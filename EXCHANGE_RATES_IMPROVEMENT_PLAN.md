# Exchange Rates Improvement Plan

## Current State Analysis

### How It Works Now

1. **`convertCurrencies.ts`** iterates over each account in `ACTUAL_CONFIG.convertAccounts`
2. For each account, it creates a new `Exchange` instance via `createExchange()`
3. Each `Exchange` instance calls `fetchRates()` which hits the Twelve Data API
4. The API fetches rates for the last 365 days (`LOOKBACK_DAYS`)

### Identified Problems

1. **Duplicate API Calls**: If multiple accounts share the same currency pair (e.g., two accounts both converting BRL → EUR), the API is called multiple times for the same data
2. **No Persistent Storage**: Historical rates older than 30 days are stable and won't change, yet they're refetched every time the job runs
3. **No In-Memory Cache**: Even within a single run, there's no mechanism to reuse fetched rates across accounts

### Current Configuration Example

```typescript
convertAccounts: [
  { id: "...", fromCurrency: "BRL" },
  { id: "...", fromCurrency: "BRL" },
]
toCurrency: "EUR"
```

Both accounts hit the API for `BRL/EUR` rates separately.

---

## Proposed Solution

### Overview

Implement a two-tier caching strategy:

1. **Persistent File Cache**: Store historical rates (older than 30 days) in a JSON file
2. **In-Memory Session Cache**: Cache fetched rates during a single conversion run to avoid duplicate API calls for the same currency pair

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     convertCurrencies.ts                         │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Account 1   │    │  Account 2   │    │  Account N   │       │
│  │  BRL → EUR   │    │  BRL → EUR   │    │  USD → EUR   │       │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │
│         │                   │                   │                │
│         └─────────┬─────────┴─────────┬─────────┘                │
│                   ▼                   ▼                          │
│         ┌─────────────────────────────────────────┐              │
│         │         Exchange Rate Manager           │              │
│         │  (new module: exchangeRateManager.ts)   │              │
│         └─────────────────┬───────────────────────┘              │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
    ┌─────────────────┐         ┌─────────────────┐
    │  Session Cache  │         │  File Cache     │
    │  (Map object)   │         │  (JSON file)    │
    └─────────────────┘         └─────────────────┘
