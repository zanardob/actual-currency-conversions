# Exchange Rates Improvement Plan

## Current State Analysis

### How It Works Now
1. **`convert.ts`** iterates over each account in `ACTUAL_CONFIG.convertAccounts`
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
│                        convert.ts                                │
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

**New file: `src/rateCache.ts`**

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
    "2025-01-02": 0.164891,
    ...
  },
  "USD/EUR": {
    "2025-01-01": 0.923456,
    ...
  }
}
```

#### Key Functions:
- `loadCache(): Record<string, Record<string, number>>` - Load from file
- `saveCache(cache: Record<string, Record<string, number>>): void` - Save to file
- `getCachedRates(currencyPair: string): Record<string, number>` - Get rates for a pair
- `setCachedRates(currencyPair: string, rates: Record<string, number>): void` - Store rates
- `getUncachedDateRange(currencyPair: string, startDate: string, endDate: string): { start: string, end: string } | null` - Determine what needs fetching

#### Cache File Location:
- Store in `./data/exchange-rates-cache.json`
- Create the `data` directory if it doesn't exist
- Add `data/` to `.gitignore` (or make configurable via env var)

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

### Step 3: Modify `exchangeRates.ts`

Update the existing module to use the new manager instead of directly calling the API.

#### Changes:
- Remove direct API call logic (move to manager)
- `fetchRates()` will now call `exchangeRateManager.getRates()`
- Keep the `applyRate()` logic as-is (it works well)

---

### Step 4: Update `convert.ts`

#### Changes:
- Initialize the exchange rate manager at the start of the conversion job
- Shutdown the manager at the end (to save cache)
- The rest of the logic remains the same

```typescript
// At start of convert()
await initializeManager()

// ... existing account loop ...

// At end of convert()
await shutdownManager()
await actualApi.shutdown()
```

---

### Step 5: Configuration Updates

**Update `src/config.ts`**

Add new configuration options:
```typescript
export const CACHE_CONFIG = {
  cacheFilePath: process.env.CACHE_FILE_PATH || './data/exchange-rates-cache.json',
  historicalThresholdDays: 30, // Rates older than this are considered stable
}
```

---

## Clarifying Questions

Before proceeding with implementation, I'd like to confirm a few things:

1. **Cache File Location**: Is `./data/exchange-rates-cache.json` an acceptable location? Or would you prefer it configurable via environment variable?

2. **30-Day Threshold**: The issue mentions "older than 30 days" for persistent storage. Should this be configurable, or is 30 days a fixed requirement?

3. **Cache Invalidation**: Should there be a mechanism to manually clear/invalidate the cache? (e.g., a CLI command or deleting the file)

4. **Error Handling**: If the cache file is corrupted or unreadable, should we:
   - Fail loudly and stop?
   - Log a warning and start fresh?
   - Backup the corrupted file and start fresh?

5. **Docker Considerations**: The project uses Docker. Should the cache file location be a mounted volume by default in `docker-compose.yml`?

6. **Rate Precision**: The current code uses 6 decimal places (`dp=6`). Should cached rates maintain this precision?

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
   - `convert.ts` changes are minimal
   - New functionality isolated in new modules

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/rateCache.ts` | **CREATE** | File-based cache read/write operations |
| `src/exchangeRateManager.ts` | **CREATE** | Central rate management with session cache |
| `src/exchangeRates.ts` | **MODIFY** | Use manager instead of direct API calls |
| `src/convert.ts` | **MODIFY** | Initialize/shutdown manager |
| `src/config.ts` | **MODIFY** | Add cache configuration options |
| `data/` | **CREATE** | Directory for cache file |
| `.gitignore` | **MODIFY** | Add `data/` directory |
| `docker-compose.yml` | **MODIFY** | Add volume mount for cache persistence |

---

## Next Steps

Once you've reviewed this plan and answered the clarifying questions, I'll proceed with the implementation. Let me know if you'd like any changes to the approach!
