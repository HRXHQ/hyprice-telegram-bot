const cacheHandler = require("./cache-handler");
const { debugLog } = require("./helper");
/**
 *
 * @param {*} tokenAddress
 * @returns {priceUsd: string, priceChange: string}
 */

async function getTokenData(tokenAddress) {
    //see if the data is in the cache
    const cacheKey = `tokenData_${tokenAddress}`;
    const cachedData = cacheHandler.getCache(cacheKey);

    if (cachedData) {
        debugLog(`Token data found in cache for ${tokenAddress}`);
        return cachedData;
    }

    // Use the token page URL (not a pair page)
    const url = `https://api.dexscreener.com/latest/dex/pairs/hyperliquid/${tokenAddress}`;
    try {
        const response = await fetch(url, { headers: {} });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const json = await response.json();

        const price = json.pairs[0].priceUsd;
        const priceChange = json.pairs[0].priceChange;

        //save the data to the cache
        cacheHandler.setCache(cacheKey, {
            priceUsd: price,
            priceChange: priceChange["h24"],
        });
        debugLog(`Token data saved to cache for ${tokenAddress}`);
        return { priceUsd: price, priceChange: priceChange["h24"] };
    } catch (err) {
        console.error("Error in getTokenData:", err);
        //sleep  5sec and try try again
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return getTokenData(tokenAddress);
    }
}

module.exports = { getTokenData };