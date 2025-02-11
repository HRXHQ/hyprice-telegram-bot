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
 * @param {string} tokenAddress - The token contract address.
 * @returns {Promise<object|null>} - The JSON response from DexScreener or null on error.
 */
async function fetchTokenData(tokenAddress) {
  try {
    const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
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
    "Welcome to the HyPrice Telegram Bot!\n\n" +
    "To track a token, send a message in the following format:\n" +
    "$SYMBOL: token_address\n\n" +
    "Example:\n" +
    "$HYPE: 0x13ba5fea7078ab3798fbce53b4d0721c";
  bot.sendMessage(chatId, welcomeMessage);
});

// Listen for messages to add token tracking
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text && msg.text.trim();
  
  // Regex to match the token tracking format, e.g., "$HYPE: 0x..."
  const tokenRegex = /^\$(\w+):\s*(0x[a-fA-F0-9]{40})$/;
  const match = text.match(tokenRegex);
  
  if (match) {
    const tokenSymbol = match[1];
    const tokenAddress = match[2];
    
    // Fetch initial token data from DexScreener
    let tokenData = await fetchTokenData(tokenAddress);
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
                      `Address: ${tokenAddress}\n` +
                      `Price: $${price}\n\n` +
                      `Last updated: ${new Date().toLocaleTimeString()}`;
    
    // Create an inline keyboard with a button linking to the DexScreener page
    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: "View on DexScreener",
            url: `https://dexscreener.com/hyperliquid/${tokenAddress}`
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
      let updatedData = await fetchTokenData(tokenAddress);
      if (!updatedData) return;
      
      const updatedPair = updatedData.pairs && updatedData.pairs[0];
      if (!updatedPair) return;
      
      const updatedPrice = updatedPair.priceUsd || "N/A";
      let updatedText = `Tracking Token: $${tokenSymbol}\n` +
                        `Address: ${tokenAddress}\n` +
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
    }, 15000); // 15,000 ms = 15 seconds
    
    return; // Exit the handler for this message
  }
  
  // (Optional) For non-token messages, you can choose to ignore or handle them differently.
  // For now, we do nothing if the message doesn't match the token format.
});

console.log("HyPrice Telegram Bot is running...");
