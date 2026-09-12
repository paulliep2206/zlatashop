import type { Address } from '@/payload-types'
import type { NovaPoshtaDelivery } from '@/integrations/nova-poshta/types'

export type WayForPayItemSnapshot = {
  product: number
  quantity: number
  name: string
  priceMinor: number
}

export type InitiateWayForPayInput = {
  cartID: number
  cartSecret?: string
  customerEmail: string
  shippingAddress: Partial<Address>
  novaPoshtaDelivery: NovaPoshtaDelivery
}

export type WayForPayWidgetRequest = {
  merchantAccount: string
  merchantDomainName: string
  authorizationType: 'SimpleSignature'
  merchantSignature: string
  orderReference: string
  orderDate: number
  amount: string
  currency: 'UAH'
  productName: string[]
  productPrice: string[]
  productCount: number[]
  clientFirstName: string
  clientLastName: string
  clientEmail: string
  clientPhone: string
  returnUrl: string
  serviceUrl: string
  language: 'UA'
  paymentSystems: 'card;applePay;googlePay'
  defaultPaymentSystem: 'card'
}

export type WayForPayCallback = {
  merchantAccount: string
  orderReference: string
  merchantSignature: string
  amount: string | number
  currency: string
  authCode?: string
  email?: string
  phone?: string
  createdDate?: number
  processingDate?: number
  cardPan?: string
  cardType?: string
  issuerBankCountry?: string
  issuerBankName?: string
  recToken?: string
  transactionStatus: string
  reason?: string
  reasonCode?: string | number
  fee?: string | number
  paymentSystem?: string
}

export type WayForPayStatusResponse = WayForPayCallback
