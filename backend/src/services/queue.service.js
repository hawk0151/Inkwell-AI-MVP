import { Queue, Worker } from 'bullmq';
import { redisConnection } from '../config/redisClient.js';
import * as imageService from './image.service.js';
import { getDb } from '../db/database.js';

const connection = redisConnection;

export const storyGenerationQueue = new Queue('storyGenerationQueue', {
    connection: connection,
});

export const imageGenerationQueue = new Queue('imageGenerationQueue', {
    connection: connection,
});

// ✅ NEW: Worker to process jobs from the imageGenerationQueue.
const imageGenerationWorker = new Worker('imageGenerationQueue', async job => {
    const { bookId, userId, pageNumber, prompt } = job.data;
    console.log(`[Worker] Processing job ${job.id}: Image for book ${bookId}, page ${pageNumber}.`);
    
    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();
        
        // 1. Fetch the book details (character reference, style, etc.) needed for generation.
        const bookResult = await client.query(`SELECT character_reference, story_bible FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        
        if (bookResult.rows.length === 0) {
            throw new Error(`Book not found (ID: ${bookId}) for user ${userId}.`);
        }
        const book = bookResult.rows[0];

        if (!book.character_reference?.url) {
            throw new Error(`Character reference image is missing for book ${bookId}. Cannot process job.`);
        }

        // 2. Construct the options payload for the image generation service.
        const imageServiceOptions = {
            referenceImageUrl: book.character_reference.url,
            prompt: prompt,
            style: book.story_bible?.art?.style || 'watercolor', // Use book's style or a default
            characterFeatures: book.story_bible?.character?.description,
            mood: book.story_bible?.tone,
            bookId,
            pageNumber
        };
        
        // 3. Call the image service to generate and upload the images.
        const { previewUrl, printUrl } = await imageService.generateImageFromReference(imageServiceOptions);

        // 4. Update the database with the new image URLs.
        const updateSql = `
            UPDATE timeline_events 
            SET image_url = $1, image_url_preview = $2, image_url_print = $3, uploaded_image_url = NULL
            WHERE book_id = $4 AND page_number = $5
        `;
        await client.query(updateSql, [previewUrl, previewUrl, printUrl, bookId, pageNumber]);

    } catch (error) {
        console.error(`[Worker] FAILED job ${job.id} for page ${pageNumber}:`, error.message);
        // Re-throw the error to ensure the job is marked as 'failed' in BullMQ
        throw error;
    } finally {
        if (client) client.release();
    }
}, { 
    connection: connection,
    // Adjust concurrency as needed based on API rate limits and server resources
    concurrency: 5 
});

// ✅ NEW: Event listeners for worker feedback.
imageGenerationWorker.on('completed', job => {
  console.log(`[Worker] ✅ Completed job ${job.id} for book ${job.data.bookId}, page ${job.data.pageNumber}.`);
});

imageGenerationWorker.on('failed', (job, err) => {
  console.error(`[Worker] ❌ Failed job ${job.id} for book ${job.data.bookId}, page ${job.data.pageNumber} with error: ${err.message}`);
});

console.log('✅ BullMQ queues and worker initialized.');