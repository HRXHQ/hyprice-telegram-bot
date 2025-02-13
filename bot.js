// bot.js

// Debug logging helper
// Load environment variables from .env file
require('dotenv').config();
require("dotenv").config();
//we are going to pool the cache every 1 minute to free the memory
const cacheHandler = require("./cache-handler");
const { debugLog } = require("./helper");
cacheHandler.poolCache();

// Import required modules
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const { getTokenData } = require('./hyprice');
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const { getTokenData } = require("./hyprice");

// Retrieve the Telegram bot token from environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Error: TELEGRAM_BOT_TOKEN is not set.");
  process.exit(1);
    console.error("Error: TELEGRAM_BOT_TOKEN is not set.");
    process.exit(1);
}

// Create a new Telegram bot instance using polling
const bot = new TelegramBot(token, { polling: true });

// Define the persistent data file
const DATA_FILE = 'trackedChats.json';
const DATA_FILE = "trackedChats.json";

// Global object for storing watchlists by chat ID
// Structure: { [chatId]: { tokens: { SYMBOL: { pairAddress, lastPrice, lastChange } } } }
let trackedChats = {};

// Load persistent data if available
if (fs.existsSync(DATA_FILE)) {
  try {
    trackedChats = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    console.log("[DEBUG] Persistent data loaded.");
  } catch (err) {
    console.error("Error reading persistent data:", err);
  }
    try {
        trackedChats = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
        console.log("[DEBUG] Persistent data loaded.");
    } catch (err) {
        console.error("Error reading persistent data:", err);
    }
}

// Define default tokens (using the correct token address format)
const defaultTokens = {
  "HYPE": { 
    pairAddress: "0x13ba5fea7078ab3798fbce53b4d0721c", 
    lastPrice: null, 
    lastChange: "" 
  },
  "HFUN": { 
    pairAddress: "0x929bdfee96b790d3ff9a6cb31e96147e", 
    lastPrice: null, 
    lastChange: "" 
  }
    HYPE: {
        pairAddress: "0x13ba5fea7078ab3798fbce53b4d0721c",
        lastPrice: null,
        lastChange: "",
    },
    HFUN: {
        pairAddress: "0x929bdfee96b790d3ff9a6cb31e96147e",
        lastPrice: null,
        lastChange: "",
    },
};

// Save persistent data to the JSON file
function savePersistentData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(trackedChats, null, 2));
    console.log("[DEBUG] Persistent data saved.");
  } catch (err) {
    console.error("Error saving persistent data:", err);
  }
}
// Debug logging helper
function debugLog(...args) {
  console.log("[DEBUG]", ...args);
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(trackedChats, null, 2));
        console.log("[DEBUG] Persistent data saved.");
    } catch (err) {
        console.error("Error saving persistent data:", err);
    }
}

