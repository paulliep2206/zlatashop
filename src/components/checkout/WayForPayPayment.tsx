'use client'

import { Button } from '@/components/ui/button'
import { Message } from '@/components/Message'
import { NOVA_POSHTA_DELIVERY_STORAGE_KEY } from '@/components/checkout/NovaPoshtaOfficeSelector'
import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'

type WidgetRequest = Record<string, unknown> & { orderReference: string }
type PaymentData = { orderReference: string; publicToken: string; widget: WidgetRequest }

type WayForPayWidget = {
  run: (
    request: WidgetRequest,
    approved: () => void,
    declined: (response: { reason?: string }) => void,
    pending: () => void,
  ) => void
}

declare global {
  interface Window {
    Wayforpay?: new () => WayForPayWidget
  }
}

const SCRIPT_ID = 'wayforpay-widget-script'

export const WayForPayPayment: React.FC<{
  data: PaymentData
  onCancel: () => void
  setProcessingPayment: (processing: boolean) => void
}> = ({ data, onCancel, setProcessingPayment }) => {
  const router = useRouter()
  const { clearCart } = useCart()
  const [error, setError] = useState<string>()
  const [status, setStatus] = useState('Opening secure payment…')
  const opened = useRef(false)

  const finish = useCallback(
    async (result: Record<string, unknown>) => {
      if (!result.orderID) return false
      const query = new URLSearchParams()
      if (result.customerEmail) query.set('email', String(result.customerEmail))
      if (result.accessToken) query.set('accessToken', String(result.accessToken))
      await clearCart()
      sessionStorage.removeItem(NOVA_POSHTA_DELIVERY_STORAGE_KEY)
      router.push(`/orders/${String(result.orderID)}${query.size ? `?${query}` : ''}`)
      return true
    },
    [clearCart, router],
  )

  const poll = useCallback(async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const response = await fetch(
        `/api/wayforpay/status/${encodeURIComponent(data.orderReference)}?token=${encodeURIComponent(data.publicToken)}`,
      )
      const result = (await response.json()) as Record<string, unknown>
      if (response.ok && (await finish(result))) return
      if (
        result.status === 'declined' ||
        result.status === 'failed' ||
        result.status === 'expired'
      ) {
        throw new Error(typeof result.reason === 'string' ? result.reason : 'Payment was declined.')
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1500))
    }
    throw new Error('Payment is still processing. Please check your order status shortly.')
  }, [data.orderReference, data.publicToken, finish])

  const confirm = useCallback(async () => {
    setProcessingPayment(true)
    setStatus('Confirming your payment…')
    const response = await fetch('/api/wayforpay/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderReference: data.orderReference, publicToken: data.publicToken }),
    })
    const result = (await response.json()) as Record<string, unknown>
    if (!response.ok) throw new Error(String(result.error ?? 'Could not confirm payment.'))
    if (!(await finish(result))) await poll()
  }, [data.orderReference, data.publicToken, finish, poll, setProcessingPayment])

  useEffect(() => {
    if (opened.current) return
    const openWidget = () => {
      if (!window.Wayforpay || opened.current) return
      opened.current = true
      const widget = new window.Wayforpay()
      widget.run(
        data.widget,
        () =>
          void confirm().catch((reason) =>
            setError(reason instanceof Error ? reason.message : String(reason)),
          ),
        (response) => {
          setProcessingPayment(false)
          setError(response.reason || 'Payment was declined.')
        },
        () => {
          setProcessingPayment(true)
          setStatus('Payment is processing…')
          void poll().catch((reason) =>
            setError(reason instanceof Error ? reason.message : String(reason)),
          )
        },
      )
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      if (window.Wayforpay) openWidget()
      else existing.addEventListener('load', openWidget, { once: true })
      return
    }
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = 'https://secure.wayforpay.com/server/pay-widget.js'
    script.async = true
    script.addEventListener('load', openWidget, { once: true })
    script.addEventListener('error', () => setError('Could not load the secure payment form.'), {
      once: true,
    })
    document.head.appendChild(script)
  }, [confirm, data.widget, poll, setProcessingPayment])

  return (
    <div className="flex flex-col items-start gap-4 pb-16">
      <h2 className="font-medium text-3xl">Payment</h2>
      {error ? <Message error={error} /> : <p>{status}</p>}
      <div className="flex gap-3">
        {error && <Button onClick={() => window.location.reload()}>Try again</Button>}
        <Button variant="ghost" onClick={onCancel}>
          Cancel payment
        </Button>
      </div>
    </div>
  )
}
