'use client'

import { Media } from '@/components/Media'
import { Message } from '@/components/Message'
import { Price } from '@/components/Price'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useCallback, useMemo, useState } from 'react'

import { useCart, usePayments } from '@payloadcms/plugin-ecommerce/client/react'
import { Address } from '@/payload-types'
import { FormItem } from '@/components/forms/FormItem'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import {
  NOVA_POSHTA_DELIVERY_STORAGE_KEY,
  NovaPoshtaOfficeSelector,
} from './NovaPoshtaOfficeSelector'
import type { NovaPoshtaDelivery } from '@/integrations/nova-poshta/types'
import { getProductPrice } from '@/lib/pricing'

type ContactInformation = Pick<Address, 'fatherName' | 'firstName' | 'lastName' | 'phone'>
type PaymentMethod = 'liqpay' | 'bankTransfer'

export const CheckoutPage: React.FC = () => {
  const router = useRouter()
  const { cart, clearCart } = useCart()
  const [error, setError] = useState<null | string>(null)
  /**
   * State to manage the checkout email input.
   */
  const [email, setEmail] = useState('')
  const [emailEditable, setEmailEditable] = useState(true)
  const { confirmOrder, initiatePayment } = usePayments()
  const [contactInformation, setContactInformation] = useState<ContactInformation>({
    fatherName: '',
    firstName: '',
    lastName: '',
    phone: '',
  })
  const [isProcessingPayment, setProcessingPayment] = useState(false)
  const [novaPoshtaDelivery, setNovaPoshtaDelivery] = useState<NovaPoshtaDelivery>()
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('liqpay')

  const cartIsEmpty = !cart || !cart.items || !cart.items.length

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const contactInformationIsComplete = Boolean(
    emailIsValid &&
    contactInformation.firstName?.trim() &&
    contactInformation.lastName?.trim() &&
    contactInformation.phone?.trim(),
  )

  const shippingAddress = useMemo<Partial<Address> | undefined>(() => {
    if (!contactInformationIsComplete || !novaPoshtaDelivery) {
      return undefined
    }

    return {
      fatherName: contactInformation.fatherName?.trim() || undefined,
      firstName: contactInformation.firstName?.trim(),
      lastName: contactInformation.lastName?.trim(),
      phone: contactInformation.phone?.trim(),
      addressLine1: novaPoshtaDelivery.warehouse.shortAddress,
      addressLine2: `Nova Poshta office №${novaPoshtaDelivery.warehouse.number}`,
      city: novaPoshtaDelivery.warehouse.cityDescription,
      novaPoshtaDelivery,
    }
  }, [contactInformation, contactInformationIsComplete, novaPoshtaDelivery])

  const canGoToPayment = Boolean(
    contactInformationIsComplete && !emailEditable && shippingAddress && novaPoshtaDelivery,
  )

  const placeOrder = useCallback(
    async () => {
      try {
        setError(null)
        setProcessingPayment(true)
        const paymentData = (await initiatePayment(paymentMethod, {
          additionalData: {
            customerEmail: email.trim(),
            billingAddress: shippingAddress,
            shippingAddress,
          },
        })) as Record<string, unknown>

        if (paymentMethod === 'liqpay') {
          const checkoutURL = paymentData.checkoutURL
          const data = paymentData.data
          const signature = paymentData.signature
          if (
            typeof checkoutURL !== 'string' ||
            typeof data !== 'string' ||
            typeof signature !== 'string'
          ) {
            throw new Error('LiqPay checkout response is invalid.')
          }

          const form = document.createElement('form')
          form.method = 'POST'
          form.action = checkoutURL
          for (const [name, value] of Object.entries({ data, signature })) {
            const input = document.createElement('input')
            input.type = 'hidden'
            input.name = name
            input.value = value
            form.appendChild(input)
          }
          document.body.appendChild(form)
          form.submit()
          return
        }

        if (typeof paymentData.referenceID !== 'string') {
          throw new Error('Bank-transfer checkout response is invalid.')
        }
        const result = (await confirmOrder('bankTransfer', {
          additionalData: {
            customerEmail: email.trim(),
            referenceID: paymentData.referenceID,
          },
        })) as Record<string, unknown>
        if (typeof result.orderID !== 'number') throw new Error('Order was not created.')

        const params = new URLSearchParams({ email: email.trim() })
        if (typeof result.accessToken === 'string') params.set('accessToken', result.accessToken)
        await clearCart()
        sessionStorage.removeItem(NOVA_POSHTA_DELIVERY_STORAGE_KEY)
        router.push(`/orders/${result.orderID}?${params.toString()}`)
      } catch (error) {
        let errorData: { cause?: { code?: string } } = {}
        if (error instanceof Error) {
          try {
            errorData = JSON.parse(error.message) as typeof errorData
          } catch {
            // The provider may return a plain error message.
          }
        }
        let errorMessage = 'An error occurred while initiating payment.'

        if (errorData?.cause?.code === 'OutOfStock') {
          errorMessage = 'One or more items in your cart are out of stock.'
        }

        setError(errorMessage)
        toast.error(errorMessage)
        setProcessingPayment(false)
      }
    },
    [clearCart, confirmOrder, email, initiatePayment, paymentMethod, router, shippingAddress],
  )

  if (cartIsEmpty && isProcessingPayment) {
    return (
      <div className="py-12 w-full items-center justify-center">
        <div className="prose dark:prose-invert text-center max-w-none self-center mb-8">
          <p>Processing your payment...</p>
        </div>
        <LoadingSpinner />
      </div>
    )
  }

  if (cartIsEmpty) {
    return (
      <div className="prose dark:prose-invert py-12 w-full items-center">
        <p>Your cart is empty.</p>
        <Link href="/search">Continue shopping?</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-stretch justify-stretch my-8 md:flex-row grow gap-10 md:gap-6 lg:gap-8">
      <div className="basis-full lg:basis-2/3 flex flex-col gap-8 justify-stretch">
        <h2 className="font-medium text-3xl">Contact</h2>
        <div className="bg-accent dark:bg-black rounded-lg p-4 ">
          <div>
            <p className="mb-4">Enter your contact information to continue to checkout.</p>

            <div className="grid gap-4 mb-6 md:grid-cols-2">
              <FormItem>
                <Label htmlFor="firstName">First name*</Label>
                <Input
                  disabled={!emailEditable}
                  id="firstName"
                  name="firstName"
                  onChange={(event) =>
                    setContactInformation((contact) => ({
                      ...contact,
                      firstName: event.target.value,
                    }))
                  }
                  required
                  value={contactInformation.firstName ?? ''}
                />
              </FormItem>

              <FormItem>
                <Label htmlFor="lastName">Last name*</Label>
                <Input
                  disabled={!emailEditable}
                  id="lastName"
                  name="lastName"
                  onChange={(event) =>
                    setContactInformation((contact) => ({
                      ...contact,
                      lastName: event.target.value,
                    }))
                  }
                  required
                  value={contactInformation.lastName ?? ''}
                />
              </FormItem>

              <FormItem>
                <Label htmlFor="fatherName">Father name</Label>
                <Input
                  disabled={!emailEditable}
                  id="fatherName"
                  name="fatherName"
                  onChange={(event) =>
                    setContactInformation((contact) => ({
                      ...contact,
                      fatherName: event.target.value,
                    }))
                  }
                  value={contactInformation.fatherName ?? ''}
                />
              </FormItem>

              <FormItem>
                <Label htmlFor="phone">Phone number*</Label>
                <Input
                  autoComplete="tel"
                  disabled={!emailEditable}
                  id="phone"
                  name="phone"
                  onChange={(event) =>
                    setContactInformation((contact) => ({
                      ...contact,
                      phone: event.target.value,
                    }))
                  }
                  required
                  type="tel"
                  value={contactInformation.phone ?? ''}
                />
              </FormItem>
            </div>

            <FormItem className="mb-6">
              <Label htmlFor="email">Email Address</Label>
              <Input
                disabled={!emailEditable}
                id="email"
                name="email"
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
              />
            </FormItem>

            <Button
              disabled={!contactInformationIsComplete || !emailEditable}
              onClick={(e) => {
                e.preventDefault()
                setEmailEditable(false)
              }}
              variant="default"
            >
              Continue
            </Button>
          </div>
        </div>

        <NovaPoshtaOfficeSelector
          disabled={isProcessingPayment}
          onChange={setNovaPoshtaDelivery}
          value={novaPoshtaDelivery}
        />

        <div className="flex flex-col gap-3 rounded-lg bg-accent p-4 dark:bg-black">
          <h2 className="text-2xl font-medium">Payment</h2>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              checked={paymentMethod === 'liqpay'}
              disabled={isProcessingPayment}
              name="paymentMethod"
              onChange={() => setPaymentMethod('liqpay')}
              type="radio"
              value="liqpay"
            />
            <span>LiqPay</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              checked={paymentMethod === 'bankTransfer'}
              disabled={isProcessingPayment}
              name="paymentMethod"
              onChange={() => setPaymentMethod('bankTransfer')}
              type="radio"
              value="bankTransfer"
            />
            <span>Оплатити за реквізитами</span>
          </label>
        </div>

        <Button
          className="self-start"
          disabled={!canGoToPayment || isProcessingPayment}
          onClick={(e) => {
            e.preventDefault()
            void placeOrder()
          }}
        >
          {isProcessingPayment ? 'Processing...' : 'Place order'}
        </Button>

        {error && (
          <div className="my-8">
            <Message error={error} />

            <Button
              onClick={(e) => {
                e.preventDefault()
                setError(null)
              }}
              variant="default"
            >
              Try again
            </Button>
          </div>
        )}
      </div>

      {!cartIsEmpty && (
        <div className="basis-full lg:basis-1/3 lg:pl-8 p-8 border-none bg-primary/5 flex flex-col gap-8 rounded-lg">
          <h2 className="text-3xl font-medium">Your cart</h2>
          {cart?.items?.map((item, index) => {
            if (typeof item.product === 'object' && item.product) {
              const {
                product,
                product: { id, meta, title, gallery },
                quantity,
              } = item

              if (!quantity) return null

              let image = gallery?.[0]?.image || meta?.image
              const price = getProductPrice(product)

              return (
                <div className="flex items-start gap-4" key={index}>
                  <div className="flex items-stretch justify-stretch h-20 w-20 p-2 rounded-lg border">
                    <div className="relative w-full h-full">
                      {image && typeof image !== 'string' && (
                        <Media className="" fill imgClassName="rounded-lg" resource={image} />
                      )}
                    </div>
                  </div>
                  <div className="flex grow justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <p className="font-medium text-lg">{title}</p>
                      <div>
                        {'x'}
                        {quantity}
                      </div>
                    </div>

                    {typeof price === 'number' && <Price amount={price} />}
                  </div>
                </div>
              )
            }
            return null
          })}
          <hr />
          <div className="flex justify-between items-center gap-2">
            <span className="uppercase">Total</span>{' '}
            <Price className="text-3xl font-medium" amount={cart.subtotal || 0} />
          </div>
        </div>
      )}
    </div>
  )
}
