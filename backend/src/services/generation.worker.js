// backend/src/services/generation.worker.js

import 'dotenv/config';
import { Worker } from 'bullmq';
import { generateChapterWithPlan } from './generation/chapter.js';
import { unlockBook } from '../utils/lock.util.js';
import { initializeDb } from '../db/database.js';

// --- MODIFICATION: The redisConnection object has been removed. ---
// We will now pass the REDIS_URL string directly to the Worker constructor.

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

(async () => {
    try {
        console.log('[Worker] Initializing services...');
        await initializeDb();
        
        // --- MODIFICATION: The connection now uses the REDIS_URL directly ---
        // This is the correct way to connect to Upstash.
        const worker = new Worker('storyGenerationQueue', processGenerationJob, {
            connection: process.env.REDIS_URL,
            concurrency: 5 
        });

        worker.on('completed', (job) => {
          console.log(`✅ [Worker] Job '${job.name}' #${job.id} for book ${job.data.bookId} has completed.`);
        });

        worker.on('failed', (job, err) => {
          console.error(`❌ [Worker] Job '${job.name}' #${job.id} for book ${job.data.bookId} failed with error: ${err.message}`);
        });

        const gracefulShutdown = async () => {
            console.log('\n[Worker] Shutting down gracefully...');
            await worker.close();
            console.log('[Worker] BullMQ worker closed.');
            process.exit(0);
        };
        
        process.on('SIGINT', gracefulShutdown);
        process.on('SIGTERM', gracefulShutdown);

        console.log('✅ BullMQ worker is running and listening for jobs. Press Ctrl+C to exit.');

    } catch (error) {
        console.error('❌ [Worker] Failed to start worker process:', error);
        process.exit(1);
    }
})();