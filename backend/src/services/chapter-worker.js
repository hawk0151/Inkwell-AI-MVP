// backend/src/services/chapter-worker.js

import 'dotenv/config';
import { Worker } from 'bullmq';
// --- FIX: Added 'getDb' to the import ---
// REASON: The sequential processor needs this to get a DB client to schedule the next job.
import { getDb, initializeDb } from '../db/database.js'; 
import { redisConnection } from '../config/redisClient.js';
import { storyGenerationQueue } from './queue.service.js';
import { generateChapterWithPlan } from './generation/chapter.js';

/**
 * @fileoverview This worker processes jobs for the 'storyGenerationQueue'.
 */

const processSequentialChapterJob = async (job) => {
    const { bookId, userId, chapterNumber, guidance } = job.data;
    console.log(`[ChapterWorker] Starting sequential job for Book ${bookId}, Chapter ${chapterNumber}.`);
    
    let client;
    try {
        await generateChapterWithPlan(bookId, userId, chapterNumber, guidance);
        
        const pool = await getDb();
        client = await pool.connect();

        // --- FIX: Check the book's status BEFORE queuing the next chapter ---
        const bookResult = await client.query(`SELECT generation_status, total_chapters FROM text_books WHERE id = $1`, [bookId]);
        const book = bookResult.rows[0];

        if (!book) {
            throw new Error(`Book not found after generation: ${bookId}`);
        }

        // If the status is 'Cancelled', stop the chain.
        if (book.generation_status === 'Cancelled') {
            console.log(`[ChapterWorker] Generation for book ${bookId} was cancelled. Stopping sequence.`);
            return; // Exit without queuing the next job
        }

        const totalChapters = book.total_chapters;
        const progress = `${chapterNumber}/${totalChapters}`;
        await client.query(`UPDATE text_books SET generation_progress = $1 WHERE id = $2`, [progress, bookId]);
        console.log(`[ChapterWorker] ✅ Service completed Chapter ${progress} for Book ${bookId}.`);

        if (chapterNumber < totalChapters) {
            console.log(`[ChapterWorker] Scheduling next chapter (${chapterNumber + 1}) for Book ${bookId}.`);
            await storyGenerationQueue.add('generateSequentialChapter', { bookId, userId, chapterNumber: chapterNumber + 1, guidance: '' });
        } else {
            console.log(`[ChapterWorker] ✅ All chapters for Book ${bookId} are complete!`);
            await client.query(`UPDATE text_books SET generation_status = 'Completed', generation_progress = $1 WHERE id = $2`,[progress, bookId]);
        }
    } catch (error) {
        console.error(`[ChapterWorker] ❌ FAILED sequential job for Book ${bookId}, Chapter ${chapterNumber}:`, error.message);
        const pool = await getDb();
        client = await pool.connect();
        await client.query(`UPDATE text_books SET generation_status = 'Failed', generation_error = $1 WHERE id = $2`, [error.message, bookId]);
        throw error;
    } finally {
        if (client) client.release();
    }
};

const processSingleChapterJob = async (job) => {
    const { bookId, userId, chapterNumber, guidance } = job.data;
    console.log(`[ChapterWorker] Starting single-generation job for Book ${bookId}, Chapter ${chapterNumber}.`);
    try {
        await generateChapterWithPlan(bookId, userId, chapterNumber, guidance);
        console.log(`[ChapterWorker] ✅ Service successfully completed single generation for Chapter ${chapterNumber}.`);
    } catch (error) {
        console.error(`[ChapterWorker] ❌ FAILED single-generation job for Book ${bookId}, Chapter ${chapterNumber}:`, error.message);
        throw error;
    }
};

/**
 * Initializes and starts the BullMQ worker.
 */
const startWorker = async () => {
    console.log('[ChapterWorker] Initializing textbook chapter generation worker...');
    
    await initializeDb();
    console.log('[ChapterWorker] ✅ Database initialized successfully.');

    new Worker('storyGenerationQueue', async (job) => {
        if (job.name === 'generateSequentialChapter') {
            await processSequentialChapterJob(job);
        } else if (job.name === 'generateChapter' || job.name === 'regenerateChapter') {
            await processSingleChapterJob(job);
        }
    }, {
        connection: redisConnection,
        concurrency: 1
    });

    console.log('✅ BullMQ Textbook Chapter Worker is running.');
};

startWorker();