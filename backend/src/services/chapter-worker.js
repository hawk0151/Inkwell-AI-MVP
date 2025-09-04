import 'dotenv/config';
import { Worker } from 'bullmq';
import { getDb } from '../db/database.js';
import { redisConnection } from '../config/redisClient.js';
import { generateStoryFromApi } from '../services/gemini.service.js';
import { storyGenerationQueue } from '../services/queue.service.js'; // Ensure you export this from queue.service.js

// This is the processor for the SEQUENTIAL chapter generation flow.
const processSequentialChapterJob = async (job) => {
    const { bookId, userId, chapterNumber, guidance } = job.data;
    console.log(`[SeqWorker] Starting job for Book ${bookId}, Chapter ${chapterNumber}.`);

    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();

        // 1. Get the full book data, including the prompt details and total chapters
        const bookResult = await client.query(`SELECT * FROM text_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        if (bookResult.rows.length === 0) {
            throw new Error(`Book not found (ID: ${bookId}) for user ${userId}.`);
        }
        const book = bookResult.rows[0];
        const totalChapters = book.total_chapters;

        // 2. Get all existing chapters to build the context (previousChaptersText)
        const chaptersResult = await client.query(`SELECT content FROM chapters WHERE book_id = $1 ORDER BY chapter_number ASC`, [bookId]);
        const previousChaptersText = chaptersResult.rows.map(c => c.content).join('\n\n');

        // 3. Prepare the promptDetails object for the gemini.service call
        const promptDetails = {
            ...book.prompt_details, // Contains title, character info, genre, etc.
            previousChaptersText,
            chapterNumber,
            totalChapters,
            // Assuming these are part of your config or book details
            wordsPerPage: book.prompt_details.wordsPerPage || 250, 
            maxPageCount: book.prompt_details.maxPageCount || 100,
            wordTarget: book.prompt_details.wordTarget || { min: 800, max: 1200 }
        };

        // 4. Call your existing Gemini service to generate the chapter content
        const newChapterText = await generateStoryFromApi(promptDetails, guidance);

        // 5. Save the new chapter to the database
        await client.query(
            `INSERT INTO chapters (book_id, chapter_number, content) VALUES ($1, $2, $3)`,
            [bookId, chapterNumber, newChapterText]
        );

        // 6. Update the book's progress
        const progress = `${chapterNumber}/${totalChapters}`;
        await client.query(
            `UPDATE text_books SET generation_progress = $1 WHERE id = $2`,
            [progress, bookId]
        );
        console.log(`[SeqWorker] ✅ Saved Chapter ${progress} for Book ${bookId}.`);


        // 7. CRITICAL: Schedule the next chapter if the book is not yet complete
        if (chapterNumber < totalChapters) {
            console.log(`[SeqWorker] Scheduling next chapter (${chapterNumber + 1}) for Book ${bookId}.`);
            await storyGenerationQueue.add('generateSequentialChapter', {
                bookId,
                userId,
                chapterNumber: chapterNumber + 1,
                guidance: '' // Guidance is typically only for regeneration, so we pass an empty string
            });
        } else {
            console.log(`[SeqWorker] ✅ All chapters for Book ${bookId} are complete!`);
            await client.query(
                `UPDATE text_books SET generation_status = 'Completed' WHERE id = $1`,
                [bookId]
            );
        }

    } catch (error) {
        console.error(`[SeqWorker] ❌ FAILED job for Book ${bookId}, Chapter ${chapterNumber}:`, error.message);
        // Update the book's status in the DB to reflect the failure
        if (client) {
             await client.query(
                `UPDATE text_books SET generation_status = 'Failed', generation_error = $1 WHERE id = $2`,
                [error.message, bookId]
            );
        }
        throw error; // Re-throw to make BullMQ mark the job as failed
    } finally {
        if (client) client.release();
    }
};

// Initialize and start the worker
const startWorker = async () => {
    console.log('[SeqWorker] Initializing sequential chapter generation worker...');
    new Worker('storyGenerationQueue', processSequentialChapterJob, {
        connection: redisConnection,
        concurrency: 1 // IMPORTANT: Concurrency is 1 to ensure chapters for DIFFERENT books are still sequential and don't overload the API
    });
    console.log('✅ BullMQ Sequential Chapter Worker is running.');
};

startWorker();