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

export interface PairCacheEntry {
  rates: Record<DateString, number>
  /**
   * The latest date (inclusive) for which historical data is fully covered.
   * Dates ≤ historicalThrough are treated as cached even if no rate exists for
   * them (weekends, holidays, etc.).
   */
  historicalThrough: DateString
}

export type RatesCache = Partial<Record<CurrencyPair, PairCacheEntry>>
