const failedStatuses = new Set([
  'error',
  'failure',
  'reversed',
  'unsubscribed',
])

const refundedStatuses = new Set(['refund', 'refunded'])

export type MappedLiqPayStatus = 'paid' | 'pending' | 'failed' | 'refunded'

export const mapLiqPayStatus = (status?: string): MappedLiqPayStatus => {
  if (status === 'success' || status === 'sandbox') return 'paid'
  if (status && failedStatuses.has(status)) return 'failed'
  if (status && refundedStatuses.has(status)) return 'refunded'
  return 'pending'
}
