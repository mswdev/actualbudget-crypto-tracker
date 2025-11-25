# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ActualBudget Crypto Tracker is a Node.js script that automatically syncs cryptocurrency portfolio values with ActualBudget by fetching prices from CoinGecko API and creating adjustment transactions to match current market values. The script runs on a configurable cron schedule.

## Development Commands

```bash
# Install dependencies
npm install

# Run the script
npm run main

# Direct execution
node src/index.js
```

## Docker Deployment

```bash
# Build and run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

**Configuration Options:**
- **Option 1 (Recommended)**: Use `.env` file - the compose file automatically loads it via `env_file`
- **Option 2**: Uncomment and configure the `environment:` section in `docker-compose.yml` to override `.env` values
- Container runs with `restart: unless-stopped` for automatic recovery after system reboots

## Configuration

The application is configured entirely through environment variables in `.env`:

- `ACTUAL_SERVER_URL`: ActualBudget server URL (e.g., https://localhost:5006)
- `ACTUAL_PASSWORD`: Server password
- `ACTUAL_SYNC_ID`: Budget Sync ID (found in Actual Budget → Settings → Show Advanced Settings → Sync ID)
- `CRON_SCHEDULE`: Cron syntax for sync frequency (default: `'0 0 * * *'` - daily)
- `CRYPTO_ASSETS`: Portfolio configuration in format `asset_id:quantity:Account Name` separated by semicolons
  - Example: `bitcoin:0.5:Bitcoin;ethereum:2:Ethereum Wallet`
  - `asset_id` must match CoinGecko API asset IDs
- `NODE_TLS_REJECT_UNAUTHORIZED`: Set to `0` for self-signed certificates (see ActualBudget docs)

## Architecture

### Single-File Design
The entire application logic is in `src/index.js` with the following flow:

1. **Configuration Parsing** (`parseConfig()` at line 67):
   - Parses `CRYPTO_ASSETS` environment variable
   - Validates format and returns array of portfolio items

2. **Main Sync Loop** (`run()` at line 14):
   - Initializes ActualBudget API connection with temp data directory (`/tmp/actual-data`)
   - Downloads budget using `SYNC_ID`
   - Fetches all accounts from ActualBudget
   - Processes each configured asset by matching account names

3. **Account Processing** (`processAccount()` at line 82):
   - Fetches current USD price from CoinGecko API (`https://api.coingecko.com/api/v3/simple/price`)
   - Calculates target value: `price × quantity`
   - Compares with current ActualBudget account balance
   - Creates adjustment transaction via `api.importTransactions()` if difference > $1.00
   - Transaction notes include asset ID, price, and quantity for audit trail

4. **Cron Scheduling**:
   - Script runs immediately on startup
   - Then runs on configured `CRON_SCHEDULE`
   - Each run performs a full sync of all configured assets

### Key Dependencies
- `@actual-app/api`: Official ActualBudget API client
- `axios`: HTTP client for CoinGecko API requests
- `node-cron`: Cron job scheduler
- `dotenv`: Environment variable management

### Important Implementation Details

**Currency Handling**: ActualBudget stores amounts as integers in cents. Always multiply USD values by 100 when creating transactions and divide by 100 when reading balances.

**Transaction Method**: Use `api.importTransactions(accountId, [transactionArray])` - it expects an array of transaction objects, not individual transactions.

**Account Matching**: Accounts are matched by exact name match (`acct.name === item.accountName`) and must not be closed (`!acct.closed`).

**Error Handling**: The script continues processing other assets if one fails. Errors are logged but don't crash the script. Connection is always closed in the `finally` block.
