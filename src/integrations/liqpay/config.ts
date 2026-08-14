import { LIQPAY_IMMEDIATE_PAYTYPES, type LiqPayPaytype } from './types'

export type LiqPayConfig = {
  apiVersion: number
  checkoutURL: string
  hashAlgorithm: 'sha1' | 'sha3-256'
  paytypes: LiqPayPaytype[]
  privateKey: string
  publicKey: string
  requestURL: string
  serverURL: string
}

export const getLiqPayConfig = (): LiqPayConfig => {
  const publicKey = process.env.LIQPAY_PUBLIC_KEY
  const privateKey = process.env.LIQPAY_PRIVATE_KEY
  const serverURL = process.env.NEXT_PUBLIC_SERVER_URL

  if (!publicKey || !privateKey) {
    throw new Error('LIQPAY_PUBLIC_KEY and LIQPAY_PRIVATE_KEY are required.')
  }
  if (!serverURL) {
    throw new Error('NEXT_PUBLIC_SERVER_URL is required for LiqPay callbacks.')
  }
  if (
    process.env.NODE_ENV === 'production' &&
    publicKey.startsWith('sandbox_') &&
    process.env.LIQPAY_ALLOW_SANDBOX_IN_PRODUCTION !== 'true'
  ) {
    throw new Error('Sandbox LiqPay keys are not allowed in production.')
  }

  const configuredPaytypes = (process.env.LIQPAY_ALLOWED_PAYTYPES ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const allowed = new Set<string>(LIQPAY_IMMEDIATE_PAYTYPES)
  const paytypes = (configuredPaytypes.length
    ? configuredPaytypes.filter((value): value is LiqPayPaytype => allowed.has(value))
    : [...LIQPAY_IMMEDIATE_PAYTYPES]) as LiqPayPaytype[]

  if (!paytypes.length) {
    throw new Error('LIQPAY_ALLOWED_PAYTYPES must contain at least one immediate payment method.')
  }

  return {
    apiVersion: Number(process.env.LIQPAY_API_VERSION ?? 7),
    checkoutURL: 'https://www.liqpay.ua/api/3/checkout',
    hashAlgorithm: process.env.LIQPAY_HASH_ALGORITHM === 'sha1' ? 'sha1' : 'sha3-256',
    paytypes,
    privateKey,
    publicKey,
    requestURL: 'https://www.liqpay.ua/api/request',
    serverURL: serverURL.replace(/\/$/, ''),
  }
}
