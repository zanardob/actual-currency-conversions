import { type CurrencyPair, type DateString } from "./types"

let sessionCache = new Map<CurrencyPair, Record<DateString, number>>()

/**
 * Checks if a currency pair exists in the session cache.
 * @param currencyPair - The currency pair (e.g., "EUR/BRL")
 * @returns True if the currency pair is cached
 */
export const hasSessionCache = (currencyPair: CurrencyPair): boolean => {
  return sessionCache.has(currencyPair)
}

/**
 * Gets cached rates for a currency pair from the session cache.
 * @param currencyPair - The currency pair (e.g., "EUR/BRL")
 * @returns Record of date -> rate, or undefined if not cached
 */
export const getSessionCache = (currencyPair: CurrencyPair): Record<DateString, number> | undefined => {
  return sessionCache.get(currencyPair)
}

/**
 * Sets cached rates for a currency pair in the session cache.
 * @param currencyPair - The currency pair (e.g., "EUR/BRL")
 * @param rates - Record of date -> rate
 */
export const setSessionCache = (currencyPair: CurrencyPair, rates: Record<DateString, number>): void => {
  sessionCache.set(currencyPair, rates)
}

/**
 * Clears the session cache.
 */
export const clearSessionCache = (): void => {
  sessionCache.clear()
}
