// backend/src/controllers/textbook.controller.js

import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';
import { generateStoryFromApi } from '../services/gemini.service.js';
import { LULU_PRODUCT_CONFIGURATIONS, getCoverDimensionsFromApi, getPrintOptions } from '../services/lulu.service.js';
import { generateAndSaveTextBookPdf, generateCoverPdf, getPdfPageCount } from '../services/pdf.service.js';
import { uploadPdfFileToCloudinary } from '../services/image.service.js';
import { createStripeCheckoutSession } from '../services/stripe.service.js';
import path from 'path';
import fs from 'fs/promises';

let printOptionsCache = null;

async function getFullTextBook(bookId, userId, client) {
    const bookResult = await client.query(`SELECT * FROM text_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
    const book = bookResult.rows[0];
    if (!book) return null;

    const chaptersResult = await client.query(`SELECT * FROM chapters WHERE book_id = $1 ORDER BY chapter_number ASC`, [bookId]);
    book.chapters = chaptersResult.rows;
    return book;
}

export const createTextBook = async (req, res) => {
    let client;
    const { title, promptDetails, luluProductId } = req.body;
    const userId = req.userId;

    if (!title || !promptDetails || !luluProductId) {
        return res.status(400).json({ message: 'Missing title, prompt details, or product ID.' });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();

        if (!printOptionsCache) {
            printOptionsCache = await getPrintOptions();
        }
        const selectedProductConfig = printOptionsCache.find(p => p.id === luluProductId);
        if (!selectedProductConfig) {
            return res.status(404).json({ message: 'Selected product format (configuration) not found.' });
        }

        const totalChaptersForBook = 6; // Example, adjust as needed

        const bookId = randomUUID();
        const currentDate = new Date().toISOString();

        const bookSql = `INSERT INTO text_books (id, user_id, title, prompt_details, lulu_product_id, date_created, last_modified, total_chapters) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
        await client.query(bookSql, [bookId, userId, title, JSON.stringify(promptDetails), luluProductId, currentDate, currentDate, totalChaptersForBook]);

        const firstChapterText = await generateStoryFromApi({
            ...promptDetails,
            chapterNumber: 1,
            totalChapters: totalChaptersForBook,
        });

        const chapterSql = `INSERT INTO chapters (book_id, chapter_number, content, date_created) VALUES ($1, 1, $2, $3)`;
        await client.query(chapterSql, [bookId, firstChapterText, currentDate]);

        res.status(201).json({
            message: 'Project created and first chapter generated.',
            bookId: bookId,
            firstChapter: firstChapterText,
            totalChapters: totalChaptersForBook,
        });
    } catch (error) {
        console.error('Error creating text book:', error);
        res.status(500).json({ message: 'Failed to create text book project.' });
    } finally {
        if (client) client.release();
    }
};

