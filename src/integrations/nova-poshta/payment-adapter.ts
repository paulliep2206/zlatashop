import type { PaymentAdapter } from '@payloadcms/plugin-ecommerce/types'

import { createNovaPoshtaService } from '.'
import { fulfillNovaPoshtaOrder } from './fulfillment'
import { parseDelivery } from './validation'

type AdapterOptions = {
  baseAdapter: PaymentAdapter
  createService?: typeof createNovaPoshtaService
  createWaybillOnOrder?: boolean
}

type OrderResult = Awaited<ReturnType<PaymentAdapter['confirmOrder']>>

export const withNovaPoshta = ({
  baseAdapter,
  createService = createNovaPoshtaService,
  createWaybillOnOrder = process.env.NOVA_POSHTA_CREATE_WAYBILL_ON_ORDER === 'true',
}: AdapterOptions): PaymentAdapter => ({
  ...baseAdapter,
  confirmOrder: async (args): Promise<OrderResult> => {
    const delivery = parseDelivery(args.data.novaPoshtaDelivery)
    const result = await baseAdapter.confirmOrder(args)
    const orderID = result.orderID

    await fulfillNovaPoshtaOrder({
      createService,
      createWaybill: createWaybillOnOrder,
      delivery,
      orderID,
      req: args.req,
    })

    return result
  },
})
