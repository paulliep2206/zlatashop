export const toMinorAmount = (amount: number): number => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Payment amount must be a positive UAH value.')
  }

  const scaled = amount * 100
  const amountMinor = Math.round(scaled)
  if (!Number.isSafeInteger(amountMinor) || Math.abs(scaled - amountMinor) > 1e-8) {
    throw new Error('Payment amount cannot have more than two decimal places.')
  }

  return amountMinor
}

export const fromMinorAmount = (amountMinor: number): number => {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('Payment amount must be a positive integer in kopiykas.')
  }

  return amountMinor / 100
}

export const formatMinorAmount = (amountMinor: number): string => {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('Payment amount must be a positive integer in kopiykas.')
  }

  return fromMinorAmount(amountMinor).toFixed(2)
}

export const amountsMatch = (providerAmount: string | number, amountMinor: number): boolean => {
  const parsed = Number(providerAmount)
  return Number.isFinite(parsed) && Math.round(parsed * 100) === amountMinor
}
