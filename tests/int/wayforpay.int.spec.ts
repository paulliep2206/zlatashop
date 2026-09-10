import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  amountsMatch,
  formatMinorAmount,
  fromMinorAmount,
  toMinorAmount,
} from '@/integrations/wayforpay/amount'
import { applyWayForPayResult, finalizeWayForPayOrder } from '@/integrations/wayforpay/finalize'
import { createWayForPayPayment } from '@/integrations/wayforpay/initiate'
import {
  createCallbackAcknowledgement,
  signCallback,
  signPurchase,
  signStatusRequest,
  verifyCallbackSignature,
} from '@/integrations/wayforpay/signatures'
import type { WayForPayCallback } from '@/integrations/wayforpay/types'
import { parseInitiateInput } from '@/integrations/wayforpay/validation'

const secret = 'merchant-secret'
const delivery = {
  provider: 'nova-poshta' as const,
  serviceType: 'WarehouseWarehouse' as const,
  warehouse: {
    ref: 'warehouse-ref',
    description: 'Office 1',
    shortAddress: 'Khreshchatyk 1',
    cityRef: 'city-ref',
    cityDescription: 'Kyiv',
    number: '1',
    categoryOfWarehouse: 'Branch',
  },
}
const address = {
  firstName: 'Ivan',
  lastName: 'Petrenko',
  phone: '380671234567',
  addressLine1: 'Khreshchatyk 1',
  addressLine2: 'Nova Poshta office 1',
  city: 'Kyiv',
}

const callback = (overrides: Partial<WayForPayCallback> = {}): WayForPayCallback => {
  const value: WayForPayCallback = {
    merchantAccount: 'merchant.test',
    orderReference: 'WFP-123',
    merchantSignature: '',
    amount: '12.34',
    currency: 'UAH',
    authCode: '123456',
    cardPan: '42****4242',
    transactionStatus: 'Approved',
    reasonCode: 1100,
    paymentSystem: 'googlePay',
    ...overrides,
  }
  value.merchantSignature = signCallback(value, secret)
  return value
}

describe('WayForPay protocol', () => {
  it('formats and compares minor UAH amounts without floating point drift', () => {
    expect(toMinorAmount(450)).toBe(45000)
    expect(toMinorAmount(450.5)).toBe(45050)
    expect(fromMinorAmount(45000)).toBe(450)
    expect(formatMinorAmount(1)).toBe('0.01')
    expect(formatMinorAmount(123456)).toBe('1234.56')
    expect(amountsMatch('1234.56', 123456)).toBe(true)
    expect(amountsMatch('1234.57', 123456)).toBe(false)
    expect(() => formatMinorAmount(1.5)).toThrow(/integer/)
    expect(() => toMinorAmount(4.501)).toThrow(/decimal places/)
  })

  it('uses the documented purchase signature field order', () => {
    const request = {
      merchantAccount: 'merchant.test',
      merchantDomainName: 'shop.test',
      authorizationType: 'SimpleSignature' as const,
      orderReference: 'WFP-123',
      orderDate: 1700000000,
      amount: '12.34',
      currency: 'UAH' as const,
      productName: ['Book A', 'Book B'],
      productPrice: ['5.00', '3.67'],
      productCount: [1, 2],
      clientFirstName: 'Ivan',
      clientLastName: 'Petrenko',
      clientEmail: 'ivan@example.com',
      clientPhone: '380671234567',
      returnUrl: 'https://shop.test/checkout',
      serviceUrl: 'https://shop.test/api/wayforpay/callback',
      language: 'UA' as const,
      paymentSystems: 'card;applePay;googlePay' as const,
      defaultPaymentSystem: 'card' as const,
    }
    const canonical = [
      'merchant.test',
      'shop.test',
      'WFP-123',
      '1700000000',
      '12.34',
      'UAH',
      'Book A',
      'Book B',
      '1',
      '2',
      '5.00',
      '3.67',
    ].join(';')
    expect(signPurchase(request, secret)).toBe(
      createHmac('md5', secret).update(canonical).digest('hex'),
    )
  })

  it('verifies callbacks and rejects changed signed data', () => {
    const approved = callback()
    expect(verifyCallbackSignature(approved, secret)).toBe(true)
    expect(verifyCallbackSignature({ ...approved, amount: '99.00' }, secret)).toBe(false)
    expect(signStatusRequest('merchant.test', 'WFP-123', secret)).toBe(
      createHmac('md5', secret).update('merchant.test;WFP-123').digest('hex'),
    )
  })

  it('creates a correctly signed callback acknowledgement', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:00:00Z'))
    const result = createCallbackAcknowledgement('WFP-123', secret)
    expect(result).toMatchObject({ orderReference: 'WFP-123', status: 'accept', time: 1786708800 })
    expect(result.signature).toBe(
      createHmac('md5', secret).update('WFP-123;accept;1786708800').digest('hex'),
    )
    vi.useRealTimers()
  })
})

