import { NovaPoshtaError } from './errors'
import type { NovaPoshtaApiRequest, NovaPoshtaApiResponse } from './types'

export type NovaPoshtaClientOptions = {
  apiKey: string
  apiUrl: string
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
}

export class NovaPoshtaClient {
  private readonly apiKey: string
  private readonly apiUrl: string
  private readonly fetchImplementation: typeof globalThis.fetch
  private readonly timeoutMs: number

  constructor(options: NovaPoshtaClientOptions) {
    this.apiKey = options.apiKey
    this.apiUrl = options.apiUrl
    this.fetchImplementation = options.fetch ?? globalThis.fetch
    this.timeoutMs = options.timeoutMs ?? 10_000
  }

  async call<T, TProperties extends Record<string, unknown>>(
    request: Omit<NovaPoshtaApiRequest<TProperties>, 'apiKey'>,
  ): Promise<T[]> {
    let response: Response

    try {
      response = await this.fetchImplementation(this.apiUrl, {
        body: JSON.stringify({ ...request, apiKey: this.apiKey }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (error) {
      throw new NovaPoshtaError('Could not reach Nova Poshta.', 'REMOTE_API', { cause: error })
    }

    if (!response.ok) {
      throw new NovaPoshtaError(`Nova Poshta returned HTTP ${response.status}.`, 'REMOTE_API')
    }

    let payload: NovaPoshtaApiResponse<T>
    try {
      payload = (await response.json()) as NovaPoshtaApiResponse<T>
    } catch (error) {
      throw new NovaPoshtaError('Nova Poshta returned invalid JSON.', 'INVALID_RESPONSE', {
        cause: error,
      })
    }

    if (
      typeof payload?.success !== 'boolean' ||
      !Array.isArray(payload.data) ||
      !Array.isArray(payload.errors)
    ) {
      throw new NovaPoshtaError('Nova Poshta returned an invalid response.', 'INVALID_RESPONSE')
    }

    if (!payload.success) {
      throw new NovaPoshtaError(
        payload.errors.join('; ') || 'Nova Poshta rejected the request.',
        'REMOTE_API',
        { details: payload.errors },
      )
    }

    return payload.data
  }
}
