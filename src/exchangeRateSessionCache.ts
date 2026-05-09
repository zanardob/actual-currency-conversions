import { type CurrencyPair, type DateString } from "./types"

let sessionCache = new Map<CurrencyPair, Record<DateString, number>>()

export const hasSessionCache = (currencyPair: CurrencyPair): boolean => {
  return sessionCache.has(currencyPair)
}

export const getSessionCache = (currencyPair: CurrencyPair): Record<DateString, number> | undefined => {
  return sessionCache.get(currencyPair)
}

export const setSessionCache = (currencyPair: CurrencyPair, rates: Record<DateString, number>): void => {
  sessionCache.set(currencyPair, rates)
}

export const clearSessionCache = (): void => {
  sessionCache.clear()
}
