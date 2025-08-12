// backend/src/services/queue.service.js

/**
 * @fileoverview This file sets up and exports a BullMQ queue instance
 * for processing background jobs, such as story generation.
 */

import { Queue } from 'bullmq';

// This connects directly using the REDIS_URL from your environment variables,
// which is the correct method for connecting to Upstash.
export const storyGenerationQueue = new Queue('storyGenerationQueue', {
  connection: process.env.REDIS_URL,
});

console.log('✅ BullMQ queue service initialized.');