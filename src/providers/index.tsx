import { AuthProvider } from '@/providers/Auth'
import { EcommerceProvider } from '@payloadcms/plugin-ecommerce/client/react'
import React from 'react'

import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'
import { SonnerProvider } from '@/providers/Sonner'
import { liqpayAdapterClient } from '@/integrations/liqpay/client-adapter'
import { bankTransferAdapterClient } from '@/integrations/bank-transfer/client-adapter'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HeaderThemeProvider>
          <SonnerProvider />
          <EcommerceProvider
            enableVariants={true}
            api={{
              cartsFetchQuery: {
                depth: 2,
                populate: {
                  products: {
                    slug: true,
                    title: true,
                    gallery: true,
                    stock: true,
                    stockStatus: true,
                    price: true,
                    specialPrice: true,
                  },
                  variants: {
                    title: true,
                    inventory: true,
                  },
                },
              },
            }}
            currenciesConfig={{
              defaultCurrency: 'UAH',
              supportedCurrencies: [
                {
                  code: 'UAH',
                  decimals: 2,
                  label: 'Ukrainian hryvnia',
                  symbol: '₴',
                },
              ],
            }}
            paymentMethods={[liqpayAdapterClient(), bankTransferAdapterClient()]}
          >
            {children}
          </EcommerceProvider>
        </HeaderThemeProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
