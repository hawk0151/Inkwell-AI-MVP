// backend/src/services/queue.service.js
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    tls: {
        rejectUnauthorized: false
    }
});

export const storyGenerationQueue = new Queue('storyGenerationQueue', {
    connection: connection,
});

console.log('✅ BullMQ queue service initialized.');