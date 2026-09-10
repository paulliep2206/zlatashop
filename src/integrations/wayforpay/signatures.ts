import { createHmac, timingSafeEqual } from 'node:crypto'

import type { WayForPayCallback, WayForPayWidgetRequest } from './types'

const sign = (values: Array<number | string>, secretKey: string): string =>
  createHmac('md5', secretKey).update(values.join(';'), 'utf8').digest('hex')

export const signPurchase = (
  request: Omit<WayForPayWidgetRequest, 'merchantSignature'>,
  secretKey: string,
): string =>
  sign(
    [
      request.merchantAccount,
      request.merchantDomainName,
      request.orderReference,
      request.orderDate,
      request.amount,
      request.currency,
      ...request.productName,
      ...request.productCount,
      ...request.productPrice,
    ],
    secretKey,
  )

export const signStatusRequest = (
  merchantAccount: string,
  orderReference: string,
  secretKey: string,
): string => sign([merchantAccount, orderReference], secretKey)

export const signCallback = (callback: WayForPayCallback, secretKey: string): string =>
  sign(
    [
      callback.merchantAccount,
      callback.orderReference,
      callback.amount,
      callback.currency,
      callback.authCode ?? '',
      callback.cardPan ?? '',
      callback.transactionStatus,
      callback.reasonCode ?? '',
    ],
    secretKey,
  )

export const verifyCallbackSignature = (
  callback: WayForPayCallback,
  secretKey: string,
): boolean => {
  const expected = Buffer.from(signCallback(callback, secretKey), 'utf8')
  const received = Buffer.from(callback.merchantSignature ?? '', 'utf8')
  return expected.length === received.length && timingSafeEqual(expected, received)
}

export const createCallbackAcknowledgement = (orderReference: string, secretKey: string) => {
  const time = Math.floor(Date.now() / 1000)
  return {
    orderReference,
    status: 'accept' as const,
    time,
    signature: sign([orderReference, 'accept', time], secretKey),
  }
}
