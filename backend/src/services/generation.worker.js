// backend/src/services/generation.worker.js

import 'dotenv/config';
import { Worker } from 'bullmq';
import { generateChapterWithPlan } from './generation/chapter.js';
import { unlockBook } from '../utils/lock.util.js';
import { initializeDb } from '../db/database.js';

const redisConnection = {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD || null
};

const processGenerationJob = async (job) => {
    const { bookId, userId, chapterNumber, guidance } = job.data;
    console.log(`[Worker] Received job '${job.name}' for book ${bookId}, chapter ${chapterNumber}.`);

    try {
        await generateChapterWithPlan(bookId, userId, chapterNumber, guidance);
    } catch (error) {
        console.error(`[Worker] Job '${job.name}' for book ${bookId} FAILED.`, error);
        await unlockBook(bookId);
        throw error;
    }
};

// --- MODIFICATION: Restructure as a self-executing async function (IIFE) ---
// This is a standard pattern for a service entry point.
(async () => {
    try {
        // 1. Initialize services required by the worker.
        console.log('[Worker] Initializing services...');
        await initializeDb();
        
        // 2. Create the BullMQ worker instance.
        const worker = new Worker('storyGenerationQueue', processGenerationJob, {
            connection: redisConnection,
            concurrency: 5 
        });

        // Add event listeners for logging and monitoring.
        worker.on('completed', (job) => {
          console.log(`✅ [Worker] Job '${job.name}' #${job.id} for book ${job.data.bookId} has completed.`);
        });

        worker.on('failed', (job, err) => {
          console.error(`❌ [Worker] Job '${job.name}' #${job.id} for book ${job.data.bookId} failed with error: ${err.message}`);
        });

        // 3. Add graceful shutdown logic. This also keeps the process alive.
        const gracefulShutdown = async () => {
            console.log('\n[Worker] Shutting down gracefully...');
            await worker.close();
            console.log('[Worker] BullMQ worker closed.');
            process.exit(0);
        };
        
        // Listen for termination signals
        process.on('SIGINT', gracefulShutdown); // Catches Ctrl+C
        process.on('SIGTERM', gracefulShutdown); // Catches standard termination signals

        console.log('✅ BullMQ worker is running and listening for jobs. Press Ctrl+C to exit.');

    } catch (error) {
        console.error('❌ [Worker] Failed to start worker process:', error);
        process.exit(1);
    }
})();