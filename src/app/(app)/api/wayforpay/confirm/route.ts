import config from '@payload-config'
import { createLocalReq, getPayload } from 'payload'

import { applyWayForPayResult, findWayForPayPayment } from '@/integrations/wayforpay/finalize'
import { checkWayForPayStatus } from '@/integrations/wayforpay/service'

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { orderReference?: string; publicToken?: string }
    if (!body.orderReference || !body.publicToken) throw new Error('Payment reference is required.')
    const payload = await getPayload({ config })
    const req = await createLocalReq({ req: { headers: request.headers } }, payload)
    const payment = await findWayForPayPayment(payload, body.orderReference, req)
    if (payment.publicToken !== body.publicToken) {
      return Response.json({ error: 'Payment was not found.' }, { status: 404 })
    }
    const status = await checkWayForPayStatus(body.orderReference)
    const result = await applyWayForPayResult({ callback: status, payload, req })
    return Response.json(result)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not confirm payment.' },
      { status: 400 },
    )
  }
}
