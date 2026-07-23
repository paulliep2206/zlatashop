import { NovaPoshtaError } from './errors'
import type { NovaPoshtaCity, NovaPoshtaDelivery, NovaPoshtaWarehouse } from './types'

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

export const parseWarehouse = (value: unknown): NovaPoshtaWarehouse => {
  if (!value || typeof value !== 'object') {
    throw new NovaPoshtaError('Invalid Nova Poshta warehouse.', 'INVALID_RESPONSE')
  }

  const warehouse = value as Record<string, unknown>
  const parsed = {
    ref: warehouse.Ref,
    description: warehouse.Description,
    shortAddress: warehouse.ShortAddress,
    cityRef: warehouse.CityRef,
    cityDescription: warehouse.CityDescription,
    number: warehouse.Number,
    categoryOfWarehouse: warehouse.CategoryOfWarehouse,
  }

  if (!Object.values(parsed).every(nonEmptyString)) {
    throw new NovaPoshtaError('Nova Poshta returned an incomplete warehouse.', 'INVALID_RESPONSE')
  }

  return parsed as NovaPoshtaWarehouse
}

export const parseCity = (value: unknown): NovaPoshtaCity => {
  if (!value || typeof value !== 'object') {
    throw new NovaPoshtaError('Invalid Nova Poshta city.', 'INVALID_RESPONSE')
  }

  const city = value as Record<string, unknown>
  return {
    ref: requireString(city.Ref, 'city ref'),
    description: requireString(city.Description, 'city description'),
    areaDescription: typeof city.AreaDescription === 'string' ? city.AreaDescription : '',
    settlementTypeDescription:
      typeof city.SettlementTypeDescription === 'string' ? city.SettlementTypeDescription : '',
  }
}

export const parseDelivery = (value: unknown): NovaPoshtaDelivery => {
  if (!value || typeof value !== 'object') {
    throw new NovaPoshtaError('Select a Nova Poshta office.', 'VALIDATION')
  }

  const delivery = value as Record<string, unknown>
  if (delivery.provider !== 'nova-poshta' || delivery.serviceType !== 'WarehouseWarehouse') {
    throw new NovaPoshtaError('Unsupported delivery service.', 'VALIDATION')
  }

  try {
    const warehouse = delivery.warehouse as Record<string, unknown>
    return {
      provider: 'nova-poshta',
      serviceType: 'WarehouseWarehouse',
      warehouse: {
        ref: requireString(warehouse?.ref, 'warehouse ref'),
        description: requireString(warehouse?.description, 'warehouse description'),
        shortAddress: requireString(warehouse?.shortAddress, 'warehouse address'),
        cityRef: requireString(warehouse?.cityRef, 'city ref'),
        cityDescription: requireString(warehouse?.cityDescription, 'city'),
        number: requireString(warehouse?.number, 'warehouse number'),
        categoryOfWarehouse: requireString(warehouse?.categoryOfWarehouse, 'warehouse category'),
      },
    }
  } catch (error) {
    throw new NovaPoshtaError('Select a valid Nova Poshta office.', 'VALIDATION', { cause: error })
  }
}

const requireString = (value: unknown, name: string): string => {
  if (!nonEmptyString(value)) {
    throw new NovaPoshtaError(`Missing ${name}.`, 'VALIDATION')
  }
  return value.trim()
}
