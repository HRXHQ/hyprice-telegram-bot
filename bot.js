// bot.js

// Load environment variables from .env file
require('dotenv').config();

// Import necessary modules
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Retrieve the Telegram bot token from environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Error: TELEGRAM_BOT_TOKEN is not set.");
  process.exit(1);
}

// Create a new Telegram bot instance using polling
const bot = new TelegramBot(token, { polling: true });

// Global object to store tracked tokens per chat.
const trackedChats = {};

// Debug logging function
function debugLog(...args) {
  console.log("[DEBUG]", ...args);
}

// Handle polling errors (e.g., 409 Conflict when another instance is running)
bot.on("polling_error", (error) => {
  console.error("Polling error:", error);
  if (error && error.message && error.message.includes("409 Conflict")) {
    console.error("409 Conflict detected. This instance will stop polling to avoid duplicate instances.");
    bot.stopPolling();
  }
});

/**
 * Fetch pair data from DexScreener API (Hyperliquid endpoint).
 * @param {string} pairAddress - The token pair contract address.
 * @returns {Promise<object|null>} - Returns the API response object (expected to contain a "pair" field) or null.
 */
async function fetchTokenData(pairAddress) {
  try {
    debugLog("Fetching pair data for", pairAddress);
    const response = await axios.get(`https://api.dexscreener.com/latest/dex/pairs/hyperliquid/${pairAddress}`);
    debugLog("Received pair data:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching pair data:", error.toString());
    return null;
  }
}

/**
 * Generate an aggregated message and inline keyboard for a chat based on its tracked tokens.
 * This message is formatted in HTML.
 * @param {string} chatId - The chat identifier.
 * @returns {object} - { text: string, inlineKeyboard: object }
 */
function generateAggregatedMessage(chatId) {
  const chatData = trackedChats[chatId];
  // Header with the new title and description.
  let text = `<b>Hyprice Watchlist</b>\n`;
  text += `<i>The ultimate bot for Hyperliquid price tracking and personalized token watchlists.</i>\n\n`;
  text += `<b>Tracked Tokens:</b>\n\n`;

  let inlineKeyboard = [];
  for (const tokenSymbol in chatData.tokens) {
    const tokenData = chatData.tokens[tokenSymbol];
    text += `<b>$${tokenSymbol}</b>: <code>${tokenData.pairAddress}</code>\n`;
    text += `Price: <b>$${tokenData.lastPrice || "N/A"}</b> &mdash; Last updated: <i>${tokenData.lastUpdated || "-"}</i>\n\n`;
    inlineKeyboard.push([
      {
        text: `🔷 View $${tokenSymbol}`,
        url: `https://dexscreener.com/hyperliquid/${tokenData.pairAddress}`
      }
    ]);
  }
  return { text, inlineKeyboard: { inline_keyboard: inlineKeyboard } };
}

/**
 * Update all tracked tokens for a given chat by fetching their latest prices
 * and editing the pinned aggregated message.
 * @param {string} chatId - The chat identifier.
 */
async function updateChatTokens(chatId) {
  const chatData = trackedChats[chatId];
  let updated = false;
  for (const tokenSymbol in chatData.tokens) {
    const tokenInfo = chatData.tokens[tokenSymbol];
    const data = await fetchTokenData(tokenInfo.pairAddress);
    if (data && data.pair) {
      const newPrice = data.pair.priceUsd || "N/A";
      tokenInfo.lastPrice = newPrice;
      tokenInfo.lastUpdated = new Date().toLocaleTimeString();
      updated = true;
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
 * Start the periodic update loop for a chat if not already started.
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

// Handle the /start command with HTML formatting.
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
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

// Handle the /help command to list the bot's capabilities.
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
<b>Hyprice Bot - What I Can Do:</b>

• <b>Track Tokens:</b> Send me a message in the format <code>$SYMBOL: pair_address</code> and I will track the token's price from DexScreener (Hyperliquid chain).

• <b>Aggregated Updates:</b> All tokens you track in a chat are combined into one pinned message that updates every 15 seconds with the latest prices.

• <b>View Details:</b> Each token in the pinned message has a button to view more details on DexScreener.

• <b>User-Friendly Interface:</b> I use HTML formatting to display a clean and professional summary of all tracked tokens.

Simply add your tokens and use /help anytime to see this message again.
  `;
  bot.sendMessage(chatId, helpMessage, { parse_mode: "HTML" })
    .then(() => debugLog("Sent help message"))
    .catch(err => console.error("Error sending /help message:", err.toString()));
});

// Listen for messages that match the token tracking pattern.
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  // Check if msg.text exists
  if (!msg.text) {
    debugLog("No text in message, skipping.");
    return;
  }
  const text = msg.text.trim();
  debugLog("Received message:", text);

  // Regex to match a tracking message of the form: "$SYMBOL: pair_address"
  // Accepts addresses with 32 to 40 hexadecimal characters after "0x"
  const pattern = /^\$(\w+):\s*(0x[a-fA-F0-9]{32,40})$/i;
  const match = text.match(pattern);
  if (match) {
    const tokenSymbol = match[1];
    const pairAddress = match[2];
    debugLog(`Tracking request for ${tokenSymbol} with pair address: ${pairAddress}`);

    // Initialize tracking for this chat if it doesn't exist
    if (!trackedChats[chatId]) {
      trackedChats[chatId] = { pinnedMessageId: null, tokens: {}, intervalId: null };
    }
    // Add or update the token in the chat's tracked tokens list
    trackedChats[chatId].tokens[tokenSymbol] = { pairAddress, lastPrice: null, lastUpdated: null };

    // If no aggregated (pinned) message exists yet for this chat, send one and pin it.
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
      // If an aggregated message already exists, update it immediately.
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

    // Start (or ensure) the update loop for this chat is running.
    startUpdateLoop(chatId);
  } else {
    debugLog("Message did not match tracking pattern");
  }
});

debugLog("Hyprice Telegram Bot is running...");
