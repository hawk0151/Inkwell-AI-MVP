import { Queue } from 'bullmq';
// --- MODIFICATION: Import the single, shared Redis connection ---
import { redisConnection } from '../config/redis.connection.js';

// This queue is specifically for picture book images
export const imageGenerationQueue = new Queue('imageGenerationQueue', {
    // --- MODIFICATION: Use the imported shared connection ---
    connection: redisConnection,
});

console.log('✅ BullMQ image generation queue initialized.');