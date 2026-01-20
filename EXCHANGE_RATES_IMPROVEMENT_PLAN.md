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
    │  In-Memory      │         │  File Cache     │
    │  Session Cache  │         │  (JSON file)    │
    │  (Map object)   │         │                 │
    └─────────────────┘         └─────────────────┘
```

---

## Detailed Implementation Plan

### Step 1: Create the File Cache Module

**New file: `src/exchangeRateCache.ts`**

This module will handle reading/writing rates to a JSON file.

#### Responsibilities:
- Load cached rates from file on startup
- Save rates to file after fetching
- Determine which dates need to be fetched (not in cache)
- Only cache rates older than 30 days (these are stable/historical)

#### File Structure:
```json
{
  "BRL/EUR": {
    "2025-01-01": 0.165432,
    "2025-01-02": 0.164891
  },
  "USD/EUR": {
    "2025-01-01": 0.923456
  }
}
```

#### Key Functions:
- `loadCache(): Record<string, Record<string, number>>` - Load from file
- `saveCache(cache: Record<string, Record<string, number>>): void` - Save to file
- `getCachedRates(currencyPair: string): Record<string, number>` - Get rates for a pair
- `setCachedRates(currencyPair: string, rates: Record<string, number>): void` - Store rates
- `getUncachedDateRange(currencyPair: string, startDate: string, endDate: string): { start: string, end: string } | null` - Determine what needs fetching
- `clearCache(): void` - Clear the cache file (backup if exists)

#### Cache File Location:
- Store in `./data/exchange-rates-cache.json`
- **Define the path once in `config.ts`** and reference it everywhere
- Create the `data` directory if it doesn't exist
- Add `data/` to `.gitignore`

---

### Step 2: Create the Exchange Rate Manager

**New file: `src/exchangeRateManager.ts`**

This module will be the central point for getting exchange rates, managing both the in-memory session cache and the file cache.

#### Responsibilities:
- Maintain an in-memory cache of rates for the current session
- Coordinate between file cache and API calls
- Ensure each currency pair is only fetched once per session
- Determine optimal date ranges to fetch (only fetch what's not cached)

#### Key Functions:
- `initializeManager(): Promise<void>` - Load file cache at startup
- `getRates(fromCurrency: string, toCurrency: string): Promise<Record<string, number>>` - Main entry point
- `shutdownManager(): Promise<void>` - Save cache to file at end of session

#### Logic Flow for `getRates()`:
```
1. Check if currency pair exists in session cache
   → If yes, return cached rates
   
2. Load rates from file cache for this pair
   
3. Determine which dates are missing:
   - Dates older than 30 days: should be in file cache
   - Dates within last 30 days: need to fetch from API
   
4. If dates need fetching:
   - Call Twelve Data API for missing date range only
   - Merge with cached rates
   
5. Update file cache with any new historical rates (>30 days old)

6. Store complete rates in session cache

7. Return rates
```

---

### Step 3: Modify `exchangeRateConverter.ts`

Update the existing module to use the new manager instead of directly calling the API.

#### Changes:
- Remove direct API call logic (move to manager)
- `fetchRates()` will now call `exchangeRateManager.getRates()`
- Keep the `applyRate()` logic as-is (it works well)

---

### Step 4: Update `convertCurrencies.ts`

#### Changes:
- Rename the `convert` function to `convertCurrencies`
- Export the `convertCurrencies` function so it can be imported by `schedule.ts`
- Remove the cron scheduling logic (moved to `schedule.ts`)
- Remove the manual run check at the bottom (moved to `schedule.ts`)
- Initialize the exchange rate manager at the start of the conversion job
- Shutdown the manager at the end (to save cache)

```typescript
// At start of convertCurrencies()
await initializeManager()

// ... existing account loop ...

// At end of convertCurrencies()
await shutdownManager()
await actualApi.shutdown()
```

---

### Step 5: Create Schedule Module

**New file: `src/schedule.ts`**

This module will handle the cron scheduling, separating scheduling concerns from the conversion logic.

#### Responsibilities:
- Import and call `convertCurrencies` from `convertCurrencies.ts`
- Configure and start the cron job (daily at 00:00 UTC)
- Handle manual run when script is executed directly

#### Structure:
```typescript
import cron from "node-cron"
import { convertCurrencies } from "./convertCurrencies"

