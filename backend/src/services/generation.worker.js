import 'dotenv/config';
import { Worker } from 'bullmq';
import { getDb, initializeDb } from '../db/database.js';
import * as imageService from '../services/image.service.js';
import { redisConnection } from '../config/redisClient.js';

const BATCH_SIZE = 4; // Process 4 pages at a time
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds delay

/**
 * Main processor for the image generation queue.
 * This function handles a single job to generate all 20 pages for a picture book.
 * @param {object} job - The job object from BullMQ.
 */
const processImageGenerationJob = async (job) => {
    const { bookId } = job.data;
    console.log(`[Worker] Received job '${job.name}' for picture book ${bookId}.`);
    
    let dbClient;
    try {
        const pool = await getDb();
        dbClient = await pool.connect();

        // 1. Fetch all necessary book data
        const bookResult = await dbClient.query(
            `SELECT story_bible, character_reference, book_status FROM picture_books WHERE id = $1`,
            [bookId]
        );
        const book = bookResult.rows[0];

        // 2. Validate the data before starting the generation
        if (!book) throw new Error(`Book with ID ${bookId} not found.`);
        if (book.book_status !== 'generating') throw new Error(`Book ${bookId} is not in 'generating' state.`);
        if (!book.story_bible?.storyPlan || book.story_bible.storyPlan.length === 0) {
            throw new Error(`Book ${bookId} does not have a valid story plan.`);
        }
        if (!book.character_reference?.url) {
            throw new Error(`Book ${bookId} does not have a selected character reference.`);
        }

        const storyPlan = book.story_bible.storyPlan;
        const characterReferenceUrl = book.character_reference.url;
        const artStyle = book.story_bible.art.style;

        // 3. Process pages in batches
        for (let i = 0; i < storyPlan.length; i += BATCH_SIZE) {
            const batch = storyPlan.slice(i, i + BATCH_SIZE);
            console.log(`[Worker] Processing batch for pages ${batch.map(p => p.pageNumber).join(', ')}...`);

            const batchPromises = batch.map(page => 
                // This is the call to the new image service function we will create next
                imageService.generateImageFromReference({
                    referenceImageUrl: characterReferenceUrl,
                    prompt: page.imagePrompt,
                    style: artStyle,
                    bookId: bookId,
                    pageNumber: page.pageNumber,
                }).then(generatedUrls => {
                    // Update the timeline_events table with the new image URLs
                    return dbClient.query(
                        `UPDATE timeline_events SET image_url_preview = $1, image_url_print = $2 WHERE book_id = $3 AND page_number = $4`,
                        [generatedUrls.previewUrl, generatedUrls.printUrl, bookId, page.pageNumber]
                    );
                })
            );

            await Promise.all(batchPromises);
            console.log(`[Worker] ✅ Batch completed for pages ${batch.map(p => p.pageNumber).join(', ')}.`);

            // Add a delay between batches to respect potential rate limits
            if (i + BATCH_SIZE < storyPlan.length) {
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
            }
        }
        
        // 4. Mark the book as complete
        await dbClient.query(`UPDATE picture_books SET book_status = 'completed', last_modified = $1 WHERE id = $2`, [new Date(), bookId]);
        console.log(`[Worker] 🎉 All pages generated for book ${bookId}. Status updated to 'completed'.`);

    } catch (error) {
        console.error(`[Worker] Job for book ${bookId} FAILED.`, error);
        // If an error occurs, mark the book as failed and store metadata
        if (dbClient) {
            const meta = { error: error.message, failedAt: new Date() };
            await dbClient.query(`UPDATE picture_books SET book_status = 'failed', generation_meta = $1 WHERE id = $2`, [meta, bookId]);
        }
        throw error; // Re-throw to make BullMQ mark the job as failed
    } finally {
        if (dbClient) dbClient.release();
    }
};

/**
 * IIFE to initialize and start the worker.
 */
(async () => {
    try {
        console.log('[Worker] Initializing services...');
        await initializeDb();

        // The worker now listens to the 'imageGenerationQueue'
        const worker = new Worker('imageGenerationQueue', processImageGenerationJob, {
            connection: redisConnection,
            concurrency: 2 // Lower concurrency for intense, long-running image jobs
        });

        worker.on('completed', (job) => {
            console.log(`✅ [Worker] Job '${job.name}' #${job.id} for book ${job.data.bookId} has completed.`);
        });
        worker.on('failed', (job, err) => {
            console.error(`❌ [Worker] Job '${job.name}' #${job.id} for book ${job.data.bookId} failed: ${err.message}`);
        });

        const gracefulShutdown = async () => {
            console.log('\n[Worker] Shutting down gracefully...');
            await worker.close();
            await redisConnection.quit();
            console.log('[Worker] BullMQ worker closed.');
            process.exit(0);
        };
        process.on('SIGINT', gracefulShutdown);
        process.on('SIGTERM', gracefulShutdown);

        console.log('✅ BullMQ Image Generation worker is running and listening for jobs.');
    } catch (error) {
        console.error('❌ [Worker] Failed to start worker process:', error);
        process.exit(1);
    }
})();