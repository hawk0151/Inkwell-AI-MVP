import { Queue } from 'bullmq';
// --- MODIFICATION: Import the single, shared Redis connection ---
import { redisConnection } from '../config/redis.connection.js';

// This queue is specifically for story chapters
export const storyGenerationQueue = new Queue('storyGenerationQueue', {
    // --- MODIFICATION: Use the imported shared connection ---
    connection: redisConnection,
});

console.log('✅ BullMQ story generation queue initialized.');