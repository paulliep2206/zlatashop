export class NovaPoshtaError extends Error {
  readonly code: 'CONFIGURATION' | 'INVALID_RESPONSE' | 'REMOTE_API' | 'VALIDATION'
  readonly details?: string[]

  constructor(
    message: string,
    code: NovaPoshtaError['code'],
    options?: { cause?: unknown; details?: string[] },
  ) {
    super(message, { cause: options?.cause })
    this.name = 'NovaPoshtaError'
    this.code = code
    this.details = options?.details
  }
}

export const getPublicNovaPoshtaError = (error: unknown): string => {
  if (error instanceof NovaPoshtaError && error.code === 'VALIDATION') {
    return error.message
  }

  return 'Nova Poshta service is temporarily unavailable. Please try again.'
}
