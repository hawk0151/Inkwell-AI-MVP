import { Queue } from 'bullmq';
import { redisConnection } from '../config/redisClient.js';

const connection = redisConnection;

export const storyGenerationQueue = new Queue('storyGenerationQueue', {
    connection: connection,
});

export const imageGenerationQueue = new Queue('imageGenerationQueue', {
    connection: connection,
});

console.log('✅ BullMQ queues initialized.');