import { describe, it, expect, beforeEach } from "vitest"
import { getSessionCache, setSessionCache, clearSessionCache } from "../exchangeRateSessionCache"
import { type DateString } from "../types"

describe("exchangeRateSessionCache", () => {
  beforeEach(() => {
    clearSessionCache()
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
      expect(getSessionCache("EUR/BRL")).toBeUndefined()
      expect(getSessionCache("BRL/EUR")).toBeUndefined()
    })
  })
})
