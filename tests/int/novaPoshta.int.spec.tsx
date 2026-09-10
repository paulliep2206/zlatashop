import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NovaPoshtaOfficeSelector } from '@/components/checkout/NovaPoshtaOfficeSelector'
import { NovaPoshtaClient } from '@/integrations/nova-poshta/client'
import { getNovaPoshtaConfig } from '@/integrations/nova-poshta/config'
import {
  createNovaPoshtaCitiesEndpoint,
  createNovaPoshtaWarehousesEndpoint,
} from '@/integrations/nova-poshta/endpoints'
import { NovaPoshtaError, getPublicNovaPoshtaError } from '@/integrations/nova-poshta/errors'
import { fulfillNovaPoshtaOrder } from '@/integrations/nova-poshta/fulfillment'
import { NovaPoshtaService } from '@/integrations/nova-poshta/service'
import type { NovaPoshtaDelivery, NovaPoshtaWarehouse } from '@/integrations/nova-poshta/types'
import { parseDelivery, parseWarehouse } from '@/integrations/nova-poshta/validation'

const apiWarehouse = {
  Ref: 'warehouse-ref',
  Description: 'Відділення №1',
  ShortAddress: 'вул. Хрещатик, 1',
  CityRef: 'city-ref',
  CityDescription: 'Київ',
  Number: '1',
  CategoryOfWarehouse: 'Branch',
}

const warehouse: NovaPoshtaWarehouse = {
  ref: 'warehouse-ref',
  description: 'Відділення №1',
  shortAddress: 'вул. Хрещатик, 1',
  cityRef: 'city-ref',
  cityDescription: 'Київ',
  number: '1',
  categoryOfWarehouse: 'Branch',
}

const delivery: NovaPoshtaDelivery = {
  provider: 'nova-poshta',
  serviceType: 'WarehouseWarehouse',
  warehouse,
}

const config = {
  apiKey: 'api-key',
  apiUrl: 'https://example.test',
  sender: {
    cityRef: 'sender-city',
    contactRef: 'sender-contact',
    phone: '380501234567',
    ref: 'sender-ref',
    warehouseRef: 'sender-warehouse',
  },
  shipment: { description: 'Books', weight: 1 },
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('NovaPoshtaClient', () => {
  it('sends a typed API request and returns data', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ success: true, data: [apiWarehouse], errors: [], warnings: [], info: {} }),
      )
    const client = new NovaPoshtaClient({
      apiKey: 'secret',
      apiUrl: 'https://example.test',
      fetch: fetchMock,
    })

    await expect(
      client.call({
        modelName: 'AddressGeneral',
        calledMethod: 'getWarehouses',
        methodProperties: { CityName: 'Київ' },
      }),
    ).resolves.toEqual([apiWarehouse])

    const [, request] = fetchMock.mock.calls[0]!
    expect(request).toMatchObject({ method: 'POST' })
    expect(JSON.parse(request.body)).toEqual({
      apiKey: 'secret',
      modelName: 'AddressGeneral',
      calledMethod: 'getWarehouses',
      methodProperties: { CityName: 'Київ' },
    })
  })

  it.each([
    [vi.fn().mockRejectedValue(new Error('offline')), 'REMOTE_API'],
    [vi.fn().mockResolvedValue(new Response(null, { status: 503 })), 'REMOTE_API'],
    [vi.fn().mockResolvedValue(new Response('not-json')), 'INVALID_RESPONSE'],
    [
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ success: false, data: [], errors: ['Bad key'], warnings: [], info: {} }),
        ),
      'REMOTE_API',
    ],
  ])('normalizes transport and response failures', async (fetchMock, code) => {
    const client = new NovaPoshtaClient({
      apiKey: 'secret',
      apiUrl: 'https://example.test',
      fetch: fetchMock,
    })

    await expect(
      client.call({
        modelName: 'AddressGeneral',
        calledMethod: 'getWarehouses',
        methodProperties: {},
      }),
    ).rejects.toMatchObject({ code })
  })
})

