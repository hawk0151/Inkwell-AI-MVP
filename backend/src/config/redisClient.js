// backend/src/config/redis.connection.js
import IORedis from 'ioredis';

console.log('DEBUG REDIS_URL:', JSON.stringify(process.env.REDIS_URL));
const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.error('❌ CRITICAL: REDIS_URL environment variable is not set!');
  process.exit(1);
}

// Start with base options compatible with BullMQ
const redisOptions = {
  maxRetriesPerRequest: null,
};

// --- THIS IS THE KEY CHANGE ---
// Check if the URL is for a secure Redis instance (like Upstash).
// Secure Redis URLs start with the "rediss://" protocol.
if (redisUrl.startsWith('rediss://')) {
  // If it is, add the required TLS options.
  redisOptions.tls = {
    rejectUnauthorized: false,
  };
  console.log('✅ TLS configuration enabled for secure Redis connection.');
}

// This single instance will now work for both TLS and non-TLS connections.
export const redisConnection = new IORedis(redisUrl, redisOptions);

redisConnection.on('connect', () => {
  console.log('✅ Connected to Redis successfully.');
});

redisConnection.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});