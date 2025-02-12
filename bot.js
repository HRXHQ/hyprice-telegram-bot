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
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    trackedChats = data;
    console.log("[DEBUG] Persistent data loaded.");
  } catch (err) {
    console.error("Error reading persistent data:", err);
  }
}

// Define default tokens
const defaultTokens = {
  "HYPE": { pairAddress: "0x13ba5fea7078ab3798fbce53b4d0721c", lastPrice: null, lastChange: "" },
  "HFUN": { pairAddress: "0x929bdfee96b790d3ff9a6cb31e96147e", lastPrice: null, lastChange: "" }
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
  text += `<i>The ultimate bot for Hyperliquid price tracking and personalized token watchlists.</i>\n\n`;
  text += `<b>Tracked Tokens:</b>\n\n`;
  let inlineKeyboard = [];
  for (const symbol in chatData.tokens) {
    const tokenData = chatData.tokens[symbol];
    text += `<b>$${symbol}</b>: <code>${tokenData.pairAddress}</code>\n`;
    text += `Price: <b>$${tokenData.lastPrice || "N/A"}</b>`;
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

// Update token data for all tokens in a chat (by scraping the website)
async function updateChatTokens(chatId) {
  const chatData = trackedChats[chatId];
  let updated = false;
  for (const symbol in chatData.tokens) {
    const tokenInfo = chatData.tokens[symbol];
    const data = await getTokenData(tokenInfo.pairAddress);
    if (data) {
      const newPrice = data.priceUsd || "N/A";
      const changeStr = data.priceChange;
      let changeIndicator = "";
      if (changeStr) {
        const cleanStr = changeStr.replace("%", "").trim();
        const num = parseFloat(cleanStr);
        if (!isNaN(num)) {
          changeIndicator = (num >= 0 ? "🟢 +" : "🔴 ") + num.toFixed(2) + "%";
        }
      }
      tokenInfo.lastPrice = newPrice;
      tokenInfo.lastChange = changeIndicator;
      updated = true;
      debugLog(`Updated ${symbol}: Price = $${newPrice}, Change = ${changeIndicator}`);
    } else {
      debugLog(`No updated data for ${symbol}`);
    }
  }
  return updated;
}

// Send the aggregated watchlist message (updates on demand, not pinned)
async function sendWatchlist(chatId) {
  await updateChatTokens(chatId);
  const aggregated = generateAggregatedMessage(chatId);
  bot.sendMessage(chatId, aggregated.text, {
    reply_markup: aggregated.inlineKeyboard,
    parse_mode: "HTML"
  });
}

// /start command: Initialize the chat and send a welcome message.
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!trackedChats[chatId]) {
    trackedChats[chatId] = { tokens: { ...defaultTokens } };
    savePersistentData();
  }
  const welcome = `<b>Welcome to the Hyprice Telegram Bot!</b>\n\n` +
                  `To track a token, send a message in the format:\n` +
                  `<code>$SYMBOL: pair_address</code>\n\n` +
                  `Example:\n` +
                  `<code>$HYPE: 0x13ba5fea7078ab3798fbce53b4d0721c</code>\n\n` +
                  `Use /help to see what I can do.`;
  bot.sendMessage(chatId, welcome, { parse_mode: "HTML" });
});

// /help command: Display instructions.
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMsg = `<b>Hyprice Bot - What I Can Do:</b>\n\n` +
                  `• <b>Track Tokens:</b> Send <code>$SYMBOL: pair_address</code> to add a token to your watchlist.\n` +
                  `• <b>View Watchlist:</b> Use /watchlist to see the latest prices and 24h changes.\n` +
                  `• <b>Remove Tokens:</b> Press the "❌ Remove" button to delete a token from your watchlist.\n\n` +
                  `Default tokens are loaded automatically on /start.`;
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
      bot.answerCallbackQuery(callbackQuery.id, { text: `Removed $${symbol} from watchlist.` });
      await sendWatchlist(chatId);
    } else {
      bot.answerCallbackQuery(callbackQuery.id, { text: "Token not found." });
    }
  } else {
    bot.answerCallbackQuery(callbackQuery.id);
  }
});

// Listen for messages matching the token tracking pattern.
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (!msg.text) return;
  const text = msg.text.trim();
  const pattern = /^\$(\w+):\s*(0x[a-fA-F0-9]{32,40})$/;
  const match = text.match(pattern);
  if (match) {
    const symbol = match[1];
    const pairAddress = match[2];
    trackedChats[chatId] = trackedChats[chatId] || { tokens: {} };
    trackedChats[chatId].tokens[symbol] = { pairAddress, lastPrice: null, lastChange: "" };
    savePersistentData();
    await sendWatchlist(chatId);
  }
});

console.log("Hyprice Telegram Bot is running...");
