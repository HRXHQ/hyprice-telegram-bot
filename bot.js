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

// Define default tokens with valid Hyperliquid addresses
const defaultTokens = {
  "HYPE": { 
    pairAddress: "0x13ba5fea7078ab3798fbce53b4d0721c1e497d9766114b944cb9b6e4d3b0e86d",
    lastPrice: null,
    lastChange: "" 
  },
  "HFUN": { 
    pairAddress: "0x929bdfee96b790d3ff9a6cb31e96147e9b9d6c48eefc1e2e0f14a7fd1a76f2d9",
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

// Generate the aggregated watchlist message and inline keyboard
function generateAggregatedMessage(chatId) {
  const chatData = trackedChats[chatId];
  let text = `<b>Hyprice Watchlist</b>\n`;
  text += `<i>Real-time Hyperliquid price tracking</i>\n\n`;
  
  for (const symbol in chatData.tokens) {
    const tokenData = chatData.tokens[symbol];
    const price = tokenData.lastPrice ? `$${parseFloat(tokenData.lastPrice).toFixed(4)}` : "N/A";
    text += `<b>$${symbol}</b>\n`;
    text += `📍 <code>${tokenData.pairAddress}</code>\n`;
    text += `💰 Price: ${price}\n`;
    text += `📊 24h Change: ${tokenData.lastChange || "N/A"}\n\n`;
  }
  
  const inlineKeyboard = Object.keys(chatData.tokens).map(symbol => [
    {
      text: `📈 $${symbol} Chart`,
      url: `https://dexscreener.com/hyperliquid/${chatData.tokens[symbol].pairAddress}`
    },
    {
      text: `❌ Remove`,
      callback_data: `remove_${symbol}`
    }
  ]);

  return { text, inlineKeyboard: { inline_keyboard: inlineKeyboard } };
}

// Update token data for all tokens in a chat
async function updateChatTokens(chatId) {
  const chatData = trackedChats[chatId];
  let updated = false;
  
  for (const symbol in chatData.tokens) {
    const tokenInfo = chatData.tokens[symbol];
    try {
      const data = await getTokenData(tokenInfo.pairAddress);
      if (data && data.priceUsd && data.priceChange) {
        // Clean and format price
        const cleanPrice = parseFloat(data.priceUsd.replace(/[^0-9.]/g, ''));
        tokenInfo.lastPrice = cleanPrice.toFixed(4);
        
        // Format price change
        const changeValue = parseFloat(data.priceChange.replace('%', ''));
        tokenInfo.lastChange = `${changeValue >= 0 ? '🟢 +' : '🔴 '}${Math.abs(changeValue).toFixed(2)}%`;
        
        updated = true;
        console.log(`Updated ${symbol}: $${tokenInfo.lastPrice} (${tokenInfo.lastChange})`);
      }
    } catch (error) {
      console.error(`Error updating ${symbol}:`, error.message);
    }
  }
  return updated;
}

// Send the aggregated watchlist message
async function sendWatchlist(chatId) {
  try {
    await updateChatTokens(chatId);
    const aggregated = generateAggregatedMessage(chatId);
    await bot.sendMessage(chatId, aggregated.text, {
      reply_markup: aggregated.inlineKeyboard,
      parse_mode: "HTML"
    });
  } catch (error) {
    console.error("Error sending watchlist:", error.message);
    bot.sendMessage(chatId, "❌ Error fetching latest prices. Please try again later.");
  }
}

// /start command handler
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!trackedChats[chatId]) {
    trackedChats[chatId] = { tokens: { ...defaultTokens } };
    savePersistentData();
  }
  const welcome = `<b>🚀 Welcome to Hyprice Tracker!</b>\n\n`
    + `I track token prices on Hyperliquid in real-time!\n\n`
    + `✅ <b>Default tokens added:</b>\n`
    + `- $HYPE\n`
    + `- $HFUN\n\n`
    + `Use /watchlist to view prices\n`
    + `Use /help for instructions`;
  bot.sendMessage(chatId, welcome, { parse_mode: "HTML" });
});

// /help command handler
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMsg = `<b>📖 Help Guide</b>\n\n`
    + `<b>Add Token:</b>\n<code>$SYMBOL: pair_address</code>\n\n`
    + `<b>Example:</b>\n<code>$HYPE: 0x13ba5f...0e86d</code>\n\n`
    + `<b>Commands:</b>\n`
    + `/start - Initialize bot\n`
    + `/watchlist - Show tracked tokens\n`
    + `/help - Show this message\n\n`
    + `🔍 Addresses must be valid 32-character Hyperliquid pool addresses`;
  bot.sendMessage(chatId, helpMsg, { parse_mode: "HTML" });
});

// Callback query handler
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  
  if (data.startsWith("remove_")) {
    const symbol = data.replace("remove_", "");
    if (trackedChats[chatId]?.tokens[symbol]) {
      delete trackedChats[chatId].tokens[symbol];
      savePersistentData();
      bot.answerCallbackQuery(callbackQuery.id, { text: `✅ Removed $${symbol}` });
      await sendWatchlist(chatId);
    }
  }
});

// Message handler for adding tokens
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (!msg.text) return;

  // Add token command
  if (msg.text.startsWith('$')) {
    const match = msg.text.match(/^\$(\w+):\s*(0x[a-fA-F0-9]{64})$/);
    if (match) {
      const [_, symbol, pairAddress] = match;
      trackedChats[chatId] = trackedChats[chatId] || { tokens: {} };
      trackedChats[chatId].tokens[symbol] = {
        pairAddress,
        lastPrice: null,
        lastChange: ""
      };
      savePersistentData();
      bot.sendMessage(chatId, `✅ Added $${symbol} to watchlist!`);
      await sendWatchlist(chatId);
    }
  }
});

console.log("Hyprice Tracker is running...");