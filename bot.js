// bot.js

// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// Define the persistent data file
const DATA_FILE = 'trackedChats.json';

// Retrieve the Telegram bot token from environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Error: TELEGRAM_BOT_TOKEN is not set.");
  process.exit(1);
}

// Create a new Telegram bot instance using polling
const bot = new TelegramBot(token, { polling: true });

// Global object for runtime data (includes persistent tokens plus runtime fields)
let trackedChats = {};

// Load persistent data (tokens only) from DATA_FILE if available
if (fs.existsSync(DATA_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    for (const chatId in data) {
      trackedChats[chatId] = {
        tokens: data[chatId],
        pinnedMessageId: null,
        intervalId: null
      };
    }
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

// Save persistent tokens (only the tokens field) to file
function savePersistentData() {
  let dataToSave = {};
  for (const chatId in trackedChats) {
    dataToSave[chatId] = trackedChats[chatId].tokens;
  }
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2));
    console.log("[DEBUG] Persistent data saved.");
  } catch (err) {
    console.error("Error saving persistent data:", err);
  }
}

// Debug logging function
function debugLog(...args) {
  console.log("[DEBUG]", ...args);
}

// Handle polling errors
bot.on("polling_error", (error) => {
  console.error("Polling error:", error);
  if (error && error.message && error.message.includes("409 Conflict")) {
    console.error("409 Conflict detected. Stopping polling.");
    bot.stopPolling();
  }
});

/**
 * Fetch token data by scraping the Dexscreener website.
 * Uses updated headers and selectors.
 * @param {string} pairAddress - The token (or pair) contract address.
 * @returns {Promise<object|null>} - Returns an object with { priceUsd, priceChange } or null on error.
 */
async function fetchTokenDataFromWebsite(pairAddress) {
  try {
    debugLog("Fetching webpage for", pairAddress);
    const url = `https://dexscreener.com/hyperliquid/${pairAddress}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    const html = response.data;
    const $ = cheerio.load(html);
    // UPDATED SELECTORS (adjust these as needed by inspecting the page)
    let price = $('span[data-testid="PairPrice"]').first().text().trim();
    if (!price) {
      // Fallback if not found
      price = $('span.price').first().text().trim();
    }
    let changeText = $('span[data-testid="PairPriceChange"]').first().text().trim();
    if (!changeText) {
      changeText = $('span.change').first().text().trim();
    }
    debugLog("Scraped price:", price, "Change:", changeText);
    return {
      priceUsd: price,
      priceChange: changeText
    };
  } catch (error) {
    console.error("Error fetching token data from website:", error.toString());
    return null;
  }
}

/**
 * Generate an aggregated watchlist message and inline keyboard.
 * Uses HTML formatting.
 * @param {string} chatId - The chat identifier.
 * @returns {object} - { text: string, inlineKeyboard: object }
 */
function generateAggregatedMessage(chatId) {
  const chatData = trackedChats[chatId];
  let text = `<b>Hyprice Watchlist</b>\n`;
  text += `<i>The ultimate bot for Hyperliquid price tracking and personalized token watchlists.</i>\n\n`;
  text += `<b>Tracked Tokens:</b>\n\n`;
  let inlineKeyboard = [];
  for (const tokenSymbol in chatData.tokens) {
    const tokenData = chatData.tokens[tokenSymbol];
    text += `<b>$${tokenSymbol}</b>: <code>${tokenData.pairAddress}</code>\n`;
    text += `Price: <b>$${tokenData.lastPrice || "N/A"}</b>`;
    if (tokenData.lastChange && tokenData.lastChange !== "") {
      text += ` (${tokenData.lastChange})`;
    }
    text += `\n\n`;
    inlineKeyboard.push([
      {
        text: `📈 View $${tokenSymbol}`,
        url: `https://dexscreener.com/hyperliquid/${tokenData.pairAddress}`
      },
      {
        text: `❌ Remove`,
        callback_data: `remove_${tokenSymbol}`
      }
    ]);
  }
  return { text, inlineKeyboard: { inline_keyboard: inlineKeyboard } };
}

/**
 * Update token prices for all tracked tokens in a chat.
 * @param {string} chatId - The chat identifier.
 */
async function updateChatTokens(chatId) {
  const chatData = trackedChats[chatId];
  let updated = false;
  for (const tokenSymbol in chatData.tokens) {
    const tokenInfo = chatData.tokens[tokenSymbol];
    const data = await fetchTokenDataFromWebsite(tokenInfo.pairAddress);
    if (data) {
      const newPrice = data.priceUsd || "N/A";
      // Process the 24h change value (strip any '%' sign and convert to number)
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
      debugLog(`Updated ${tokenSymbol}: Price = $${newPrice}, Change = ${changeIndicator}`);
    } else {
      debugLog(`No updated data for token ${tokenSymbol}`);
    }
  }
  if (updated && chatData.pinnedMessageId) {
    const aggregated = generateAggregatedMessage(chatId);
    try {
      await bot.editMessageText(aggregated.text, {
        chat_id: chatId,
        message_id: chatData.pinnedMessageId,
        reply_markup: aggregated.inlineKeyboard,
        parse_mode: "HTML"
      });
      debugLog(`Updated aggregated message for chat ${chatId}`);
    } catch (err) {
      console.error("Error updating aggregated message:", err.toString());
    }
  }
}

/**
 * Start the periodic update loop for a chat.
 * @param {string} chatId - The chat identifier.
 */
function startUpdateLoop(chatId) {
  const chatData = trackedChats[chatId];
  if (!chatData.intervalId) {
    chatData.intervalId = setInterval(() => {
      updateChatTokens(chatId);
    }, 15000); // update every 15 seconds
    debugLog(`Started update loop for chat ${chatId}`);
  }
}

