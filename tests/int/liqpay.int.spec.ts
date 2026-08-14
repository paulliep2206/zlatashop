import { describe, expect, it } from 'vitest'

import {
  createLiqPaySignature,
  decodeLiqPayData,
  encodeLiqPayData,
  verifyLiqPaySignature,
} from '@/integrations/liqpay/signature'
import { mapLiqPayStatus } from '@/integrations/liqpay/statuses'
import { LIQPAY_IMMEDIATE_PAYTYPES } from '@/integrations/liqpay/types'

describe('LiqPay protocol helpers', () => {
  it('round-trips a signed SHA3-256 payload', () => {
    const payload = { action: 'pay', amount: 10.05, currency: 'UAH', order_id: 'order-1' }
    const data = encodeLiqPayData(payload)
    const signature = createLiqPaySignature(data, 'private-key', 'sha3-256')

    expect(verifyLiqPaySignature(data, signature, 'private-key', 'sha3-256')).toBe(true)
    expect(decodeLiqPayData(data)).toEqual(payload)
  })

  it('rejects a modified callback signature', () => {
    const data = encodeLiqPayData({ status: 'success' })
    const signature = createLiqPaySignature(data, 'private-key', 'sha3-256')
    const changedData = encodeLiqPayData({ status: 'failure' })

    expect(verifyLiqPaySignature(changedData, signature, 'private-key', 'sha3-256')).toBe(false)
  })

  it('only treats the explicit success status as paid', () => {
    expect(mapLiqPayStatus('success')).toBe('paid')
    expect(mapLiqPayStatus('sandbox')).toBe('paid')
    expect(mapLiqPayStatus('failure')).toBe('failed')
    expect(mapLiqPayStatus('refund')).toBe('refunded')
    expect(mapLiqPayStatus('wait_accept')).toBe('pending')
    expect(mapLiqPayStatus('new-provider-status')).toBe('pending')
  })

  it('does not expose delayed payment methods', () => {
    expect(LIQPAY_IMMEDIATE_PAYTYPES).not.toContain('cash')
    expect(LIQPAY_IMMEDIATE_PAYTYPES).not.toContain('invoice')
  })
})
