import type { PaymentAdapterClient } from '@payloadcms/plugin-ecommerce/types'

export const liqpayAdapterClient = (): PaymentAdapterClient => ({
  name: 'liqpay',
  label: 'LiqPay',
  initiatePayment: true,
  confirmOrder: true,
})
