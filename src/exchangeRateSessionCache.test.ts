import { describe, it, expect, beforeEach } from "vitest"
import { hasSessionCache, getSessionCache, setSessionCache, clearSessionCache } from "./exchangeRateSessionCache"
import { type DateString, type CurrencyPair } from "./types"

describe("exchangeRateSessionCache", () => {
  beforeEach(() => {
    clearSessionCache()
  })

  describe("hasSessionCache", () => {
    it("returns false for uncached currency pair", () => {
      expect(hasSessionCache("EUR/BRL")).toBe(false)
    })

    it("returns true for cached currency pair", () => {
      setSessionCache("EUR/BRL", { "2024-01-01": 5.5 } as Record<DateString, number>)
      expect(hasSessionCache("EUR/BRL")).toBe(true)
    })
  })

  describe("getSessionCache", () => {
    it("returns undefined for uncached currency pair", () => {
      expect(getSessionCache("EUR/BRL")).toBeUndefined()
    })

    it("returns rates for cached currency pair", () => {
      const rates = { "2024-01-01": 5.5 } as Record<DateString, number>
      setSessionCache("EUR/BRL", rates)
      expect(getSessionCache("EUR/BRL")).toEqual(rates)
    })
  })

  describe("setSessionCache", () => {
    it("stores rates for currency pair", () => {
      const rates = { "2024-01-01": 5.5, "2024-01-02": 5.6 } as Record<DateString, number>
      setSessionCache("EUR/BRL", rates)
      expect(getSessionCache("EUR/BRL")).toEqual(rates)
    })

    it("overwrites existing rates", () => {
      setSessionCache("EUR/BRL", { "2024-01-01": 5.5 } as Record<DateString, number>)
      setSessionCache("EUR/BRL", { "2024-01-02": 5.6 } as Record<DateString, number>)
      expect(getSessionCache("EUR/BRL")).toEqual({ "2024-01-02": 5.6 })
    })
  })

  describe("clearSessionCache", () => {
    it("clears all cached data", () => {
      setSessionCache("EUR/BRL", { "2024-01-01": 5.5 } as Record<DateString, number>)
      setSessionCache("BRL/EUR", { "2024-01-01": 0.19 } as Record<DateString, number>)
      clearSessionCache()
      expect(hasSessionCache("EUR/BRL")).toBe(false)
      expect(hasSessionCache("BRL/EUR")).toBe(false)
    })
  })
})
