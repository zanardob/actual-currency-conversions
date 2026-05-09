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
  let sortedDates: string[] = []

  const fetchRates = async () => {
    rates = await getRates(fromCurrency, toCurrency)
    sortedDates = Object.keys(rates).sort()
  }

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
      for (let i = sortedDates.length - 1; i >= 0; i--) {
        if (sortedDates[i] < date && sortedDates[i] >= dateStart) {
          rate = rates[sortedDates[i]]
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
