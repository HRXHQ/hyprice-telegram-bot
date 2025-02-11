/*
 * hyprice.js
 *
 * This module contains the core business logic for the HyPrice project.
 * It is adapted from your Chrome extension code. In this example, the function
 * processes an input string to extract numeric price values and calculates
 * summary statistics (total, average, minimum, and maximum).
 *
 * You can modify, extend, or replace this logic with the actual functionality
 * from your extension as needed.
 */

/**
 * Processes the given input text to extract price values and calculate summary statistics.
 *
 * @param {string} input - The text input that should contain price information.
 * @returns {string} - A response string with the calculated results or an error message.
 */
function processHyprice(input) {
  // Basic input validation
  if (!input || typeof input !== 'string') {
    return "Invalid input. Please send some text containing price information.";
  }

  // Regular expression to match numbers (prices), e.g., "19.99", "100", etc.
  const priceRegex = /(\d+(?:\.\d+)?)/g;
  const matches = input.match(priceRegex);

  if (!matches || matches.length === 0) {
    return "No price information found in the input.";
  }

  // Convert matched strings to numbers
  const prices = matches.map(str => parseFloat(str));

  // Calculate total, average, minimum, and maximum
  const total = prices.reduce((acc, val) => acc + val, 0);
  const average = total / prices.length;
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  // Prepare a response message
  let response = `Prices detected: ${prices.join(", ")}.\n`;
  response += `Total: ${total.toFixed(2)}\n`;
  response += `Average: ${average.toFixed(2)}\n`;
  response += `Minimum: ${min.toFixed(2)}\n`;
  response += `Maximum: ${max.toFixed(2)}`;

  return response;
}

// Export the function so it can be used in bot.js
module.exports = { processHyprice };
