# ActualBudget Crypto Tracker
Preface: I made this as a very basic tool for my personal ActualBudget usage and may not be flexible for your setup. This nor ActualBudget is designed for full crypto portfolio tracking. If you are looking for something more advanced I recommend something like [Ghostfolio](https://github.com/ghostfolio/ghostfolio). This tool does not sync your live qauntity holdings, but I'm open to contributors if someone wants to add support for pulling balance holdings via wallet addresses from blockchain.com or similar.

Automatically sync your cryptocurrency portfolio values with [Actual Budget](https://actualbudget.com/) by tracking real-time prices from CoinGecko and creating adjustment transactions to reflect current market values.

## Overview

This lightweight Node.js script runs on a configurable schedule (cron) to keep your crypto asset accounts in Actual Budget synchronized with current market prices. Instead of manually updating account balances, the tracker fetches live prices from the CoinGecko API and automatically creates reconciliation transactions to adjust your account balances.

## Prerequisites

- [Actual Budget](https://actualbudget.com/) server running and accessible
- Node.js 18+ (if running without Docker)
- Docker and Docker Compose (if using Docker deployment)

## Installation

### Option 1: Node.js

```bash
# Clone the repository
git clone https://github.com/mswdev/actualbudget-crypto-tracker.git
cd actualbudget-crypto-tracker

# Install dependencies
npm install

# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
nano .env  # or use your preferred editor
```

### Option 2: Docker

```bash
# Clone the repository
git clone https://github.com/mswdev/actualbudget-crypto-tracker.git
cd actualbudget-crypto-tracker

# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
nano .env  # or use your preferred editor

# Start the container
docker-compose up -d
```

## Configuration

Edit the `.env` file with your settings:

```env
# The URL of your Actual Budget server (e.g., http://localhost:5006)
ACTUAL_SERVER_URL='https://ACTUAL_BUDGET_IP:5006'

# Your Actual Budget server password
ACTUAL_PASSWORD='your_server_password_here'

# The specific Budget ID you want to edit.
# To find this: Open Actual Budget -> Settings -> Show Advanced Settings -> Sync ID
ACTUAL_SYNC_ID='your_sync_id_here'

# How often the script should check prices (Cron Syntax)
# Examples:
# "0 0 * * *"   = Every day at midnight (Recommended)
# "0 * * * *"   = Every hour
# "*/30 * * * *" = Every 30 minutes
CRON_SCHEDULE='0 0 * * *'

# PORTFOLIO CONFIGURATION
# Format:  asset_id:quantity:Account Name
# Separate multiple assets with a semicolon (;)
CRYPTO_ASSETS='bitcoin:0.5:Bitcoin'

# SSL (REQUIRED FOR SELF-SIGNED CERTS) Not recommended if your program reaches out to any other endpoints other than the Actual server.
# SEE https://actualbudget.org/docs/api/#self-signed-https-certificates
NODE_TLS_REJECT_UNAUTHORIZED=0
```

### Finding Your Sync ID

1. Open Actual Budget
2. Go to **Settings**
3. Click **Show Advanced Settings**
4. Copy the **Sync ID**

### Configuring Assets

The `CRYPTO_ASSETS` variable uses this format:
```
asset_id:quantity:Account Name
```

- **asset_id**: CoinGecko asset identifier (e.g., `bitcoin`, `ethereum`, `doge`)
  - Find IDs at: https://api.coingecko.com/api/v3/coins/list
- **quantity**: Amount of the asset you hold (decimals allowed)
- **Account Name**: Exact name of the account in Actual Budget (case-sensitive)

**Examples:**
```env
# Single asset
CRYPTO_ASSETS='bitcoin:0.5:My Bitcoin Wallet'

# Multiple assets
CRYPTO_ASSETS='bitcoin:0.5:Bitcoin;ethereum:2:ETH Holdings;doge:1000:Doge Investment'
```

## Usage

### Running with Node.js

```bash
# Run once
node src/index.js

# Run with npm script
npm run main
```

The script will:
1. Run immediately on startup
2. Then run on the configured `CRON_SCHEDULE`

### Running with Docker

```bash
# Start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down

# Restart after configuration changes
docker-compose restart

# Rebuild after code changes
docker-compose up -d --build
```

### Running as a System Service (Without Docker)

You can run this script as a persistent service on your system without Docker. **Prerequisites**: Node.js must be installed on your system and the `node` command must be accessible in your PATH.

#### Option 1: Direct Execution (Simple)

Simply run the script directly. It will continue running until you stop it:

```bash
# Navigate to project directory
cd actualbudget-crypto-tracker

# Run the script
node src/index.js

# Or use npm
npm run main
```

**Note**: The process will stop when you close the terminal. Use `nohup` or `screen`/`tmux` to keep it running:

```bash
# Run in background with nohup
nohup node src/index.js > crypto-tracker.log 2>&1 &

# View logs
tail -f crypto-tracker.log
```

#### Option 2: PM2 (Recommended for Node.js)

[PM2](https://pm2.keymetrics.io/) is a popular process manager for Node.js applications with automatic restarts and log management.

```bash
# Install PM2 globally
npm install -g pm2

# Start the script
pm2 start src/index.js --name crypto-tracker

# View status
pm2 status

# View logs
pm2 logs crypto-tracker

# Stop the script
pm2 stop crypto-tracker

# Restart the script
pm2 restart crypto-tracker

# Enable auto-start on system boot
pm2 startup
pm2 save
```

#### Option 3: systemd (Linux Systems)

Create a systemd service for automatic startup on boot:

```bash
# Create service file
sudo nano /etc/systemd/system/crypto-tracker.service
```

Add the following configuration (adjust paths to match your setup):

```ini
[Unit]
Description=ActualBudget Crypto Tracker
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/actualbudget-crypto-tracker
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable on boot
sudo systemctl enable crypto-tracker

# Start the service
sudo systemctl start crypto-tracker

# Check status
sudo systemctl status crypto-tracker

# View logs
sudo journalctl -u crypto-tracker -f
```

#### Option 4: Other Process Managers

Other tools you can use:
- **forever**: `npm install -g forever && forever start src/index.js`
- **nodemon** (development): `npm install -g nodemon && nodemon src/index.js`
- **Windows Task Scheduler**: Schedule `node.exe` to run at startup
- **macOS launchd**: Create a launch agent for automatic startup

**Important Notes:**
- Ensure Node.js is properly installed: `node --version` should display the version
- Verify PATH configuration: `which node` (Linux/Mac) or `where node` (Windows)
- The script includes its own cron scheduling, so you don't need external cron jobs
- Make sure the `.env` file is in the project root directory with correct permissions

## How It Works

### Sync Process

1. **Parse Configuration**: Reads and validates the `CRYPTO_ASSETS` environment variable
2. **Connect to Actual Budget**: Establishes connection using your server URL and password
3. **Download Budget**: Syncs the specified budget using the Sync ID
4. **Fetch Prices**: Queries CoinGecko API for current USD prices of each configured asset
5. **Calculate Adjustments**: Compares current account balance with target value (`price × quantity`)
6. **Create Transactions**: If the difference is greater than $1.00, creates an adjustment transaction
7. **Cleanup**: Safely closes the Actual Budget connection

### Why `importTransactions` Instead of `addTransaction`?

The script uses `api.importTransactions()` rather than `api.addTransaction()` for a specific reason: **automatic reconciliation**.

- **`importTransactions()`**: Creates transactions that are automatically marked as **cleared** and **reconciled**, similar to importing transactions from a bank
- **`addTransaction()`**: Creates manual transactions that would require reconciliation in Actual Budget's UI

Since crypto price adjustments reflect the actual market value (similar to how a bank reports your balance), using `importTransactions()` ensures:
- ✅ Transactions are automatically reconciled
- ✅ Account balances immediately reflect current market values
- ✅ No manual reconciliation required in the UI
- ✅ Clean transaction history without pending/unreconciled items

Each transaction includes detailed notes:
```
Asset: bitcoin | Price: $45000.50 | Qty: 0.5
```

This provides a complete audit trail showing what price was used and when.

## Troubleshooting

### "Could not find an open account named X"

- Verify the account name in `.env` matches exactly (case-sensitive)
- Ensure the account is not closed in Actual Budget
- Check for extra spaces in the account name

### "CoinGecko error: Asset X not found"

- Verify the asset ID is correct: https://api.coingecko.com/api/v3/coins/list
- Common IDs: `bitcoin`, `ethereum`, `cardano`, `polkadot`, `solana`

### SSL/TLS Certificate Errors

If using self-signed certificates with Actual Budget:
```env
NODE_TLS_REJECT_UNAUTHORIZED=0
```

**Security Note**: Only use this for self-hosted Actual Budget instances with self-signed certificates. Not recommended if your program reaches out to any other endpoints other than the ActualBudget server. See [Actual Budget documentation](https://actualbudget.org/docs/api/#self-signed-https-certificates) for more details.

### Docker Container Not Starting

```bash
# Check logs for errors
docker-compose logs

# Verify .env file exists and is configured
cat .env

# Ensure port 5006 is accessible from the Docker container!
```

## Development

```bash
# Install dependencies
npm install

# Run the script directly
node src/index.js

# Test configuration parsing
node -e "require('dotenv').config(); console.log(process.env.CRYPTO_ASSETS)"
```

## Contributing

Contributions are welcome! Submit an issue or pull request!

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: https://github.com/mswdev/actualbudget-crypto-tracker/issues
- **Actual Budget Documentation**: https://actualbudget.org/docs/
- **CoinGecko API**: https://www.coingecko.com/en/api

---

**Disclaimer**: This tool is for personal portfolio tracking. Cryptocurrency prices are volatile. Always verify balances and transactions in your Actual Budget instance.
