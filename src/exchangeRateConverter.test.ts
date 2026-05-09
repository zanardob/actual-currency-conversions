import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { type DateString } from "./types"

// Mock the manager
vi.mock("./exchangeRateManager")

describe("exchangeRateConverter", () => {
  let createExchange: typeof import("./exchangeRateConverter").default
  let manager: typeof import("./exchangeRateManager")

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // Use fixed date for consistent testing
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-06-15"))

    manager = await import("./exchangeRateManager")
    const module = await import("./exchangeRateConverter")
    createExchange = module.default
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  describe("fetchRates", () => {
    it("calls getRates from manager", async () => {
      const mockRates = { "2024-01-01": 5.5 } as Record<DateString, number>
      vi.mocked(manager.getRates).mockResolvedValue(mockRates)

      const exchange = createExchange({
        fromCurrency: "BRL",
        toCurrency: "EUR",
      })

      await exchange.fetchRates()

      expect(manager.getRates).toHaveBeenCalledWith("BRL", "EUR")
    })
  })

  describe("applyRate", () => {
    it("converts amount using exact date rate", async () => {
      const mockRates = {
        "2024-01-01": 5.0,
        "2024-01-02": 5.5,
      } as Record<DateString, number>
      vi.mocked(manager.getRates).mockResolvedValue(mockRates)

      const exchange = createExchange({
        fromCurrency: "BRL",
        toCurrency: "EUR",
      })
      await exchange.fetchRates()

      const result = exchange.applyRate(1000, "2024-01-02")

      expect(result).toEqual({
        amount: 182, // Math.round(1000 / 5.5)
        rate: 5.5,
      })
    })

    it("falls back to previous rate when date not found", async () => {
      const mockRates = {
        "2024-01-01": 5.0,
        "2024-01-03": 5.5,
      } as Record<DateString, number>
      vi.mocked(manager.getRates).mockResolvedValue(mockRates)

      const exchange = createExchange({
        fromCurrency: "BRL",
        toCurrency: "EUR",
      })
      await exchange.fetchRates()

      const result = exchange.applyRate(1000, "2024-01-02")

      expect(result).toEqual({
        amount: 200, // Math.round(1000 / 5.0)
        rate: 5.0,
      })
    })

    it("returns empty object for date outside range (before start)", async () => {
      const mockRates = { "2024-01-01": 5.0 } as Record<DateString, number>
      vi.mocked(manager.getRates).mockResolvedValue(mockRates)

      const exchange = createExchange({
        fromCurrency: "BRL",
        toCurrency: "EUR",
      })
      await exchange.fetchRates()

      // Date is before the lookback period (365 days before 2024-06-15)
      const result = exchange.applyRate(1000, "2020-01-01")

      expect(result).toEqual({})
    })

    it("returns empty object when no rate found", async () => {
      vi.mocked(manager.getRates).mockResolvedValue({})

      const exchange = createExchange({
        fromCurrency: "BRL",
        toCurrency: "EUR",
      })
      await exchange.fetchRates()

      const result = exchange.applyRate(1000, "2024-01-01")

      expect(result).toEqual({})
    })

    it("rounds converted amount to nearest integer", async () => {
      const mockRates = { "2024-01-01": 3.0 } as Record<DateString, number>
      vi.mocked(manager.getRates).mockResolvedValue(mockRates)

      const exchange = createExchange({
        fromCurrency: "BRL",
        toCurrency: "EUR",
      })
      await exchange.fetchRates()

      const result = exchange.applyRate(1000, "2024-01-01")

      expect(result.amount).toBe(333) // Math.round(1000 / 3.0)
    })

    it("handles large amounts correctly", async () => {
      const mockRates = { "2024-01-01": 5.5 } as Record<DateString, number>
      vi.mocked(manager.getRates).mockResolvedValue(mockRates)

      const exchange = createExchange({
        fromCurrency: "BRL",
        toCurrency: "EUR",
      })
      await exchange.fetchRates()

      const result = exchange.applyRate(1000000, "2024-01-01") // 10000.00 in cents

      expect(result).toEqual({
        amount: 181818, // Math.round(1000000 / 5.5)
        rate: 5.5,
      })
    })
  })
})
