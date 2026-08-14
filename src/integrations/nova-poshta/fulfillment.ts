import type { PayloadRequest } from 'payload'

import { createNovaPoshtaService, getPublicNovaPoshtaError } from '.'
import { getNovaPoshtaConfig } from './config'
import type { NovaPoshtaDelivery, NovaPoshtaOrderShipping, NovaPoshtaWaybill } from './types'
import type { Order } from '@/payload-types'

type FulfillNovaPoshtaOrderArgs = {
  createService?: typeof createNovaPoshtaService
  createWaybill?: boolean
  delivery: NovaPoshtaDelivery
  orderID: number
  req: PayloadRequest
}

export const fulfillNovaPoshtaOrder = async ({
  createService = createNovaPoshtaService,
  createWaybill = process.env.NOVA_POSHTA_CREATE_WAYBILL_ON_ORDER === 'true',
  delivery,
  orderID,
  req,
}: FulfillNovaPoshtaOrderArgs): Promise<void> => {
  const currentOrder = (await req.payload.findByID({
    collection: 'orders',
    id: orderID,
    depth: 0,
  })) as Order
  const currentShipping = currentOrder.novaPoshtaShipping as
    | { waybill?: { status?: string } }
    | undefined
  if (currentShipping?.waybill?.status === 'created') return

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
    const address = currentOrder.shippingAddress
    const config = getNovaPoshtaConfig()
    const created = await createService().createWaybill({
      delivery,
      recipient: {
        firstName: address?.firstName ?? '',
        lastName: address?.lastName ?? '',
        phone: address?.phone ?? '',
      },
      order: {
        amount: typeof currentOrder.amount === 'number' ? currentOrder.amount : 0,
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
