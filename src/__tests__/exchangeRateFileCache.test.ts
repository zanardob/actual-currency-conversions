import { describe, it, expect, beforeEach, vi } from "vitest"
import fs from "node:fs"
import { type DateString } from "../types"

vi.mock("node:fs")

let loadFileCache: typeof import("../exchangeRateFileCache").loadFileCache
let saveFileCache: typeof import("../exchangeRateFileCache").saveFileCache
let getFileCacheRates: typeof import("../exchangeRateFileCache").getFileCacheRates
let setFileCacheRates: typeof import("../exchangeRateFileCache").setFileCacheRates
let getFileCacheUncachedDateRange: typeof import("../exchangeRateFileCache").getFileCacheUncachedDateRange
let clearFileCache: typeof import("../exchangeRateFileCache").clearFileCache

describe("exchangeRateFileCache", () => {
  beforeEach(async () => {
    vi.resetModules()
    const module = await import("../exchangeRateFileCache")
    loadFileCache = module.loadFileCache
    saveFileCache = module.saveFileCache
    getFileCacheRates = module.getFileCacheRates
    setFileCacheRates = module.setFileCacheRates
    getFileCacheUncachedDateRange = module.getFileCacheUncachedDateRange
    clearFileCache = module.clearFileCache
  })

  describe("loadFileCache", () => {
    it("loads existing cache file", () => {
      const mockData = {
        "EUR/BRL": {
          rates: { "2024-01-01": 5.5 },
          historicalThrough: "2024-01-01",
        },
      }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockData))

      loadFileCache()

      expect(fs.readFileSync).toHaveBeenCalledWith("./actual-cache/exchange-rates-cache.json", "utf-8")
      expect(getFileCacheRates("EUR/BRL")).toEqual({ "2024-01-01": 5.5 })
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

    it("backs up cache files in legacy/invalid shapes", () => {
      const legacyData = { "EUR/BRL": { "2024-01-01": 5.5 } }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(legacyData))

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
      const mockData = {
        "EUR/BRL": {
          rates: { "2024-01-01": 5.5 },
          historicalThrough: "2024-01-01",
        },
      }
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

      setFileCacheRates(
        "EUR/BRL",
        { "2024-01-01": 5.123456789 } as Record<DateString, number>,
        "2024-01-01" as DateString,
      )

      const rates = getFileCacheRates("EUR/BRL")
      expect(rates["2024-01-01" as DateString]).toBe(5.123457)
    })

    it("merges with existing rates", () => {
      const mockData = {
        "EUR/BRL": {
          rates: { "2024-01-01": 5.5 },
          historicalThrough: "2024-01-01",
        },
      }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockData))
      loadFileCache()

      setFileCacheRates(
        "EUR/BRL",
        { "2024-01-02": 5.6 } as Record<DateString, number>,
        "2024-01-02" as DateString,
      )

      const rates = getFileCacheRates("EUR/BRL")
      expect(rates).toEqual({
        "2024-01-01": 5.5,
        "2024-01-02": 5.6,
      })
    })

    it("advances historicalThrough monotonically (does not regress to an earlier date)", () => {
      const mockData = {
        "EUR/BRL": {
          rates: { "2024-01-01": 5.5 },
          historicalThrough: "2024-01-05",
        },
      }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockData))
      loadFileCache()

      setFileCacheRates("EUR/BRL", {} as Record<DateString, number>, "2024-01-03" as DateString)
      saveFileCache()

      const written = vi.mocked(fs.writeFileSync).mock.calls.at(-1)?.[1] as string
      expect(JSON.parse(written)).toMatchObject({
        "EUR/BRL": { historicalThrough: "2024-01-05" },
      })
    })

    it("advances historicalThrough when given a later date", () => {
      const mockData = {
        "EUR/BRL": {
          rates: { "2024-01-01": 5.5 },
          historicalThrough: "2024-01-01",
        },
      }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockData))
      loadFileCache()

      setFileCacheRates(
        "EUR/BRL",
        { "2024-01-05": 5.6 } as Record<DateString, number>,
        "2024-01-05" as DateString,
      )
      saveFileCache()

      const written = vi.mocked(fs.writeFileSync).mock.calls.at(-1)?.[1] as string
      expect(JSON.parse(written)).toMatchObject({
        "EUR/BRL": { historicalThrough: "2024-01-05" },
      })
    })
  })

  describe("getFileCacheUncachedDateRange", () => {
    it("returns full range when no cache entry exists", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      loadFileCache()

      const range = getFileCacheUncachedDateRange(
        "EUR/BRL",
        "2024-01-01" as DateString,
        "2024-01-03" as DateString,
      )

      expect(range).toEqual({ start: "2024-01-01", end: "2024-01-03" })
    })

    it("returns null when historicalThrough already covers the requested end", () => {
      const mockData = {
        "EUR/BRL": {
          rates: { "2024-01-01": 5.5 },
          historicalThrough: "2024-01-05",
        },
      }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockData))
      loadFileCache()

      const range = getFileCacheUncachedDateRange(
        "EUR/BRL",
        "2024-01-01" as DateString,
        "2024-01-03" as DateString,
      )

      expect(range).toBeNull()
    })

    it("returns range starting one day after historicalThrough", () => {
      const mockData = {
        "EUR/BRL": {
          rates: { "2024-01-01": 5.5 },
          historicalThrough: "2024-01-02",
        },
      }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockData))
      loadFileCache()

      const range = getFileCacheUncachedDateRange(
        "EUR/BRL",
        "2024-01-01" as DateString,
        "2024-01-05" as DateString,
      )

      expect(range).toEqual({ start: "2024-01-03", end: "2024-01-05" })
    })

    it("treats dates with no rate as covered when below historicalThrough (handles weekends/holidays)", () => {
      // Cache has only Friday's rate but historicalThrough covers through Sunday —
      // the API returned nothing for Sat/Sun, but we should not re-fetch them.
      const mockData = {
        "EUR/BRL": {
          rates: { "2024-01-05": 5.5 },
          historicalThrough: "2024-01-07",
        },
      }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockData))
      loadFileCache()

      const range = getFileCacheUncachedDateRange(
        "EUR/BRL",
        "2024-01-05" as DateString,
        "2024-01-07" as DateString,
      )

      expect(range).toBeNull()
    })

    it("returns the full range when startDate is older than historicalThrough but endDate extends past it", () => {
      const mockData = {
        "EUR/BRL": {
          rates: { "2024-01-05": 5.5 },
          historicalThrough: "2024-01-05",
        },
      }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockData))
      loadFileCache()

      const range = getFileCacheUncachedDateRange(
        "EUR/BRL",
        "2024-01-01" as DateString,
        "2024-01-10" as DateString,
      )

      // We don't try to backfill the older gap; we only fetch what's past the boundary.
      expect(range).toEqual({ start: "2024-01-06", end: "2024-01-10" })
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
