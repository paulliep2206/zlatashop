import config from '@payload-config'
import { createLocalReq, getPayload } from 'payload'

import { applyWayForPayResult } from '@/integrations/wayforpay/finalize'
import { getWayForPayConfig } from '@/integrations/wayforpay/config'
import {
  createCallbackAcknowledgement,
  verifyCallbackSignature,
} from '@/integrations/wayforpay/signatures'
import { parseCallback } from '@/integrations/wayforpay/validation'

export async function POST(request: Request): Promise<Response> {
  try {
    const wayForPayConfig = getWayForPayConfig()
    const contentType = request.headers.get('content-type') ?? ''
    const callback = parseCallback(
      contentType.includes('application/json')
        ? await request.json()
        : Object.fromEntries(new URLSearchParams(await request.text())),
    )
    if (callback.merchantAccount !== wayForPayConfig.merchantAccount) {
      return Response.json({ error: 'Unknown merchant.' }, { status: 401 })
    }
    if (!verifyCallbackSignature(callback, wayForPayConfig.secretKey)) {
      return Response.json({ error: 'Invalid signature.' }, { status: 401 })
    }

    const payload = await getPayload({ config })
    const req = await createLocalReq({ req: { headers: request.headers } }, payload)
    await applyWayForPayResult({ callback, payload, req })
    return Response.json(
      createCallbackAcknowledgement(callback.orderReference, wayForPayConfig.secretKey),
    )
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not process callback.' },
      { status: 400 },
    )
  }
}