describe('NovaPoshtaService', () => {
  it('retrieves and normalizes warehouses', async () => {
    const client = { call: vi.fn().mockResolvedValue([apiWarehouse]) }
    const service = new NovaPoshtaService(client as never, config)

    await expect(service.getWarehouses({ cityRef: ' city-ref ', limit: 500 })).resolves.toEqual([
      warehouse,
    ])
    expect(client.call).toHaveBeenCalledWith(
      expect.objectContaining({
        calledMethod: 'getWarehouses',
        methodProperties: expect.objectContaining({
          CityRef: 'city-ref',
          Limit: '100',
          Page: '1',
        }),
      }),
    )
  })

  it('validates the warehouse city query', async () => {
    const service = new NovaPoshtaService({ call: vi.fn() } as never, config)
    await expect(service.getWarehouses({ cityRef: '' })).rejects.toMatchObject({
      code: 'VALIDATION',
    })
  })

  it('retrieves city suggestions and validates short searches', async () => {
    const apiCity = {
      Ref: 'city-ref',
      Description: 'Музичі',
      AreaDescription: 'Київська',
      SettlementTypeDescription: 'село',
    }
    const client = { call: vi.fn().mockResolvedValue([apiCity]) }
    const service = new NovaPoshtaService(client as never, config)

    await expect(service.getCities({ search: ' Музичі ' })).resolves.toEqual([
      {
        ref: 'city-ref',
        description: 'Музичі',
        areaDescription: 'Київська',
        settlementTypeDescription: 'село',
      },
    ])
    expect(client.call).toHaveBeenCalledWith(
      expect.objectContaining({
        calledMethod: 'getCities',
        methodProperties: expect.objectContaining({
          FindByString: 'Музичі',
          Limit: '20',
          Page: '1',
        }),
      }),
    )
    await expect(service.getCities({ search: 'М' })).rejects.toMatchObject({
      code: 'VALIDATION',
    })
  })

  it('creates a WarehouseWarehouse waybill', async () => {
    const client = {
      call: vi.fn().mockResolvedValue([
        {
          Ref: 'waybill-ref',
          IntDocNumber: '20450000000000',
          CostOnSite: '80',
          EstimatedDeliveryDate: '24.07.2026',
        },
      ]),
    }
    const service = new NovaPoshtaService(client as never, config)

    await expect(
      service.createWaybill({
        delivery,
        recipient: { firstName: 'Іван', lastName: 'Петренко', phone: '380671234567' },
        order: { amount: 12345, description: 'Books', weight: 1 },
      }),
    ).resolves.toMatchObject({ IntDocNumber: '20450000000000' })

    expect(client.call).toHaveBeenCalledWith(
      expect.objectContaining({
        calledMethod: 'save',
        modelName: 'InternetDocument',
        methodProperties: expect.objectContaining({
          CityRecipient: 'city-ref',
          RecipientAddress: 'warehouse-ref',
          RecipientName: 'Іван Петренко',
          Cost: '123',
          ServiceType: 'WarehouseWarehouse',
        }),
      }),
    )
  })

  it('rejects incomplete recipient and incomplete waybill responses', async () => {
    const service = new NovaPoshtaService(
      { call: vi.fn().mockResolvedValue([{}]) } as never,
      config,
    )
    await expect(
      service.createWaybill({
        delivery,
        recipient: { firstName: '', lastName: '', phone: '' },
        order: { amount: 100, description: 'Books', weight: 1 },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })

    await expect(
      service.createWaybill({
        delivery,
        recipient: { firstName: 'Іван', lastName: 'Петренко', phone: '380671234567' },
        order: { amount: 100, description: 'Books', weight: 1 },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
})

describe('Nova Poshta validation and configuration', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('parses the API warehouse and checkout delivery JSON', () => {
    expect(parseWarehouse(apiWarehouse)).toEqual(warehouse)
    expect(parseDelivery(delivery)).toEqual(delivery)
  })

  it.each([null, {}, { provider: 'other' }])('rejects invalid delivery JSON', (value) => {
    expect(() => parseDelivery(value)).toThrow(NovaPoshtaError)
  })

  it('loads secrets from server environment and validates missing settings', () => {
    process.env.NOVA_POSHTA_API_KEY = 'key'
    process.env.NOVA_POSHTA_SENDER_CITY_REF = 'city'
    process.env.NOVA_POSHTA_SENDER_CONTACT_REF = 'contact'
    process.env.NOVA_POSHTA_SENDER_PHONE = 'phone'
    process.env.NOVA_POSHTA_SENDER_REF = 'sender'
    process.env.NOVA_POSHTA_SENDER_WAREHOUSE_REF = 'office'
    expect(getNovaPoshtaConfig()).toMatchObject({ apiKey: 'key' })

    delete process.env.NOVA_POSHTA_API_KEY
    expect(() => getNovaPoshtaConfig()).toThrow(/not configured/)
  })

  it('only exposes validation details to storefront users', () => {
    expect(getPublicNovaPoshtaError(new NovaPoshtaError('Bad city', 'VALIDATION'))).toBe('Bad city')
    expect(
      getPublicNovaPoshtaError(new NovaPoshtaError('secret error', 'REMOTE_API')),
    ).not.toContain('secret')
  })
})

describe('Nova Poshta paid-order fulfillment', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.NOVA_POSHTA_API_KEY = 'key'
    process.env.NOVA_POSHTA_SENDER_CITY_REF = 'city'
    process.env.NOVA_POSHTA_SENDER_CONTACT_REF = 'contact'
    process.env.NOVA_POSHTA_SENDER_PHONE = 'phone'
    process.env.NOVA_POSHTA_SENDER_REF = 'sender'
    process.env.NOVA_POSHTA_SENDER_WAREHOUSE_REF = 'office'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  const makeContext = () => {
    const payload = {
      update: vi.fn().mockResolvedValue({}),
      findByID: vi.fn().mockResolvedValue({
        amount: 12000,
        shippingAddress: { firstName: 'Іван', lastName: 'Петренко', phone: '380671234567' },
      }),
      logger: { error: vi.fn() },
    }
    const req = { payload } as never
    return { req, payload }
  }

  it('saves selection without creating a waybill when automation is disabled', async () => {
    const { req, payload } = makeContext()
    await fulfillNovaPoshtaOrder({ delivery, orderID: 42, req, createWaybill: false })

    expect(payload.update).toHaveBeenCalledOnce()
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          novaPoshtaShipping: {
            delivery,
            waybill: { status: 'not-requested' },
          },
        },
      }),
    )
  })

  it('records a created waybill', async () => {
    const { req, payload } = makeContext()
    const createWaybill = vi.fn().mockResolvedValue({
      Ref: 'waybill-ref',
      IntDocNumber: '20450000000000',
      CostOnSite: '80',
    })
    await fulfillNovaPoshtaOrder({
      delivery,
      orderID: 42,
      req,
      createWaybill: true,
      createService: () => ({ createWaybill }) as never,
    })

    expect(createWaybill).toHaveBeenCalled()
    expect(payload.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: {
          novaPoshtaShipping: {
            delivery,
            waybill: expect.objectContaining({
              status: 'created',
              number: '20450000000000',
            }),
          },
        },
      }),
    )
  })

  it('keeps the paid order and records a failed waybill', async () => {
    const { req, payload } = makeContext()
    await fulfillNovaPoshtaOrder({
      delivery,
      orderID: 42,
      req,
      createWaybill: true,
      createService: () =>
        ({ createWaybill: vi.fn().mockRejectedValue(new Error('API failed')) }) as never,
    })
    expect(payload.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: {
          novaPoshtaShipping: {
            delivery,
            waybill: {
              status: 'failed',
              error: 'Nova Poshta service is temporarily unavailable. Please try again.',
            },
          },
        },
      }),
    )
  })
})

