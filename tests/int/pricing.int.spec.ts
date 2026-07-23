import { describe, expect, it } from 'vitest'

import { calculateCartSubtotal, getProductPrice } from '@/lib/pricing'

describe('product pricing', () => {
  it('uses the regular price when no special price is set', () => {
    expect(getProductPrice({ price: 450 })).toBe(450)
  })

  it('gives the special price priority', () => {
    expect(getProductPrice({ price: 450, specialPrice: 375 })).toBe(375)
  })

  it('preserves a zero special price instead of falling back', () => {
    expect(getProductPrice({ price: 450, specialPrice: 0 })).toBe(0)
  })

  it('calculates quantities with special-price priority', async () => {
    const products = {
      regular: { price: 450 },
      special: { price: 500, specialPrice: 375 },
    }

    await expect(
      calculateCartSubtotal(
        [
          { product: 'regular', quantity: 2 },
          { product: { id: 'special' }, quantity: 3 },
        ],
        async (id) => products[id as keyof typeof products],
      ),
    ).resolves.toBe(2025)
  })
})
