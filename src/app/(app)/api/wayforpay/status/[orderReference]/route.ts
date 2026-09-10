import config from '@payload-config'
import { getPayload } from 'payload'

import { findWayForPayPayment } from '@/integrations/wayforpay/finalize'

export async function GET(
  request: Request,
  context: { params: Promise<{ orderReference: string }> },
): Promise<Response> {
  try {
    const { orderReference } = await context.params
    const publicToken = new URL(request.url).searchParams.get('token')
    const payload = await getPayload({ config })
    const payment = await findWayForPayPayment(payload, orderReference)
    if (!publicToken || payment.publicToken !== publicToken) {
      return Response.json({ error: 'Payment was not found.' }, { status: 404 })
    }
    const order =
      typeof payment.order === 'number'
        ? await payload.findByID({ collection: 'orders', id: payment.order, depth: 0 })
        : payment.order
    return Response.json({
      status: payment.status,
      orderID: order?.id,
      accessToken: order?.accessToken,
      customerEmail: payment.customerEmail,
      reason: payment.reason,
    })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not read payment.' },
      { status: 400 },
    )
  }
}
