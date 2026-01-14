import fs from "node:fs"
import path from "node:path"
import { CACHE_FILE_PATH } from "./config"

/**
 * Supported currency pairs for exchange rate caching.
 */
export type CurrencyPair = "BRL/EUR" | "EUR/BRL"

/**
 * Date string in YYYY-MM-DD format.
 */
export type DateString = `${number}${number}${number}${number}-${number}${number}-${number}${number}`

type RatesCache = Record<CurrencyPair, Record<DateString, number>>

/**
 * Creates a new cache store with encapsulated state.
 */
const createCacheStore = () => {
  let cache: Partial<RatesCache> = {}

  return {
    get: () => cache,
    set: (newCache: Partial<RatesCache>) => {
      cache = newCache
    },
    getCurrencyPair: (currencyPair: CurrencyPair): Record<DateString, number> => {
      return cache[currencyPair] || {}
    },
    setCurrencyPair: (currencyPair: CurrencyPair, rates: Record<DateString, number>) => {
      cache[currencyPair] = {
        ...cache[currencyPair],
        ...rates,
      }
    },
    reset: () => {
      cache = {}
    },
  }
}

const cacheStore = createCacheStore()

/**
 * Ensures the data directory exists.
 */
const ensureDataDirectory = (): void => {
  const dir = path.dirname(CACHE_FILE_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * Loads the cache from the JSON file.
 * If the file doesn't exist or is corrupted, returns an empty cache.
 * Corrupted files are backed up before starting fresh.
 */
export const loadCache = (): Partial<RatesCache> => {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const data = fs.readFileSync(CACHE_FILE_PATH, "utf-8")
      cacheStore.set(JSON.parse(data))
      console.log("Exchange rate cache loaded successfully.")
    } else {
      cacheStore.reset()
      console.log("No existing cache file found. Starting with empty cache.")
    }
  } catch (error) {
    console.warn("Cache file is corrupted. Backing up and starting fresh.")
    backupCorruptedCache()
    cacheStore.reset()
  }
  return cacheStore.get()
}

/**
 * Saves the current cache to the JSON file.
 */
export const saveCache = (): void => {
  try {
    ensureDataDirectory()
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheStore.get(), null, 2), "utf-8")
    console.log("Exchange rate cache saved successfully.")
  } catch (error) {
    console.error("Failed to save cache:", error)
  }
}

/**
 * Gets cached rates for a specific currency pair.
 * @param currencyPair - The currency pair (e.g., "BRL/EUR")
 * @returns Record of date -> rate, or empty object if not cached
 */
export const getCachedRates = (currencyPair: CurrencyPair): Record<DateString, number> => {
  return cacheStore.getCurrencyPair(currencyPair)
}

/**
 * Sets cached rates for a specific currency pair.
 * Only stores rates with 6 decimal places precision.
 * @param currencyPair - The currency pair (e.g., "BRL/EUR")
 * @param rates - Record of date -> rate
 */
export const setCachedRates = (currencyPair: CurrencyPair, rates: Record<DateString, number>): void => {
  const formattedRates: Record<DateString, number> = {} as Record<DateString, number>
  for (const [date, rate] of Object.entries(rates)) {
    formattedRates[date as DateString] = Number(rate.toFixed(6))
  }

  cacheStore.setCurrencyPair(currencyPair, formattedRates)
}

/**
 * Determines which dates need to be fetched from the API.
 * Returns the date range that is not in the cache.
 * If there is no cache for the given range, returns the full startDate to endDate range.
 * @param currencyPair - The currency pair (e.g., "BRL/EUR")
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Object with start and end dates to fetch
 */
export const getUncachedDateRange = (
  currencyPair: CurrencyPair,
  startDate: DateString,
  endDate: DateString,
): { start: DateString; end: DateString } => {
  const cachedRates = getCachedRates(currencyPair)
  const cachedDates = new Set(Object.keys(cachedRates))

  // Find the earliest uncached date
  let uncachedStart: DateString | null = null
  let uncachedEnd: DateString | null = null

  const start = new Date(startDate)
  const end = new Date(endDate)

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0] as DateString
    if (!cachedDates.has(dateStr)) {
      if (!uncachedStart) {
        uncachedStart = dateStr
      }
      uncachedEnd = dateStr
    }
  }

  // If all dates are cached, return the full range anyway
  // (this shouldn't happen in practice, but provides a safe fallback)
  if (!uncachedStart || !uncachedEnd) {
    return { start: startDate, end: endDate }
  }

  return { start: uncachedStart, end: uncachedEnd }
}

/**
 * Backs up a corrupted cache file.
 */
const backupCorruptedCache = (): void => {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const backupPath = `${CACHE_FILE_PATH}.bak`
      fs.renameSync(CACHE_FILE_PATH, backupPath)
      console.log(`Corrupted cache backed up to: ${backupPath}`)
    }
  } catch (error) {
    console.error("Failed to backup corrupted cache:", error)
  }
}

/**
 * Clears the cache file. Backs up the existing file before clearing.
 */
export const clearCache = (): void => {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const backupPath = `${CACHE_FILE_PATH}.bak`
      fs.renameSync(CACHE_FILE_PATH, backupPath)
      console.log(`Cache cleared. Backup saved to: ${backupPath}`)
    } else {
      console.log("No cache file to clear.")
    }
    cacheStore.reset()
  } catch (error) {
    console.error("Failed to clear cache:", error)
  }
}

/**
 * Returns the current in-memory cache (for testing/debugging).
 */
export const getCache = (): Partial<RatesCache> => {
  return cacheStore.get()
}

/**
 * Resets the in-memory cache (for testing/debugging).
 */
export const resetCache = (): void => {
  cacheStore.reset()
}
