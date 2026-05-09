import { describe, it, expect, beforeEach, vi } from "vitest"
import { type DateString } from "../types"

vi.mock("../exchangeRateFileCache")
vi.mock("../exchangeRateSessionCache")

const mockFetch = vi.fn()
global.fetch = mockFetch

describe("exchangeRateManager", () => {
  let initializeManager: typeof import("../exchangeRateManager").initializeManager
  let shutdownManager: typeof import("../exchangeRateManager").shutdownManager
  let getRates: typeof import("../exchangeRateManager").getRates
  let fileCache: typeof import("../exchangeRateFileCache")
  let sessionCache: typeof import("../exchangeRateSessionCache")

  beforeEach(async () => {
    vi.resetModules()
    process.env.TWELVE_DATA_API_KEY = "test-api-key"

    fileCache = await import("../exchangeRateFileCache")
    sessionCache = await import("../exchangeRateSessionCache")
    const manager = await import("../exchangeRateManager")
    initializeManager = manager.initializeManager
    shutdownManager = manager.shutdownManager
    getRates = manager.getRates
  })

  describe("initializeManager", () => {
    it("loads file cache and clears session cache", () => {
      initializeManager()

      expect(fileCache.loadFileCache).toHaveBeenCalled()
      expect(sessionCache.clearSessionCache).toHaveBeenCalled()
    })
  })

  describe("shutdownManager", () => {
    it("saves file cache and clears session cache", () => {
      shutdownManager()

      expect(fileCache.saveFileCache).toHaveBeenCalled()
      expect(sessionCache.clearSessionCache).toHaveBeenCalled()
    })
  })

  describe("getRates", () => {
    it("returns from session cache if available", async () => {
      const mockRates = { "2024-01-01": 5.5 } as Record<DateString, number>
      vi.mocked(sessionCache.getSessionCache).mockReturnValue(mockRates)

      const rates = await getRates("BRL", "EUR")

      expect(rates).toEqual(mockRates)
      expect(fileCache.getFileCacheRates).not.toHaveBeenCalled()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("fetches from API when cache is empty", async () => {
      vi.mocked(fileCache.getFileCacheRates).mockReturnValue({})
      vi.mocked(fileCache.getFileCacheUncachedDateRange).mockReturnValue({
        start: "2024-01-01" as DateString,
        end: "2024-01-03" as DateString,
      })

      const mockApiResponse = {
        values: [
          { datetime: "2024-01-01", close: "5.5" },
          { datetime: "2024-01-02", close: "5.6" },
        ],
      }
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response)

      const rates = await getRates("BRL", "EUR")

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("symbol=EUR/BRL"), expect.any(Object))
      expect(rates).toEqual({
        "2024-01-01": 5.5,
        "2024-01-02": 5.6,
      })
    })

    it("handles API errors gracefully", async () => {
      vi.mocked(fileCache.getFileCacheRates).mockReturnValue({})
      vi.mocked(fileCache.getFileCacheUncachedDateRange).mockReturnValue({
        start: "2024-01-01" as DateString,
        end: "2024-01-03" as DateString,
      })

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      } as Response)

      const rates = await getRates("BRL", "EUR")

      expect(rates).toEqual({})
    })

    it("merges cached and fetched rates", async () => {
      const cachedRates = { "2024-01-01": 5.5 } as Record<DateString, number>
      vi.mocked(fileCache.getFileCacheRates).mockReturnValue(cachedRates)
      vi.mocked(fileCache.getFileCacheUncachedDateRange).mockReturnValue({
        start: "2024-01-02" as DateString,
        end: "2024-01-03" as DateString,
      })

      const mockApiResponse = {
        values: [{ datetime: "2024-01-02", close: "5.6" }],
      }
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response)

      const rates = await getRates("BRL", "EUR")

      expect(rates).toEqual({
        "2024-01-01": 5.5,
        "2024-01-02": 5.6,
      })
    })

    it("skips API call when fully cached", async () => {
      const cachedRates = { "2024-01-01": 5.5 } as Record<DateString, number>
      vi.mocked(fileCache.getFileCacheRates).mockReturnValue(cachedRates)
      vi.mocked(fileCache.getFileCacheUncachedDateRange).mockReturnValue(null)

      const rates = await getRates("BRL", "EUR")

      expect(mockFetch).not.toHaveBeenCalled()
      expect(rates).toEqual(cachedRates)
    })

    it("stores rates in session cache after fetch", async () => {
      vi.mocked(fileCache.getFileCacheRates).mockReturnValue({})
      vi.mocked(fileCache.getFileCacheUncachedDateRange).mockReturnValue({
        start: "2024-01-01" as DateString,
        end: "2024-01-01" as DateString,
      })

      const mockApiResponse = {
        values: [{ datetime: "2024-01-01", close: "5.5" }],
      }
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response)

      await getRates("BRL", "EUR")

      expect(sessionCache.setSessionCache).toHaveBeenCalledWith(
        "EUR/BRL",
        expect.objectContaining({ "2024-01-01": 5.5 }),
      )
    })
  })
})
