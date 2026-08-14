import * as normalizeCurrencyToUAH from './20260724_130000_normalize_currency_to_uah'
import * as addLiqPayTransactionFields from './20260724_140000_add_liqpay_transaction_fields'
import * as addBankTransferFields from './20260724_163000_add_bank_transfer_fields'

export const migrations = [
  {
    name: '20260724_130000_normalize_currency_to_uah',
    up: normalizeCurrencyToUAH.up,
    down: normalizeCurrencyToUAH.down,
  },
  {
    name: '20260724_140000_add_liqpay_transaction_fields',
    up: addLiqPayTransactionFields.up,
    down: addLiqPayTransactionFields.down,
  },
  {
    name: '20260724_163000_add_bank_transfer_fields',
    up: addBankTransferFields.up,
    down: addBankTransferFields.down,
  },
]
