import 'dotenv/config';
import { Worker } from 'bullmq';
import { initializeDb } from '../db/database.js';
import * as imageService from './image.service.js'; // Import the image service

// Redis connection details
const redisConnection = {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD || null
};

// This is the main job processing function
const processGenerationJob = async (job) => {
    console.log(`[Worker] Received job '${job.name}' #${job.id}`);

    // --- Job Router ---
    // This checks the name of the job and calls the correct function
    try {
        if (job.name === 'generate-page-image') {
            const { bookId, userId, pageNumber, prompt, style } = job.data;
            await imageService.processAndUploadImageVersions(prompt, style, userId, bookId, pageNumber);
        } else {
            // You can add other job types here in the future
            console.warn(`[Worker] Unknown job name: ${job.name}`);
        }
    } catch (error) {
        console.error(`[Worker] Job '${job.name}' for book ${job.data.bookId} FAILED.`);
        // We re-throw the error so BullMQ knows the job failed and can retry it
        throw error;
    }
};

// Main worker startup logic
(async () => {
    try {
        console.log('[Worker] Initializing services...');
        await initializeDb();
        
        // **FIX**: The worker now listens to the correct queue: 'image-generation'
        const worker = new Worker('image-generation', processGenerationJob, {
            connection: redisConnection,
            concurrency: 5 // Process up to 5 jobs at the same time
        });

        worker.on('completed', (job) => {
          console.log(`✅ [Worker] Job '${job.name}' #${job.id} has completed.`);
        });

        worker.on('failed', (job, err) => {
          console.error(`❌ [Worker] Job '${job.name}' #${job.id} failed with error: ${err.message}`);
        });

        const gracefulShutdown = async () => {
            console.log('\n[Worker] Shutting down gracefully...');
            await worker.close();
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