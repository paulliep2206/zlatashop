import type { Endpoint } from 'payload'

import { createNovaPoshtaService } from '.'
import { getPublicNovaPoshtaError, NovaPoshtaError } from './errors'

export const createNovaPoshtaWarehousesEndpoint = (
  createService: typeof createNovaPoshtaService = createNovaPoshtaService,
): Endpoint => ({
  path: '/nova-poshta/warehouses',
  method: 'get',
  handler: async (req) => {
    const url = new URL(req.url ?? 'http://localhost/api/nova-poshta/warehouses')

    try {
      const warehouses = await createService().getWarehouses({
        cityRef: url.searchParams.get('cityRef') ?? '',
        search: url.searchParams.get('search') ?? '',
      })

      return Response.json({ warehouses })
    } catch (error) {
      req.payload.logger.error({ err: error }, 'Nova Poshta warehouse lookup failed')
      const status = error instanceof NovaPoshtaError && error.code === 'VALIDATION' ? 400 : 502
      return Response.json({ message: getPublicNovaPoshtaError(error) }, { status })
    }
  },
})

export const novaPoshtaWarehousesEndpoint = createNovaPoshtaWarehousesEndpoint()

export const createNovaPoshtaCitiesEndpoint = (
  createService: typeof createNovaPoshtaService = createNovaPoshtaService,
): Endpoint => ({
  path: '/nova-poshta/cities',
  method: 'get',
  handler: async (req) => {
    const url = new URL(req.url ?? 'http://localhost/api/nova-poshta/cities')

    try {
      const cities = await createService().getCities({
        search: url.searchParams.get('search') ?? '',
      })
      return Response.json({ cities })
    } catch (error) {
      req.payload.logger.error({ err: error }, 'Nova Poshta city lookup failed')
      const status = error instanceof NovaPoshtaError && error.code === 'VALIDATION' ? 400 : 502
      return Response.json({ message: getPublicNovaPoshtaError(error) }, { status })
    }
  },
})

export const novaPoshtaCitiesEndpoint = createNovaPoshtaCitiesEndpoint()
