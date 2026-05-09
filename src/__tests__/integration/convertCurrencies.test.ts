import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

// Per-test cache file lives in tmpdir so the project's ./actual-cache stays untouched
const tmpCachePath = path.join(os.tmpdir(), `actual-cache-test-${Date.now()}-${process.pid}.json`)

// External boundary: Actual API
const mockInit = vi.fn()
const mockDownloadBudget = vi.fn()
const mockGetTransactions = vi.fn()
const mockUpdateTransaction = vi.fn()
const mockShutdown = vi.fn()

// External boundary: Twelve Data HTTP API
const mockFetch = vi.fn()

vi.mock("@actual-app/api", () => ({
  default: {
    init: mockInit,
    downloadBudget: mockDownloadBudget,
    getTransactions: mockGetTransactions,
    updateTransaction: mockUpdateTransaction,
    shutdown: mockShutdown,
  },
}))

// Override the cache file path; everything else from config stays real
vi.mock("../../config", async () => {
  const actual = await vi.importActual<typeof import("../../config")>("../../config")
  return {
    ...actual,
    CACHE_FILE_PATH: tmpCachePath,
  }
})

global.fetch = mockFetch

const cleanupTmpCache = () => {
  if (fs.existsSync(tmpCachePath)) {
    fs.unlinkSync(tmpCachePath)
  }
  if (fs.existsSync(`${tmpCachePath}.bak`)) {
    fs.unlinkSync(`${tmpCachePath}.bak`)
  }
}

describe("convertCurrencies integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    cleanupTmpCache()

    process.env.ACTUAL_SERVER_URL = "http://localhost:5006"
    process.env.ACTUAL_PASSWORD = "test"
    process.env.TWELVE_DATA_API_KEY = "test-key"

    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-06-15"))

    mockInit.mockResolvedValue({})
    mockDownloadBudget.mockResolvedValue({})
    mockShutdown.mockResolvedValue({})
    mockUpdateTransaction.mockResolvedValue({})

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        values: [
          { datetime: "2024-01-01", close: "5.0" },
          { datetime: "2024-01-02", close: "5.0" },
        ],
      }),
    } as Response)
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanupTmpCache()
  })

  it("converts transactions for configured accounts", async () => {
    mockGetTransactions.mockResolvedValue([
      {
        id: "tx1",
        account: "acc1",
        amount: 100000, // 1000.00 BRL in cents
        date: "2024-01-01",
        notes: undefined,
      },
    ])

    const { convertCurrencies } = await import("../../convertCurrencies")
    await convertCurrencies()

    expect(mockInit).toHaveBeenCalledWith({
      dataDir: "./actual-cache",
      serverURL: "http://localhost:5006",
      password: "test",
    })

    expect(mockUpdateTransaction).toHaveBeenCalledWith("tx1", {
      notes: expect.stringContaining("BRL @"),
      amount: 20000, // Math.round(100000 / 5.0)
    })

    expect(mockShutdown).toHaveBeenCalled()
  })

  it("skips already converted transactions", async () => {
    mockGetTransactions.mockResolvedValue([
      {
        id: "tx1",
        account: "acc1",
        amount: 20000,
        date: "2024-01-01",
        notes: "1,000.00 BRL @ 5.0",
      },
    ])

    const { convertCurrencies } = await import("../../convertCurrencies")
    await convertCurrencies()

    expect(mockUpdateTransaction).not.toHaveBeenCalled()
  })

  it("handles multiple transactions in an account", async () => {
    mockGetTransactions.mockResolvedValue([
      { id: "tx1", account: "acc1", amount: 100000, date: "2024-01-01", notes: undefined },
      { id: "tx2", account: "acc1", amount: 200000, date: "2024-01-02", notes: "Original note" },
    ])

    const { convertCurrencies } = await import("../../convertCurrencies")
    await convertCurrencies()

    expect(mockUpdateTransaction).toHaveBeenCalled()
  })

  it("preserves original note when converting", async () => {
    mockGetTransactions.mockResolvedValue([
      {
        id: "tx1",
        account: "acc1",
        amount: 100000,
        date: "2024-01-01",
        notes: "Coffee purchase",
      },
    ])

    const { convertCurrencies } = await import("../../convertCurrencies")
    await convertCurrencies()

    expect(mockUpdateTransaction).toHaveBeenCalledWith("tx1", {
      notes: expect.stringContaining("• Coffee purchase"),
      amount: 20000,
    })
  })

  it("handles empty transaction list", async () => {
    mockGetTransactions.mockResolvedValue([])

    const { convertCurrencies } = await import("../../convertCurrencies")
    await convertCurrencies()

    expect(mockUpdateTransaction).not.toHaveBeenCalled()
  })

  it("dedupes rate fetches across accounts via session cache", async () => {
    // Both configured accounts use BRL→EUR; the session cache should serve the second.
    mockGetTransactions.mockResolvedValue([
      { id: "tx1", account: "acc1", amount: 100000, date: "2024-01-01", notes: undefined },
    ])

    const { convertCurrencies } = await import("../../convertCurrencies")
    await convertCurrencies()

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("persists historical rates to the file cache and reuses them on the next run", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        values: [
          { datetime: "2024-01-01", close: "5.0" },
          { datetime: "2024-01-02", close: "5.1" },
        ],
      }),
    } as Response)
    mockGetTransactions.mockResolvedValue([
      { id: "tx1", account: "acc1", amount: 100000, date: "2024-01-01", notes: undefined },
    ])

    const { convertCurrencies } = await import("../../convertCurrencies")
    await convertCurrencies()

    expect(fs.existsSync(tmpCachePath)).toBe(true)
    const cacheContents = JSON.parse(fs.readFileSync(tmpCachePath, "utf-8"))
    expect(cacheContents).toMatchObject({
      "EUR/BRL": {
        "2024-01-01": expect.any(Number),
        "2024-01-02": expect.any(Number),
      },
    })

    // Second run: the file cache should already have the historical dates,
    // so the fetched range should not include them.
    vi.resetModules()
    mockFetch.mockClear()

    const { convertCurrencies: convertCurrenciesAgain } = await import("../../convertCurrencies")
    await convertCurrenciesAgain()

    for (const call of mockFetch.mock.calls) {
      const url = call[0] as string
      expect(url).not.toContain("start_date=2024-01-01")
    }
  })
})
