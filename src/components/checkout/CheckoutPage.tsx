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

import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { Address } from '@/payload-types'
import { FormItem } from '@/components/forms/FormItem'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { NovaPoshtaOfficeSelector } from './NovaPoshtaOfficeSelector'
import type { NovaPoshtaDelivery } from '@/integrations/nova-poshta/types'
import { getProductPrice } from '@/lib/pricing'
import { WayForPayPayment } from './WayForPayPayment'

type PaymentData = {
  orderReference: string
  publicToken: string
  widget: Record<string, unknown> & { orderReference: string }
}

type ContactInformation = Pick<Address, 'fatherName' | 'firstName' | 'lastName' | 'phone'>

export const CheckoutPage: React.FC = () => {
  const router = useRouter()
  const { cart } = useCart()
  const [error, setError] = useState<null | string>(null)
  /**
   * State to manage the checkout email input.
   */
  const [email, setEmail] = useState('')
  const [emailEditable, setEmailEditable] = useState(true)
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [contactInformation, setContactInformation] = useState<ContactInformation>({
    fatherName: '',
    firstName: '',
    lastName: '',
    phone: '',
  })
  const [isProcessingPayment, setProcessingPayment] = useState(false)
  const [novaPoshtaDelivery, setNovaPoshtaDelivery] = useState<NovaPoshtaDelivery>()

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
    }
  }, [contactInformation, contactInformationIsComplete, novaPoshtaDelivery])

  const canGoToPayment = Boolean(
    contactInformationIsComplete && !emailEditable && shippingAddress && novaPoshtaDelivery,
  )

  const initiatePaymentIntent = useCallback(async () => {
    try {
      if (!cart?.id || !shippingAddress || !novaPoshtaDelivery) return
      const response = await fetch('/api/wayforpay/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartID: cart.id,
          customerEmail: email.trim(),
          shippingAddress,
          novaPoshtaDelivery,
        }),
      })
      const result = (await response.json()) as PaymentData & { error?: string }
      if (!response.ok) throw new Error(result.error || 'Could not initiate payment.')
      setPaymentData(result)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Could not initiate payment.'
      setError(errorMessage)
      toast.error(errorMessage)
    }
  }, [cart?.id, email, novaPoshtaDelivery, shippingAddress])

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
        <h2 className="font-medium text-3xl">Контактна інформація</h2>
        <div className="bg-primary/5 rounded-lg p-4 ">
          <div>
            <div className="grid gap-4 mb-6 md:grid-cols-2">
              <FormItem>
                <Label htmlFor="firstName">Імʼя*</Label>
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
                <Label htmlFor="lastName">Прізвище*</Label>
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
                <Label htmlFor="fatherName">По-батькові</Label>
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
                <Label htmlFor="phone">Телефон*</Label>
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
              <Label htmlFor="email">Email</Label>
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
          disabled={Boolean(paymentData)}
          onChange={setNovaPoshtaDelivery}
          value={novaPoshtaDelivery}
        />

        {!paymentData && (
          <Button
            className="self-start"
            disabled={!canGoToPayment}
            onClick={(e) => {
              e.preventDefault()
              void initiatePaymentIntent()
            }}
          >
            Оплатити
          </Button>
        )}

        {!paymentData && error && (
          <div className="my-8">
            <Message error={error} />

            <Button
              onClick={(e) => {
                e.preventDefault()
                router.refresh()
              }}
              variant="default"
            >
              Try again
            </Button>
          </div>
        )}

        {paymentData && (
          <WayForPayPayment
            data={paymentData}
            onCancel={() => setPaymentData(null)}
            setProcessingPayment={setProcessingPayment}
          />
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
