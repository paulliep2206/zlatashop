export type NovaPoshtaApiRequest<TProperties extends Record<string, unknown>> = {
  apiKey: string
  calledMethod: string
  methodProperties: TProperties
  modelName: 'AddressGeneral' | 'InternetDocument'
}

export type NovaPoshtaApiResponse<T> = {
  data: T[]
  errors: string[]
  info: Record<string, unknown>
  success: boolean
  warnings: string[]
}

export type NovaPoshtaWarehouse = {
  ref: string
  description: string
  shortAddress: string
  cityRef: string
  cityDescription: string
  number: string
  categoryOfWarehouse: string
}

export type NovaPoshtaCity = {
  ref: string
  description: string
  areaDescription: string
  settlementTypeDescription: string
}

export type NovaPoshtaDelivery = {
  provider: 'nova-poshta'
  serviceType: 'WarehouseWarehouse'
  warehouse: NovaPoshtaWarehouse
}

export type NovaPoshtaWaybill = {
  status: 'not-requested' | 'created' | 'failed'
  ref?: string
  number?: string
  cost?: number
  estimatedDeliveryDate?: string
  error?: string
  createdAt?: string
}

export type NovaPoshtaOrderShipping = {
  delivery: NovaPoshtaDelivery
  waybill: NovaPoshtaWaybill
}

export type CreateWaybillInput = {
  delivery: NovaPoshtaDelivery
  recipient: {
    firstName: string
    lastName: string
    phone: string
  }
  order: {
    amount: number
    description: string
    weight: number
  }
}

export type NovaPoshtaWaybillResult = {
  Ref: string
  CostOnSite?: string
  EstimatedDeliveryDate?: string
  IntDocNumber: string
}