describe('WayForPay initiation', () => {
  const originalEnv = { ...process.env }
  beforeEach(() => {
    process.env.WAYFORPAY_MERCHANT_ACCOUNT = 'merchant.test'
    process.env.WAYFORPAY_MERCHANT_DOMAIN = 'shop.test'
    process.env.WAYFORPAY_SECRET_KEY = secret
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://shop.test'
  })
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('reprices the stored cart and enables only card and wallet methods', async () => {
    const payload = {
      findByID: vi.fn(async ({ collection, id }: { collection: string; id: number }) => {
        if (collection === 'carts') {
          return {
            id: 7,
            items: [
              { product: 10, quantity: 2 },
              { product: 11, quantity: 1 },
            ],
          }
        }
        return id === 10
          ? { id, title: 'Regular book', price: 500 }
          : { id, title: 'Sale book', price: 900, specialPrice: 650 }
      }),
      create: vi.fn(async ({ data }) => ({ id: 99, ...data })),
    }
    const input = parseInitiateInput({
      cartID: 7,
      customerEmail: 'ivan@example.com',
      shippingAddress: address,
      novaPoshtaDelivery: delivery,
    })
    const result = await createWayForPayPayment({ input, payload: payload as never })

    expect(result.widget.amount).toBe('1650.00')
    expect(result.widget.productPrice).toEqual(['500.00', '650.00'])
    expect(result.widget.paymentSystems).toBe('card;applePay;googlePay')
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'wayforpay-payments',
        data: expect.objectContaining({
          amountMinor: 165000,
          currency: 'UAH',
          status: 'pending',
        }),
      }),
    )
    expect(verifyCallbackSignature(callback(), secret)).toBe(true)
  })
})

describe('WayForPay finalization', () => {
  const payment = {
    id: 9,
    orderReference: 'WFP-123',
    publicToken: 'public-token',
    status: 'approved',
    amountMinor: 1234,
    providerAmount: '12.34',
    currency: 'UAH',
    cart: 7,
    customerEmail: 'ivan@example.com',
    itemsSnapshot: [{ product: 10, quantity: 2, name: 'Book', priceMinor: 617 }],
    shippingAddressSnapshot: address,
    novaPoshtaDeliverySnapshot: delivery,
    createdAt: '',
    updatedAt: '',
  }

  it('does not create a second order for an already finalized payment', async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({ ...payment, order: 42 }),
      create: vi.fn(),
    }
    await expect(
      finalizeWayForPayOrder({ paymentID: 9, payload: payload as never, req: {} as never }),
    ).resolves.toEqual({ paymentStatus: 'approved', orderID: 42 })
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('creates one paid order from the stored snapshots and marks the cart purchased', async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue(payment),
      create: vi.fn().mockResolvedValue({ id: 42, accessToken: 'order-access-token' }),
      update: vi.fn(async (args: { where?: unknown }) =>
        args.where ? { docs: [{ ...payment, status: 'finalizing' }] } : {},
      ),
      logger: { error: vi.fn() },
    }
    const req = { payload } as never

    await expect(
      finalizeWayForPayOrder({ paymentID: 9, payload: payload as never, req }),
    ).resolves.toEqual({
      paymentStatus: 'approved',
      orderID: 42,
      accessToken: 'order-access-token',
    })
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'orders',
        data: expect.objectContaining({
          amount: 12.34,
          customerEmail: 'ivan@example.com',
          items: [{ product: 10, quantity: 2 }],
          status: 'processing',
        }),
      }),
    )
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'carts',
        id: 7,
        data: expect.objectContaining({ status: 'purchased' }),
      }),
    )
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'orders',
        id: 42,
        data: { novaPoshtaShipping: { delivery, waybill: { status: 'not-requested' } } },
      }),
    )
  })

  it('rejects an approved callback whose amount differs from the snapshot', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [payment] }),
      update: vi.fn(),
    }
    await expect(
      applyWayForPayResult({
        callback: callback({ amount: '99.00' }),
        payload: payload as never,
        req: {} as never,
      }),
    ).rejects.toThrow(/amount or currency/)
    expect(payload.update).not.toHaveBeenCalled()
  })
})
