// hyprice.js

const cheerio = require('cheerio');

async function getTokenData(pairAddress) {
  const url = `https://dexscreener.com/hyperliquid/${pairAddress}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    // Attempt to extract the USD price and 24h change using data-testid attributes.
    let price = $('span[data-testid="PairPrice"]').first().text().trim();
    if (!price) {
      // Fallback selector if needed
      price = $('span.price').first().text().trim();
    }
    let priceChange = $('span[data-testid="PairPriceChange"]').first().text().trim();
    if (!priceChange) {
      priceChange = $('span.change').first().text().trim();
    }
    return { priceUsd: price, priceChange: priceChange };
  } catch (err) {
    console.error("Error in getTokenData:", err);
    return null;
  }
}

module.exports = { getTokenData };
