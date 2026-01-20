import { ActualConfig } from "./types"

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
