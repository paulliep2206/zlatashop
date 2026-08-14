import type { PaymentAdapter } from '@payloadcms/plugin-ecommerce/types'
import type { Endpoint, GroupField } from 'payload'

import type { Transaction } from '@/payload-types'
import { LiqPayClient } from './client'
import { getLiqPayConfig, type LiqPayConfig } from './config'
import { finalizeLiqPayOrder } from './finalize-order'
import { mapLiqPayStatus } from './statuses'
import type { LiqPayCallback, LiqPayTransactionData } from './types'

type LiqPayTransaction = Transaction & {
  liqpay?: LiqPayTransactionData & {
    novaPoshtaDelivery?: unknown
    shippingAddress?: Record<string, unknown>
  }
}

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
  merchantOrderID: string,
  req: Parameters<PaymentAdapter['confirmOrder']>[0]['req'],
  transactionsSlug: string,
): Promise<LiqPayTransaction> => {
  const result = await req.payload.find({
    collection: transactionsSlug as 'transactions',
    depth: 0,
    limit: 1,
    req,
    where: { 'liqpay.merchantOrderID': { equals: merchantOrderID } },
  })
  const transaction = result.docs[0] as LiqPayTransaction | undefined
  if (!transaction) throw new Error('No transaction found for this LiqPay payment.')
  return transaction
}

const validateProviderPayment = (
  provider: LiqPayCallback,
  transaction: LiqPayTransaction,
  config: LiqPayConfig,
): void => {
  if (provider.public_key !== config.publicKey) throw new Error('LiqPay public key mismatch.')
  if (provider.order_id !== transaction.liqpay?.merchantOrderID) {
    throw new Error('LiqPay order ID mismatch.')
  }
  if (provider.currency !== transaction.currency) throw new Error('LiqPay currency mismatch.')
  if (Math.round(Number(provider.amount) * 100) !== transaction.amount) {
    throw new Error('LiqPay amount mismatch.')
  }
  if (provider.action !== 'pay') throw new Error('Unexpected LiqPay action.')
}

const providerFields = (callback: LiqPayCallback, current: LiqPayTransactionData) => ({
  ...current,
  finalizationState: current.finalizationState ?? 'pending',
  lastCallbackAt: new Date().toISOString(),
  liqpayOrderID: callback.liqpay_order_id,
  paymentID: callback.payment_id ? String(callback.payment_id) : undefined,
  paytype: callback.paytype,
  providerStatus: callback.status,
})

const callbackEndpoint = (config: LiqPayConfig, client: LiqPayClient): Endpoint => ({
  method: 'post',
  path: '/callback',
  handler: async (req) => {
    try {
      if (!req.text) return Response.json({ received: false }, { status: 400 })
      const rawBody = await req.text()
      if (rawBody.length > 100_000) {
        return Response.json({ received: false }, { status: 413 })
      }
      const body = new URLSearchParams(rawBody)
      const data = body.get('data')
      const signature = body.get('signature')
      if (!data || !signature || !client.verifyCallback(data, signature)) {
        return Response.json({ received: false }, { status: 400 })
      }

      const callback = client.decodeCallback(data)
      if (!callback.order_id) return Response.json({ received: false }, { status: 400 })
      const transaction = await findTransaction(callback.order_id, req, 'transactions')
      validateProviderPayment(callback, transaction, config)
      const status = mapLiqPayStatus(callback.status)

      await req.payload.update({
        collection: 'transactions',
        id: transaction.id,
        data: {
          liqpay: providerFields(callback, transaction.liqpay!),
          ...(status === 'failed'
            ? { status: 'failed' }
            : status === 'refunded'
              ? { status: 'refunded' }
              : {}),
        },
        req,
      })

      if (status === 'paid') {
        await finalizeLiqPayOrder(
          { ...transaction, liqpay: providerFields(callback, transaction.liqpay!) },
          req,
        )
      }

      return Response.json({ received: true })
    } catch (error) {
      req.payload.logger.error({ err: error }, 'LiqPay callback processing failed')
      return Response.json({ received: false }, { status: 400 })
    }
  },
})

