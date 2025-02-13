const { debugLog } = require("./helper");

class CacheHandler {
    cache = {};
    constructor() {
        this.cache = {};
    }

    getCache(key) {
        return this.cache[key];
    }

    setCache(key, value) {
        const timenow = new Date().getTime();
        this.cache[key] = {...value, timestamp: timenow, ttl: 1000 * 60 * 1 };
    }

    poolCache() {
        const timenow = new Date().getTime();

        for (const key in this.cache) {
            if (this.cache[key].timestamp + this.cache[key].ttl < timenow) {
                debugLog(`Cache key ${key} expired`);
                delete this.cache[key];
            }
        }

        debugLog(`Pooling cache.....`);
        //run every 1 minutes
        setTimeout(() => {
            this.poolCache();
        }, 1000 * 60 * 1);
    }
}

module.exports = new CacheHandler();