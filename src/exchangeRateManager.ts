import dayjs from "dayjs"
import {
  loadFileCache,
  saveFileCache,
  getFileCacheRates,
  setFileCacheRates,
  getFileCacheUncachedDateRange,
} from "./exchangeRateFileCache"
import { getSessionCache, setSessionCache, clearSessionCache } from "./exchangeRateSessionCache"
import { LOOKBACK_DAYS, HISTORICAL_THRESHOLD_DAYS } from "./config"
import { type CurrencyPair, type DateString } from "./types"

export const initializeManager = (): void => {
  loadFileCache()
  clearSessionCache()
  console.log("Exchange rate manager initialized.")
}

export const shutdownManager = (): void => {
  saveFileCache()
  clearSessionCache()
  console.log("Exchange rate manager shut down.")
}

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
    const rates: Record<DateString, number> = {}

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
    return {}
  }
}

/**
 * Only rates older than the threshold are stable enough to persist —
 * recent rates can still be revised by the data provider.
 */
const filterHistoricalRates = (rates: Record<DateString, number>): Record<DateString, number> => {
  const thresholdDate = dayjs().subtract(HISTORICAL_THRESHOLD_DAYS, "days").format("YYYY-MM-DD")
  const historicalRates: Record<DateString, number> = {}

  for (const [date, rate] of Object.entries(rates)) {
    if (date < thresholdDate) {
      historicalRates[date as DateString] = rate
    }
  }

  return historicalRates
}

export const getRates = async (fromCurrency: string, toCurrency: string): Promise<Record<DateString, number>> => {
  // Currency pair format is TO/FROM to match Twelve Data API convention
  const currencyPair = `${toCurrency}/${fromCurrency}` as CurrencyPair

  const cached = getSessionCache(currencyPair)
  if (cached) {
    console.log(`Using session cache for ${currencyPair}.`)
    return cached
  }

  const cachedRates = getFileCacheRates(currencyPair)
  const cachedCount = Object.keys(cachedRates).length
  if (cachedCount > 0) {
    console.log(`Found ${cachedCount} cached rates for ${currencyPair}.`)
  }

  const startDate = dayjs().subtract(LOOKBACK_DAYS, "days").format("YYYY-MM-DD") as DateString
  const endDate = dayjs().format("YYYY-MM-DD") as DateString
  const uncachedRange = getFileCacheUncachedDateRange(currencyPair, startDate, endDate)

  let fetchedRates: Record<DateString, number> = {}
  if (uncachedRange) {
    fetchedRates = await fetchRatesFromApi(currencyPair, uncachedRange.start, uncachedRange.end)

    const historicalRates = filterHistoricalRates(fetchedRates)
    if (Object.keys(historicalRates).length > 0) {
      setFileCacheRates(currencyPair, historicalRates)
      console.log(`Cached ${Object.keys(historicalRates).length} historical rates for ${currencyPair}.`)
    }
  }

  const allRates: Record<DateString, number> = {
    ...cachedRates,
    ...fetchedRates,
  }
  setSessionCache(currencyPair, allRates)

  return allRates
}
