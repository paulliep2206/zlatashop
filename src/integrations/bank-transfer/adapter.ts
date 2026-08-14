import type { PaymentAdapter } from '@payloadcms/plugin-ecommerce/types'
import {
  commitTransaction,
  initTransaction,
  killTransaction,
  type GroupField,
  type PayloadRequest,
} from 'payload'

import { fulfillNovaPoshtaOrder } from '@/integrations/nova-poshta/fulfillment'
import { parseDelivery } from '@/integrations/nova-poshta/validation'
import type { Transaction } from '@/payload-types'

type StoredBankTransfer = {
  finalizationState?: 'pending' | 'finalizing' | 'finalized'
  novaPoshtaDelivery?: unknown
  referenceID?: string
  shippingAddress?: Record<string, unknown>
}

type BankTransferTransaction = Transaction & { bankTransfer?: StoredBankTransfer }

const relationID = (value: null | number | { id: number } | undefined): number | undefined =>
  typeof value === 'object' && value ? value.id : value ?? undefined

const flattenItems = (
  items: NonNullable<Parameters<PaymentAdapter['initiatePayment']>[0]['data']['cart']>['items'],
) =>
  (items ?? []).map((item) => ({
    product: typeof item.product === 'object' ? item.product.id : item.product,
    quantity: item.quantity,
    ...(item.variant
      ? { variant: typeof item.variant === 'object' ? item.variant.id : item.variant }
      : {}),
  }))

const findTransaction = async (
  referenceID: string,
  req: PayloadRequest,
  transactionsSlug: string,
): Promise<BankTransferTransaction> => {
  const result = await req.payload.find({
    collection: transactionsSlug as 'transactions',
    depth: 0,
    limit: 1,
    req,
    where: { 'bankTransfer.referenceID': { equals: referenceID } },
  })
  const transaction = result.docs[0] as BankTransferTransaction | undefined
  if (!transaction) throw new Error('Bank-transfer transaction was not found.')
  return transaction
}

const finalizeOrder = async (
  transaction: BankTransferTransaction,
  req: PayloadRequest,
): Promise<{ accessToken?: string; orderID: number }> => {
  const existingOrderID = relationID(transaction.order)
  if (existingOrderID) {
    const existing = await req.payload.findByID({
      collection: 'orders',
      id: existingOrderID,
      depth: 0,
    })
    return { orderID: existing.id, accessToken: existing.accessToken ?? undefined }
  }

  const startedTransaction = await initTransaction(req)
  try {
    const claimed = await req.payload.db.updateOne({
      collection: 'transactions',
      data: {
        bankTransfer: { ...transaction.bankTransfer, finalizationState: 'finalizing' },
      },
      req,
      where: {
        and: [
          { id: { equals: transaction.id } },
          { 'bankTransfer.finalizationState': { equals: 'pending' } },
        ],
      },
    })
    if (!claimed?.id) throw new Error('Bank-transfer order is already being finalized.')

    const cartID = relationID(transaction.cart)
    if (!cartID || !transaction.items?.length || !transaction.amount) {
      throw new Error('Bank-transfer transaction snapshot is incomplete.')
    }

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
        shippingAddress: transaction.bankTransfer?.shippingAddress as
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
        bankTransfer: { ...transaction.bankTransfer, finalizationState: 'finalized' },
      },
      req,
    })

    if (startedTransaction) await commitTransaction(req)

    if (transaction.bankTransfer?.novaPoshtaDelivery) {
      await fulfillNovaPoshtaOrder({
        delivery: parseDelivery(transaction.bankTransfer.novaPoshtaDelivery),
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

const group: GroupField = {
  name: 'bankTransfer',
  type: 'group',
  admin: { condition: (data) => data?.paymentMethod === 'bankTransfer' },
  fields: [
    { name: 'referenceID', type: 'text', index: true, unique: true },
    {
      name: 'finalizationState',
      type: 'select',
      defaultValue: 'pending',
      options: ['pending', 'finalizing', 'finalized'],
      required: true,
    },
    { name: 'shippingAddress', type: 'json' },
    { name: 'novaPoshtaDelivery', type: 'json' },
  ],
}

export const bankTransferAdapter = (): PaymentAdapter => ({
  name: 'bankTransfer',
  label: 'Оплатити за реквізитами',
  group,
  initiatePayment: async ({ data, req, transactionsSlug }) => {
    const { cart, currency, customerEmail, billingAddress, shippingAddress } = data
    if (!cart?.items?.length || !cart.subtotal || cart.subtotal <= 0) {
      throw new Error('A valid cart is required.')
    }
    if (currency !== 'UAH') throw new Error('Bank-transfer checkout only supports UAH.')
    if (!customerEmail || !shippingAddress) throw new Error('Contact and shipping data are required.')

    const referenceID = crypto.randomUUID()
    const storedShipping = shippingAddress as unknown as Record<string, unknown>
    const novaPoshtaDelivery = storedShipping.novaPoshtaDelivery
    if (!novaPoshtaDelivery) throw new Error('Nova Poshta delivery is required.')

    await req.payload.create({
      collection: transactionsSlug as 'transactions',
      data: {
        amount: cart.subtotal,
        billingAddress,
        bankTransfer: {
          finalizationState: 'pending',
          referenceID,
          shippingAddress: storedShipping,
          novaPoshtaDelivery: novaPoshtaDelivery as
            | { [key: string]: unknown }
            | unknown[]
            | string
            | number
            | boolean
            | null,
        },
        cart: cart.id,
        currency: 'UAH',
        customerEmail,
        ...(req.user ? { customer: req.user.id } : {}),
        items: flattenItems(cart.items),
        paymentMethod: 'bankTransfer',
        status: 'pending',
      },
      req,
    })

    return { message: 'Bank-transfer order initialized.', referenceID }
  },
  confirmOrder: async ({ data, req, transactionsSlug = 'transactions' }) => {
    if (typeof data.referenceID !== 'string') throw new Error('Reference ID is required.')
    const transaction = await findTransaction(data.referenceID, req, transactionsSlug)
    const finalized = await finalizeOrder(transaction, req)
    return {
      message: 'Order placed. Awaiting payment by bank details.',
      transactionID: 0,
      ...finalized,
    }
  },
})
