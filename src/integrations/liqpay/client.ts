import type { LiqPayCallback, LiqPayCheckoutRequest, LiqPayPaymentStatus } from './types'
import type { LiqPayConfig } from './config'
import {
  createLiqPaySignature,
  decodeLiqPayData,
  encodeLiqPayData,
  verifyLiqPaySignature,
} from './signature'

export class LiqPayClient {
  constructor(private readonly config: LiqPayConfig) {}

  createCheckout(input: Omit<LiqPayCheckoutRequest, 'public_key' | 'version'>) {
    const request: LiqPayCheckoutRequest = {
      ...input,
      public_key: this.config.publicKey,
      version: this.config.apiVersion,
    }
    const data = encodeLiqPayData(request)

    return {
      checkoutURL: this.config.checkoutURL,
      data,
      signature: createLiqPaySignature(
        data,
        this.config.privateKey,
        this.config.hashAlgorithm,
      ),
    }
  }

  decodeCallback(data: string): LiqPayCallback {
    return decodeLiqPayData<LiqPayCallback>(data)
  }

  verifyCallback(data: string, signature: string): boolean {
    return verifyLiqPaySignature(
      data,
      signature,
      this.config.privateKey,
      this.config.hashAlgorithm,
    )
  }

  async getPaymentStatus(orderID: string): Promise<LiqPayPaymentStatus> {
    const data = encodeLiqPayData({
      action: 'status',
      order_id: orderID,
      public_key: this.config.publicKey,
      version: this.config.apiVersion,
    })
    const signature = createLiqPaySignature(
      data,
      this.config.privateKey,
      this.config.hashAlgorithm,
    )
    const body = new URLSearchParams({ data, signature })
    const response = await fetch(this.config.requestURL, {
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })

    if (!response.ok) {
      throw new Error(`LiqPay status request failed with HTTP ${response.status}.`)
    }

    return (await response.json()) as LiqPayPaymentStatus
  }
}
