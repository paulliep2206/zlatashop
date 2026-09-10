import config from '@payload-config'
import { createLocalReq, getPayload } from 'payload'

import { createWayForPayPayment } from '@/integrations/wayforpay/initiate'
import { parseInitiateInput } from '@/integrations/wayforpay/validation'

export async function POST(request: Request): Promise<Response> {
  try {
    const payload = await getPayload({ config })
    const req = await createLocalReq({ req: { headers: request.headers } }, payload)
    const result = await createWayForPayPayment({
      input: parseInitiateInput(await request.json()),
      payload,
      req,
    })
    return Response.json(result)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not initiate payment.' },
      { status: 400 },
    )
  }
}
