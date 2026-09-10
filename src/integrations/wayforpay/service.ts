import { getWayForPayConfig } from './config'
import { signStatusRequest, verifyCallbackSignature } from './signatures'
import { parseCallback } from './validation'
import type { WayForPayStatusResponse } from './types'

export const checkWayForPayStatus = async (
  orderReference: string,
): Promise<WayForPayStatusResponse> => {
  const config = getWayForPayConfig()
  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactionType: 'CHECK_STATUS',
      merchantAccount: config.merchantAccount,
      orderReference,
      merchantSignature: signStatusRequest(
        config.merchantAccount,
        orderReference,
        config.secretKey,
      ),
      apiVersion: 1,
    }),
  })
  if (!response.ok) throw new Error(`WayForPay status request failed (${response.status}).`)

  const status = parseCallback(await response.json())
  if (
    status.orderReference !== orderReference ||
    status.merchantAccount !== config.merchantAccount
  ) {
    throw new Error('WayForPay returned a status for a different payment.')
  }
  if (!verifyCallbackSignature(status, config.secretKey)) {
    throw new Error('WayForPay status signature is invalid.')
  }
  return status
}
