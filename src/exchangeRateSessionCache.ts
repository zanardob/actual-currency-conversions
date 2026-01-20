import { type CurrencyPair, type DateString } from "./types"

/**
 * Creates a session cache store with encapsulated state.
 * Avoids duplicate API calls within a single run.
 */
export const createSessionCacheStore = () => {
  let sessionCache = new Map<CurrencyPair, Record<DateString, number>>()

  return {
    has: (currencyPair: CurrencyPair): boolean => sessionCache.has(currencyPair),
    get: (currencyPair: CurrencyPair): Record<DateString, number> | undefined => sessionCache.get(currencyPair),
    set: (currencyPair: CurrencyPair, rates: Record<DateString, number>): void => {
      sessionCache.set(currencyPair, rates)
    },
    clear: (): void => {
      sessionCache.clear()
    },
  }
}
