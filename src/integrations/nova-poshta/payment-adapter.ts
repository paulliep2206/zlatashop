import type { PaymentAdapter } from '@payloadcms/plugin-ecommerce/types'

import { createNovaPoshtaService, getPublicNovaPoshtaError } from '.'
import { getNovaPoshtaConfig } from './config'
import { parseDelivery } from './validation'
import type { NovaPoshtaOrderShipping, NovaPoshtaWaybill } from './types'
import type { Order } from '@/payload-types'

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

    const initialShipping: NovaPoshtaOrderShipping = {
      delivery,
      waybill: { status: 'not-requested' },
    }

    await args.req.payload.update({
      collection: 'orders',
      id: orderID,
      data: { novaPoshtaShipping: initialShipping },
      req: args.req,
    })

    if (!createWaybillOnOrder) {
      return result
    }

    let waybill: NovaPoshtaWaybill
    try {
      const order = (await args.req.payload.findByID({
        collection: 'orders',
        id: orderID,
        depth: 0,
      })) as Order
      const address = order.shippingAddress as
        | { firstName?: string; lastName?: string; phone?: string }
        | undefined
      const config = getNovaPoshtaConfig()
      const created = await createService().createWaybill({
        delivery,
        recipient: {
          firstName: address?.firstName ?? '',
          lastName: address?.lastName ?? '',
          phone: address?.phone ?? '',
        },
        order: {
          amount: typeof order.amount === 'number' ? order.amount : 0,
          description: config.shipment.description,
          weight: config.shipment.weight,
        },
      })

      waybill = {
        status: 'created',
        ref: created.Ref,
        number: created.IntDocNumber,
        cost: created.CostOnSite ? Number(created.CostOnSite) : undefined,
        estimatedDeliveryDate: created.EstimatedDeliveryDate,
        createdAt: new Date().toISOString(),
      }
    } catch (error) {
      args.req.payload.logger.error({ err: error, orderID }, 'Nova Poshta waybill creation failed')
      waybill = {
        status: 'failed',
        error: getPublicNovaPoshtaError(error),
      }
    }

    await args.req.payload.update({
      collection: 'orders',
      id: orderID,
      data: { novaPoshtaShipping: { delivery, waybill } },
      req: args.req,
    })

    return result
  },
})
