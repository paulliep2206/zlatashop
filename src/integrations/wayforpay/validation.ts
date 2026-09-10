import type { Address } from '@/payload-types'
import { parseDelivery } from '@/integrations/nova-poshta/validation'

import type { InitiateWayForPayInput, WayForPayCallback } from './types'

const requireString = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`)
  return value.trim()
}

const normalizePhone = (value: unknown): string => {
  const phone = requireString(value, 'Phone').replace(/\D/g, '')
  if (phone.length < 9 || phone.length > 13) {
    throw new Error('Phone must contain between 9 and 13 digits.')
  }
  return phone
}

export const parseInitiateInput = (value: unknown): InitiateWayForPayInput => {
  if (!value || typeof value !== 'object') throw new Error('Invalid payment request.')
  const input = value as Record<string, unknown>
  const cartID = Number(input.cartID)
  if (!Number.isSafeInteger(cartID) || cartID <= 0) throw new Error('A valid cart is required.')

  const customerEmail = requireString(input.customerEmail, 'Customer email')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    throw new Error('A valid customer email is required.')
  }

  if (!input.shippingAddress || typeof input.shippingAddress !== 'object') {
    throw new Error('Shipping address is required.')
  }
  const address = input.shippingAddress as Record<string, unknown>
  const shippingAddress: Partial<Address> = {
    firstName: requireString(address.firstName, 'First name'),
    lastName: requireString(address.lastName, 'Last name'),
    fatherName: typeof address.fatherName === 'string' ? address.fatherName.trim() : undefined,
    phone: normalizePhone(address.phone),
    addressLine1: requireString(address.addressLine1, 'Address'),
    addressLine2:
      typeof address.addressLine2 === 'string' ? address.addressLine2.trim() : undefined,
    city: requireString(address.city, 'City'),
  }

  return {
    cartID,
    customerEmail,
    shippingAddress,
    novaPoshtaDelivery: parseDelivery(input.novaPoshtaDelivery),
  }
}

export const parseCallback = (value: unknown): WayForPayCallback => {
  if (!value || typeof value !== 'object') throw new Error('Invalid WayForPay callback.')
  const data = value as Record<string, unknown>
  return {
    merchantAccount: requireString(data.merchantAccount, 'Merchant account'),
    orderReference: requireString(data.orderReference, 'Order reference'),
    merchantSignature: requireString(data.merchantSignature, 'Merchant signature'),
    amount: typeof data.amount === 'number' ? data.amount : requireString(data.amount, 'Amount'),
    currency: requireString(data.currency, 'Currency'),
    transactionStatus: requireString(data.transactionStatus, 'Transaction status'),
    authCode: typeof data.authCode === 'string' ? data.authCode : undefined,
    email: typeof data.email === 'string' ? data.email : undefined,
    phone: typeof data.phone === 'string' ? data.phone : undefined,
    createdDate: typeof data.createdDate === 'number' ? data.createdDate : undefined,
    processingDate: typeof data.processingDate === 'number' ? data.processingDate : undefined,
    cardPan: typeof data.cardPan === 'string' ? data.cardPan : undefined,
    cardType: typeof data.cardType === 'string' ? data.cardType : undefined,
    issuerBankCountry:
      typeof data.issuerBankCountry === 'string' ? data.issuerBankCountry : undefined,
    issuerBankName: typeof data.issuerBankName === 'string' ? data.issuerBankName : undefined,
    reason: typeof data.reason === 'string' ? data.reason : undefined,
    reasonCode:
      typeof data.reasonCode === 'string' || typeof data.reasonCode === 'number'
        ? data.reasonCode
        : undefined,
    fee: typeof data.fee === 'string' || typeof data.fee === 'number' ? data.fee : undefined,
    paymentSystem: typeof data.paymentSystem === 'string' ? data.paymentSystem : undefined,
  }
}
