import { randomUUID } from 'node:crypto'
import type { Payload, PayloadRequest, Where } from 'payload'

import type { Cart } from '@/payload-types'
import { getProductPrice } from '@/lib/pricing'

import { formatMinorAmount, toMinorAmount } from './amount'
import { getWayForPayConfig, getWayForPayRolloutConfig } from './config'
import { signPurchase } from './signatures'
import type { InitiateWayForPayInput, WayForPayItemSnapshot, WayForPayWidgetRequest } from './types'

export class CartAuthorizationError extends Error {
  constructor() {
    super('Cart not found.')
    this.name = 'CartAuthorizationError'
  }
}

export const getPaymentInitiationError = (error: unknown) =>
  error instanceof CartAuthorizationError
    ? { body: { error: 'Cart not found.' }, status: 404 }
    : { body: { error: 'Could not initiate payment.' }, status: 400 }

const invalidCheckout = (): never => {
  throw new Error('Could not initiate payment.')
}

const productID = (product: object | number | string | null | undefined): number => {
  const value = typeof product === 'object' && product && 'id' in product ? product.id : product
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) invalidCheckout()
  return parsed
}

const findAuthorizedCart = async ({
  cartID,
  cartSecret,
  payload,
  req,
}: {
  cartID: number
  cartSecret?: string
  payload: Payload
  req: PayloadRequest
}): Promise<{ authorization: 'customer' | 'guest'; cart: Cart }> => {
  const userID = req.user?.id

  if (userID !== undefined && userID !== null) {
    const owned = await payload.find({
      collection: 'carts',
      depth: 0,
      limit: 1,
      overrideAccess: false,
      req,
      where: { and: [{ id: { equals: cartID } }, { customer: { equals: userID } }] },
    })
    if (owned.docs.length === 1) {
      return { authorization: 'customer', cart: owned.docs[0] as Cart }
    }
  }

  if (cartSecret) {
    const guestReq = {
      ...req,
      context: { ...req.context, cartSecret },
      user: null,
    } as PayloadRequest
    const guestWhere: Where = {
      and: [{ id: { equals: cartID } }, { customer: { exists: false } }],
    }
    const guest = await payload.find({
      collection: 'carts',
      depth: 0,
      limit: 1,
      overrideAccess: false,
      req: guestReq,
      where: guestWhere,
    })
    if (guest.docs.length === 1) {
      return { authorization: 'guest', cart: guest.docs[0] as Cart }
    }
  }

  throw new CartAuthorizationError()
}

export const createWayForPayPayment = async ({
  input,
  payload,
  req,
}: {
  input: InitiateWayForPayInput
  payload: Payload
  req: PayloadRequest
}) => {
  const { authorization, cart } = await findAuthorizedCart({
    cartID: input.cartID,
    cartSecret: input.cartSecret,
    payload,
    req,
  })
  if (!cart.items?.length || cart.purchasedAt) invalidCheckout()
  const cartItems = cart.items!

  const items: WayForPayItemSnapshot[] = []
  let amountMinor = 0
  let hasPhysical = false
  let hasVirtual = false

  for (const item of cartItems) {
    const id = productID(item.product)
    const quantityValue = item.quantity
    if (!Number.isSafeInteger(quantityValue) || !quantityValue || quantityValue <= 0)
      invalidCheckout()
    const quantity = quantityValue as number

    const product: {
      _status?: 'draft' | 'published' | null
      id: number
      price?: number | null
      productType?: 'configurable' | 'simple' | 'virtual' | null
      specialPrice?: number | null
      stock?: number | null
      stockStatus?: 'in_stock' | 'out_stock' | 'presell' | null
      title: string
    } = await payload
      .findByID({
        collection: 'products',
        id,
        depth: 0,
        overrideAccess: true,
        select: {
          _status: true,
          title: true,
          price: true,
          specialPrice: true,
          productType: true,
          stock: true,
          stockStatus: true,
        },
        req,
      })
      .catch(() => invalidCheckout())

    if (product._status !== 'published') invalidCheckout()
    if (product.productType === 'virtual') {
      hasVirtual = true
    } else if (product.productType === 'simple' || product.productType === 'configurable') {
      hasPhysical = true
      if (
        (product.stockStatus !== 'in_stock' && product.stockStatus !== 'presell') ||
        !Number.isSafeInteger(product.stock) ||
        !product.stock ||
        product.stock < quantity
      )
        invalidCheckout()
    } else {
      invalidCheckout()
    }

    const price = getProductPrice(product)
    if (typeof price !== 'number') invalidCheckout()
    const priceValue = price as number
    const priceMinor = (() => {
      try {
        return toMinorAmount(priceValue)
      } catch {
        return invalidCheckout()
      }
    })()
    const itemTotal = priceMinor * quantity
    if (!Number.isSafeInteger(itemTotal) || !Number.isSafeInteger(amountMinor + itemTotal)) {
      invalidCheckout()
    }
    items.push({ product: id, quantity, name: product.title, priceMinor })
    amountMinor += itemTotal
  }

  const rollout = getWayForPayRolloutConfig()
  if (hasVirtual && authorization !== 'guest') invalidCheckout()
  if (
    (hasVirtual && hasPhysical && !rollout.allowMixedCarts) ||
    (hasVirtual && !hasPhysical && !rollout.allowVirtualOnlyCarts)
  )
    invalidCheckout()

  const config = getWayForPayConfig()
  const orderReference = `WFP-${Date.now()}-${randomUUID().slice(0, 8)}`
  const publicToken = randomUUID()
  const providerAmount = formatMinorAmount(amountMinor)
  const customerID =
    typeof cart.customer === 'object' && cart.customer
      ? cart.customer.id
      : typeof cart.customer === 'number'
        ? cart.customer
        : undefined
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
      ...(customerID ? { customer: customerID } : {}),
      customerEmail: input.customerEmail,
      itemsSnapshot: items,
      shippingAddressSnapshot: input.shippingAddress,
      novaPoshtaDeliverySnapshot: input.novaPoshtaDelivery,
    },
    overrideAccess: true,
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
