// Load environment variables from .env file
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');

// Retrieve the Telegram bot token from the environment variable
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
  bot.sendMessage(chatId, "Welcome to the HyPrice Telegram Bot!");
});

// Echo back any text message sent to the bot (you can replace this with your extension logic)
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  // Replace this with your own processing logic as needed
  bot.sendMessage(chatId, `Received: ${msg.text}`);
});

console.log("HyPrice Telegram Bot is running...");
