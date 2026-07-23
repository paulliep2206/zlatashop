'use client'

import { Message } from '@/components/Message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  NovaPoshtaCity,
  NovaPoshtaDelivery,
  NovaPoshtaWarehouse,
} from '@/integrations/nova-poshta/types'
import { useEffect, useState } from 'react'

type Props = {
  disabled?: boolean
  onChange: (delivery: NovaPoshtaDelivery | undefined) => void
  value?: NovaPoshtaDelivery
}

export const NOVA_POSHTA_DELIVERY_STORAGE_KEY = 'nova-poshta-delivery'

export const NovaPoshtaOfficeSelector: React.FC<Props> = ({ disabled, onChange, value }) => {
  const [city, setCity] = useState(value?.warehouse.cityDescription ?? '')
  const [selectedCity, setSelectedCity] = useState<NovaPoshtaCity>()
  const [citySuggestions, setCitySuggestions] = useState<NovaPoshtaCity[]>([])
  const [officeSearch, setOfficeSearch] = useState(
    value ? `№${value.warehouse.number} — ${value.warehouse.shortAddress}` : '',
  )
  const [officeSelected, setOfficeSelected] = useState(Boolean(value))
  const [officeFocused, setOfficeFocused] = useState(false)
  const [warehouses, setWarehouses] = useState<NovaPoshtaWarehouse[]>([])
  const [error, setError] = useState<string>()
  const [loadingCities, setLoadingCities] = useState(false)
  const [loadingWarehouses, setLoadingWarehouses] = useState(false)

  useEffect(() => {
    if (selectedCity || city.trim().length < 2) {
      setCitySuggestions([])
      setLoadingCities(false)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLoadingCities(true)
      setError(undefined)

      try {
        const params = new URLSearchParams({ search: city.trim() })
        const response = await fetch(`/api/nova-poshta/cities?${params}`, {
          signal: controller.signal,
        })
        const body = (await response.json()) as {
          cities?: NovaPoshtaCity[]
          message?: string
        }

        if (!response.ok || !body.cities) {
          throw new Error(body.message ?? 'Could not load Nova Poshta cities.')
        }

        setCitySuggestions(body.cities)
      } catch (error) {
        if (!controller.signal.aborted) {
          setCitySuggestions([])
          setError(error instanceof Error ? error.message : 'Could not load Nova Poshta cities.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingCities(false)
        }
      }
    }, 300)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [city, selectedCity])

  useEffect(() => {
    if (!selectedCity || officeSelected) {
      setWarehouses([])
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(
      async () => {
        setLoadingWarehouses(true)
        setError(undefined)

        try {
          const params = new URLSearchParams({
            cityRef: selectedCity.ref,
            search: officeSearch.trim(),
          })
          const response = await fetch(`/api/nova-poshta/warehouses?${params}`, {
            signal: controller.signal,
          })
          const body = (await response.json()) as {
            message?: string
            warehouses?: NovaPoshtaWarehouse[]
          }

          if (!response.ok || !body.warehouses) {
            throw new Error(body.message ?? 'Could not load Nova Poshta offices.')
          }

          setWarehouses(body.warehouses)
          if (!body.warehouses.length) {
            setError('No Nova Poshta offices found. Check the office number or address.')
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            setWarehouses([])
            setError(error instanceof Error ? error.message : 'Could not load Nova Poshta offices.')
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoadingWarehouses(false)
          }
        }
      },
      officeSearch ? 300 : 0,
    )

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [officeSearch, officeSelected, selectedCity])

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-medium text-3xl">Delivery</h2>
      <p>Select a Nova Poshta office for this order.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="relative flex flex-col gap-2">
          <Label htmlFor="nova-poshta-city">City</Label>
          <Input
            aria-autocomplete="list"
            aria-controls="nova-poshta-city-suggestions"
            aria-expanded={citySuggestions.length > 0}
            disabled={disabled}
            id="nova-poshta-city"
            onChange={(event) => {
              setError(undefined)
              setCity(event.target.value)
              setSelectedCity(undefined)
              setOfficeSearch('')
              setOfficeSelected(false)
              setWarehouses([])
              onChange(undefined)
              sessionStorage.removeItem(NOVA_POSHTA_DELIVERY_STORAGE_KEY)
            }}
            placeholder="Київ"
            value={city}
          />
          {loadingCities && <p className="text-sm">Searching cities…</p>}
          {citySuggestions.length > 0 && (
            <ul
              className="bg-background absolute top-full z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border shadow-md"
              id="nova-poshta-city-suggestions"
              role="listbox"
            >
              {citySuggestions.map((suggestion) => (
                <li key={suggestion.ref} role="option">
                  <button
                    className="hover:bg-accent focus:bg-accent w-full px-3 py-2 text-left"
                    onClick={(event) => {
                      event.preventDefault()
                      setCity(suggestion.description)
                      setSelectedCity(suggestion)
                      setCitySuggestions([])
                      setOfficeSearch('')
                      setOfficeSelected(false)
                      onChange(undefined)
                    }}
                    type="button"
                  >
                    {[suggestion.settlementTypeDescription, suggestion.description]
                      .filter(Boolean)
                      .join(' ')}
                    {suggestion.areaDescription ? `, ${suggestion.areaDescription} область` : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="relative flex flex-col gap-2">
          <Label htmlFor="nova-poshta-office">Nova Poshta office</Label>
          <Input
            aria-autocomplete="list"
            aria-controls="nova-poshta-office-suggestions"
            aria-expanded={officeFocused && !officeSelected && warehouses.length > 0}
            disabled={disabled || !selectedCity}
            id="nova-poshta-office"
            onBlur={() => setOfficeFocused(false)}
            onChange={(event) => {
              setOfficeSearch(event.target.value)
              setOfficeSelected(false)
              onChange(undefined)
              sessionStorage.removeItem(NOVA_POSHTA_DELIVERY_STORAGE_KEY)
            }}
            onFocus={() => setOfficeFocused(true)}
            placeholder="Type office number or address"
            value={officeSearch}
          />
          {officeFocused && !officeSelected && warehouses.length > 0 && (
            <ul
              className="bg-background absolute top-full z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border shadow-md"
              id="nova-poshta-office-suggestions"
              role="listbox"
            >
              {warehouses.map((warehouse) => (
                <li key={warehouse.ref} role="option">
                  <button
                    className="hover:bg-accent focus:bg-accent w-full px-3 py-2 text-left"
                    onClick={(event) => {
                      event.preventDefault()
                      const delivery = {
                        provider: 'nova-poshta',
                        serviceType: 'WarehouseWarehouse',
                        warehouse,
                      } satisfies NovaPoshtaDelivery

                      setOfficeSearch(`№${warehouse.number} — ${warehouse.shortAddress}`)
                      setOfficeSelected(true)
                      setOfficeFocused(false)
                      setWarehouses([])
                      onChange(delivery)
                      sessionStorage.setItem(
                        NOVA_POSHTA_DELIVERY_STORAGE_KEY,
                        JSON.stringify(delivery),
                      )
                    }}
                    onMouseDown={(event) => event.preventDefault()}
                    type="button"
                  >
                    {warehouse.description} — {warehouse.shortAddress}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {error && <Message error={error} />}
      {loadingWarehouses && <p className="text-sm">Loading offices…</p>}
      {value && (
        <p className="text-sm">
          Selected: {value.warehouse.description}, {value.warehouse.shortAddress}
        </p>
      )}
    </section>
  )
}