// 00:00 UTC daily
cron.schedule(
  "0 0 * * *",
  () => {
    convertCurrencies()
  },
  { timezone: "UTC" },
)

console.log("Cron scheduler started: running daily at 00:00 UTC")

// Allow manual run if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  convertCurrencies()
}
```

#### Update `package.json`:
Change the `convert` script to run `schedule.ts` instead:
```json
"convert": "tsx src/schedule.ts"
```

---

### Step 6: Configuration Updates

**Update `src/config.ts`**

Add cache configuration (path defined once, referenced everywhere):
```typescript
export const CACHE_FILE_PATH = './data/exchange-rates-cache.json'
export const HISTORICAL_THRESHOLD_DAYS = 30  // Rates older than this are considered stable
```

---

### Step 7: Add Clear Cache Command

**New file: `src/clearCache.ts`**

Create a command similar to `listAccounts.ts` to clear the cache.

#### Behavior:
- If cache file exists, back it up to `exchange-rates-cache.backup.json`
- Delete the main cache file
- Log success message

#### Add to `package.json`:
```json
"scripts": {
  "clear-cache": "tsx src/clearCache.ts"
}
```

---

### Step 8: Docker Volume Configuration

**Update `docker-compose.yml`**

Add a volume mount for cache persistence:
```yaml
volumes:
  - ./data:/app/data
```

This ensures the cache persists across container restarts.

---

## Design Decisions (Based on Clarifications)

| Question | Decision |
|----------|----------|
| Cache file location | `./data/exchange-rates-cache.json` - defined once in `config.ts`, referenced everywhere |
| 30-day threshold | Hardcoded to 30 days, not configurable |
| Cache invalidation | Add `clear-cache` command (similar to `list-accounts`) |
| Corrupted cache handling | Backup corrupted file and start fresh with API data, do not error out |
| Docker support | Add volume mount in `docker-compose.yml` for persistence |
| Rate precision | Always 6 decimal places |
| Currency pair format | `TO/FROM` format (e.g., `EUR/BRL`) to match Twelve Data API convention |
| API error handling | Wrap fetch in try/catch, check response.ok, return empty rates on failure |

---

## Benefits of This Approach

1. **Reduced API Calls**: 
   - Same currency pair across accounts = 1 API call instead of N
   - Historical rates fetched once and stored forever

2. **Faster Execution**:
   - File cache loads instantly vs API latency
   - Only recent dates (last 30 days) need API calls

3. **Cost Savings**:
   - Twelve Data API likely has rate limits or costs
   - Fewer calls = lower costs / less risk of hitting limits

4. **Reliability**:
   - If API is down, historical conversions still work from cache
   - Only recent transactions would be affected

5. **Minimal Code Changes**:
   - Existing `applyRate()` logic unchanged
   - `convertCurrencies.ts` changes are minimal (rename function, export, remove cron)
   - Cron scheduling isolated in `schedule.ts`
   - New functionality isolated in new modules

6. **Docker-Ready**:
   - Volume mount ensures cache persists across container restarts
   - Works seamlessly in VPS deployment

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/exchangeRateCache.ts` | **CREATE** | File-based cache read/write operations |
| `src/exchangeRateManager.ts` | **CREATE** | Central rate management with session cache |
| `src/exchangeRateConverter.ts` | **MODIFY** | Use manager instead of direct API calls |
| `src/convertCurrencies.ts` | **MODIFY** | Rename `convert` function to `convertCurrencies`, export it, remove cron logic, initialize/shutdown manager |
| `src/schedule.ts` | **CREATE** | Cron scheduling configuration, imports and calls `convertCurrencies` |
| `src/config.ts` | **MODIFY** | Add cache configuration (path defined once) |
| `src/clearCache.ts` | **CREATE** | Command to clear the cache |
| `package.json` | **MODIFY** | Add `clear-cache` script, update `convert` script to run `schedule.ts` |
| `data/` | **CREATE** | Directory for cache file |
| `.gitignore` | **MODIFY** | Add `data/` directory |
| `docker-compose.yml` | **MODIFY** | Add volume mount for cache persistence |

