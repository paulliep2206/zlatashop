import type { PayloadRequest } from 'payload'

import type { Order } from '@/payload-types'

import { createNovaPoshtaService, getPublicNovaPoshtaError } from '.'
import { getNovaPoshtaConfig } from './config'
import type { NovaPoshtaDelivery, NovaPoshtaOrderShipping, NovaPoshtaWaybill } from './types'

type FulfillNovaPoshtaOrderArgs = {
  delivery: NovaPoshtaDelivery
  orderID: number
  req: PayloadRequest
  createService?: typeof createNovaPoshtaService
  createWaybill?: boolean
}

export const fulfillNovaPoshtaOrder = async ({
  delivery,
  orderID,
  req,
  createService = createNovaPoshtaService,
  createWaybill = process.env.NOVA_POSHTA_CREATE_WAYBILL_ON_ORDER === 'true',
}: FulfillNovaPoshtaOrderArgs): Promise<void> => {
  const initialShipping: NovaPoshtaOrderShipping = {
    delivery,
    waybill: { status: 'not-requested' },
  }

  await req.payload.update({
    collection: 'orders',
    id: orderID,
    data: { novaPoshtaShipping: initialShipping },
    req,
  })

  if (!createWaybill) return

  let waybill: NovaPoshtaWaybill
  try {
    const order = (await req.payload.findByID({
      collection: 'orders',
      id: orderID,
      depth: 0,
      req,
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
    req.payload.logger.error({ err: error, orderID }, 'Nova Poshta waybill creation failed')
    waybill = { status: 'failed', error: getPublicNovaPoshtaError(error) }
  }

  await req.payload.update({
    collection: 'orders',
    id: orderID,
    data: { novaPoshtaShipping: { delivery, waybill } },
    req,
  })
}
