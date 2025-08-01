// backend/src/controllers/textbook.controller.js

import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';
import { generateStoryFromApi } from '../services/gemini.service.js';
import { getPrintOptions, getLuluSkuByConfigAndPageCount, getCoverDimensionsFromApi } from '../services/lulu.service.js';
import { generateAndSaveTextBookPdf, generateCoverPdf, getPdfPageCount } from '../services/pdf.service.js';
import { uploadPdfFileToCloudinary } from '../services/image.service.js';
import { createStripeCheckoutSession } from '../services/stripe.service.js';
import path from 'path';
import fs from 'fs/promises';

let printOptionsCache = null;

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

        const totalChaptersForBook = Math.ceil(selectedProductConfig.minPages / (selectedProductConfig.pagesPerChapter || 10));

        const bookId = randomUUID();
        const currentDate = new Date().toISOString();

        const bookSql = `INSERT INTO text_books (id, user_id, title, prompt_details, lulu_product_id, date_created, last_modified, total_chapters) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
        await client.query(bookSql, [bookId, userId, title, JSON.stringify(promptDetails), luluProductId, currentDate, currentDate, totalChaptersForBook]);

        const firstChapterText = await generateStoryFromApi({
            ...promptDetails,
            pageCount: selectedProductConfig.minPages,
            wordsPerPage: selectedProductConfig.wordsPerPage || 250,
            previousChaptersText: '',
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

        if (!printOptionsCache) {
            printOptionsCache = await getPrintOptions();
        }
        const selectedProductConfig = printOptionsCache.find(p => p.id === book.lulu_product_id);
        if (!selectedProductConfig) return res.status(404).json({ message: 'Product format for this book not found.' });

        const chaptersResult = await client.query(`SELECT * FROM chapters WHERE book_id = $1 ORDER BY chapter_number ASC`, [bookId]);
        const chapters = chaptersResult.rows;

        const previousChaptersText = chapters.map(c => c.content).join('\n\n---\n\n');
        const nextChapterNumber = chapters.length + 1;
        const promptDetails = JSON.parse(book.prompt_details);

        const isFinalChapter = nextChapterNumber === book.total_chapters;

        const newChapterText = await generateStoryFromApi({
            ...promptDetails,
            pageCount: selectedProductConfig.minPages,
            wordsPerPage: selectedProductConfig.wordsPerPage || 250,
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
            SELECT
                tb.id, tb.title, tb.last_modified, tb.lulu_product_id, tb.is_public, tb.cover_image_url, tb.total_chapters,
                u.username as author_username,
                (SELECT avatar_url FROM users WHERE id = tb.user_id) as author_avatar_url
            FROM text_books tb
            JOIN users u ON tb.user_id = u.id
            WHERE tb.user_id = $1
            ORDER BY tb.last_modified DESC
        `, [userId]);
        const books = booksResult.rows;

        if (!printOptionsCache) {
            printOptionsCache = await getPrintOptions();
        }
        const booksWithData = books.map(book => {
            const productConfig = printOptionsCache.find(p => p.id === book.lulu_product_id);
            return { ...book, productName: productConfig ? productConfig.name : 'Unknown Book', type: 'textBook', book_type: 'textBook' };
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

        const bookResult = await client.query(`SELECT *, total_chapters FROM text_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        const book = bookResult.rows[0];
        if (!book) return res.status(404).json({ message: 'Book project not found.' });

        const chaptersResult = await client.query(`SELECT chapter_number, content FROM chapters WHERE book_id = $1 ORDER BY chapter_number ASC`, [bookId]);
        const chapters = chaptersResult.rows;

        const bookDetails = {
            id: book.id,
            title: book.title,
            promptDetails: JSON.parse(book.prompt_details),
            luluProductId: book.lulu_product_id,
            lastModified: book.last_modified,
            totalChapters: book.total_chapters,
        };
        res.status(200).json({ book: bookDetails, chapters });
    }
    catch (error) {
        console.error(`Error fetching details for book ${bookId}:`, error);
        res.status(500).json({ message: 'Failed to fetch book details.' });
    } finally {
        if (client) client.release();
    }
};

export const createTextBookCheckoutSession = async (req, res) => {
    let client;
    // FIXED: All temporary path variables are declared here to ensure they are in scope for the 'finally' block.
    let tempInteriorPdfPath = null;
    let tempCoverPdfPath = null;
    let initialTempPdfPath = null;

    const { bookId } = req.params;
    const userId = req.userId;
    try {
        const pool = await getDb();
        client = await pool.connect();

        const bookResult = await client.query(`SELECT * FROM text_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        const book = bookResult.rows[0];
        if (!book) return res.status(404).json({ message: "Project not found." });

        console.log('DEBUG: Full book object from DB for checkout:', book);

        const chaptersResult = await client.query(`SELECT * FROM chapters WHERE book_id = $1 ORDER BY chapter_number ASC`, [bookId]);
        const chapters = chaptersResult.rows;

        if (chapters.length < book.total_chapters) {
            return res.status(400).json({ message: `Please generate all ${book.total_chapters} chapters before finalizing your book.` });
        }

        if (!printOptionsCache) {
            printOptionsCache = await getPrintOptions();
        }
        const selectedProductConfig = printOptionsCache.find(p => p.id === book.lulu_product_id);
        if (!selectedProductConfig) return res.status(500).json({ message: "Book product configuration not found." });

        console.log(`Generating PDFs for book ${bookId}...`);
        const tempPdfsDir = path.resolve(process.cwd(), 'tmp', 'pdfs');
        
        const userResult = await client.query(`SELECT username FROM users WHERE id = $1`, [userId]);
        const authorUsername = userResult.rows[0]?.username || 'Inkwell AI';

        initialTempPdfPath = await generateAndSaveTextBookPdf(book.title, chapters, selectedProductConfig.id, tempPdfsDir, false);
        const actualInteriorPageCount = await getPdfPageCount(initialTempPdfPath);
        console.log(`Initial interior PDF has ${actualInteriorPageCount} pages.`);
        
        let finalPageCount = actualInteriorPageCount;
        const needsBlankPage = actualInteriorPageCount % 2 !== 0;

        if (needsBlankPage) {
            finalPageCount++;
            console.log(`WARN: Odd page count detected. Adjusting to ${finalPageCount} and will regenerate PDF with a final blank page.`);
            await fs.unlink(initialTempPdfPath);
            initialTempPdfPath = null;
            tempInteriorPdfPath = await generateAndSaveTextBookPdf(book.title, chapters, selectedProductConfig.id, tempPdfsDir, true);
        } else {
            console.log("Page count is even. Using initial PDF as final version.");
            tempInteriorPdfPath = initialTempPdfPath;
            initialTempPdfPath = null;
        }

        const dynamicLuluSku = getLuluSkuByConfigAndPageCount(selectedProductConfig.id, finalPageCount);
        console.log(`Determined dynamic Lulu SKU: ${dynamicLuluSku} for final page count: ${finalPageCount}`);
        
        const interiorPdfUrl = await uploadPdfFileToCloudinary(
            tempInteriorPdfPath,
            `inkwell-ai/user_${userId}/books`,
            `book_${bookId}_interior`
        );
        console.log(`Uploaded interior PDF to Cloudinary: ${interiorPdfUrl}`);

        const coverPdfBuffer = await generateCoverPdf(book.title, authorUsername, dynamicLuluSku, finalPageCount);
        tempCoverPdfPath = path.join(tempPdfsDir, `cover_${Date.now()}_${randomUUID().substring(0,8)}.pdf`);
        await fs.writeFile(tempCoverPdfPath, coverPdfBuffer);
        console.log(`Cover PDF saved temporarily at: ${tempCoverPdfPath}`);

        const coverPdfUrl = await uploadPdfFileToCloudinary(
            tempCoverPdfPath,
            `inkwell-ai/user_${userId}/covers`,
            `book_${bookId}_cover`
        );
        console.log(`Uploaded cover PDF to Cloudinary: ${coverPdfUrl}`);

        console.log(`Creating Stripe session for text book ${bookId}...`);
        const orderId = randomUUID();

        await client.query(
            `INSERT INTO orders (id, user_id, book_id, book_type, book_title, lulu_product_id, status, total_price, interior_pdf_url, cover_pdf_url, order_date, actual_page_count) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                orderId, userId, bookId, 'textBook', book.title, dynamicLuluSku, 'pending',
                selectedProductConfig.basePrice, interiorPdfUrl, coverPdfUrl,
                new Date().toISOString(), finalPageCount
            ]
        );

        const session = await createStripeCheckoutSession(
            {
                id: dynamicLuluSku, name: selectedProductConfig.name, description: book.title,
                price: selectedProductConfig.basePrice, bookType: 'textBook', pageCount: finalPageCount
            },
            userId, orderId, bookId
        );

        await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]);

        res.status(200).json({ url: session.url });
    } catch (error) {
        console.error("Failed to create checkout session for text book:", error.stack);
        res.status(500).json({ message: "Failed to create checkout session.", error: error.message });
    } finally {
        if (client) client.release();
        const cleanupPromises = [];
        if (tempInteriorPdfPath) cleanupPromises.push(fs.unlink(tempInteriorPdfPath).catch(err => console.error(`Error cleaning up final interior PDF:`, err)));
        if (tempCoverPdfPath) cleanupPromises.push(fs.unlink(tempCoverPdfPath).catch(err => console.error(`Error cleaning up cover PDF:`, err)));
        if (initialTempPdfPath) cleanupPromises.push(fs.unlink(initialTempPdfPath).catch(err => console.error(`Error cleaning up initial temp PDF:`, err)));
        await Promise.all(cleanupPromises);
    }
};

export const toggleTextBookPrivacy = async (req, res) => {
    let client;
    const { bookId } = req.params;
    const userId = req.userId;
    const { is_public } = req.body;
    if (typeof is_public !== 'boolean') {
        return res.status(400).json({ message: 'is_public must be a boolean value.' });
    }
    try {
        const pool = await getDb();
        client = await pool.connect();

        const bookResult = await client.query(`SELECT id, user_id FROM text_books WHERE id = $1`, [bookId]);
        const book = bookResult.rows[0];
        if (!book) {
            return res.status(404).json({ message: 'Project not found.' });
        }
        if (book.user_id !== userId) {
            return res.status(403).json({ message: 'You are not authorized to edit this project.' });
        }
        await client.query(`UPDATE text_books SET is_public = $1 WHERE id = $2`, [is_public, bookId]);
        res.status(200).json({
            message: `Book status successfully set to ${is_public ? 'public' : 'private'}.`,
            is_public: is_public
        });
    } catch (err) {
        console.error("Error toggling book privacy:", err.message);
        res.status(500).json({ message: 'Failed to update project status.' });
    } finally {
        if (client) client.release();
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