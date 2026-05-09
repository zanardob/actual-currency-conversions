import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import fs from "node:fs"
import { type DateString } from "../types"

vi.mock("node:fs")

// Dynamically import the module after mocking to get fresh state
let loadFileCache: typeof import("../exchangeRateFileCache").loadFileCache
let saveFileCache: typeof import("../exchangeRateFileCache").saveFileCache
let getFileCacheRates: typeof import("../exchangeRateFileCache").getFileCacheRates
let setFileCacheRates: typeof import("../exchangeRateFileCache").setFileCacheRates
let getFileCacheUncachedDateRange: typeof import("../exchangeRateFileCache").getFileCacheUncachedDateRange
let clearFileCache: typeof import("../exchangeRateFileCache").clearFileCache

describe("exchangeRateFileCache", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const module = await import("../exchangeRateFileCache")
    loadFileCache = module.loadFileCache
    saveFileCache = module.saveFileCache
    getFileCacheRates = module.getFileCacheRates
    setFileCacheRates = module.setFileCacheRates
    getFileCacheUncachedDateRange = module.getFileCacheUncachedDateRange
    clearFileCache = module.clearFileCache
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe("loadFileCache", () => {
    it("loads existing cache file", () => {
      const mockData = { "EUR/BRL": { "2024-01-01": 5.5 } }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockData))

      loadFileCache()

      expect(fs.readFileSync).toHaveBeenCalledWith("./actual-cache/exchange-rates-cache.json", "utf-8")
    })

    it("handles missing cache file", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      loadFileCache()

      expect(fs.readFileSync).not.toHaveBeenCalled()
    })

    it("handles corrupted cache file by backing up", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue("invalid json")

      loadFileCache()

      expect(fs.renameSync).toHaveBeenCalledWith(
        "./actual-cache/exchange-rates-cache.json",
        "./actual-cache/exchange-rates-cache.json.bak",
      )
    })
  })

  describe("saveFileCache", () => {
    it("creates directory if missing", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      loadFileCache()
      saveFileCache()

      expect(fs.mkdirSync).toHaveBeenCalledWith("./actual-cache", { recursive: true })
    })

    it("writes cache to file", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)

      loadFileCache()
      saveFileCache()

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "./actual-cache/exchange-rates-cache.json",
        expect.any(String),
        "utf-8",
      )
    })

    it("handles write errors gracefully", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error("Write failed")
      })

      loadFileCache()
      expect(() => saveFileCache()).not.toThrow()
    })
  })

  describe("getFileCacheRates", () => {
    it("returns empty object for uncached pair", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      loadFileCache()

      const rates = getFileCacheRates("EUR/BRL")

      expect(rates).toEqual({})
    })

    it("returns cached rates for pair", () => {
      const mockData = { "EUR/BRL": { "2024-01-01": 5.5 } }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockData))
      loadFileCache()

      const rates = getFileCacheRates("EUR/BRL")

      expect(rates).toEqual({ "2024-01-01": 5.5 })
    })
  })

  describe("setFileCacheRates", () => {
    it("formats rates to 6 decimal places", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      loadFileCache()

      setFileCacheRates("EUR/BRL", { "2024-01-01": 5.123456789 } as Record<DateString, number>)

      const rates = getFileCacheRates("EUR/BRL")
      expect(rates["2024-01-01" as DateString]).toBe(5.123457)
    })

    it("merges with existing rates", () => {
      const mockData = { "EUR/BRL": { "2024-01-01": 5.5 } }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockData))
      loadFileCache()

      setFileCacheRates("EUR/BRL", { "2024-01-02": 5.6 } as Record<DateString, number>)

      const rates = getFileCacheRates("EUR/BRL")
      expect(rates).toEqual({
        "2024-01-01": 5.5,
        "2024-01-02": 5.6,
      })
    })
  })

  describe("getFileCacheUncachedDateRange", () => {
    it("returns null when all dates are cached", () => {
      const mockData = {
        "EUR/BRL": {
          "2024-01-01": 5.5,
          "2024-01-02": 5.6,
          "2024-01-03": 5.7,
        },
      }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockData))
      loadFileCache()

      const range = getFileCacheUncachedDateRange("EUR/BRL", "2024-01-01" as DateString, "2024-01-03" as DateString)

      expect(range).toBeNull()
    })

    it("returns full range when no dates are cached", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      loadFileCache()

      const range = getFileCacheUncachedDateRange("EUR/BRL", "2024-01-01" as DateString, "2024-01-03" as DateString)

      expect(range).toEqual({
        start: "2024-01-01",
        end: "2024-01-03",
      })
    })

    it("returns partial range when some dates are cached", () => {
      const mockData = { "EUR/BRL": { "2024-01-01": 5.5 } }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockData))
      loadFileCache()

      const range = getFileCacheUncachedDateRange("EUR/BRL", "2024-01-01" as DateString, "2024-01-03" as DateString)

      expect(range).toEqual({
        start: "2024-01-02",
        end: "2024-01-03",
      })
    })
  })

  describe("clearFileCache", () => {
    it("backs up and clears existing cache", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)

      clearFileCache()

      expect(fs.renameSync).toHaveBeenCalledWith(
        "./actual-cache/exchange-rates-cache.json",
        "./actual-cache/exchange-rates-cache.json.bak",
      )
    })

    it("handles missing cache file", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      clearFileCache()

      expect(fs.renameSync).not.toHaveBeenCalled()
    })
  })
})
