import dayjs from "dayjs"
import { type ActualConfig, type DateString } from "./types"

/**
 * Configuration settings for the conversions.
 */
export const ACTUAL_CONFIG: ActualConfig = {
  syncId: "5a94121f-a446-4349-a21a-53b9ce4199a0",
  convertAccounts: [
    {
      id: "e32e6708-a352-4c15-82f4-e39e7e8cb2f2",
      fromCurrency: "BRL",
    },
    {
      id: "6f4aac1d-3983-4499-bf66-bbd70c2d95e4",
      fromCurrency: "BRL",
    },
  ],
  toCurrency: "EUR",
}

/**
 * How many days to look back for account activity.
 */
export const LOOKBACK_DAYS = 365

/**
 * Historical threshold in days. Rates older than this are considered stable
 * and will be persisted to the file cache.
 */
export const HISTORICAL_THRESHOLD_DAYS = 30

/**
 * Volume-mounted data directory used by both the Actual SDK (budget data) and
 * the exchange rate file cache. In Docker this is bind-mounted from the host.
 */
export const ACTUAL_CACHE_DIR = "./actual-cache"

export const CACHE_FILE_PATH = `${ACTUAL_CACHE_DIR}/exchange-rates-cache.json`

/**
 * Returns the [today - LOOKBACK_DAYS, today] window as YYYY-MM-DD strings.
 */
export const getLookbackRange = (): { start: DateString; end: DateString } => {
  const now = dayjs()
  return {
    start: now.subtract(LOOKBACK_DAYS, "days").format("YYYY-MM-DD") as DateString,
    end: now.format("YYYY-MM-DD") as DateString,
  }
}
