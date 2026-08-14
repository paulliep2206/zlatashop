import { commitTransaction, initTransaction, killTransaction, type PayloadRequest } from 'payload'

import { fulfillNovaPoshtaOrder } from '@/integrations/nova-poshta/fulfillment'
import { parseDelivery } from '@/integrations/nova-poshta/validation'
import type { Transaction } from '@/payload-types'
import type { LiqPayTransactionData } from './types'

type LiqPayStoredData = LiqPayTransactionData & {
  shippingAddress?: Record<string, unknown>
  novaPoshtaDelivery?: unknown
}

type LiqPayTransaction = Transaction & { liqpay?: LiqPayStoredData }

export type FinalizedOrder = {
  accessToken?: string
  orderID: number
}

const relationID = (value: null | number | { id: number } | undefined): number | undefined =>
  typeof value === 'object' && value ? value.id : value ?? undefined

export const finalizeLiqPayOrder = async (
  transaction: LiqPayTransaction,
  req: PayloadRequest,
): Promise<FinalizedOrder> => {
  const existingOrderID = relationID(transaction.order)
  if (existingOrderID) {
    const existingOrder = await req.payload.findByID({
      collection: 'orders',
      id: existingOrderID,
      depth: 0,
    })
    if (transaction.liqpay?.novaPoshtaDelivery) {
      await fulfillNovaPoshtaOrder({
        delivery: parseDelivery(transaction.liqpay.novaPoshtaDelivery),
        orderID: existingOrder.id,
        req,
      })
    }
    return { orderID: existingOrder.id, accessToken: existingOrder.accessToken ?? undefined }
  }

  const startedTransaction = await initTransaction(req)
  try {
    const claimed = (await req.payload.db.updateOne({
      collection: 'transactions',
      data: {
        liqpay: {
          ...transaction.liqpay,
          finalizationState: 'finalizing',
        },
      },
      req,
      where: {
        and: [
          { id: { equals: transaction.id } },
          { 'liqpay.finalizationState': { equals: 'pending' } },
        ],
      },
    })) as LiqPayTransaction

    if (!claimed?.id) {
      throw new Error('LiqPay payment is already being finalized.')
    }

    const cartID = relationID(transaction.cart)
    if (!cartID) throw new Error('Transaction does not contain a cart.')
    if (!transaction.items?.length) throw new Error('Transaction does not contain cart items.')
    if (!transaction.amount || transaction.amount <= 0) throw new Error('Invalid transaction amount.')

    const order = await req.payload.create({
      collection: 'orders',
      data: {
        amount: transaction.amount,
        currency: 'UAH',
        customerEmail: transaction.customerEmail,
        ...(transaction.customer ? { customer: relationID(transaction.customer) } : {}),
        items: transaction.items.map((item) => ({
          product: relationID(item.product),
          quantity: item.quantity,
          ...(item.variant ? { variant: relationID(item.variant) } : {}),
        })),
        shippingAddress: transaction.liqpay?.shippingAddress as
          | NonNullable<Transaction['billingAddress']>
          | undefined,
        status: 'processing',
        transactions: [transaction.id],
      },
      req,
    })

    for (const item of transaction.items) {
      if (item.variant) {
        await req.payload.db.updateOne({
          collection: 'variants',
          data: { inventory: { $inc: item.quantity * -1 } },
          id: relationID(item.variant)!,
          req,
        })
      } else if (item.product) {
        await req.payload.db.updateOne({
          collection: 'products',
          data: { stock: { $inc: item.quantity * -1 } },
          id: relationID(item.product)!,
          req,
        })
      }
    }

    await req.payload.update({
      collection: 'carts',
      id: cartID,
      data: { purchasedAt: new Date().toISOString() },
      req,
    })
    await req.payload.update({
      collection: 'transactions',
      id: transaction.id,
      data: {
        order: order.id,
        status: 'succeeded',
        liqpay: { ...transaction.liqpay, finalizationState: 'finalized' },
      },
      req,
    })

    if (startedTransaction) await commitTransaction(req)

    if (transaction.liqpay?.novaPoshtaDelivery) {
      await fulfillNovaPoshtaOrder({
        delivery: parseDelivery(transaction.liqpay.novaPoshtaDelivery),
        orderID: order.id,
        req,
      })
    }

    return { orderID: order.id, accessToken: order.accessToken ?? undefined }
  } catch (error) {
    if (startedTransaction) await killTransaction(req)
    throw error
  }
}
