import dayjs from "dayjs"
import { LOOKBACK_DAYS } from "./config"
import { getRates } from "./exchangeRateManager"

interface ExchangeOptions {
  fromCurrency: string
  toCurrency: string
}

interface ConversionResult {
  amount?: number
  rate?: number
}

interface Exchange {
  fromCurrency: string
  toCurrency: string
  fetchRates: () => Promise<void>
  applyRate: (amount: number, date: string) => ConversionResult
}

/**
 * Creates an exchange rate converter that fetches and applies historical rates.
 * Uses inverted rates because we're usually converting from a weaker currency to a stronger one.
 */
const createExchange = ({ fromCurrency, toCurrency }: ExchangeOptions): Exchange => {
  const dateStart = dayjs().subtract(LOOKBACK_DAYS, "days").format("YYYY-MM-DD")
  const dateEnd = dayjs().format("YYYY-MM-DD")
  let rates: Record<string, number> = {}

  /**
   * Fetches historical exchange rates via the exchange rate manager.
   * The manager handles caching and API calls.
   */
  const fetchRates = async () => {
    rates = await getRates(fromCurrency, toCurrency)
  }

  /**
   * Applies the exchange rate for a given date to convert an amount.
   */
  const applyRate = (amount: number, date: string): ConversionResult => {
    if (date < dateStart || date > dateEnd) {
      console.warn(
        `Date ${date} is outside the range of fetched rates (${dateStart} to ${dateEnd}). ` +
          `No conversion will be applied.`,
      )
      return {}
    }

    let rate = rates[date]
    if (!rate) {
      const dates = Object.keys(rates).sort((a, b) => a.localeCompare(b))
      for (let i = dates.length - 1; i >= 0; i--) {
        if (dates[i] < date) {
          rate = rates[dates[i]]
          break
        }
      }
      console.warn(
        `No rate found for ${date}, ${
          rate
            ? `falling back to previous rate ${rate}.`
            : "no previous rate found either. No conversion will be applied."
        }`,
      )
    }
    if (!rate) {
      return {}
    }

    return { amount: Math.round(amount / rate), rate }
  }

  return {
    fromCurrency,
    toCurrency,
    fetchRates,
    applyRate,
  }
}

export default createExchange
