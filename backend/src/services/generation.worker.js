// FIX: Load environment variables to prevent the worker process from crashing on startup.
import 'dotenv/config';

import { Worker } from 'bullmq';
// FIX: Import initializeDb along with getDb.
import { getDb, initializeDb } from '../db/database.js';
import { redisConnection } from '../config/redisClient.js';
import * as imageService from './image.service.js';

// This is the processor for a SINGLE page generation job, as created by the controller's flow.
const processSinglePageJob = async (job) => {
    const { bookId, userId, pageNumber, prompt, style } = job.data;
    console.log(`[Worker] Processing job ${job.id}: Image for book ${bookId}, page ${pageNumber}.`);
    
    let client;
    try {
        // This will now work because initializeDb() has been called.
        const pool = await getDb();
        client = await pool.connect();
        
        const bookResult = await client.query(`SELECT character_reference, story_bible FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        
        if (bookResult.rows.length === 0) {
            throw new Error(`Book not found (ID: ${bookId}) for user ${userId}.`);
        }
        const book = bookResult.rows[0];

        if (!book.character_reference?.url) {
            throw new Error(`Character reference image is missing for book ${bookId}.`);
        }

        const imageServiceOptions = {
            referenceImageUrl: book.character_reference.url,
            prompt,
            style,
            bookId,
            pageNumber,
            characterFeatures: book.story_bible?.character?.description,
            mood: book.story_bible?.tone,
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
        throw error; // Re-throw to make BullMQ mark the job as failed
    } finally {
        if (client) client.release();
    }
};

// This function wraps the worker setup in an async function to allow for proper initialization.
const startWorker = async () => {
    try {
        console.log('[Worker] Initializing services...');
        // FIX: Initialize the database connection before starting the worker.
        await initializeDb();
        console.log('[Worker] ✅ Database initialized successfully.');

        const imageGenerationWorker = new Worker('imageGenerationQueue', processSinglePageJob, { 
            connection: redisConnection,
            concurrency: 5
        });

        imageGenerationWorker.on('completed', async (job) => {
            if (job.name === 'generate-page-image' || job.name === 'generate-single-page-image') {
                console.log(`[Worker] ✅ Completed job ${job.id} for book ${job.data.bookId}, page ${job.data.pageNumber}.`);
            }
            
            if (job.name === 'prepare-for-print-flow' || job.name === 'generate-all-images-flow') {
                const { bookId, finalStatus } = job.data;
                console.log(`[Flow] ✅ Flow '${job.name}' for book ${bookId} completed successfully.`);

                let client;
                try {
                    const pool = await getDb();
                    client = await pool.connect();
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
            console.error(`[Worker] ❌ Failed job ${job.id} for book ${job.data.bookId} page ${job.data.pageNumber} with error: ${err.message}`);
            
            if (job.name === 'prepare-for-print-flow' || job.name === 'generate-all-images-flow') {
                const { bookId } = job.data;
                console.error(`[Flow] ❌ Flow '${job.name}' for book ${bookId} failed. Error: ${err.message}`);

                let client;
                try {
                    const pool = await getDb();
                    client = await pool.connect();
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

        console.log('✅ BullMQ Image Generation worker is running and listening for jobs.');
    } catch (error) {
        console.error('❌ [Worker] Failed to start worker process:', error);
        process.exit(1);
    }
};

startWorker();