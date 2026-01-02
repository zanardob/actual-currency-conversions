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

## Deployment

Docker images are automatically built and published to GitHub Container Registry when version tags are pushed.
The workflow triggers on tags matching `v*.*.*` (e.g., `v1.0.0`) and publishes images with semantic versioning tags.

### Publishing a New Image Version

To publish a new Docker image version, create and push a version tag to GitHub.

**Via Command Line:**

```bash
# Create a version tag (use semantic versioning)
$ git tag v1.0.0

# Push the tag to GitHub
$ git push origin v1.0.0
```

**Via GitHub Web Interface:**

You can also create a new release directly from GitHub:
1. Go to your repository on GitHub;
2. Click on _Releases → Create a new release_;
3. Click _Choose a tag_ and type a new tag name (e.g., `v1.0.0`);
4. Click _Create new tag_ and publish the release.

This will automatically trigger the GitHub Actions workflow to build and publish the image to `ghcr.io/zanardob/dual-actual` with the corresponding version tag.

## Setup

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

Add the service definition to your existing `docker-compose.yml` (alongside your Actual Budget service).
The Actual Budget service should also use the same "proxy" network to allow communication between the two containers.

**Note**: 
- The image is pulled from GitHub Container Registry.
- Ensure the `ACTUAL_SERVER_URL` matches your Actual Budget container name and port.

### 4. Start the Service

```bash
$ docker compose up -d
```

The service will start immediately and run conversions, then continue running daily at 00:00 UTC.

## Development

For local development, you can build the image locally by replacing the `image` directive with `build: .` in your docker-compose.yml and running:

```bash
$ docker compose up -d --build
```
