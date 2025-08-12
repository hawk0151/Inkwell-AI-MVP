// backend/src/services/queue.service.js

/**
 * @fileoverview This file sets up and exports a BullMQ queue instance
 * for processing background jobs, such as story generation.
 */

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// --- MODIFICATION: Create a dedicated Redis connection instance ---
// new IORedis() will correctly parse your full REDIS_URL from Upstash,
// including the password, host, port, and TLS settings.
const connection = new IORedis(process.env.REDIS_URL, {
    // This option is important for some cloud providers to prevent hangs
    maxRetriesPerRequest: null 
});

// Pass the pre-configured connection instance to the queue.
export const storyGenerationQueue = new Queue('storyGenerationQueue', {
  connection: connection,
});

console.log('✅ BullMQ queue service initialized.');