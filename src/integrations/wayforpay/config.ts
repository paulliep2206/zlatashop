export type WayForPayConfig = {
  merchantAccount: string
  merchantDomainName: string
  secretKey: string
  apiUrl: string
  serverUrl: string
}

export type WayForPayRolloutConfig = {
  allowMixedCarts: boolean
  allowVirtualOnlyCarts: boolean
}

export const getWayForPayRolloutConfig = (): WayForPayRolloutConfig => ({
  allowMixedCarts: process.env.WAYFORPAY_ENABLE_MIXED_CARTS === 'true',
  allowVirtualOnlyCarts: process.env.WAYFORPAY_ENABLE_VIRTUAL_ONLY_CARTS === 'true',
})

export const getWayForPayConfig = (): WayForPayConfig => {
  const merchantAccount = process.env.WAYFORPAY_MERCHANT_ACCOUNT?.trim()
  const merchantDomainName = process.env.WAYFORPAY_MERCHANT_DOMAIN?.trim()
  const secretKey = process.env.WAYFORPAY_SECRET_KEY?.trim()
  const serverUrl = (process.env.NEXT_PUBLIC_SERVER_URL ?? '').replace(/\/$/, '')

  const missing = [
    !merchantAccount && 'WAYFORPAY_MERCHANT_ACCOUNT',
    !merchantDomainName && 'WAYFORPAY_MERCHANT_DOMAIN',
    !secretKey && 'WAYFORPAY_SECRET_KEY',
    !serverUrl && 'NEXT_PUBLIC_SERVER_URL',
  ].filter(Boolean)

  if (missing.length) {
    throw new Error(`WayForPay is not configured: ${missing.join(', ')}`)
  }

  return {
    merchantAccount: merchantAccount!,
    merchantDomainName: merchantDomainName!,
    secretKey: secretKey!,
    apiUrl: process.env.WAYFORPAY_API_URL ?? 'https://api.wayforpay.com/api',
    serverUrl,
  }
}
