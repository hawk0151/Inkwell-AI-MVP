// backend/src/services/queue.service.js

/**
 * @fileoverview This file sets up and exports a BullMQ queue instance
 * for processing background jobs, such as story generation.
 */

import { Queue } from 'bullmq';

// We need a Redis connection for BullMQ. This URL should be in your .env file.
const redisConnection = {
  // Use a different environment variable if yours is named differently
  // e.g., process.env.REDIS_URL
  host: process.env.REDIS_HOST, 
  port: parseInt(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD
};

// Create a new queue instance for story generation jobs.
// The name 'storyGenerationQueue' is an identifier and must be consistent
// between the queue and the worker.
export const storyGenerationQueue = new Queue('storyGenerationQueue', {
  connection: redisConnection,
});

console.log('✅ BullMQ queue service initialized.');