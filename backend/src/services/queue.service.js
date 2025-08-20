import { Queue, Worker, FlowProducer } from 'bullmq'; // MODIFIED: Added FlowProducer
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

// NEW: Export a FlowProducer for the controller to use.
export const flowProducer = new FlowProducer({
    connection: connection,
});


// This is your existing worker logic, which is correct for processing individual page jobs.
const imageGenerationWorker = new Worker('imageGenerationQueue', async job => {
    // This worker now handles jobs from two different flows:
    // 'generate-single-page-image' and 'generate-page-image'
    // Ensure the data passed from the controller matches what's needed here.
    const { bookId, userId, pageNumber, prompt } = job.data;
    console.log(`[Worker] Processing job ${job.id}: Image for book ${bookId}, page ${pageNumber}.`);
    
    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();
        
        const bookResult = await client.query(`SELECT character_reference, story_bible FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        
        if (bookResult.rows.length === 0) {
            throw new Error(`Book not found (ID: ${bookId}) for user ${userId}.`);
        }
        const book = bookResult.rows[0];

        if (!book.character_reference?.url) {
            throw new Error(`Character reference image is missing for book ${bookId}. Cannot process job.`);
        }

        const imageServiceOptions = {
            referenceImageUrl: book.character_reference.url,
            prompt: prompt,
            style: book.story_bible?.art?.style || 'watercolor',
            characterFeatures: book.story_bible?.character?.description,
            mood: book.story_bible?.tone,
            bookId,
            pageNumber
        };
        
        const { previewUrl, printUrl } = await imageService.generateImageFromReference(imageServiceOptions);

        const updateSql = `
            UPDATE timeline_events 
            SET image_url = $1, image_url_preview = $2, image_url_print = $3, uploaded_image_url = NULL
            WHERE book_id = $4 AND page_number = $5
        `;
        await client.query(updateSql, [previewUrl, previewUrl, printUrl, bookId, pageNumber]);

    } catch (error) {
        console.error(`[Worker] FAILED job ${job.id} for page ${pageNumber}:`, error.message);
        throw error;
    } finally {
        if (client) client.release();
    }
}, { 
    connection: connection,
    concurrency: 5 
});


// --- MODIFIED: Upgraded event listeners to handle flow completion ---

imageGenerationWorker.on('completed', async (job) => {
    console.log(`[Worker] ✅ Completed job ${job.id} for book ${job.data.bookId}, page ${job.data.pageNumber}.`);
    
    // Check if the completed job is a parent flow job
    if (job.name === 'prepare-for-print-flow' || job.name === 'generate-all-images-flow') {
        const { bookId, finalStatus } = job.data;
        console.log(`[Flow] ✅ Flow '${job.name}' for book ${bookId} completed successfully.`);

        let client;
        try {
            const pool = await getDb();
            client = await pool.connect();
            // All children are done, so now we can safely update the book's status.
            await client.query(
                `UPDATE picture_books SET book_status = $1, last_modified = NOW() WHERE id = $2`,
                [finalStatus || 'complete', bookId]
            );
            console.log(`[Flow] ✅ Updated book ${bookId} status to '${finalStatus}'.`);
        } catch (err) {
            console.error(`[Flow] ❌ DB Error after completing flow for book ${bookId}:`, err);
        } finally {
            if (client) client.release();
        }
    }
});

imageGenerationWorker.on('failed', async (job, err) => {
    console.error(`[Worker] ❌ Failed job ${job.id} for book ${job.data.bookId}, page ${job.data.pageNumber} with error: ${err.message}`);
    
    // Check if the failed job is a parent flow job
    if (job.name === 'prepare-for-print-flow' || job.name === 'generate-all-images-flow') {
        const { bookId } = job.data;
        console.error(`[Flow] ❌ Flow '${job.name}' for book ${bookId} failed. Error: ${err.message}`);

        let client;
        try {
            const pool = await getDb();
            client = await pool.connect();
            // Update the book's status to reflect the failure.
            await client.query(
                `UPDATE picture_books SET book_status = 'error', last_modified = NOW() WHERE id = $1`,
                [bookId]
            );
            console.log(`[Flow] ❌ Updated book ${bookId} status to 'error'.`);
        } catch (dbErr) {
            console.error(`[Flow] ❌ DB Error after failing flow for book ${bookId}:`, dbErr);
        } finally {
            if (client) client.release();
        }
    }
});

console.log('✅ BullMQ queues and worker initialized.');