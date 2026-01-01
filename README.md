# Actual Currency Conversions

A Docker-based service for automatic currency conversion in [Actual Budget](https://actualbudget.org/). This companion service runs alongside your Actual Budget instance and automatically converts transactions from foreign currency accounts to your base currency.

## Features

- **Automatic Daily Conversions**: Runs daily at 00:00 UTC via cron scheduler
- **Historical Exchange Rates**: Uses [Twelve Data API](https://twelvedata.com/docs) for accurate historical rates
- **Smart Transaction Tracking**: Only converts transactions once, marking them with original amount and exchange rate
- **Docker-Ready**: Designed to run as a companion container to Actual Budget

## Prerequisites

- A running Actual Budget instance
- Docker and Docker Compose
- A [Twelve Data API key](https://twelvedata.com/pricing) (free tier: 800 calls/month)

## Development Setup

### 1. Configure Environment Variables

Create a `.env` file in the project root based on `.env.example` and add your Actual Budget credentials:

```dotenv
ACTUAL_PASSWORD="<your-actual-password>"
TWELVE_DATA_API_KEY="<your-twelve-data-api-key>"
```

### 2. Update Configuration

Edit `src/config.ts` with your Actual Budget settings:

- **syncId**: Find this in Actual Budget under _Settings → Advanced → Sync ID_
- **convertAccounts**: Array of accounts to convert (see below for finding account IDs)
- **toCurrency**: Your base currency (e.g., "EUR", "USD")
- **LOOKBACK_DAYS**: How many days back to process (default: 365)

To find your account IDs, first start the service, then run:

```bash
$ docker exec -it actual-currency-conversions npm run list-accounts
```

### 3. Deploy the Service

Add the service definition to your existing docker-compose.yml (alongside your Actual Budget service):

```yaml
services:
  actual-currency-conversions:
    build: .
    container_name: "actual-currency-conversions"
    restart: "always"
    environment:
      - ACTUAL_SERVER_URL=http://actual-budget:5006
      - ACTUAL_PASSWORD=${ACTUAL_PASSWORD}
      - TWELVE_DATA_API_KEY=${TWELVE_DATA_API_KEY}
    volumes:
      - "./actualcurrencyconversions:/app/actual-cache"
    networks:
      - "proxy"
    healthcheck:
      test: ["CMD-SHELL", "pgrep -f 'tsx src/convert.ts' || exit 1"]
      interval: "60s"
      timeout: "10s"
      retries: "3"
      start_period: "30s"
```

**Note**: Ensure the `ACTUAL_SERVER_URL` matches your Actual Budget container name and port. If using an external network, declare it:

```yaml
networks:
  proxy:
    external: true
```

### 4. Start the Service

```bash
docker compose up -d --build
```

The service will start immediately and run conversions, then continue running daily at 00:00 UTC.
