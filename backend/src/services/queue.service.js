import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Create a Redis connection from URL (Upstash requires TLS)
const redisConnection = new IORedis(process.env.REDIS_URL, {
  tls: {} // Enables SSL/TLS
});

export const storyGenerationQueue = new Queue('storyGenerationQueue', {
  connection: redisConnection
});

console.log('✅ BullMQ queue service initialized.');
