// backend/src/services/queue.service.js
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

if (!process.env.REDIS_URL) {
  console.error('❌ REDIS_URL environment variable is NOT set!');
  process.exit(1);
}

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  tls: {} // Upstash requires TLS
});

export const storyGenerationQueue = new Queue('storyGenerationQueue', {
  connection
});

console.log('✅ BullMQ queue service initialized.');
