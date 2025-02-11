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

/**
 * Fetch token data from DexScreener API.
 * @param {string} pairAddress - The token pair contract address.
 * @returns {Promise<object|null>} - The JSON response from DexScreener or null on error.
 */
async function fetchTokenData(pairAddress) {
  try {
    const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${pairAddress}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching token data:", error);
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
  bot.sendMessage(chatId, welcomeMessage);
});

// Listen for messages to add token tracking
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text && msg.text.trim();
  
  // Regex to match the token tracking format, e.g., "$HYPE: 0x..."
  const pairRegex = /^\$(\w+):\s*(0x[a-fA-F0-9]{40})$/i;
  const match = text.match(pairRegex);
  
  if (match) {
    const tokenSymbol = match[1];
    const pairAddress = match[2];
    
    console.log(`Received tracking request for ${tokenSymbol} with pair address: ${pairAddress}`);
    
    // Fetch initial token data from DexScreener
    let tokenData = await fetchTokenData(pairAddress);
    if (!tokenData) {
      bot.sendMessage(chatId, "Failed to fetch token data. Please try again later.");
      return;
    }
    
    // Assume the token data includes an array "pairs" with trading pair info.
    const pair = tokenData.pairs && tokenData.pairs[0];
    if (!pair) {
      bot.sendMessage(chatId, "No trading pairs found for this token.");
      return;
    }
    
    const price = pair.priceUsd || "N/A";
    let messageText = `Tracking Token: $${tokenSymbol}\n` +
                      `Pair Address: ${pairAddress}\n` +
                      `Price: $${price}\n\n` +
                      `Last updated: ${new Date().toLocaleTimeString()}`;
    
    // Create an inline keyboard with a button linking to the DexScreener page (Hyperliquid themed)
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
    
    // Send the tracking message and pin it
    let sentMessage;
    try {
      sentMessage = await bot.sendMessage(chatId, messageText, { reply_markup: inlineKeyboard });
      await bot.pinChatMessage(chatId, sentMessage.message_id);
    } catch (err) {
      console.error("Error sending or pinning message:", err);
      bot.sendMessage(chatId, "Error sending or pinning tracking message. Ensure the bot has permission to pin messages.");
      return;
    }
    
    // Set up periodic updates every 15 seconds to refresh the pinned message
    setInterval(async () => {
      let updatedData = await fetchTokenData(pairAddress);
      if (!updatedData) return;
      
      const updatedPair = updatedData.pairs && updatedData.pairs[0];
      if (!updatedPair) return;
      
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
      } catch (err) {
        console.error("Error updating pinned message:", err);
      }
    }, 15000); // 15 seconds interval
    
    return; // Exit after processing a valid token tracking request
  }
  
  // (Optional) You could send a notice if the message format is unrecognized.
  // For now, non-matching messages are ignored.
});

console.log("Hyprice Telegram Bot is running...");
