import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"

// Create mock functions
const mockInit = vi.fn()
const mockDownloadBudget = vi.fn()
const mockGetTransactions = vi.fn()
const mockUpdateTransaction = vi.fn()
const mockShutdown = vi.fn()
const mockFetch = vi.fn()

// File cache mocks
const mockLoadFileCache = vi.fn()
const mockSaveFileCache = vi.fn()
const mockGetFileCacheRates = vi.fn()
const mockSetFileCacheRates = vi.fn()
const mockGetFileCacheUncachedDateRange = vi.fn()

// Session cache mocks
const mockHasSessionCache = vi.fn()
const mockGetSessionCache = vi.fn()
const mockSetSessionCache = vi.fn()
const mockClearSessionCache = vi.fn()

// Mock all external dependencies before any imports
vi.mock("@actual-app/api", () => ({
  default: {
    init: mockInit,
    downloadBudget: mockDownloadBudget,
    getTransactions: mockGetTransactions,
    updateTransaction: mockUpdateTransaction,
    shutdown: mockShutdown,
  },
}))

vi.mock("../../exchangeRateFileCache", () => ({
  loadFileCache: mockLoadFileCache,
  saveFileCache: mockSaveFileCache,
  getFileCacheRates: mockGetFileCacheRates,
  setFileCacheRates: mockSetFileCacheRates,
  getFileCacheUncachedDateRange: mockGetFileCacheUncachedDateRange,
}))

vi.mock("../../exchangeRateSessionCache", () => ({
  hasSessionCache: mockHasSessionCache,
  getSessionCache: mockGetSessionCache,
  setSessionCache: mockSetSessionCache,
  clearSessionCache: mockClearSessionCache,
}))

// Set up global fetch mock
global.fetch = mockFetch

describe("convertCurrencies integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Set up environment variables
    process.env.ACTUAL_SERVER_URL = "http://localhost:5006"
    process.env.ACTUAL_PASSWORD = "test"
    process.env.TWELVE_DATA_API_KEY = "test-key"

    // Use fixed date for consistent testing
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-06-15"))

    // Default Actual API mock implementations
    mockInit.mockResolvedValue({})
    mockDownloadBudget.mockResolvedValue({})
    mockShutdown.mockResolvedValue({})
    mockUpdateTransaction.mockResolvedValue({})

    // Default file cache mock implementations
    mockGetFileCacheRates.mockReturnValue({})
    mockGetFileCacheUncachedDateRange.mockReturnValue({
      start: "2023-06-15",
      end: "2024-06-15",
    })

    // Default session cache mock implementations
    mockHasSessionCache.mockReturnValue(false)

    // Default fetch mock for exchange rates
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

    // Import and run conversion (use dynamic import to get fresh module)
    const { convertCurrencies } = await import("../../convertCurrencies")
    await convertCurrencies()

    // Verify Actual API was initialized
    expect(mockInit).toHaveBeenCalledWith({
      dataDir: "./actual-cache",
      serverURL: "http://localhost:5006",
      password: "test",
    })

    // Verify transaction was updated with conversion
    expect(mockUpdateTransaction).toHaveBeenCalledWith("tx1", {
      notes: expect.stringContaining("BRL @"),
      amount: 20000, // Math.round(100000 / 5.0)
    })

    // Verify cleanup
    expect(mockShutdown).toHaveBeenCalled()
  })

  it("skips already converted transactions", async () => {
    mockGetTransactions.mockResolvedValue([
      {
        id: "tx1",
        account: "acc1",
        amount: 20000,
        date: "2024-01-01",
        notes: "1,000.00 BRL @ 5.0", // Already converted
      },
    ])

    const { convertCurrencies } = await import("../../convertCurrencies")
    await convertCurrencies()

    // Should not update already-converted transaction
    expect(mockUpdateTransaction).not.toHaveBeenCalled()
  })

  it("handles multiple transactions in an account", async () => {
    mockGetTransactions.mockResolvedValue([
      {
        id: "tx1",
        account: "acc1",
        amount: 100000, // 1000.00 BRL
        date: "2024-01-01",
        notes: undefined,
      },
      {
        id: "tx2",
        account: "acc1",
        amount: 200000, // 2000.00 BRL
        date: "2024-01-02",
        notes: "Original note",
      },
    ])

    const { convertCurrencies } = await import("../../convertCurrencies")
    await convertCurrencies()

    // Both transactions should be updated
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
})