// Generate the aggregated watchlist message and inline keyboard
function generateAggregatedMessage(chatId) {
  const chatData = trackedChats[chatId];
  let text = `<b>Hyprice Watchlist</b>\n`;
  text += `<i>Real-time Hyperliquid token price tracking</i>\n\n`;
  text += `<b>Tracked Tokens:</b>\n\n`;
  let inlineKeyboard = [];
  for (const symbol in chatData.tokens) {
    const tokenData = chatData.tokens[symbol];
    text += `<b>$${symbol}</b>: <code>${tokenData.pairAddress}</code>\n`;
    const priceDisplay = tokenData.lastPrice ? `$${parseFloat(tokenData.lastPrice).toFixed(4)}` : "N/A";
    text += `💰 Price: <b>${priceDisplay}</b>`;
    if (tokenData.lastChange && tokenData.lastChange !== "") {
      text += ` (${tokenData.lastChange})`;
    const chatData = trackedChats[chatId];
    let text = `<b>Hyprice Watchlist</b>\n`;
    text += `<i>Real-time Hyperliquid token price tracking</i>\n\n`;
    text += `<b>Tracked Tokens:</b>\n\n`;
    let inlineKeyboard = [];
    for (const symbol in chatData.tokens) {
        const tokenData = chatData.tokens[symbol];
        text += `<b>$${symbol}</b>: <code>${tokenData.pairAddress}</code>\n`;
        const priceDisplay = tokenData.lastPrice ?
            `$${parseFloat(tokenData.lastPrice).toFixed(4)}` :
            "N/A";
        text += `💰 Price: <b>${priceDisplay}</b>`;
        if (tokenData.lastChange && tokenData.lastChange !== "") {
            text += ` (${tokenData.lastChange})`;
        }
        text += `\n\n`;
        inlineKeyboard.push([{
                text: `📈 View $${symbol}`,
                url: `https://dexscreener.com/hyperliquid/${tokenData.pairAddress}`,
            },
            {
                text: `❌ Remove`,
                callback_data: `remove_${symbol}`,
            },
        ]);
    }
    text += `\n\n`;
    inlineKeyboard.push([
      {
        text: `📈 View $${symbol}`,
        url: `https://dexscreener.com/hyperliquid/${tokenData.pairAddress}`
      },
      {
        text: `❌ Remove`,
        callback_data: `remove_${symbol}`
      }
    ]);
  }
  return { text, inlineKeyboard: { inline_keyboard: inlineKeyboard } };
    return { text, inlineKeyboard: { inline_keyboard: inlineKeyboard } };
}

// Update token data for all tokens in a chat by scraping the token page
async function updateChatTokens(chatId) {
  const chatData = trackedChats[chatId];
  let updated = false;
  for (const symbol in chatData.tokens) {
    const tokenInfo = chatData.tokens[symbol];
    try {
      const data = await getTokenData(tokenInfo.pairAddress);
      if (data && data.priceUsd && data.priceChange) {
        // Clean and format the price
        const cleanPrice = parseFloat(data.priceUsd.replace(/[^0-9.]/g, ''));
        tokenInfo.lastPrice = isNaN(cleanPrice) ? "N/A" : cleanPrice.toFixed(4);
        // Process the 24h change
        const changeStr = data.priceChange;
        let changeIndicator = "";
        if (changeStr) {
          const cleanChange = changeStr.replace("%", "").trim();
          const num = parseFloat(cleanChange);
          if (!isNaN(num)) {
            changeIndicator = (num >= 0 ? "🟢 +" : "🔴 ") + Math.abs(num).toFixed(2) + "%";
          }
    const chatData = trackedChats[chatId];
    let updated = false;
    for (const symbol in chatData.tokens) {
        const tokenInfo = chatData.tokens[symbol];
        try {
            const data = await getTokenData(tokenInfo.pairAddress);
            if (data && data.priceUsd && data.priceChange) {
                // Clean and format the price
                const cleanPrice = parseFloat(data.priceUsd.replace(/[^0-9.]/g, ""));
                tokenInfo.lastPrice = isNaN(cleanPrice) ? "N/A" : cleanPrice.toFixed(4);
                // Process the 24h change
                const changeStr = data.priceChange;
                let changeIndicator = "";
                if (changeStr) {
                    const cleanChange = changeStr;
                    const num = parseFloat(cleanChange);
                    if (!isNaN(num)) {
                        changeIndicator =
                            (num >= 0 ? "🟢 +" : "🔴 ") + Math.abs(num).toFixed(2) + "%";
                    }
                }
                tokenInfo.lastChange = changeIndicator;
                updated = true;
                debugLog(
                    `Updated ${symbol}: Price = $${tokenInfo.lastPrice}, Change = ${tokenInfo.lastChange}`
                );
            } else {
                debugLog(`No valid data for ${symbol}`);
            }
        } catch (error) {
            console.error(`Error updating ${symbol}:`, error.message);
        }
        tokenInfo.lastChange = changeIndicator;
        updated = true;
        debugLog(`Updated ${symbol}: Price = $${tokenInfo.lastPrice}, Change = ${tokenInfo.lastChange}`);
      } else {
        debugLog(`No valid data for ${symbol}`);
      }
    } catch (error) {
      console.error(`Error updating ${symbol}:`, error.message);
    }
  }
  return updated;
    return updated;
}

// Send the aggregated watchlist message (without pinning)
async function sendWatchlist(chatId) {
  await updateChatTokens(chatId);
  const aggregated = generateAggregatedMessage(chatId);
  await bot.sendMessage(chatId, aggregated.text, {
    reply_markup: aggregated.inlineKeyboard,
    parse_mode: "HTML"
  });
    await updateChatTokens(chatId);
    const aggregated = generateAggregatedMessage(chatId);
    await bot.sendMessage(chatId, aggregated.text, {
        reply_markup: aggregated.inlineKeyboard,
        parse_mode: "HTML",
    });
}

// /start command: Initialize the chat and load default tokens if needed.
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!trackedChats[chatId]) {
    trackedChats[chatId] = { tokens: { ...defaultTokens } };
    savePersistentData();
  }
  const welcome = `<b>🚀 Welcome to Hyprice Tracker!</b>\n\n`
    + `I track token prices on Hyperliquid in real-time!\n\n`
    + `✅ Default tokens added:\n`
    + `- $HYPE\n`
    + `- $HFUN\n\n`
    + `Use /watchlist to view your watchlist.\n`
    + `Use /help for instructions.`;
  bot.sendMessage(chatId, welcome, { parse_mode: "HTML" });
    const chatId = msg.chat.id;
    if (!trackedChats[chatId]) {
        trackedChats[chatId] = { tokens: {...defaultTokens } };
        savePersistentData();
    }
    const welcome =
        `<b>🚀 Welcome to Hyprice Tracker!</b>\n\n` +
        `I track token prices on Hyperliquid in real-time!\n\n` +
        `✅ Default tokens added:\n` +
        `- $HYPE\n` +
        `- $HFUN\n\n` +
        `Use /watchlist to view your watchlist.\n` +
        `Use /help for instructions.`;
    bot.sendMessage(chatId, welcome, { parse_mode: "HTML" });
});

