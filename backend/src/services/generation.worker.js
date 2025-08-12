// backend/src/services/generation.worker.js

import 'dotenv/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis'; // --- MODIFICATION: Import ioredis ---
import { generateChapterWithPlan } from './generation/chapter.js';
import { unlockBook } from '../utils/lock.util.js';
import { initializeDb } from '../db/database.js';

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
        
        // --- MODIFICATION: Create a dedicated Redis connection instance ---
        const connection = new IORedis(process.env.REDIS_URL, {
            maxRetriesPerRequest: null 
        });

        // --- MODIFICATION: Pass the pre-configured connection instance to the worker ---
        const worker = new Worker('storyGenerationQueue', processGenerationJob, {
            connection: connection,
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