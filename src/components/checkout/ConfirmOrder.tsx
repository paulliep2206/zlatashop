'use client'

import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useCart, usePayments } from '@payloadcms/plugin-ecommerce/client/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { NOVA_POSHTA_DELIVERY_STORAGE_KEY } from '@/components/checkout/NovaPoshtaOfficeSelector'
import { useState } from 'react'
import { Message } from '@/components/Message'

export const ConfirmOrder: React.FC = () => {
  const { confirmOrder } = usePayments()
  const { cart } = useCart()

  const searchParams = useSearchParams()
  const router = useRouter()
  // Ensure we only confirm the order once, even if the component re-renders
  const isConfirming = useRef(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!cart || !cart.items || cart.items?.length === 0) {
      return
    }

    const merchantOrderID = searchParams.get('liqpay_order_id')
    const email = searchParams.get('email')

    if (merchantOrderID) {
      if (!isConfirming.current) {
        isConfirming.current = true

        const placeOrder = async () => {
          try {
            const result = await confirmOrder('liqpay', {
              additionalData: {
                merchantOrderID,
                ...(email ? { customerEmail: email } : {}),
              },
            })

            if (result && typeof result === 'object' && 'orderID' in result && result.orderID) {
              const accessToken = 'accessToken' in result ? (result.accessToken as string) : ''
              const queryParams = new URLSearchParams()

              if (email) {
                queryParams.set('email', email)
              }
              if (accessToken) {
                queryParams.set('accessToken', accessToken)
              }

              const queryString = queryParams.toString()
              sessionStorage.removeItem(NOVA_POSHTA_DELIVERY_STORAGE_KEY)
              router.push(`/orders/${result.orderID}${queryString ? `?${queryString}` : ''}`)
            } else if (
              result &&
              typeof result === 'object' &&
              'paymentStatus' in result &&
              result.paymentStatus === 'pending'
            ) {
              isConfirming.current = false
              setError('Payment is still being confirmed. Please try again in a moment.')
            } else {
              isConfirming.current = false
              setError('Payment was not completed.')
            }
          } catch (error) {
            isConfirming.current = false
            setError(error instanceof Error ? error.message : 'Could not confirm the order.')
          }
        }

        void placeOrder()
      }
    } else {
      // If no LiqPay order ID is found, redirect to the home
      router.push('/')
    }
  }, [cart, confirmOrder, router, searchParams])

  return (
    <div className="text-center w-full flex flex-col items-center justify-start gap-4">
      <h1 className="text-2xl">Confirming Order</h1>

      {error ? <Message error={error} /> : <LoadingSpinner className="w-12 h-6" />}
    </div>
  )
}
