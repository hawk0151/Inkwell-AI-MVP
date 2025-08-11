import { Queue } from 'bullmq';
import { REDIS_HOST, REDIS_PORT } from '../config/redis.config.js';

// Define the connection to Redis
const redisConnection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
};

// Create and export the queue
// The name 'image-generation' is important for the worker to find it
export const generationQueue = new Queue('image-generation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Try each job up to 3 times if it fails
    backoff: {
      type: 'exponential',
      delay: 5000, // Wait 5 seconds before the first retry
    },
  },
});

console.log('✅ BullMQ queue service initialized.');