describe('Nova Poshta warehouse endpoint', () => {
  it('returns warehouses and maps validation failures to HTTP 400', async () => {
    const logger = { error: vi.fn() }
    const successEndpoint = createNovaPoshtaWarehousesEndpoint(
      () => ({ getWarehouses: vi.fn().mockResolvedValue([warehouse]) }) as never,
    )
    const success = await successEndpoint.handler({
      url: 'http://localhost/api/nova-poshta/warehouses?cityRef=city-ref',
      payload: { logger },
    } as never)
    expect(success.status).toBe(200)
    await expect(success.json()).resolves.toEqual({ warehouses: [warehouse] })

    const invalidEndpoint = createNovaPoshtaWarehousesEndpoint(
      () =>
        ({
          getWarehouses: vi
            .fn()
            .mockRejectedValue(new NovaPoshtaError('Enter a city.', 'VALIDATION')),
        }) as never,
    )
    const invalid = await invalidEndpoint.handler({
      url: 'http://localhost/api/nova-poshta/warehouses',
      payload: { logger },
    } as never)
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toEqual({ message: 'Enter a city.' })
  })

  it('returns city suggestions', async () => {
    const city = {
      ref: 'city-ref',
      description: 'Музичі',
      areaDescription: 'Київська',
      settlementTypeDescription: 'село',
    }
    const endpoint = createNovaPoshtaCitiesEndpoint(
      () => ({ getCities: vi.fn().mockResolvedValue([city]) }) as never,
    )
    const response = await endpoint.handler({
      url: 'http://localhost/api/nova-poshta/cities?search=Музичі',
      payload: { logger: { error: vi.fn() } },
    } as never)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ cities: [city] })
  })
})

describe('NovaPoshtaOfficeSelector', () => {
  it('suggests cities while typing and loads offices without a search button', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        Response.json({
          cities: [
            {
              ref: 'city-ref',
              description: 'Музичі',
              areaDescription: 'Київська',
              settlementTypeDescription: 'село',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json({ warehouses: [] }))
      .mockResolvedValueOnce(Response.json({ warehouses: [warehouse] }))
    const onChange = vi.fn()

    render(<NovaPoshtaOfficeSelector onChange={onChange} />)
    expect(screen.queryByRole('button', { name: /find offices/i })).toBeNull()

    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Муз' } })
    expect(await screen.findByRole('option', { name: /Музичі/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Музичі/i }))
    await screen.findByText(/No Nova Poshta offices found/i)
    const officeInput = screen.getByLabelText('Nova Poshta office')
    fireEvent.focus(officeInput)
    fireEvent.change(officeInput, { target: { value: '1' } })
    expect(await screen.findByRole('option', { name: /Відділення №1/i })).toBeTruthy()
    fireEvent.blur(officeInput)
    expect(screen.queryByRole('option', { name: /Відділення №1/i })).toBeNull()
    fireEvent.focus(officeInput)
    expect(screen.getByRole('option', { name: /Відділення №1/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Відділення №1/i }))

    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/nova-poshta/cities?')
    expect(fetchMock.mock.calls[1]?.[0]).toContain('cityRef=city-ref')
    expect(fetchMock.mock.calls[2]?.[0]).toContain('search=1')
    expect(onChange).toHaveBeenLastCalledWith(delivery)
  })
})
