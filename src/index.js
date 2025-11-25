const api = require('@actual-app/api');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
require('dotenv').config();

// Configuration
const SERVER_URL = process.env.ACTUAL_SERVER_URL;
const PASSWORD = process.env.ACTUAL_PASSWORD;
const SYNC_ID = process.env.ACTUAL_SYNC_ID;
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 * * * *';
const CRYPTO_ASSETS = process.env.CRYPTO_ASSETS || "";

async function run() {
    console.log('⏳ Starting Crypto Sync...');

    try {
        // 1. Parse Configuration
        const portfolio = parseConfig(CRYPTO_ASSETS);
        if (portfolio.length === 0) {
            console.error('❌ No assets configured. Check CRYPTO_ASSETS in your .env file.');
            return;
        }
        console.log(`📋 Configuration loaded: ${portfolio.length} assets to track.`);

        // 2. Setup Data Directory
        const dataDir = '/tmp/actual-data';
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // 3. Initialize Connection
        await api.init({
            dataDir: dataDir,
            serverURL: SERVER_URL,
            password: PASSWORD,
        });

        // 4. Download Budget
        await api.downloadBudget(SYNC_ID);

        // 5. Fetch all accounts from Actual
        const actualAccounts = await api.getAccounts();

        // 6. Match Configuration to Actual Accounts
        for (const item of portfolio) {
            const matchedAccount = actualAccounts.find(
                acct => acct.name === item.accountName && !acct.closed
            );

            if (matchedAccount) {
                await processAccount(matchedAccount, item);
            } else {
                console.warn(`⚠️ Could not find an open account named "${item.accountName}" in Actual Budget.`);
            }
        }

        console.log('✅ Sync Complete.');
    } catch (error) {
        console.error('❌ Error during sync:', error);
    } finally {
        await api.shutdown();
    }
}

// Helper to parse the env string "bitcoin:0.5:My Wallet; eth:2:Eth Wallet"
function parseConfig(configStr) {
    if (!configStr) return [];

    return configStr.split(';').map(entry => {
        const parts = entry.trim().split(':');
        if (parts.length !== 3) return null;

        return {
            id: parts[0].trim(), // CoinGecko ID
            qty: parseFloat(parts[1].trim()), // Quantity
            accountName: parts[2].trim() // Actual Budget Account Name
        };
    }).filter(item => item !== null && !isNaN(item.qty));
}

async function processAccount(account, config) {
    let price = 0;

    // Fetch Price
    try {
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${config.id}&vs_currencies=usd`);
        if (!response.data[config.id]) {
            console.error(`❌ CoinGecko error: Asset "${config.id}" not found.`);
            return;
        }
        price = response.data[config.id].usd;
    } catch (err) {
        console.error(`❌ API Error for ${config.id}: ${err.message}`);
        return;
    }

    // Calculate
    const targetValueUSD = price * config.qty;

    // Actual stores money as integers (cents), so $100.00 = 10000
    const currentBalanceInt = await api.getAccountBalance(account.id);
    const currentBalanceUSD = currentBalanceInt / 100;

    const diffUSD = targetValueUSD - currentBalanceUSD;

    // Update if difference is > $1.00
    if (Math.abs(diffUSD) > 1.00) {
        console.log(`🔄 Updating "${account.name}":`);
        console.log(`   Price: $${price} | Qty: ${config.qty}`);
        console.log(`   Balance: $${currentBalanceUSD.toFixed(2)} -> Target: $${targetValueUSD.toFixed(2)}`);
        console.log(`   Adjustment: ${diffUSD > 0 ? '+' : ''}$${diffUSD.toFixed(2)}`);

        // FIX: Use importTransactions instead of createTransaction
        // importTransactions expects an ARRAY of transactions
        await api.importTransactions(account.id, [{
            date: new Date().toISOString().split('T')[0],
            amount: Math.round(diffUSD * 100), // Convert back to cents
            payee_name: 'Market Adjustment',
            notes: `Asset: ${config.id} | Price: $${price} | Qty: ${config.qty}`,
            cleared: true
        }]);
    } else {
        console.log(`No update needed for "${account.name}" (Diff < $1)`);
    }
}

console.log(`🚀 Bot started. Schedule: ${CRON_SCHEDULE}`);
cron.schedule(CRON_SCHEDULE, run);

// Run immediately on startup
run();