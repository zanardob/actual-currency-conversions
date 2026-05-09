import { type DateString, type CurrencyPair } from "../types"

export const mockRates: Record<DateString, number> = {
  "2024-01-01": 5.234567,
  "2024-01-02": 5.345678,
  "2024-01-03": 5.456789,
} as Record<DateString, number>

export const mockCurrencyPair: CurrencyPair = "EUR/BRL"

export const mockTwelveDataResponse = {
  values: [
    { datetime: "2024-01-01", close: "5.234567" },
    { datetime: "2024-01-02", close: "5.345678" },
    { datetime: "2024-01-03", close: "5.456789" },
  ],
}

export const mockTransactions = [
  {
    id: "tx1",
    amount: 100000, // 1000.00 in cents
    date: "2024-01-01",
    notes: null,
  },
  {
    id: "tx2",
    amount: 200000, // 2000.00 in cents
    date: "2024-01-02",
    notes: "Previous note",
  },
]

export const mockAccount = {
  id: "acc1",
  fromCurrency: "BRL",
}