// /help command: Display instructions.
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMsg = `<b>📖 Hyprice Tracker - Help</b>\n\n`
    + `<b>Add Token:</b>\nSend a message in the format: <code>$SYMBOL: token_address</code>\n\n`
    + `<b>View Watchlist:</b>\nUse /watchlist to see the latest prices and 24h changes.\n\n`
    + `<b>Remove Token:</b>\nPress the "❌ Remove" button to remove a token.\n\n`
    + `Addresses must be valid Hyperliquid token addresses (starting with 0x).`;
  bot.sendMessage(chatId, helpMsg, { parse_mode: "HTML" });
    const chatId = msg.chat.id;
    const helpMsg =
        `<b>📖 Hyprice Tracker - Help</b>\n\n` +
        `<b>Add Token:</b>\nSend a message in the format: <code>$SYMBOL: token_address</code>\n\n` +
        `<b>View Watchlist:</b>\nUse /watchlist to see the latest prices and 24h changes.\n\n` +
        `<b>Remove Token:</b>\nPress the "❌ Remove" button to remove a token.\n\n` +
        `Addresses must be valid Hyperliquid token addresses (starting with 0x).`;
    bot.sendMessage(chatId, helpMsg, { parse_mode: "HTML" });
});

// /watchlist command: Resend the aggregated watchlist message.
bot.onText(/\/watchlist/, async (msg) => {
  const chatId = msg.chat.id;
  if (!trackedChats[chatId]) {
    trackedChats[chatId] = { tokens: { ...defaultTokens } };
    savePersistentData();
  }
  await sendWatchlist(chatId);
bot.onText(/\/watchlist/, async(msg) => {
    const chatId = msg.chat.id;
    if (!trackedChats[chatId]) {
        trackedChats[chatId] = { tokens: {...defaultTokens } };
        savePersistentData();
    }
    await sendWatchlist(chatId);
});

// Callback query handler for removing tokens.
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  if (data.startsWith("remove_")) {
    const symbol = data.replace("remove_", "");
    if (trackedChats[chatId] && trackedChats[chatId].tokens[symbol]) {
      delete trackedChats[chatId].tokens[symbol];
      savePersistentData();
      bot.answerCallbackQuery(callbackQuery.id, { text: `✅ Removed $${symbol} from watchlist.` });
      await sendWatchlist(chatId);
bot.on("callback_query", async(callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    if (data.startsWith("remove_")) {
        const symbol = data.replace("remove_", "");
        if (trackedChats[chatId] && trackedChats[chatId].tokens[symbol]) {
            delete trackedChats[chatId].tokens[symbol];
            savePersistentData();
            bot.answerCallbackQuery(callbackQuery.id, {
                text: `✅ Removed $${symbol} from watchlist.`,
            });
            await sendWatchlist(chatId);
        } else {
            bot.answerCallbackQuery(callbackQuery.id, { text: "Token not found." });
        }
    } else {
      bot.answerCallbackQuery(callbackQuery.id, { text: "Token not found." });
        bot.answerCallbackQuery(callbackQuery.id);
    }
  } else {
    bot.answerCallbackQuery(callbackQuery.id);
  }
});

// Message handler for adding tokens via messages.
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (!msg.text) return;
  const text = msg.text.trim();
  // Expect messages in the format: $SYMBOL: token_address
  // Accept token addresses with length between 36 and 42 characters.
  const pattern = /^\$(\w+):\s*(0x[a-fA-F0-9]{36,42})$/;
  const match = text.match(pattern);
  if (match) {
    const symbol = match[1];
    const tokenAddress = match[2];
    trackedChats[chatId] = trackedChats[chatId] || { tokens: {} };
    trackedChats[chatId].tokens[symbol] = { pairAddress: tokenAddress, lastPrice: null, lastChange: "" };
    savePersistentData();
    bot.sendMessage(chatId, `✅ Added $${symbol} to watchlist!`);
    await sendWatchlist(chatId);
  }
bot.on("message", async(msg) => {
    const chatId = msg.chat.id;
    if (!msg.text) return;
    const text = msg.text.trim();
    // Expect messages in the format: $SYMBOL: token_address
    // Accept token addresses with length between 36 and 42 characters.
    const pattern = /^\$(\w+):\s*(0x[a-fA-F0-9]{36,42})$/;
    const match = text.match(pattern);
    if (match) {
        const symbol = match[1];
        const tokenAddress = match[2];
        trackedChats[chatId] = trackedChats[chatId] || { tokens: {} };
        trackedChats[chatId].tokens[symbol] = {
            pairAddress: tokenAddress,
            lastPrice: null,
            lastChange: "",
        };
        savePersistentData();
        bot.sendMessage(chatId, `✅ Added $${symbol} to watchlist!`);
        await sendWatchlist(chatId);
    }
});

console.log("Hyprice Tracker is running...");
console.log("Hyprice Tracker is running...");
‎cache-handler.js
+36
Original file line number Diff line number  Diff line change
@@ -0,0 +1,36 @@
const { debugLog } = require("./helper");
class CacheHandler {
    cache = {};
    constructor() {
        this.cache = {};
    }
    getCache(key) {
        return this.cache[key];
    }
    setCache(key, value) {
        const timenow = new Date().getTime();
        this.cache[key] = {...value, timestamp: timenow, ttl: 1000 * 60 * 1 };
    }
    poolCache() {
        const timenow = new Date().getTime();
        for (const key in this.cache) {
            if (this.cache[key].timestamp + this.cache[key].ttl < timenow) {
                debugLog(`Cache key ${key} expired`);
                delete this.cache[key];
            }
        }
        debugLog(`Pooling cache.....`);
        //run every 1 minutes
        setTimeout(() => {
            this.poolCache();
        }, 1000 * 60 * 1);
    }
}
module.exports = new CacheHandler();
‎helper.js
+7
Original file line number Diff line number  Diff line change
@@ -0,0 +1,7 @@
function debugLog(...args) {
    console.log("[DEBUG]", ...args);
}
module.exports = {
    debugLog,
};
‎hyprice.js
+39
-41
Original file line number Diff line number  Diff line change
@@ -1,48 +1,46 @@
// hyprice.js
const cheerio = require('cheerio');
const cacheHandler = require("./cache-handler");
const { debugLog } = require("./helper");
/**
 *
 * @param {*} tokenAddress
 * @returns {priceUsd: string, priceChange: string}
 */

async function getTokenData(tokenAddress) {
  // Use the token page URL (not a pair page)
  const url = `https://dexscreener.com/hyperliquid/${tokenAddress}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://dexscreener.com/',
        'Origin': 'https://dexscreener.com',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Dest': 'document'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    //see if the data is in the cache
    const cacheKey = `tokenData_${tokenAddress}`;
    const cachedData = cacheHandler.getCache(cacheKey);

    // IMPORTANT: Inspect the Dexscreener token page (e.g., 
    // https://dexscreener.com/hyperliquid/0x13ba5fea7078ab3798fbce53b4d0721c)
    // and adjust the selectors below.
    // In this example, we assume:
    // - The USD price is in a <span> with data-testid="TokenPrice"
    // - The 24h change is in a <span> with data-testid="TokenPriceChange"
    let price = $('span[data-testid="TokenPrice"]').first().text().trim();
    if (!price) {
      price = $('span.price').first().text().trim();
    if (cachedData) {
        debugLog(`Token data found in cache for ${tokenAddress}`);
        return cachedData;
    }
    let priceChange = $('span[data-testid="TokenPriceChange"]').first().text().trim();
    if (!priceChange) {
      priceChange = $('span.change').first().text().trim();
    // Use the token page URL (not a pair page)
    const url = `https://api.dexscreener.com/latest/dex/pairs/hyperliquid/${tokenAddress}`;
    try {
        const response = await fetch(url, { headers: {} });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const json = await response.json();
        const price = json.pairs[0].priceUsd;
        const priceChange = json.pairs[0].priceChange;
        //save the data to the cache
        cacheHandler.setCache(cacheKey, {
            priceUsd: price,
            priceChange: priceChange["h24"],
        });
        debugLog(`Token data saved to cache for ${tokenAddress}`);
        return { priceUsd: price, priceChange: priceChange["h24"] };
    } catch (err) {
        console.error("Error in getTokenData:", err);
        //sleep  5sec and try try again
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return getTokenData(tokenAddress);
    }
    return { priceUsd: price, priceChange: priceChange };
  } catch (err) {
    console.error("Error in getTokenData:", err);
    return null;
  }
}

module.exports = { getTokenData };
module.exports = { getTokenData };
‎package.json
+18
-18


Original file line number Diff line number  Diff line change
@@ -1,19 +1,19 @@
{
  "name": "hyprice-bot",
  "version": "1.0.0",
  "description": "A Telegram bot for tracking token prices on Hyperliquid",
  "main": "bot.js",
  "scripts": {
    "start": "node bot.js"
  },
  "dependencies": {
    "cheerio": "^1.0.0-rc.12",
    "dotenv": "^16.0.3",
    "node-telegram-bot-api": "^0.61.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "author": "",
  "license": "MIT"
}
    "name": "hyprice-bot",
    "version": "1.0.0",
    "description": "A Telegram bot for tracking token prices on Hyperliquid",
    "main": "bot.js",
    "scripts": {
        "start": "node bot.js"
    },
    "dependencies": {
        "cheerio": "^1.0.0-rc.12",
        "dotenv": "^16.0.3",
        "node-telegram-bot-api": "^0.61.0"
    },
    "engines": {
        "node": ">=18.0.0"
    },
    "author": "",
    "license": "MIT"
}