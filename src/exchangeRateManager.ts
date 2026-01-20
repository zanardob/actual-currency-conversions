import dayjs from "dayjs"
import { createFileCacheStore } from "./exchangeRateFileCache"
import { createSessionCacheStore } from "./exchangeRateSessionCache"
import { LOOKBACK_DAYS, HISTORICAL_THRESHOLD_DAYS } from "./config"
import { type CurrencyPair, type DateString } from "./types"

const sessionCacheStore = createSessionCacheStore()
const fileCacheStore = createFileCacheStore()

/**
 * Initializes the exchange rate manager by loading the file cache.
 * Should be called at the start of a conversion job.
 */
export const initializeManager = (): void => {
  fileCacheStore.load()
  sessionCacheStore.clear()
  console.log("Exchange rate manager initialized.")
}

/**
 * Shuts down the exchange rate manager by saving the file cache.
 * Should be called at the end of a conversion job.
 */
export const shutdownManager = (): void => {
  fileCacheStore.save()
  sessionCacheStore.clear()
  console.log("Exchange rate manager shut down.")
}

/**
 * Fetches exchange rates from the Twelve Data API.
 * @param currencyPair - The currency pair in "TO/FROM" format (e.g., "EUR/BRL")
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Record of date -> rate
 */
const fetchRatesFromApi = async (
  currencyPair: CurrencyPair,
  startDate: DateString,
  endDate: DateString,
): Promise<Record<DateString, number>> => {
  const baseUrl = "https://api.twelvedata.com/time_series?"
  const endpoint =
    `${baseUrl}` +
    `symbol=${currencyPair}&` +
    `dp=6&` +
    `interval=1day&` +
    `start_date=${startDate}&` +
    `end_date=${endDate}`

  console.log(`Fetching rates for ${currencyPair} from ${startDate} to ${endDate}...`)

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: `apikey ${process.env.TWELVE_DATA_API_KEY}`,
      },
    })

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`)
    }

    const data = await response.json()
    const rates: Record<DateString, number> = {} as Record<DateString, number>

    if (data.values) {
      for (const rate of data.values) {
        rates[rate.datetime as DateString] = Number.parseFloat(rate.close)
      }
      console.log(`Fetched ${Object.keys(rates).length} rates for ${currencyPair}.`)
    } else {
      console.error("No values returned from Twelve Data API", data)
    }

    return rates
  } catch (error) {
    console.error(`Failed to fetch rates for ${currencyPair}:`, error)
    return {} as Record<DateString, number>
  }
}

/**
 * Filters rates to only include historical rates (older than the threshold).
 * These are stable and safe to cache persistently.
 * @param rates - Record of date -> rate
 * @returns Record of date -> rate (only historical dates)
 */
const filterHistoricalRates = (rates: Record<DateString, number>): Record<DateString, number> => {
  const thresholdDate = dayjs().subtract(HISTORICAL_THRESHOLD_DAYS, "days").format("YYYY-MM-DD")
  const historicalRates: Record<DateString, number> = {} as Record<DateString, number>

  for (const [date, rate] of Object.entries(rates)) {
    if (date < thresholdDate) {
      historicalRates[date as DateString] = rate
    }
  }

  return historicalRates
}

/**
 * Gets exchange rates for a currency pair.
 * Uses a multi-tier caching strategy:
 * 1. Check session cache (in-memory, current run)
 * 2. Check file cache (persistent, historical rates)
 * 3. Fetch from API (only for missing dates)
 *
 * @param fromCurrency - Source currency code (e.g., "BRL")
 * @param toCurrency - Target currency code (e.g., "EUR")
 * @returns Record of date -> rate for the full lookback period
 */
export const getRates = async (fromCurrency: string, toCurrency: string): Promise<Record<DateString, number>> => {
  // Currency pair format is TO/FROM to match Twelve Data API convention
  const currencyPair = `${toCurrency}/${fromCurrency}` as CurrencyPair

  // 1. Check session cache first
  if (sessionCacheStore.has(currencyPair)) {
    console.log(`Using session cache for ${currencyPair}.`)
    return sessionCacheStore.get(currencyPair)!
  }

  // 2. Get cached rates from file
  const cachedRates = fileCacheStore.getRates(currencyPair)
  const cachedCount = Object.keys(cachedRates).length
  if (cachedCount > 0) {
    console.log(`Found ${cachedCount} cached rates for ${currencyPair}.`)
  }

  // 3. Determine date range
  const startDate = dayjs().subtract(LOOKBACK_DAYS, "days").format("YYYY-MM-DD") as DateString
  const endDate = dayjs().format("YYYY-MM-DD") as DateString

  // 4. Find uncached date range
  const uncachedRange = fileCacheStore.getUncachedDateRange(currencyPair, startDate, endDate)

  // 5. Fetch missing rates from API
  let fetchedRates: Record<DateString, number> = {} as Record<DateString, number>
  if (uncachedRange) {
    fetchedRates = await fetchRatesFromApi(currencyPair, uncachedRange.start, uncachedRange.end)

    // 6. Update file cache with historical rates only
    const historicalRates = filterHistoricalRates(fetchedRates)
    if (Object.keys(historicalRates).length > 0) {
      fileCacheStore.setRates(currencyPair, historicalRates)
      console.log(`Cached ${Object.keys(historicalRates).length} historical rates for ${currencyPair}.`)
    }
  }

  // 7. Merge cached and fetched rates
  const allRates: Record<DateString, number> = {
    ...cachedRates,
    ...fetchedRates,
  }

  // 8. Store in session cache
  sessionCacheStore.set(currencyPair, allRates)

  return allRates
}
