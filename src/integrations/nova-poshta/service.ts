import { format } from 'date-fns'

import { NovaPoshtaClient } from './client'
import type { NovaPoshtaConfig } from './config'
import { NovaPoshtaError } from './errors'
import type {
  CreateWaybillInput,
  NovaPoshtaCity,
  NovaPoshtaWarehouse,
  NovaPoshtaWaybillResult,
} from './types'
import { parseCity, parseWarehouse } from './validation'

export class NovaPoshtaService {
  constructor(
    private readonly client: NovaPoshtaClient,
    private readonly config: NovaPoshtaConfig,
  ) {}

  async getWarehouses(input: {
    cityRef: string
    search?: string
    limit?: number
    page?: number
  }): Promise<NovaPoshtaWarehouse[]> {
    const cityRef = input.cityRef.trim()
    if (!cityRef) {
      throw new NovaPoshtaError('Select a Nova Poshta city.', 'VALIDATION')
    }

    const data = await this.client.call<unknown, Record<string, unknown>>({
      modelName: 'AddressGeneral',
      calledMethod: 'getWarehouses',
      methodProperties: {
        CityRef: cityRef,
        FindByString: input.search?.trim() ?? '',
        Language: 'UA',
        Limit: String(Math.min(Math.max(input.limit ?? 50, 1), 100)),
        Page: String(Math.max(input.page ?? 1, 1)),
      },
    })

    return data.map(parseWarehouse)
  }

  async getCities(input: { search: string; limit?: number }): Promise<NovaPoshtaCity[]> {
    const search = input.search.trim()
    if (search.length < 2) {
      throw new NovaPoshtaError('Enter at least 2 characters for the city.', 'VALIDATION')
    }

    const data = await this.client.call<unknown, Record<string, unknown>>({
      modelName: 'AddressGeneral',
      calledMethod: 'getCities',
      methodProperties: {
        FindByString: search,
        Limit: String(Math.min(Math.max(input.limit ?? 20, 1), 50)),
        Page: '1',
      },
    })

    return data.map(parseCity)
  }

  async createWaybill(input: CreateWaybillInput): Promise<NovaPoshtaWaybillResult> {
    const recipientName = `${input.recipient.firstName} ${input.recipient.lastName}`.trim()
    if (!recipientName || !input.recipient.phone.trim()) {
      throw new NovaPoshtaError('Recipient name and phone are required.', 'VALIDATION')
    }

    const [result] = await this.client.call<NovaPoshtaWaybillResult, Record<string, unknown>>({
      modelName: 'InternetDocument',
      calledMethod: 'save',
      methodProperties: {
        PayerType: 'Sender',
        PaymentMethod: 'NonCash',
        DateTime: format(new Date(), 'dd.MM.yyyy'),
        CargoType: 'Parcel',
        Weight: String(input.order.weight),
        ServiceType: input.delivery.serviceType,
        SeatsAmount: '1',
        Description: input.order.description,
        Cost: String(Math.max(Math.round(input.order.amount / 100), 1)),
        CitySender: this.config.sender.cityRef,
        Sender: this.config.sender.ref,
        SenderAddress: this.config.sender.warehouseRef,
        ContactSender: this.config.sender.contactRef,
        SendersPhone: this.config.sender.phone,
        CityRecipient: input.delivery.warehouse.cityRef,
        RecipientAddress: input.delivery.warehouse.ref,
        RecipientName: recipientName,
        RecipientType: 'PrivatePerson',
        RecipientsPhone: input.recipient.phone,
      },
    })

    if (!result?.Ref || !result.IntDocNumber) {
      throw new NovaPoshtaError('Nova Poshta did not return a waybill number.', 'INVALID_RESPONSE')
    }

    return result
  }
}
