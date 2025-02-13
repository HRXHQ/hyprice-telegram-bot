// bot.js

// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const { getTokenData } = require('./hyprice');

// Retrieve the Telegram bot token from environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Error: TELEGRAM_BOT_TOKEN is not set.");
  process.exit(1);
}

// Create a new Telegram bot instance using polling
const bot = new TelegramBot(token, { polling: true });

// Define the persistent data file
const DATA_FILE = 'trackedChats.json';

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
}

// Define default tokens (using valid Hyperliquid token addresses)
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
        const cleanPrice = parseFloat(data.priceUsd.replace(/[^0-9.]/g, ""));
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
        } else {
          changeIndicator = "N/A";
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
}

// Send the aggregated watchlist message (without pinning)
async function sendWatchlist(chatId) {
  await updateChatTokens(chatId);
  const aggregated = generateAggregatedMessage(chatId);
  await bot.sendMessage(chatId, aggregated.text, {
    reply_markup: aggregated.inlineKeyboard,
    parse_mode: "HTML"
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
});

// /watchlist command: Resend the aggregated watchlist message.
bot.onText(/\/watchlist/, async (msg) => {
  const chatId = msg.chat.id;
  if (!trackedChats[chatId]) {
    trackedChats[chatId] = { tokens: { ...defaultTokens } };
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
    } else {
      bot.answerCallbackQuery(callbackQuery.id, { text: "Token not found." });
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
});

console.log("Hyprice Tracker is running...");

// Minimal HTTP server to keep Railway alive
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hyprice Tracker is running!\n');
}).listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
});
