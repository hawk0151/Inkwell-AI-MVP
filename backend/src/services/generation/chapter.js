/**
 * @fileoverview This module is responsible for generating the full-text prose for a chapter.
 * It uses a structured plan from the planner module and the story's overall context to
 * ensure a consistent and coherent narrative.
 */

// --- MODIFICATION: Unused imports related to the deleted function have been removed. ---
import { generateStoryFromApi as generateStoryFromApiImport, createStoryBible } from '../gemini.service.js';
import { generateChapterPlan } from './planner.js';
import { postprocessChapterText } from './postprocess.js';
import { getDb } from '../../db/database.js';
import { unlockBook } from '../../utils/lock.util.js';
import * as luluService from '../lulu.service.js';

// New consolidated function to handle chapter generation from the worker
export const generateChapterWithPlan = async (bookId, userId, chapterNumber, guidance) => {
    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();

        const bookResult = await client.query(`SELECT * FROM text_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        const book = bookResult.rows[0];
        if (!book) throw new Error('Book project not found in database.');

        // Note: prompt_details in the DB is expected to be a stringified JSON
        const promptData = JSON.parse(book.prompt_details);
        let selectedProductConfig = luluService.findProductConfiguration(book.lulu_product_id);

        // --- FIX STARTS HERE ---
        // If no configuration is found for the book's product ID, we create a
        // safe, default configuration object to prevent a crash.
        if (!selectedProductConfig) {
            console.warn(`[Worker] ⚠️ Product configuration for ID '${book.lulu_product_id}' not found. Using safe fallback defaults for book ${bookId}.`);
            selectedProductConfig = {
                maxPageCount: 800, // Safe default, adjust if needed
                defaultPageCount: 100, // Safe default
                wordsPerPage: 300,  // Safe default
                wordTarget: { min: 800, max: 1200 }, // Safe default
                totalChapters: book.total_chapters || 15 // Use book's total_chapters if available, else a safe default
            };
        }
        // --- FIX ENDS HERE ---

        const totalChaptersForBook = book.total_chapters || selectedProductConfig.totalChapters;

        const chaptersResult = await client.query(`SELECT * FROM chapters WHERE book_id = $1 AND chapter_number < $2 ORDER BY chapter_number ASC`, [bookId, chapterNumber]);
        const previousChaptersText = chaptersResult.rows.map(c => c.content).join('\n\n---\n\n');

        console.log(`[Worker] Starting generation for Chapter ${chapterNumber} of book ${bookId}`);

        const effectiveMaxPageCount = Math.min(
            selectedProductConfig.maxPageCount,
            Math.max(selectedProductConfig.defaultPageCount, Math.ceil(selectedProductConfig.defaultPageCount * 1.5))
        );

        const apiPromptDetails = {
            ...promptData,
            previousChaptersText: '', 
            wordsPerPage: selectedProductConfig.wordsPerPage,
            totalChapters: totalChaptersForBook,
            maxPageCount: effectiveMaxPageCount,
            wordTarget: selectedProductConfig.wordTarget,
            chapterNumber: chapterNumber,
            isFinalChapter: chapterNumber === totalChaptersForBook,
            guidance: guidance,
        };

        const storyBible = await createStoryBible(previousChaptersText);
        const chapterPlan = await generateChapterPlan(apiPromptDetails, storyBible);

        const rawChapterText = await generateStoryFromApiImport({
            ...apiPromptDetails,
            previousChaptersText: previousChaptersText,
            storyBible: storyBible,
            chapterPlan: chapterPlan,
        }, guidance);

        const postprocessedChapterText = await postprocessChapterText(rawChapterText, apiPromptDetails);
        const currentDate = new Date().toISOString();

        const upsertChapterSql = `
            INSERT INTO chapters (book_id, chapter_number, content, date_created)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (book_id, chapter_number)
            DO UPDATE SET content = EXCLUDED.content, date_created = EXCLUDED.date_created;
        `;
        
        await client.query(upsertChapterSql, [bookId, chapterNumber, postprocessedChapterText, currentDate]);

        console.log(`[Worker] Chapter ${chapterNumber} of book ${bookId} was successfully generated/regenerated and saved.`);

    } catch (error) {
        console.error(`[Worker] Error processing job for book ${bookId}, chapter ${chapterNumber}:`, error);
        throw error; // Re-throw the error so the job queue knows it failed
    } finally {
        await unlockBook(bookId); // Ensure the book is unlocked even if an error occurs
        if (client) client.release();
    }
};



/**
 * --- DEPRECATED FUNCTION REMOVED ---
 * The 'generateChapterText' function was previously here. It has been
 * removed as it contained flawed logic and an outdated prompt template.
 * All chapter generation now correctly flows through 'generateChapterWithPlan'.
 */