---

## Implementation Checklist

### Step 1: Create File Cache Module (`src/exchangeRateCache.ts`) ✓
- [x] Create the new file with cache read/write operations ✓
- [x] Implement loadCache, saveCache, getCachedRates, setCachedRates functions ✓
- [x] Implement getUncachedDateRange and clearCache functions ✓
- [x] Handle corrupted cache (backup and start fresh) ✓
- [x] Apply feedback: strict union types for currency pairs (`CurrencyPair`) ✓
- [x] Apply feedback: `DateString` type for YYYY-MM-DD format ✓
- [x] Apply feedback: backup to `.json.bak` extension ✓
- [x] Apply feedback: restore `startDate` parameter to `getUncachedDateRange` ✓
- [x] Apply feedback: use template literals instead of concatenation ✓
- [x] Apply feedback: factory pattern for cache state (avoid global mutable variable) ✓
- **✅ COMPLETE**

#### Learnings from Step 1:
- Use strict union types (e.g., `CurrencyPair`, `DateString`) to narrow types and improve type safety
- Prefer factory pattern over global mutable variables for encapsulated state
- Always use template literals for string interpolation
- Backup files should use `.json.bak` extension

#### Fixes from Step 2 Review:
- Fixed `getUncachedDateRange` to return `null` when fully cached (was incorrectly returning full range)
- Fixed currency pair direction to use `TO/FROM` format (e.g., `EUR/BRL`) to match original converter

### Step 2: Create Exchange Rate Manager (`src/exchangeRateManager.ts`)
- [x] Create the new file with session cache management
- [x] Implement initializeManager, getRates, shutdownManager functions
- [x] Coordinate between file cache and API calls
- [x] Add error handling for API fetch (try/catch, check response.ok)
- **⏸️ STOP FOR REVIEW**

### Step 3: Modify `exchangeRateConverter.ts`
- [ ] Remove direct API call logic (move to manager)
- [ ] Update fetchRates() to call exchangeRateManager.getRates()
- [ ] Keep applyRate() logic as-is
- **⏸️ STOP FOR REVIEW**

### Step 4: Update `currencyConversionJob.ts` → `convertCurrencies.ts`
- [ ] Rename file
- [ ] Rename `convert` function to `convertCurrencies`
- [ ] Export the function
- [ ] Remove cron scheduling logic
- [ ] Add manager initialization/shutdown
- **⏸️ STOP FOR REVIEW**

### Step 5: Create Schedule Module (`src/schedule.ts`)
- [ ] Create new file with cron configuration
- [ ] Import and call convertCurrencies
- [ ] Handle manual run check
- **⏸️ STOP FOR REVIEW**

### Step 6: Configuration Updates (`src/config.ts`)
- [ ] Add CACHE_FILE_PATH constant
- [ ] Add HISTORICAL_THRESHOLD_DAYS constant
- **⏸️ STOP FOR REVIEW**

### Step 7: Add Clear Cache Command (`src/clearCache.ts`)
- [ ] Create new file
- [ ] Implement backup and delete logic
- **⏸️ STOP FOR REVIEW**

### Step 8: Update `package.json`
- [ ] Add `clear-cache` script
- [ ] Update `convert` script to run `schedule.ts`
- **⏸️ STOP FOR REVIEW**

### Step 9: Docker & Git Configuration
- [ ] Create `data/` directory
- [ ] Update `.gitignore` to add `data/`
- [ ] Update `docker-compose.yml` with volume mount
- **⏸️ STOP FOR REVIEW**

### Step 10: Final Testing & Verification
- [ ] Run type-check
- [ ] Test manual conversion run
- **⏸️ STOP FOR REVIEW**

---

## Next Steps

Ready to proceed with implementation!
