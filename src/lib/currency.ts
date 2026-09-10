export const UAH_CURRENCY = {
  code: 'UAH',
  decimals: 2,
  label: 'Ukrainian Hryvnia',
  symbol: '₴',
} as const

export const UAH_CURRENCIES_CONFIG = {
  defaultCurrency: 'UAH',
  supportedCurrencies: [UAH_CURRENCY],
}