const groupField: GroupField = {
  name: 'liqpay',
  type: 'group',
  admin: { condition: (data) => data?.paymentMethod === 'liqpay' },
  fields: [
    // Nullable for legacy Stripe transactions; every new LiqPay transaction sets this value.
    { name: 'merchantOrderID', type: 'text', index: true, unique: true },
    { name: 'paymentID', type: 'text', index: true },
    { name: 'liqpayOrderID', type: 'text' },
    { name: 'paytype', type: 'text' },
    { name: 'providerStatus', type: 'text' },
    { name: 'lastCallbackAt', type: 'date' },
    {
      name: 'finalizationState',
      type: 'select',
      defaultValue: 'pending',
      options: ['pending', 'finalizing', 'finalized', 'failed'],
      required: true,
    },
    { name: 'shippingAddress', type: 'json' },
    { name: 'novaPoshtaDelivery', type: 'json' },
  ],
}

export const liqpayAdapter = (): PaymentAdapter => {
  const load = () => {
    const config = getLiqPayConfig()
    return { client: new LiqPayClient(config), config }
  }

  return {
    name: 'liqpay',
    label: 'LiqPay',
    group: groupField,
    endpoints: [
      {
        method: 'post',
        path: '/callback',
        handler: async (req) => {
          const { client, config } = load()
          return callbackEndpoint(config, client).handler!(req)
        },
      },
    ],
    initiatePayment: async ({ data, req, transactionsSlug }) => {
      const { client, config } = load()
      const { cart, currency, customerEmail, billingAddress, shippingAddress } = data
      if (!cart?.items?.length) throw new Error('Cart is empty.')
      if (!cart.subtotal || cart.subtotal <= 0) throw new Error('A valid cart total is required.')
      if (currency !== 'UAH') throw new Error('LiqPay checkout only supports UAH.')
      if (!customerEmail) throw new Error('Customer email is required.')
      if (!shippingAddress) throw new Error('Shipping address is required.')

      const merchantOrderID = crypto.randomUUID()
      const storedShipping = shippingAddress as unknown as Record<string, unknown>
      const novaPoshtaDelivery = storedShipping.novaPoshtaDelivery
      if (!novaPoshtaDelivery) throw new Error('Nova Poshta delivery is required.')

      await req.payload.create({
        collection: transactionsSlug as 'transactions',
        data: {
          amount: cart.subtotal,
          billingAddress,
          cart: cart.id,
          currency: 'UAH',
          customerEmail,
          ...(req.user ? { customer: req.user.id } : {}),
          items: flattenItems(cart.items),
          paymentMethod: 'liqpay',
          status: 'pending',
          liqpay: {
            finalizationState: 'pending',
            merchantOrderID,
            novaPoshtaDelivery: novaPoshtaDelivery as
              | { [key: string]: unknown }
              | unknown[]
              | string
              | number
              | boolean
              | null,
            shippingAddress: storedShipping,
          },
        },
        req,
      })

      return {
        message: 'LiqPay checkout created successfully.',
        ...client.createCheckout({
          action: 'pay',
          amount: cart.subtotal / 100,
          currency: 'UAH',
          description: `Bookstore order ${merchantOrderID}`,
          language: 'uk',
          order_id: merchantOrderID,
          paytypes: config.paytypes.join(','),
          result_url: `${config.serverURL}/checkout/confirm-order?liqpay_order_id=${encodeURIComponent(merchantOrderID)}&email=${encodeURIComponent(customerEmail)}`,
          server_url: `${config.serverURL}/api/payments/liqpay/callback`,
        }),
        merchantOrderID,
      }
    },
    confirmOrder: async ({ data, req, transactionsSlug = 'transactions' }) => {
      const merchantOrderID = data.merchantOrderID
      if (typeof merchantOrderID !== 'string') throw new Error('LiqPay order ID is required.')
      const { client, config } = load()
      const transaction = await findTransaction(merchantOrderID, req, transactionsSlug)

      if (transaction.order) {
        const finalized = await finalizeLiqPayOrder(transaction, req)
        return { message: 'Order already confirmed.', transactionID: 0, ...finalized }
      }

      const provider = await client.getPaymentStatus(merchantOrderID)
      validateProviderPayment(provider, transaction, config)
      const status = mapLiqPayStatus(provider.status)
      if (status !== 'paid') {
        throw new Error(`Payment is not completed (${status}).`)
      }

      const updated = {
        ...transaction,
        liqpay: providerFields(provider, transaction.liqpay!),
      }
      await req.payload.update({
        collection: transactionsSlug as 'transactions',
        id: transaction.id,
        data: { liqpay: updated.liqpay },
        req,
      })
      const finalized = await finalizeLiqPayOrder(updated, req)
      return {
        message: 'Order confirmed successfully.',
        paymentStatus: 'paid',
        transactionID: 0,
        ...finalized,
      }
    },
  }
}
