import config from '@payload-config'
import { createLocalReq, getPayload } from 'payload'

import {
  createWayForPayPayment,
  getPaymentInitiationError,
} from '@/integrations/wayforpay/initiate'
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
    const { body, status } = getPaymentInitiationError(error)
    return Response.json(body, { status })
  }
}
