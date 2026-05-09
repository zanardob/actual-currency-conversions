interface ConvertAccount {
  id: string
  fromCurrency: string
}

export interface ActualConfig {
  syncId: string
  convertAccounts: ConvertAccount[]
  toCurrency: string
}

/**
 * Supported currency pairs for exchange rate caching.
 */
export type CurrencyPair = "BRL/EUR" | "EUR/BRL"

/**
 * Date string in YYYY-MM-DD format.
 */
export type DateString = `${number}${number}${number}${number}-${number}${number}-${number}${number}`

export type RatesCache = Partial<Record<CurrencyPair, Record<DateString, number>>>
