export const LIQPAY_IMMEDIATE_PAYTYPES = [
  'apay',
  'gpay',
  'card',
  'privat24',
  'moment_part',
  'paypart',
  'qr',
] as const

export type LiqPayPaytype = (typeof LIQPAY_IMMEDIATE_PAYTYPES)[number]

export type LiqPayCheckoutRequest = {
  action: 'pay'
  amount: number
  currency: 'UAH'
  description: string
  language: 'uk'
  order_id: string
  paytypes: string
  public_key: string
  result_url: string
  server_url: string
  version: number
}

export type LiqPayCallback = {
  action?: string
  amount?: number
  currency?: string
  liqpay_order_id?: string
  order_id?: string
  payment_id?: number
  paytype?: string
  public_key?: string
  status?: string
}

export type LiqPayPaymentStatus = LiqPayCallback & {
  err_code?: string
  err_description?: string
  result?: string
}

export type LiqPayTransactionData = {
  finalizationState?: 'pending' | 'finalizing' | 'finalized' | 'failed'
  lastCallbackAt?: string
  liqpayOrderID?: string
  merchantOrderID: string
  paymentID?: string
  paytype?: string
  providerStatus?: string
}
