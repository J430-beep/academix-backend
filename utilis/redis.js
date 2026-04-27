const Redis = require("ioredis");

// Redis connection (Render / Upstash / Redis Cloud)
const redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
});

// Log connection status
redis.on("connect", () => {
    console.log("✅ Redis connected");
});

redis.on("error", (err) => {
    console.error("❌ Redis error:", err.message);
});

module.exports = redis;