// Command: /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!trackedChats[chatId]) {
    trackedChats[chatId] = {
      tokens: { ...defaultTokens },
      pinnedMessageId: null,
      intervalId: null
    };
    savePersistentData();
  }
  const welcomeMessage =
    `<b>Welcome to the Hyprice Telegram Bot!</b>\n\n` +
    `To track a token, send a message in the following format:\n` +
    `<code>$SYMBOL: pair_address</code>\n\n` +
    `Example:\n` +
    `<code>$HYPE: 0x13ba5fea7078ab3798fbce53b4d0721c</code>\n\n` +
    `Use <b>/help</b> to see what I can do.`;
  bot.sendMessage(chatId, welcomeMessage, { parse_mode: "HTML" })
    .then(() => debugLog("Sent welcome message"))
    .catch(err => console.error("Error sending /start message:", err.toString()));
});

// Command: /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
<b>Hyprice Bot - What I Can Do:</b>

• <b>Track Tokens:</b> Send a message in the format <code>$SYMBOL: pair_address</code> to track a token's price on the Hyperliquid chain.

• <b>Aggregated Updates:</b> All tokens you track in a chat are combined into one pinned message that updates every 15 seconds with the latest prices and 24h changes.

• <b>View Details:</b> Each token in the pinned message has a "View" button to see more details on Dexscreener.

• <b>Remove Tokens:</b> Use the "Remove" button next to a token to delete it from your watchlist.

Simply add your tokens and use /help anytime to see this message again.
  `;
  bot.sendMessage(chatId, helpMessage, { parse_mode: "HTML" })
    .then(() => debugLog("Sent help message"))
    .catch(err => console.error("Error sending /help message:", err.toString()));
});

// Command: /watchlist
bot.onText(/\/watchlist/, (msg) => {
  const chatId = msg.chat.id;
  if (!trackedChats[chatId]) {
    trackedChats[chatId] = {
      tokens: { ...defaultTokens },
      pinnedMessageId: null,
      intervalId: null
    };
    savePersistentData();
  }
  const aggregated = generateAggregatedMessage(chatId);
  bot.sendMessage(chatId, aggregated.text, {
    reply_markup: aggregated.inlineKeyboard,
    parse_mode: "HTML"
  })
    .then(() => debugLog("Sent watchlist message for /watchlist command"))
    .catch(err => console.error("Error sending watchlist message:", err.toString()));
});

// Callback query handler for removing tokens
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const data = callbackQuery.data;
  if (data.startsWith("remove_")) {
    const tokenSymbol = data.replace("remove_", "");
    if (trackedChats[chatId] && trackedChats[chatId].tokens[tokenSymbol]) {
      delete trackedChats[chatId].tokens[tokenSymbol];
      savePersistentData();
      const aggregated = generateAggregatedMessage(chatId);
      try {
        await bot.editMessageText(aggregated.text, {
          chat_id: chatId,
          message_id: trackedChats[chatId].pinnedMessageId,
          reply_markup: aggregated.inlineKeyboard,
          parse_mode: "HTML"
        });
        bot.answerCallbackQuery(callbackQuery.id, { text: `Removed $${tokenSymbol} from watchlist.` });
      } catch (err) {
        console.error("Error updating message after removal:", err.toString());
        bot.answerCallbackQuery(callbackQuery.id, { text: "Error removing token." });
      }
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
  if (!msg.text) {
    debugLog("No text in message, skipping.");
    return;
  }
  const text = msg.text.trim();
  debugLog("Received message:", text);
  const pattern = /^\$(\w+):\s*(0x[a-fA-F0-9]{32,40})$/i;
  const match = text.match(pattern);
  if (match) {
    const tokenSymbol = match[1];
    const pairAddress = match[2];
    debugLog(`Tracking request for ${tokenSymbol} with pair address: ${pairAddress}`);
    if (!trackedChats[chatId]) {
      trackedChats[chatId] = {
        tokens: { ...defaultTokens },
        pinnedMessageId: null,
        intervalId: null
      };
    }
    trackedChats[chatId].tokens[tokenSymbol] = { pairAddress, lastPrice: null, lastChange: "" };
    savePersistentData();
    if (!trackedChats[chatId].pinnedMessageId) {
      const aggregated = generateAggregatedMessage(chatId);
      try {
        const sentMsg = await bot.sendMessage(chatId, aggregated.text, {
          reply_markup: aggregated.inlineKeyboard,
          parse_mode: "HTML"
        });
        trackedChats[chatId].pinnedMessageId = sentMsg.message_id;
        await bot.pinChatMessage(chatId, sentMsg.message_id);
        debugLog("Pinned aggregated tracking message for chat", chatId);
      } catch (err) {
        console.error("Error sending or pinning aggregated message:", err.toString());
        bot.sendMessage(chatId, "Error sending or pinning tracking message. Ensure the bot has permission to pin messages.");
        return;
      }
    } else {
      const aggregated = generateAggregatedMessage(chatId);
      try {
        await bot.editMessageText(aggregated.text, {
          chat_id: chatId,
          message_id: trackedChats[chatId].pinnedMessageId,
          reply_markup: aggregated.inlineKeyboard,
          parse_mode: "HTML"
        });
        debugLog("Updated aggregated tracking message for chat", chatId);
      } catch (err) {
        console.error("Error updating aggregated message:", err.toString());
      }
    }
    startUpdateLoop(chatId);
  } else {
    debugLog("Message did not match tracking pattern");
  }
});

debugLog("Hyprice Telegram Bot is running...");
