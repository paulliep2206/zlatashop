import type { Payload, PayloadRequest } from 'payload'

import type { Address, WayforpayPayment } from '@/payload-types'
import { fulfillNovaPoshtaOrder } from '@/integrations/nova-poshta/fulfillment'
import { parseDelivery } from '@/integrations/nova-poshta/validation'

import { amountsMatch, fromMinorAmount } from './amount'
import type { WayForPayCallback, WayForPayItemSnapshot } from './types'

const relationshipID = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'number') {
    return value.id
  }
}

export const findWayForPayPayment = async (
  payload: Payload,
  orderReference: string,
  req?: PayloadRequest,
): Promise<WayforpayPayment> => {
  const result = await payload.find({
    collection: 'wayforpay-payments',
    where: { orderReference: { equals: orderReference } },
    limit: 1,
    depth: 0,
    req,
  })
  const payment = result.docs[0]
  if (!payment) throw new Error('Payment was not found.')
  return payment
}

export const applyWayForPayResult = async ({
  callback,
  payload,
  req,
}: {
  callback: WayForPayCallback
  payload: Payload
  req: PayloadRequest
}) => {
  const payment = await findWayForPayPayment(payload, callback.orderReference, req)
  if (!amountsMatch(callback.amount, payment.amountMinor) || callback.currency !== 'UAH') {
    throw new Error('WayForPay amount or currency does not match the payment.')
  }

  const normalizedStatus = callback.transactionStatus.toLowerCase()
  const approved = normalizedStatus === 'approved'
  const pending = normalizedStatus === 'pending' || normalizedStatus === 'inprocessing'
  const maskedCardPan = callback.cardPan?.includes('*') ? callback.cardPan : undefined
  const status =
    payment.status === 'finalizing' || payment.order
      ? payment.status
      : approved
        ? 'approved'
        : pending
          ? 'pending'
          : 'declined'
  const safeProviderResponse = {
    merchantAccount: callback.merchantAccount,
    orderReference: callback.orderReference,
    amount: callback.amount,
    currency: callback.currency,
    transactionStatus: callback.transactionStatus,
    reason: callback.reason,
    reasonCode: callback.reasonCode,
    authCode: callback.authCode,
    paymentSystem: callback.paymentSystem,
    cardPan: maskedCardPan,
    cardType: callback.cardType,
    processingDate: callback.processingDate,
  }

  await payload.update({
    collection: 'wayforpay-payments',
    id: payment.id,
    data: {
      status,
      transactionStatus: callback.transactionStatus,
      reason: callback.reason,
      reasonCode: callback.reasonCode == null ? undefined : String(callback.reasonCode),
      authCode: callback.authCode,
      paymentSystem: callback.paymentSystem,
      cardPan: maskedCardPan,
      cardType: callback.cardType,
      processingDate: callback.processingDate
        ? new Date(callback.processingDate * 1000).toISOString()
        : undefined,
      callbackReceivedAt: new Date().toISOString(),
      providerResponse: safeProviderResponse,
    },
    req,
  })

  if (!approved || payment.status === 'finalizing') return { paymentStatus: status }
  const existingOrderID = relationshipID(payment.order)
  if (existingOrderID) return { paymentStatus: 'approved', orderID: existingOrderID }
  return finalizeWayForPayOrder({ paymentID: payment.id, payload, req })
}

export const finalizeWayForPayOrder = async ({
  paymentID,
  payload,
  req,
}: {
  paymentID: number
  payload: Payload
  req: PayloadRequest
}) => {
  let payment = await payload.findByID({
    collection: 'wayforpay-payments',
    id: paymentID,
    depth: 0,
    req,
  })
  const existingOrderID = relationshipID(payment.order)
  if (existingOrderID) return { paymentStatus: 'approved', orderID: existingOrderID }
  if (payment.status !== 'approved') return { paymentStatus: payment.status }

  const claim = await payload.update({
    collection: 'wayforpay-payments',
    where: { and: [{ id: { equals: payment.id } }, { status: { equals: 'approved' } }] },
    data: { status: 'finalizing' },
    req,
  })
  if (!claim.docs.length) return { paymentStatus: 'finalizing' }
  payment = claim.docs[0]

  try {
    const items = payment.itemsSnapshot as unknown as WayForPayItemSnapshot[]
    const shippingAddress = payment.shippingAddressSnapshot as Partial<Address>
    const delivery = parseDelivery(payment.novaPoshtaDeliverySnapshot)
    const cartID = relationshipID(payment.cart)
    if (!Array.isArray(items) || !items.length || !cartID)
      throw new Error('Payment snapshot is invalid.')

    const order = await payload.create({
      collection: 'orders',
      data: {
        amount: fromMinorAmount(payment.amountMinor),
        currency: 'UAH',
        ...(relationshipID(payment.customer)
          ? { customer: relationshipID(payment.customer) }
          : { customerEmail: payment.customerEmail }),
        items: items.map(({ product, quantity }) => ({ product, quantity })),
        shippingAddress,
        status: 'processing',
      },
      req,
    })

    await payload.update({
      collection: 'carts',
      id: cartID,
      data: { purchasedAt: new Date().toISOString(), status: 'purchased' },
      req,
    })
    await payload.update({
      collection: 'wayforpay-payments',
      id: payment.id,
      data: { order: order.id, status: 'approved', finalizedAt: new Date().toISOString() },
      req,
    })
    await fulfillNovaPoshtaOrder({ delivery, orderID: order.id, req })

    return {
      paymentStatus: 'approved',
      orderID: order.id,
      accessToken: order.accessToken ?? undefined,
    }
  } catch (error) {
    await payload.update({
      collection: 'wayforpay-payments',
      id: payment.id,
      data: { status: 'approved' },
      req,
    })
    throw error
  }
}
