import { describe, expect, it, vi } from 'vitest'

import { bankTransferAdapter } from '@/integrations/bank-transfer/adapter'
import { bankTransferAdapterClient } from '@/integrations/bank-transfer/client-adapter'
import type { PayloadRequest } from 'payload'

describe('bank-transfer payment adapter', () => {
  it('registers as a selectable client payment method', () => {
    expect(bankTransferAdapterClient()).toEqual({
      name: 'bankTransfer',
      label: 'Оплатити за реквізитами',
      initiatePayment: true,
      confirmOrder: true,
    })
  })

  it('creates a pending transaction from the checkout snapshot', async () => {
    const create = vi.fn().mockResolvedValue({ id: 10 })
    const req = {
      payload: { create },
      user: { id: 5 },
    } as unknown as PayloadRequest
    const adapter = bankTransferAdapter()

    const result = await adapter.initiatePayment({
      customersSlug: 'users',
      data: {
        billingAddress: {} as never,
        cart: {
          id: 3,
          items: [{ product: 7, quantity: 2 }] as never,
          subtotal: 25000,
        },
        currency: 'UAH',
        customerEmail: 'customer@example.com',
        shippingAddress: {
          firstName: 'Zlata',
          lastName: 'Solovey',
          novaPoshtaDelivery: { warehouse: { ref: 'warehouse-ref' } },
          phone: '+380000000000',
        } as never,
      },
      req,
      transactionsSlug: 'transactions',
    })

    expect(result).toMatchObject({
      message: 'Bank-transfer order initialized.',
      referenceID: expect.any(String),
    })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        data: expect.objectContaining({
          amount: 25000,
          currency: 'UAH',
          customer: 5,
          customerEmail: 'customer@example.com',
          paymentMethod: 'bankTransfer',
          status: 'pending',
        }),
      }),
    )
  })
})
