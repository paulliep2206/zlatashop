import { randomUUID } from 'node:crypto'
import type { Payload, PayloadRequest } from 'payload'

import type { Cart, User } from '@/payload-types'
import { getProductPrice } from '@/lib/pricing'

import { formatMinorAmount, toMinorAmount } from './amount'
import { getWayForPayConfig } from './config'
import { signPurchase } from './signatures'
import type { InitiateWayForPayInput, WayForPayItemSnapshot, WayForPayWidgetRequest } from './types'

const productID = (product: object | number | string | null | undefined): number => {
  const value = typeof product === 'object' && product && 'id' in product ? product.id : product
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new Error('Cart contains an invalid product.')
  return parsed
}

export const createWayForPayPayment = async ({
  input,
  payload,
  req,
}: {
  input: InitiateWayForPayInput
  payload: Payload
  req?: PayloadRequest
}) => {
  const config = getWayForPayConfig()
  const cart = (await payload.findByID({
    collection: 'carts',
    id: input.cartID,
    depth: 0,
    req,
  })) as Cart
  if (!cart.items?.length || cart.purchasedAt)
    throw new Error('Cart is empty or already purchased.')

  const items: WayForPayItemSnapshot[] = []
  let amountMinor = 0
  for (const item of cart.items) {
    const id = productID(item.product)
    const quantity = item.quantity ?? 1
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Invalid cart quantity.')
    const product = await payload.findByID({
      collection: 'products',
      id,
      depth: 0,
      select: { title: true, price: true, specialPrice: true },
      req,
    })
    const price = getProductPrice(product)
    if (typeof price !== 'number') {
      throw new Error(`Product ${id} does not have a valid checkout price.`)
    }
    let priceMinor: number
    try {
      priceMinor = toMinorAmount(price)
    } catch {
      throw new Error(`Product ${id} does not have a valid checkout price.`)
    }
    items.push({ product: id, quantity, name: product.title, priceMinor })
    amountMinor += priceMinor * quantity
  }

  const orderReference = `WFP-${Date.now()}-${randomUUID().slice(0, 8)}`
  const publicToken = randomUUID()
  const providerAmount = formatMinorAmount(amountMinor)
  const payment = await payload.create({
    collection: 'wayforpay-payments',
    data: {
      orderReference,
      publicToken,
      status: 'pending',
      amountMinor,
      providerAmount,
      currency: 'UAH',
      cart: cart.id,
      ...(typeof cart.customer === 'object' && cart.customer
        ? { customer: (cart.customer as User).id }
        : typeof cart.customer === 'number'
          ? { customer: cart.customer }
          : {}),
      customerEmail: input.customerEmail,
      itemsSnapshot: items,
      shippingAddressSnapshot: input.shippingAddress,
      novaPoshtaDeliverySnapshot: input.novaPoshtaDelivery,
    },
    req,
  })

  const unsignedRequest: Omit<WayForPayWidgetRequest, 'merchantSignature'> = {
    merchantAccount: config.merchantAccount,
    merchantDomainName: config.merchantDomainName,
    authorizationType: 'SimpleSignature',
    orderReference,
    orderDate: Math.floor(Date.now() / 1000),
    amount: providerAmount,
    currency: 'UAH',
    productName: items.map((item) => item.name),
    productPrice: items.map((item) => formatMinorAmount(item.priceMinor)),
    productCount: items.map((item) => item.quantity),
    clientFirstName: input.shippingAddress.firstName!,
    clientLastName: input.shippingAddress.lastName!,
    clientEmail: input.customerEmail,
    clientPhone: input.shippingAddress.phone!,
    returnUrl: `${config.serverUrl}/checkout`,
    serviceUrl: `${config.serverUrl}/api/wayforpay/callback`,
    language: 'UA',
    paymentSystems: 'card;applePay;googlePay',
    defaultPaymentSystem: 'card',
  }

  return {
    orderReference,
    publicToken,
    paymentID: payment.id,
    widget: {
      ...unsignedRequest,
      merchantSignature: signPurchase(unsignedRequest, config.secretKey),
    },
  }
}
