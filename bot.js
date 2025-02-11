// Load environment variables from .env file
require('dotenv').config();

// Import the Telegram Bot API and your hyprice logic module
const TelegramBot = require('node-telegram-bot-api');
const { processHyprice } = require('./hyprice');

// Retrieve the Telegram bot token from environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Error: TELEGRAM_BOT_TOKEN is not set.");
  process.exit(1);
}

// Create a new Telegram bot instance using polling
const bot = new TelegramBot(token, { polling: true });

// Handle the /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Welcome to the HyPrice Telegram Bot!\nSend me some text containing price information, and I'll process it for you.");
});

// Process any incoming text message using the hyprice logic
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  
  // Use the custom logic from hyprice.js to process the message text
  const result = processHyprice(msg.text);
  
  // Send the processed result back to the user
  bot.sendMessage(chatId, result);
});

console.log("HyPrice Telegram Bot is running...");