```

---

## Design Decisions

| Question | Decision |
| --- | --- |
| Cache file location | `./data/exchange-rates-cache.json` - defined once in `config.ts`, referenced everywhere |
| 30-day threshold | Hardcoded to 30 days, not configurable |
| Cache invalidation | Add `clear-cache` command (similar to `list-accounts`) |
| Corrupted cache handling | Backup corrupted file and start fresh with API data, do not error out |
| Docker support | Add volume mount in `docker-compose.yml` for persistence |
| Rate precision | Always 6 decimal places |
| Currency pair format | `TO/FROM` format (e.g., `EUR/BRL`) to match Twelve Data API convention |
| API error handling | Wrap fetch in try/catch, check response.ok, return empty rates on failure |
| Cache module pattern | Module-level singleton with exported functions (not factory pattern) |
| Function naming | Explicit naming with module prefix (e.g., `loadFileCache`, `hasSessionCache`) |
| Script separation | `convert` runs once, `schedule` starts cron daemon |

---

## File Structure (Final)

```
src/
├── config.ts                    # Configuration constants
├── types.ts                     # Type definitions (CurrencyPair, DateString, RatesCache)
├── exchangeRateFileCache.ts     # File cache module (singleton)
├── exchangeRateSessionCache.ts  # Session cache module (singleton)
├── exchangeRateManager.ts       # Orchestrates caching and API calls
├── exchangeRateConverter.ts     # Creates Exchange instances, uses manager
├── convertCurrencies.ts         # Main conversion logic, runnable directly
├── schedule.ts                  # Cron scheduler (daemon)
├── clearCache.ts                # Utility to clear caches
└── listAccounts.ts              # Utility to list accounts
```

---

## Module APIs

### File Cache (`exchangeRateFileCache.ts`)

```typescript
loadFileCache(): void                    // Load from JSON file
saveFileCache(): void                    // Save to JSON file
getFileCacheRates(pair): Record          // Get rates for currency pair
setFileCacheRates(pair, rates): void     // Store rates for currency pair
getFileCacheUncachedDateRange(pair, start, end): Range | null  // Find missing dates
clearFileCache(): void                   // Backup and delete file
resetFileCache(): void                   // Reset in-memory state only
```

### Session Cache (`exchangeRateSessionCache.ts`)

```typescript
hasSessionCache(pair): boolean           // Check if pair is cached
getSessionCache(pair): Record | undefined // Get cached rates
setSessionCache(pair, rates): void       // Store rates
clearSessionCache(): void                // Clear in-memory cache
```

### Manager (`exchangeRateManager.ts`)

```typescript
initializeManager(): void                // Load file cache, clear session cache
shutdownManager(): void                  // Save file cache, clear session cache
getRates(from, to): Promise<Record>      // Main entry point for getting rates
```

---

## NPM Scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `npm run convert` | `tsx src/convertCurrencies.ts` | Run conversion once (manual/testing) |
| `npm run schedule` | `tsx src/schedule.ts` | Start cron daemon (production) |
| `npm run clear-cache` | `tsx src/clearCache.ts` | Clear exchange rate caches |
| `npm run list-accounts` | `tsx src/listAccounts.ts` | List Actual accounts |
| `npm run type-check` | `tsc --noEmit` | Type check without emitting |
| `npm run format` | `prettier --write .` | Format code |

---

## Implementation Checklist

### Step 1: File Cache Module ✅ COMPLETE

**File:** `src/exchangeRateFileCache.ts`

- [x] Create module with cache read/write operations
- [x] Implement all cache functions with explicit naming
- [x] Handle corrupted cache (backup and start fresh)
- [x] Use strict union types (`CurrencyPair`, `DateString`)
- [x] Return `null` from `getFileCacheUncachedDateRange` when fully cached

### Step 2: Session Cache Module ✅ COMPLETE

**File:** `src/exchangeRateSessionCache.ts`

- [x] Create module with in-memory Map
- [x] Implement all cache functions with explicit naming
- [x] Module-level singleton pattern

### Step 3: Exchange Rate Manager ✅ COMPLETE

**File:** `src/exchangeRateManager.ts`

- [x] Implement `initializeManager`, `getRates`, `shutdownManager`
- [x] Coordinate between file cache, session cache, and API
- [x] Add error handling for API fetch (try/catch, check response.ok)
- [x] Filter historical rates (>30 days) before caching to file
- [x] Use `TO/FROM` currency pair format for API

### Step 4: Update Converter ✅ COMPLETE

**File:** `src/exchangeRateConverter.ts`

- [x] Remove direct API call logic
- [x] `fetchRates()` now calls `getRates()` from manager
- [x] Keep `applyRate()` logic unchanged

### Step 5: Update Conversion Job ✅ COMPLETE

**File:** `src/convertCurrencies.ts` (renamed from `currencyConversionJob.ts`)

- [x] Rename function to `convertCurrencies` and export it
- [x] Remove cron scheduling logic
- [x] Add `initializeManager()` at start
- [x] Add `shutdownManager()` at end
- [x] Call `convertCurrencies()` at bottom for direct execution

### Step 6: Create Schedule Module ✅ COMPLETE

**File:** `src/schedule.ts`

- [x] Create cron job (daily at 00:00 UTC)
- [x] Import and call `convertCurrencies`
- [x] No manual run check (that's what `convert` script is for)

### Step 7: Configuration Updates ✅ COMPLETE

**File:** `src/config.ts`

- [x] Add `CACHE_FILE_PATH` constant
- [x] Add `HISTORICAL_THRESHOLD_DAYS` constant

### Step 8: Clear Cache Command ✅ COMPLETE

**File:** `src/clearCache.ts`

- [x] Import and call `clearFileCache()` and `clearSessionCache()`
- [x] Simple one-liner execution

### Step 9: Update package.json ✅ COMPLETE

- [x] Update `convert` script to run `convertCurrencies.ts`
- [x] Add `schedule` script to run `schedule.ts`
- [x] Add `clear-cache` script

### Step 10: Docker & Git Configuration ⏸️ PENDING

- [ ] Create `data/` directory
- [ ] Add `data/` to `.gitignore`
- [ ] Update `docker-compose.yml` with volume mount

### Step 11: Final Testing ⏸️ PENDING

- [ ] Run `npm run type-check`
- [ ] Test `npm run convert` manually
- [ ] Test `npm run clear-cache`

---

## Learnings & Best Practices

### 1. Module Pattern: Singleton vs Factory

**Decision:** Use module-level singleton with exported functions.

**Why:**
- Both caches are inherently singletons (one file, one session)
- Factory pattern adds unnecessary complexity for singleton resources
- Standalone scripts (like `clearCache.ts`) become awkward with factories:
  ```typescript
  // Factory pattern (awkward)
  const store = createFileCacheStore()
  store.clear()

  // Singleton pattern (clean)
  clearFileCache()
  ```

### 2. Explicit Function Naming

**Decision:** Prefix functions with module context (e.g., `loadFileCache`, `hasSessionCache`).

**Why:**
- Clear which cache a function operates on
- Consistent naming across both cache modules
- Self-documenting code

### 3. Script Separation

**Decision:** Separate `convert` (one-time) from `schedule` (daemon).

**Why:**
- `convert` for development, testing, manual runs
- `schedule` for production (Docker daemon)
- Don't conflate scheduling with execution

### 4. Currency Pair Direction

**Decision:** Use `TO/FROM` format (e.g., `EUR/BRL`).

**Why:**
- Matches Twelve Data API convention
- Matches original converter implementation
- Consistent throughout codebase

### 5. Error Handling Strategy

**Decision:** Graceful degradation - return empty rates on API failure.

**Why:**
- Don't crash the entire job for one failed fetch
- Historical rates from cache still available
- Log errors for debugging

### 6. Cache Return Values

**Decision:** `getFileCacheUncachedDateRange` returns `null` when fully cached.

**Why:**
- Caller can skip API call entirely when `null`
- Avoids unnecessary API calls for fully cached date ranges
- Original bug returned full range, defeating cache purpose

---

## Next Steps

When ready to continue:

1. **Step 10:** Create `data/` directory, update `.gitignore`, update `docker-compose.yml`
2. **Step 11:** Run type-check and manual tests
3. **Commit:** Create commit with all changes