export const generateNextChapter = async (req, res) => {
    let client;
    const { bookId } = req.params;
    const userId = req.userId;
    try {
        const pool = await getDb();
        client = await pool.connect();

        const bookResult = await client.query(`SELECT * FROM text_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        const book = bookResult.rows[0];
        if (!book) return res.status(404).json({ message: 'Book project not found.' });
        
        const chaptersResult = await client.query(`SELECT * FROM chapters WHERE book_id = $1 ORDER BY chapter_number ASC`, [bookId]);
        const chapters = chaptersResult.rows;

        const previousChaptersText = chapters.map(c => c.content).join('\n\n---\n\n');
        const nextChapterNumber = chapters.length + 1;
        const promptDetails = JSON.parse(book.prompt_details);
        const isFinalChapter = nextChapterNumber === book.total_chapters;

        const newChapterText = await generateStoryFromApi({
            ...promptDetails,
            previousChaptersText: previousChaptersText,
            chapterNumber: nextChapterNumber,
            totalChapters: book.total_chapters,
            isFinalChapter: isFinalChapter,
        });

        const currentDate = new Date().toISOString();
        const chapterSql = `INSERT INTO chapters (book_id, chapter_number, content, date_created) VALUES ($1, $2, $3, $4)`;
        await client.query(chapterSql, [bookId, nextChapterNumber, newChapterText, currentDate]);
        await client.query(`UPDATE text_books SET last_modified = $1 WHERE id = $2`, [currentDate, bookId]);

        res.status(201).json({
            message: `Chapter ${nextChapterNumber} generated.`,
            newChapter: newChapterText,
            chapterNumber: nextChapterNumber,
            isStoryComplete: isFinalChapter,
        });
    } catch (error) {
        console.error(`Error generating chapter for book ${bookId}:`, error);
        res.status(500).json({ message: 'Failed to generate next chapter.' });
    } finally {
        if (client) client.release();
    }
};

export const getTextBooks = async (req, res) => {
    let client;
    const userId = req.userId;
    try {
        const pool = await getDb();
        client = await pool.connect();

        const booksResult = await client.query(`
            SELECT tb.id, tb.title, tb.last_modified, tb.lulu_product_id, tb.is_public, tb.cover_image_url, tb.total_chapters
            FROM text_books tb
            WHERE tb.user_id = $1
            ORDER BY tb.last_modified DESC`, [userId]);
        const books = booksResult.rows;
        
        if (!printOptionsCache) {
            printOptionsCache = await getPrintOptions();
        }
        const booksWithData = books.map(book => {
            const productConfig = printOptionsCache.find(p => p.id === book.lulu_product_id);
            return { ...book, productName: productConfig ? productConfig.name : 'Unknown Book', type: 'textBook' };
        });
        res.status(200).json(booksWithData);
    } catch (error) {
        console.error('Error fetching text books:', error);
        res.status(500).json({ message: 'Failed to fetch text book projects.' });
    } finally {
        if (client) client.release();
    }
};

export const getTextBookDetails = async (req, res) => {
    let client;
    const { bookId } = req.params;
    const userId = req.userId;
    try {
        const pool = await getDb();
        client = await pool.connect();

        const book = await getFullTextBook(bookId, userId, client);
        if (!book) return res.status(404).json({ message: 'Book project not found.' });

        res.status(200).json({ book, chapters: book.chapters });
    }
    catch (error) {
        console.error(`Error fetching details for book ${bookId}:`, error);
        res.status(500).json({ message: 'Failed to fetch book details.' });
    } finally {
        if (client) client.release();
    }
};

export const createCheckoutSessionForTextBook = async (req, res) => {
    const { bookId } = req.params;
    let client;
    let tempInteriorPdfPath = null;
    let tempCoverPdfPath = null;
    let initialTempPdfPath = null;

    try {
        const pool = await getDb();
        client = await pool.connect();
        
        const book = await getFullTextBook(bookId, req.userId, client);
        if (!book) {
            return res.status(404).json({ message: 'Text book not found or access denied.' });
        }
        
        const selectedProductConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === book.lulu_product_id);
        if (!selectedProductConfig) {
            return res.status(400).json({ message: `Invalid lulu_product_id.` });
        }
        
        console.log(`Generating PDFs for book ${bookId}...`);
        
        initialTempPdfPath = await generateAndSaveTextBookPdf(book, selectedProductConfig);
        const actualInteriorPageCount = await getPdfPageCount(initialTempPdfPath);
        
        let finalPageCount = actualInteriorPageCount;
        const needsBlankPage = actualInteriorPageCount % 2 !== 0;

        if (needsBlankPage) {
            finalPageCount++;
            console.log(`WARN: Odd page count. Adjusting to ${finalPageCount} and regenerating PDF.`);
            await fs.unlink(initialTempPdfPath);
            initialTempPdfPath = null;
            tempInteriorPdfPath = await generateAndSaveTextBookPdf(book, selectedProductConfig, true);
        } else {
            tempInteriorPdfPath = initialTempPdfPath;
            initialTempPdfPath = null;
        }

        const interiorPdfUrl = await uploadPdfFileToCloudinary(tempInteriorPdfPath, `inkwell-ai/user_${req.userId}/books`, `book_${bookId}_interior`);
        console.log(`Uploaded interior PDF to Cloudinary.`);

        const luluSku = selectedProductConfig.luluSku;
        const coverDimensions = await getCoverDimensionsFromApi(luluSku, finalPageCount);
        console.log("Successfully retrieved cover dimensions from legacy API.");
        
        tempCoverPdfPath = await generateCoverPdf(book, selectedProductConfig, coverDimensions);
        
        const coverPdfUrl = await uploadPdfFileToCloudinary(tempCoverPdfPath, `inkwell-ai/user_${req.userId}/covers`, `book_${bookId}_cover`);
        console.log(`Uploaded cover PDF to Cloudinary.`);

        res.status(200).json({
            message: "SUCCESS! PDFs created and cover dimensions retrieved.",
            interiorPdfUrl,
            coverPdfUrl,
            luluSku: luluSku,
            pageCount: finalPageCount
        });

    } catch (error) {
        console.error(`Failed to create checkout session: ${error.stack}`);
        res.status(500).json({ message: 'Failed to create checkout session.', error: error.message });
    } finally {
        if (client) client.release();
        if (tempInteriorPdfPath) await fs.unlink(tempInteriorPdfPath).catch(console.error);
        if (tempCoverPdfPath) await fs.unlink(tempCoverPdfPath).catch(console.error);
        if (initialTempPdfPath) await fs.unlink(initialTempPdfPath).catch(console.error);
    }
};

export const deleteTextBook = async (req, res) => {
    let client;
    const { bookId } = req.params;
    const userId = req.userId;
    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');

        const bookResult = await client.query(`SELECT id FROM text_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        const book = bookResult.rows[0];
        if (!book) {
            return res.status(404).json({ message: 'Project not found or you are not authorized to delete it.' });
        }
        await client.query(`DELETE FROM chapters WHERE book_id = $1`, [bookId]);
        await client.query(`DELETE FROM text_books WHERE id = $1`, [bookId]);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Text book project and all its chapters have been deleted.' });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error(`Error deleting text book ${bookId}:`, error);
        res.status(500).json({ message: 'Failed to delete project.' });
    } finally {
        if (client) client.release();
    }
};