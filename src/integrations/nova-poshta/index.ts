import { NovaPoshtaClient } from './client'
import { getNovaPoshtaConfig } from './config'
import { NovaPoshtaService } from './service'

export const createNovaPoshtaService = (): NovaPoshtaService => {
  const config = getNovaPoshtaConfig()
  return new NovaPoshtaService(
    new NovaPoshtaClient({ apiKey: config.apiKey, apiUrl: config.apiUrl }),
    config,
  )
}

export * from './errors'
export * from './types'
export * from './validation'
