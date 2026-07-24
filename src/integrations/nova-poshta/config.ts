import { NovaPoshtaError } from './errors'

export type NovaPoshtaConfig = {
  apiKey: string
  apiUrl: string
  sender: {
    cityRef: string
    contactRef: string
    phone: string
    ref: string
    warehouseRef: string
  }
  shipment: {
    description: string
    weight: number
  }
}

export const getNovaPoshtaConfig = (): NovaPoshtaConfig => {
  const required = {
    apiKey: process.env.NOVA_POSHTA_API_KEY,
    cityRef: process.env.NOVA_POSHTA_SENDER_CITY_REF,
    contactRef: process.env.NOVA_POSHTA_SENDER_CONTACT_REF,
    phone: process.env.NOVA_POSHTA_SENDER_PHONE,
    ref: process.env.NOVA_POSHTA_SENDER_REF,
    warehouseRef: process.env.NOVA_POSHTA_SENDER_WAREHOUSE_REF,
  }

  const missing = Object.entries(required)
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name)

  if (missing.length) {
    throw new NovaPoshtaError(
      `Nova Poshta is not configured: ${missing.join(', ')}`,
      'CONFIGURATION',
      { details: missing },
    )
  }

  const weight = Number(process.env.NOVA_POSHTA_DEFAULT_WEIGHT_KG ?? '1')
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new NovaPoshtaError('NOVA_POSHTA_DEFAULT_WEIGHT_KG must be positive.', 'CONFIGURATION')
  }

  return {
    apiKey: required.apiKey!,
    apiUrl: process.env.NOVA_POSHTA_API_URL ?? 'https://api.novaposhta.ua/v2.0/json/',
    sender: {
      cityRef: required.cityRef!,
      contactRef: required.contactRef!,
      phone: required.phone!,
      ref: required.ref!,
      warehouseRef: required.warehouseRef!,
    },
    shipment: {
      description: process.env.NOVA_POSHTA_SHIPMENT_DESCRIPTION ?? 'Books',
      weight,
    },
  }
}
