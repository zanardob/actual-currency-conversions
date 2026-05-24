import { getLookbackRange } from "./config"
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

const createExchange = ({ fromCurrency, toCurrency }: ExchangeOptions): Exchange => {
  const { start: dateStart, end: dateEnd } = getLookbackRange()
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
      if (rate) {
        console.log(`No rate found for ${date}, falling back to previous rate ${rate}.`)
      } else {
        console.warn(`No rate found for ${date}, no previous rate found either. No conversion will be applied.`)
      }
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
