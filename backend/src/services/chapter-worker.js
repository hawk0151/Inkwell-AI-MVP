// backend/services/generation/chapter.worker.js

import 'dotenv/config';
import { Worker } from 'bullmq';
import { getDb } from '../../db/database.js';
import { redisConnection } from '../../config/redisClient.js';
import { storyGenerationQueue } from '../queue.service.js';

// --- CHANGE: The primary architectural fix ---
// We now import the sophisticated, multi-step generation function from chapter.js.
// This is the service that contains our defensive bug fix.
import { generateChapterWithPlan } from './chapter.js';

// --- CHANGE: Unused import removed ---
// We no longer call the old, simple service directly from the worker.
// import { generateStoryFromApi } from '../gemini.service.js';

/**
 * @fileoverview This worker processes jobs from the 'storyGenerationQueue'.
 * Its primary role is to orchestrate the sequential and single generation of textbook chapters.
 */

/**
 * Processes a single chapter job that is part of a bulk "Generate All" sequence.
 * @param {object} job The BullMQ job object.
 */
const processSequentialChapterJob = async (job) => {
    const { bookId, userId, chapterNumber, guidance } = job.data;
    console.log(`[ChapterWorker] Starting sequential job for Book ${bookId}, Chapter ${chapterNumber}.`);

    let client;
    try {
        // --- CHANGE: Simplified Logic ---
        // All complex logic is now delegated to the `generateChapterWithPlan` service.
        // This makes the worker a "thin orchestrator" and ensures the correct, bug-fixed code is always run.
        await generateChapterWithPlan(bookId, userId, chapterNumber, guidance);

        // The worker's remaining responsibility is to manage the sequence.
        const pool = await getDb();
        client = await pool.connect();

        const bookResult = await client.query(`SELECT total_chapters FROM text_books WHERE id = $1`, [bookId]);
        const totalChapters = bookResult.rows[0]?.total_chapters;

        // Update the book's overall progress.
        const progress = `${chapterNumber}/${totalChapters}`;
        await client.query(
            `UPDATE text_books SET generation_progress = $1 WHERE id = $2`,
            [progress, bookId]
        );
        console.log(`[ChapterWorker] ✅ Service completed Chapter ${progress} for Book ${bookId}.`);

        // If the book is not yet finished, add the next chapter's job to the queue.
        if (chapterNumber < totalChapters) {
            console.log(`[ChapterWorker] Scheduling next chapter (${chapterNumber + 1}) for Book ${bookId}.`);
            await storyGenerationQueue.add('generateSequentialChapter', {
                bookId,
                userId,
                chapterNumber: chapterNumber + 1,
                guidance: ''
            });
        } else {
            // If this was the last chapter, mark the process as complete.
            console.log(`[ChapterWorker] ✅ All chapters for Book ${bookId} are complete!`);
            await client.query(
                `UPDATE text_books SET generation_status = 'Completed', generation_progress = $1 WHERE id = $2`,
                [progress, bookId]
            );
        }

    } catch (error) {
        // Robust error handling remains. If the service fails, the worker will catch it
        // and update the book's status to 'Failed', stopping the sequence.
        console.error(`[ChapterWorker] ❌ FAILED sequential job for Book ${bookId}, Chapter ${chapterNumber}:`, error.message);
        const pool = await getDb();
        client = await pool.connect();
        await client.query(
            `UPDATE text_books SET generation_status = 'Failed', generation_error = $1 WHERE id = $2`,
            [error.message, bookId]
        );
        throw error; // Re-throw to mark the job as failed in BullMQ.
    } finally {
        if (client) client.release();
    }
};

/**
 * Processes a single chapter or regeneration job. This does NOT schedule a follow-up job.
 * @param {object} job The BullMQ job object.
 */
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
 * Initializes and starts the BullMQ worker, routing jobs to the correct processor.
 */
const startWorker = async () => {
    console.log('[ChapterWorker] Initializing textbook chapter generation worker...');

    new Worker('storyGenerationQueue', async (job) => {
        // --- CHANGE: Added a router to handle different job types ---
        // This allows one worker to correctly process both "Generate All" and single-chapter jobs.
        if (job.name === 'generateSequentialChapter') {
            await processSequentialChapterJob(job);
        } else if (job.name === 'generateChapter' || job.name === 'regenerateChapter') {
            await processSingleChapterJob(job);
        }
    }, {
        connection: redisConnection,
        concurrency: 1 // Concurrency MUST be 1 to ensure sequential generation works correctly.
    });

    console.log('✅ BullMQ Textbook Chapter Worker is running.');
};

startWorker();