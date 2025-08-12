// backend/src/config/redis.connection.js
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.error('❌ CRITICAL: REDIS_URL environment variable is not set!');
  process.exit(1);
}

// This is our single, centralized Redis connection instance.
// It includes all the necessary options for Upstash and BullMQ.
export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  tls: { 
    rejectUnauthorized: false 
  }
});

redisConnection.on('connect', () => {
    console.log('✅ Connected to Redis successfully.');
});

redisConnection.on('error', (err) => {
    console.error('❌ Redis connection error:', err);
});