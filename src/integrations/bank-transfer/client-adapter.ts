import type { PaymentAdapterClient } from '@payloadcms/plugin-ecommerce/types'

export const bankTransferAdapterClient = (): PaymentAdapterClient => ({
  name: 'bankTransfer',
  label: 'Оплатити за реквізитами',
  initiatePayment: true,
  confirmOrder: true,
})
