import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  clearCart: vi.fn(),
  confirmOrder: vi.fn(),
  initiatePayment: vi.fn(),
  routerPush: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a>,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}))
vi.mock('@payloadcms/plugin-ecommerce/client/react', () => ({
  useCart: () => ({
    cart: {
      id: 1,
      items: [{ product: { id: 1, title: 'Test book' }, quantity: 1 }],
      subtotal: 25000,
    },
    clearCart: mocks.clearCart,
  }),
  usePayments: () => ({
    confirmOrder: mocks.confirmOrder,
    initiatePayment: mocks.initiatePayment,
  }),
}))
vi.mock('@/components/Media', () => ({ Media: () => null }))
vi.mock('@/components/Message', () => ({
  Message: ({ error }: { error: string }) => <div>{error}</div>,
}))
vi.mock('@/components/Price', () => ({
  Price: ({ amount }: { amount: number }) => <span>{amount}</span>,
}))
vi.mock('@/components/LoadingSpinner', () => ({ LoadingSpinner: () => null }))
vi.mock('@/components/checkout/NovaPoshtaOfficeSelector', () => ({
  NOVA_POSHTA_DELIVERY_STORAGE_KEY: 'nova-poshta-delivery',
  NovaPoshtaOfficeSelector: ({ onChange }: { onChange: (value: unknown) => void }) => (
    <button
      onClick={() =>
        onChange({
          provider: 'nova-poshta',
          serviceType: 'WarehouseWarehouse',
          warehouse: {
            cityDescription: 'Київ',
            description: 'Відділення №1',
            number: '1',
            ref: 'warehouse-ref',
            shortAddress: 'вул. Хрещатик, 1',
          },
        })
      }
      type="button"
    >
      Select Nova Poshta office
    </button>
  ),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { CheckoutPage } from '@/components/checkout/CheckoutPage'

const completeCheckoutDetails = () => {
  fireEvent.change(screen.getByLabelText('First name*'), { target: { value: 'Zlata' } })
  fireEvent.change(screen.getByLabelText('Last name*'), { target: { value: 'Solovey' } })
  fireEvent.change(screen.getByLabelText('Phone number*'), {
    target: { value: '+380000000000' },
  })
  fireEvent.change(screen.getByLabelText('Email Address'), {
    target: { value: 'customer@example.com' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(screen.getByRole('button', { name: 'Select Nova Poshta office' }))
}

describe('checkout payment selection', () => {
  beforeEach(() => {
    mocks.clearCart.mockReset().mockResolvedValue(undefined)
    mocks.confirmOrder.mockReset()
    mocks.initiatePayment.mockReset()
    mocks.routerPush.mockReset()
    sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
    document.querySelectorAll('body > form').forEach((form) => form.remove())
    vi.restoreAllMocks()
  })

  it('submits the LiqPay checkout form when LiqPay is selected', async () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => undefined)
    mocks.initiatePayment.mockResolvedValue({
      checkoutURL: 'https://www.liqpay.ua/api/3/checkout',
      data: 'encoded-data',
      signature: 'encoded-signature',
    })
    render(<CheckoutPage />)
    completeCheckoutDetails()

    expect((screen.getByRole('radio', { name: 'LiqPay' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Place order' }))

    await waitFor(() => expect(submit).toHaveBeenCalledOnce())
    expect(mocks.initiatePayment).toHaveBeenCalledWith('liqpay', expect.any(Object))
    expect(mocks.confirmOrder).not.toHaveBeenCalled()
  })

  it('creates the order locally when bank transfer is selected', async () => {
    mocks.initiatePayment.mockResolvedValue({ referenceID: 'bank-reference' })
    mocks.confirmOrder.mockResolvedValue({ accessToken: 'guest-token', orderID: 42 })
    render(<CheckoutPage />)
    completeCheckoutDetails()

    fireEvent.click(screen.getByRole('radio', { name: 'Оплатити за реквізитами' }))
    fireEvent.click(screen.getByRole('button', { name: 'Place order' }))

    await waitFor(() =>
      expect(mocks.confirmOrder).toHaveBeenCalledWith('bankTransfer', {
        additionalData: {
          customerEmail: 'customer@example.com',
          referenceID: 'bank-reference',
        },
      }),
    )
    expect(mocks.initiatePayment).toHaveBeenCalledWith('bankTransfer', expect.any(Object))
    expect(mocks.clearCart).toHaveBeenCalledOnce()
    expect(mocks.routerPush).toHaveBeenCalledWith(
      '/orders/42?email=customer%40example.com&accessToken=guest-token',
    )
  })
})
