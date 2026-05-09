import fs from "node:fs"
import path from "node:path"
import dayjs from "dayjs"
import { CACHE_FILE_PATH } from "./config"
import { type CurrencyPair, type DateString, type RatesCache } from "./types"

let cache: RatesCache = {}

const ensureDataDirectory = (): void => {
  const dir = path.dirname(CACHE_FILE_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

const backupCacheFile = (reason: string): void => {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const backupPath = `${CACHE_FILE_PATH}.bak`
      fs.renameSync(CACHE_FILE_PATH, backupPath)
      console.log(`Cache backed up to ${backupPath} (${reason}).`)
    }
  } catch (error) {
    console.error("Failed to back up cache:", error)
  }
}

const isValidCacheShape = (value: unknown): value is RatesCache => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }
  for (const entry of Object.values(value as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return false
    const e = entry as Record<string, unknown>
    if (typeof e.historicalThrough !== "string") return false
    if (typeof e.rates !== "object" || e.rates === null || Array.isArray(e.rates)) return false
    for (const rate of Object.values(e.rates as Record<string, unknown>)) {
      if (typeof rate !== "number") return false
    }
  }
  return true
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
  } catch {
    console.warn("Cache file is corrupted or in an unrecognized format. Backing up and starting fresh.")
    backupCacheFile("corrupted")
    cache = {}
  }
}

export const saveFileCache = (): void => {
  try {
    ensureDataDirectory()
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2), "utf-8")
    console.log("Exchange rate cache saved successfully.")
  } catch (error) {
    console.error("Failed to save cache:", error)
  }
}

export const getFileCacheRates = (currencyPair: CurrencyPair): Record<DateString, number> => {
  return cache[currencyPair]?.rates ?? {}
}

/**
 * Persists historical rates and advances the historical coverage boundary for
 * the pair. `historicalThrough` is monotonically increasing — earlier values
 * are ignored.
 */
export const setFileCacheRates = (
  currencyPair: CurrencyPair,
  rates: Record<DateString, number>,
  historicalThrough: DateString,
): void => {
  const formattedRates: Record<DateString, number> = {}
  for (const [date, rate] of Object.entries(rates)) {
    formattedRates[date as DateString] = Number(rate.toFixed(6))
  }

  const existing = cache[currencyPair]
  const mergedThrough =
    existing?.historicalThrough && existing.historicalThrough > historicalThrough
      ? existing.historicalThrough
      : historicalThrough

  cache[currencyPair] = {
    rates: { ...(existing?.rates ?? {}), ...formattedRates },
    historicalThrough: mergedThrough,
  }
}

/**
 * Returns the date range that still needs fetching, or `null` when the request
 * is fully covered. Dates ≤ historicalThrough are treated as cached even if no
 * rate exists for them (e.g. weekends and holidays where the API returned
 * nothing), so the fetch range only ever extends *past* the boundary.
 */
export const getFileCacheUncachedDateRange = (
  currencyPair: CurrencyPair,
  startDate: DateString,
  endDate: DateString,
): { start: DateString; end: DateString } | null => {
  const entry = cache[currencyPair]
  if (!entry?.historicalThrough) {
    return { start: startDate, end: endDate }
  }
  if (entry.historicalThrough >= endDate) {
    return null
  }

  const fetchStart =
    entry.historicalThrough >= startDate
      ? (dayjs(entry.historicalThrough).add(1, "day").format("YYYY-MM-DD") as DateString)
      : startDate

  return { start: fetchStart, end: endDate }
}

export const clearFileCache = (): void => {
  if (fs.existsSync(CACHE_FILE_PATH)) {
    backupCacheFile("manual clear")
  } else {
    console.log("No cache file to clear.")
  }
  cache = {}
}
