// hyprice.js

const cheerio = require('cheerio');

async function getTokenData(tokenAddress) {
  const url = `https://dexscreener.com/hyperliquid/${tokenAddress}`;
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
    
    // Inspect the Dexscreener token page (for example, https://dexscreener.com/hyperliquid/0x13ba5fea7078ab3798fbce53b4d0721c)
    // and adjust the selectors below as needed.
    // Here we assume:
    // - The USD price is within a <span> element with data-testid="TokenPrice".
    // - The 24h change is within a <span> element with data-testid="TokenPriceChange".
    let price = $('span[data-testid="TokenPrice"]').first().text().trim();
    if (!price) {
      price = $('span.price').first().text().trim();
    }
    let priceChange = $('span[data-testid="TokenPriceChange"]').first().text().trim();
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
