// backend/src/services/queue.service.js
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Pass the required option directly to the IORedis constructor.
const connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null
});

export const storyGenerationQueue = new Queue('storyGenerationQueue', {
  connection: connection,
});

console.log('✅ BullMQ queue service initialized.');