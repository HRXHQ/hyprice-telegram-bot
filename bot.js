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
 * Fetch pair data from DexScreener API for the hyperliquid chain.
 * @param {string} pairAddress - The token pair contract address.
 * @returns {Promise<object|null>} - The JSON response from DexScreener or null on error.
 */
async function fetchTokenData(pairAddress) {
  try {
    debugLog("Fetching pair data for", pairAddress);
    // Use the pairs endpoint for hyperliquid chain
    const response = await axios.get(`https://api.dexscreener.com/latest/dex/pairs/hyperliquid/${pairAddress}`);
    debugLog("Received pair data:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching pair data:", error.toString());
    return null;
  }
}

// Handle the /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage =
    "Welcome to the Hyprice Telegram Bot!\n\n" +
    "To track a token, send a message in the following format:\n" +
    "$SYMBOL: pair_address\n\n" +
    "Example:\n" +
    "$HYPE: 0x13ba5fea7078ab3798fbce53b4d0721c";
  bot.sendMessage(chatId, welcomeMessage)
    .then(() => debugLog("Sent welcome message"))
    .catch(err => console.error("Error sending /start message:", err.toString()));
});

// Listen for messages to add token tracking
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text && msg.text.trim();
  debugLog("Received message:", text);

  // Updated regex: Accept addresses with 32 to 40 hexadecimal characters after "0x"
  const pairRegex = /^\$(\w+):\s*(0x[a-fA-F0-9]{32,40})$/i;
  const match = text.match(pairRegex);

  if (match) {
    const tokenSymbol = match[1];
    const pairAddress = match[2];
    debugLog(`Tracking request for ${tokenSymbol} with pair address: ${pairAddress}`);

    // Fetch initial pair data from DexScreener (using the hyperliquid pairs endpoint)
    let tokenData = await fetchTokenData(pairAddress);
    if (!tokenData) {
      bot.sendMessage(chatId, "Failed to fetch token data. Please try again later.");
      return;
    }

    // Check if tokenData contains a 'pair' field
    if (!tokenData.pair) {
      debugLog("No trading pair found in response:", tokenData);
      bot.sendMessage(chatId, "No trading pairs found for this token.");
      return;
    }

    const pair = tokenData.pair;
    const price = pair.priceUsd || "N/A";
    let messageText = `Tracking Token: $${tokenSymbol}\n` +
                      `Pair Address: ${pairAddress}\n` +
                      `Price: $${price}\n\n` +
                      `Last updated: ${new Date().toLocaleTimeString()}`;

    // Create an inline keyboard with a button linking to the DexScreener page (Hyperliquid-themed)
    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: "🔷 View on Hyperliquid",
            url: `https://dexscreener.com/hyperliquid/${pairAddress}`
          }
        ]
      ]
    };

    // Send the tracking message and attempt to pin it
    let sentMessage;
    try {
      sentMessage = await bot.sendMessage(chatId, messageText, { reply_markup: inlineKeyboard });
      debugLog("Sent tracking message, id:", sentMessage.message_id);
      await bot.pinChatMessage(chatId, sentMessage.message_id);
      debugLog("Pinned tracking message");
    } catch (err) {
      console.error("Error sending or pinning message:", err.toString());
      bot.sendMessage(chatId, "Error sending or pinning tracking message. Ensure the bot has permission to pin messages.");
      return;
    }

    // Set up periodic updates every 15 seconds to refresh the pinned message
    setInterval(async () => {
      let updatedData = await fetchTokenData(pairAddress);
      if (!updatedData) {
        debugLog("Updated data is null");
        return;
      }

      if (!updatedData.pair) {
        debugLog("No updated trading pair found. Updated data:", updatedData);
        return;
      }

      const updatedPair = updatedData.pair;
      const updatedPrice = updatedPair.priceUsd || "N/A";
      let updatedText = `Tracking Token: $${tokenSymbol}\n` +
                        `Pair Address: ${pairAddress}\n` +
                        `Price: $${updatedPrice}\n\n` +
                        `Last updated: ${new Date().toLocaleTimeString()}`;

      try {
        await bot.editMessageText(updatedText, {
          chat_id: chatId,
          message_id: sentMessage.message_id,
          reply_markup: inlineKeyboard
        });
        debugLog("Updated tracking message with new price:", updatedPrice);
      } catch (err) {
        console.error("Error updating pinned message:", err.toString());
      }
    }, 15000); // 15 seconds interval

  } else {
    debugLog("Message did not match tracking pattern");
  }
});

debugLog("Hyprice Telegram Bot is running...");
