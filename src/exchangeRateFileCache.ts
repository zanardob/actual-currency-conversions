import fs from "node:fs"
import path from "node:path"
import dayjs from "dayjs"
import { CACHE_FILE_PATH } from "./config"
import { type CurrencyPair, type DateString, type RatesCache } from "./types"

let cache: RatesCache = {}

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

const isValidCacheShape = (value: unknown): value is RatesCache => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export const loadFileCache = (): void => {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const data = fs.readFileSync(CACHE_FILE_PATH, "utf-8")
      const parsed = JSON.parse(data)
      if (!isValidCacheShape(parsed)) {
        throw new Error("Cache file has invalid shape")
      }
      cache = parsed
      console.log("Exchange rate cache loaded successfully.")
    } else {
      cache = {}
      console.log("No existing cache file found. Starting with empty cache.")
    }
  } catch (error) {
    console.warn("Cache file is corrupted. Backing up and starting fresh.")
    backupCorruptedCache()
    cache = {}
  }
}

/**
 * Saves the current file cache to the JSON file.
 */
export const saveFileCache = (): void => {
  try {
    ensureDataDirectory()
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2), "utf-8")
    console.log("Exchange rate cache saved successfully.")
  } catch (error) {
    console.error("Failed to save cache:", error)
  }
}

/**
 * Gets cached rates for a specific currency pair from the file cache.
 * @param currencyPair - The currency pair (e.g., "EUR/BRL")
 * @returns Record of date -> rate, or empty object if not cached
 */
export const getFileCacheRates = (currencyPair: CurrencyPair): Record<DateString, number> => {
  return cache[currencyPair] || {}
}

/**
 * Sets cached rates for a specific currency pair in the file cache.
 * Merges with existing rates and formats to 6 decimal places.
 * @param currencyPair - The currency pair (e.g., "EUR/BRL")
 * @param rates - Record of date -> rate
 */
export const setFileCacheRates = (currencyPair: CurrencyPair, rates: Record<DateString, number>): void => {
  const formattedRates: Record<DateString, number> = {} as Record<DateString, number>
  for (const [date, rate] of Object.entries(rates)) {
    formattedRates[date as DateString] = Number(rate.toFixed(6))
  }

  cache[currencyPair] = {
    ...cache[currencyPair],
    ...formattedRates,
  }
}

/**
 * Determines which dates need to be fetched from the API.
 * Returns the date range that is not in the file cache, or null if all dates are cached.
 * @param currencyPair - The currency pair (e.g., "EUR/BRL")
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Object with start and end dates to fetch, or null if fully cached
 */
export const getFileCacheUncachedDateRange = (
  currencyPair: CurrencyPair,
  startDate: DateString,
  endDate: DateString,
): { start: DateString; end: DateString } | null => {
  const cachedRates = cache[currencyPair] || {}
  const cachedDates = new Set(Object.keys(cachedRates))

  let uncachedStart: DateString | null = null
  let uncachedEnd: DateString | null = null

  const end = dayjs(endDate)
  for (let d = dayjs(startDate); !d.isAfter(end); d = d.add(1, "day")) {
    const dateStr = d.format("YYYY-MM-DD") as DateString
    if (!cachedDates.has(dateStr)) {
      if (!uncachedStart) {
        uncachedStart = dateStr
      }
      uncachedEnd = dateStr
    }
  }

  if (!uncachedStart || !uncachedEnd) {
    return null
  }

  return { start: uncachedStart, end: uncachedEnd }
}

/**
 * Clears the file cache. Backs up the existing file before clearing.
 */
export const clearFileCache = (): void => {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const backupPath = `${CACHE_FILE_PATH}.bak`
      fs.renameSync(CACHE_FILE_PATH, backupPath)
      console.log(`Cache cleared. Backup saved to: ${backupPath}`)
    } else {
      console.log("No cache file to clear.")
    }
    cache = {}
  } catch (error) {
    console.error("Failed to clear cache:", error)
  }
}
