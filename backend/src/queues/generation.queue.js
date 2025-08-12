// backend/src/queues/generation.queue.js
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// This is the definitive, correct connection configuration for BullMQ with Upstash.
const connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    tls: {
        rejectUnauthorized: false
    }
});

// This queue is specifically for picture book images
export const imageGenerationQueue = new Queue('imageGenerationQueue', {
    connection: connection,
});

console.log('✅ BullMQ image generation queue initialized.');