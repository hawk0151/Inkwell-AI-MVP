import { Queue } from 'bullmq';
import { getRedisClient } from '../config/redisClient.js';

const connection = getRedisClient();

export const storyGenerationQueue = new Queue('storyGenerationQueue', {
    connection: connection,
});

export const imageGenerationQueue = new Queue('imageGenerationQueue', {
    connection: connection,
});

console.log('✅ BullMQ queues initialized.');