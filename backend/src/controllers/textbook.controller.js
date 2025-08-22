/**
 * @fileoverview Controller functions for textbook projects.
 */
import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';
import { callGeminiAPI } from '../services/gemini.service.js';
import { storyGenerationQueue } from '../services/queue.service.js';
import * as luluService from '../services/lulu.service.js';
import * as pdfService from '../services/pdf.service.js';
import * as fileHostService from '../services/fileHost.service.js';
import * as stripeService from '../services/stripe.service.js';
import { uploadImageToCloudinary } from '../services/image.service.js';
import jsonwebtoken from 'jsonwebtoken';
import fs from 'fs/promises';
import { lockBook, unlockBook } from '../utils/lock.util.js';
import { validatePrompt } from '../utils/prompt.util.js';
// Add this helper function after your imports
const emitProgress = (req, bookId, progressData) => {
    if (req.io) {
        // Emit the event to a specific "room" named after the bookId.
        req.io.to(bookId).emit('checkout_progress', progressData);
        console.log(`[Socket.IO] Emitted progress to room ${bookId}: ${progressData.message}`);
    }
};
const PROFIT_MARGIN_AUD = 15.00;
const JWT_QUOTE_SECRET = process.env.JWT_QUOTE_SECRET || 'your_super_secret_jwt_quote_key_please_change_this_in_production';

// --- Helper function for page count estimation ---
const calculateEstimatedPages = (book, productConfig) => {
    if (!book.chapters || book.chapters.length === 0) {
        return productConfig.minPageCount; // Default to min if no content
    }
    const totalWords = book.chapters.reduce((sum, chap) => {
        const words = chap.content ? chap.content.split(' ').length : 0;
        return sum + words;
    }, 0);
    
    // Add 1 page for the title page
    const contentPages = Math.ceil(totalWords / (productConfig.wordsPerPage || 250));
    return 1 + contentPages; 
};


export const uploadTextbookCover = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;

    if (!req.file) {
        return res.status(400).json({ message: 'No image file provided.' });
    }
    
    const MAX_FILE_SIZE_MB = 9;
    if (req.file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        return res.status(413).json({ message: `File size cannot exceed ${MAX_FILE_SIZE_MB}MB.` });
    }

    let client;
    try {
        const folder = `inkwell-ai/user_${userId}/textbook_covers`;
        const publicIdPrefix = `cover_${bookId}`;
        const imageUrl = await uploadImageToCloudinary(req.file.buffer, folder, publicIdPrefix);
        const pool = await getDb();
        client = await pool.connect();
        const updateQuery = `
            UPDATE text_books
            SET user_cover_image_url = $1, last_modified = CURRENT_TIMESTAMP
            WHERE id = $2 AND user_id = $3
        `;
        const result = await client.query(updateQuery, [imageUrl, bookId, userId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Book not found or you do not have permission to edit it.' });
        }
        res.status(200).json({ 
            message: 'Cover image uploaded successfully.',
            imageUrl: imageUrl 
        });
    } catch (error) {
        console.error(`Error uploading cover for textbook ${bookId}:`, error);
        res.status(500).json({ message: 'Failed to upload cover image.' });
    } finally {
        if (client) {
            client.release();
        }
    }
};

export const deleteTextbookCover = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    let client;

    try {
        const pool = await getDb();
        client = await pool.connect();

        const updateQuery = `
            UPDATE text_books
            SET user_cover_image_url = NULL, last_modified = CURRENT_TIMESTAMP
            WHERE id = $1 AND user_id = $2
        `;
        const result = await client.query(updateQuery, [bookId, userId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Book not found or you do not have permission to edit it.' });
        }

        res.status(200).json({ message: 'Custom cover deleted successfully.' });
    } catch (error) {
        console.error(`Error deleting cover for textbook ${bookId}:`, error);
        res.status(500).json({ message: 'Failed to delete custom cover image.' });
    } finally {
        if (client) {
            client.release();
        }
    }
};

export const saveBackCoverBlurb = async (req, res) => {
    const { bookId } = req.params;
    const { blurb } = req.body;
    const userId = req.userId;

    if (typeof blurb !== 'string') {
        return res.status(400).json({ message: 'Blurb must be a string.' });
    }
    const sanitizedBlurb = blurb.trim().substring(0, 2000); // Increased limit for blurb

    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();

        const updateQuery = `
            UPDATE text_books
            SET back_cover_blurb = $1, last_modified = CURRENT_TIMESTAMP
            WHERE id = $2 AND user_id = $3
        `;
        const result = await client.query(updateQuery, [sanitizedBlurb, bookId, userId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Book not found or you do not have permission to edit it.' });
        }

        res.status(200).json({ message: 'Back cover blurb saved successfully.', blurb: sanitizedBlurb });
    } catch (error) {
        console.error(`Error saving back cover blurb for book ${bookId}:`, error);
        res.status(500).json({ message: 'Failed to save back cover blurb.' });
    } finally {
        if (client) {
            client.release();
        }
    }
};

async function getFullTextBook(bookId, userId, client) {
    const bookResult = await client.query(`SELECT *, back_cover_blurb FROM text_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
    const book = bookResult.rows[0];
    if (!book) return null;

    const chaptersResult = await client.query(`SELECT * FROM chapters WHERE book_id = $1 ORDER BY chapter_number ASC`, [bookId]);
    book.chapters = chaptersResult.rows;
    return book;
}

export const createTextBook = async (req, res) => {
    let client;
    const { promptData, luluProductId } = req.body;
    const userId = req.userId;

    console.log('[Textbook Controller] Received promptData for new book:', JSON.stringify(promptData, null, 2));
    
    if (!promptData || !promptData.bookTitle || !luluProductId) {
        return res.status(400).json({ message: 'Book title and product ID are required.' });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');

        const selectedProductConfig = luluService.findProductConfiguration(luluProductId);
        if (!selectedProductConfig) {
            throw new Error(`Product configuration with ID ${luluProductId} not found.`);
        }
        const totalChaptersForBook = selectedProductConfig.totalChapters;
        const bookId = randomUUID();
        const currentDate = new Date().toISOString();

        let dynamicBugName = '';
        const conflictGenres = ['adventure', 'fantasy', 'sci-fi', 'horror', 'mystery', 'thriller'];
        
        if (promptData.genre && conflictGenres.includes(promptData.genre.toLowerCase())) {
            const bugReplacementPrompt = `
You are a creative writer. Based on a story in the ${promptData.genre} genre about a character named "${promptData.mainCharacter.name}", generate a single, creative name or phrase that could be used to refer to a central mystery, a powerful item, or a mysterious antagonist.
DO NOT use any markdown, conversational text, or explanations. Just provide the name.
Examples:
Fantasy: The Shadowed One
Sci-Fi: The Cosmic Anomaly
Horror: The Whispering Shade
Your response:`.trim();
            const rawReplacementName = await callGeminiAPI(bugReplacementPrompt, 'gemini-1.5-flash-latest');
            dynamicBugName = rawReplacementName.trim().replace(/^"|"$/g, '');
            console.log(`[Textbook Controller] Dynamic bug name generated for ${promptData.genre} genre: ${dynamicBugName}`);
        } else {
            console.log(`[Textbook Controller] Skipping dynamic bug name generation for genre: ${promptData.genre}`);
        }
        
        const newPromptData = { ...promptData, dynamicBugName };
        
        const bookSql = `INSERT INTO text_books (id, user_id, title, prompt_details, lulu_product_id, date_created, last_modified, total_chapters) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
        await client.query(bookSql, [bookId, userId, newPromptData.bookTitle, JSON.stringify(newPromptData), luluProductId, currentDate, currentDate, totalChaptersForBook]);

        console.log(`[Textbook Controller] Book record created. Submitting Chapter 1 generation job for book ${bookId}.`);
        const jobData = { bookId, userId, chapterNumber: 1, guidance: '' };
        await storyGenerationQueue.add('generateChapter', jobData, {
            jobId: `book-${bookId}-chapter-1`
        });

        await client.query('COMMIT');

        res.status(202).json({
            message: 'Project created successfully. The first chapter is being generated in the background.',
            bookId: bookId,
            totalChapters: totalChaptersForBook,
        });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error creating text book:', error);
        res.status(500).json({ message: 'Failed to create text book project.' });
    } finally {
        if (client) client.release();
    }
};

export const generateNextChapter = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    let client = null; // FIX: Declare client outside the try block

    const isLocked = await lockBook(bookId);
    if (!isLocked) {
        return res.status(409).json({ message: 'A chapter is already being generated. Please wait.' });
    }

    try {
        const pool = await getDb();
        client = await pool.connect(); // FIX: Assign the connection here
        const book = await getFullTextBook(bookId, userId, client);

        if (!book) {
            await unlockBook(bookId);
            return res.status(404).json({ message: 'Book project not found.' });
        }

        const nextChapterNumber = book.chapters.length + 1;
        const totalChaptersForBook = book.total_chapters;

        if (nextChapterNumber > totalChaptersForBook) {
            await unlockBook(bookId);
            return res.status(400).json({ message: 'All chapters for this book have already been generated.' });
        }

        const jobData = { bookId, userId, chapterNumber: nextChapterNumber, guidance: '' };
        await storyGenerationQueue.add('generateChapter', jobData, {
            jobId: `book-${bookId}-chapter-${nextChapterNumber}`
        });

        res.status(202).json({
            message: `Chapter ${nextChapterNumber} generation job submitted.`,
            chapterNumber: nextChapterNumber,
        });
    } catch (error) {
        console.error(`Error submitting chapter generation job for book ${bookId}:`, error);
        await unlockBook(bookId);
        res.status(500).json({ message: 'Failed to submit next chapter generation job.' });
    } finally {
        if (client) {
            client.release();
        }
    }
};

export const regenerateChapter = async (req, res) => {
    const { bookId, chapterNumber: chapterNumberStr } = req.params;
    const { guidance } = req.body;
    const userId = req.userId;
    const chapterNumber = parseInt(chapterNumberStr);
    
    // START FIX: Use the new, robust lock utility
    const isLocked = await lockBook(bookId);
    if (!isLocked) {
        return res.status(409).json({ message: 'A chapter is already being generated. Please wait.' });
    }
    // END FIX

    try {
        const pool = await getDb();
        const client = await pool.connect();
        const book = await getFullTextBook(bookId, userId, client);
        // FIX: The original code released the client here.
        // client.release();

        if (!book) {
            await unlockBook(bookId);
            return res.status(404).json({ message: 'Book project not found.' });
        }

        const latestChapterNumber = book.chapters.length;
        if (chapterNumber !== latestChapterNumber) {
            await unlockBook(bookId);
            return res.status(400).json({ message: 'You can only regenerate the most recent chapter.' });
        }

        const jobData = {
            bookId,
            userId,
            chapterNumber,
            guidance,
        };
        
        await storyGenerationQueue.add('regenerateChapter', jobData, {
            jobId: `book-${bookId}-chapter-${chapterNumber}-regen-${Date.now()}`
        });

        res.status(202).json({
            message: `Chapter ${chapterNumber} regeneration job submitted.`,
            chapterNumber: chapterNumber,
        });
    } catch (error) {
        console.error(`Error submitting chapter regeneration job for book ${bookId}:`, error);
        // Ensure the lock is released on error
        await unlockBook(bookId);
        res.status(500).json({ message: 'Failed to submit chapter regeneration job.' });
    }
    // START FIX: Add a finally block to ensure the database client is always released.
    finally {
        if (client) {
            client.release();
        }
    }
    // END FIX
};

export const getTextBooks = async (req, res) => {
    let client;
    const userId = req.userId;
    try {
        const pool = await getDb();
        client = await pool.connect();
        const booksResult = await client.query(`
SELECT tb.id, tb.title, tb.last_modified, tb.lulu_product_id, tb.is_public, tb.cover_image_url, tb.total_chapters, tb.prompt_details, tb.user_cover_image_url
FROM text_books tb
WHERE tb.user_id = $1
ORDER BY tb.last_modified DESC`, [userId]);
        const books = booksResult.rows;

        const booksWithChapters = await Promise.all(books.map(async (book) => {
            const chaptersResult = await client.query(`SELECT chapter_number FROM chapters WHERE book_id = $1`, [book.id]);
            const productConfig = luluService.findProductConfiguration(book.lulu_product_id);
            return {
                ...book,
                chapters: chaptersResult.rows,
                productName: productConfig ? productConfig.name : 'Unknown Book',
                type: 'textBook'
            };
        }));
        
        res.status(200).json(booksWithChapters);
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
    try {
        const pool = await getDb();
        client = await pool.connect();
        const bookResult = await client.query(`SELECT tb.*, tb.back_cover_blurb FROM text_books tb WHERE tb.id = $1 AND tb.user_id = $2`, [bookId, req.userId]);
        const book = bookResult.rows[0];
        if (!book) return res.status(404).json({ message: 'Book project not found.' });

        const chaptersResult = await client.query(`SELECT * FROM chapters WHERE book_id = $1 ORDER BY chapter_number ASC`, [bookId]);
        book.chapters = chaptersResult.rows;

        res.status(200).json({ book, chapters: book.chapters });
    }
    catch (error) {
        console.error(`Error fetching details for book ${bookId}:`, error);
        res.status(500).json({ message: 'Failed to fetch book details.' });
    } finally {
        if (client) client.release();
    }
};

export const getPreviewPdf = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    let client;
    let tempPdfPath = null;
    try {
        const pool = await getDb();
        client = await pool.connect();
        const book = await getFullTextBook(bookId, userId, client);
        if (!book) {
            return res.status(404).json({ message: 'Book not found.' });
        }
        const selectedProductConfig = luluService.findProductConfiguration(book.lulu_product_id);
        if (!selectedProductConfig) {
            return res.status(400).json({ message: 'Product configuration for this book not found.' });
        }

        const estimatedPages = calculateEstimatedPages(book, selectedProductConfig);
        console.log(`[Preview PDF] Generating preview for book: ${book.title} with estimated page count: ${estimatedPages}`);
        
        // --- FIX: Pass 'true' as the third argument to enable the watermark ---
        const { path } = await pdfService.generateAndSaveTextBookPdf(book, selectedProductConfig, true);
        
        tempPdfPath = path;
        const publicId = `preview_textbook_${bookId}_${Date.now()}`;
        const previewUrl = await fileHostService.uploadPreviewFile(tempPdfPath, publicId);
        res.status(200).json({ previewUrl });

    } catch (error) {
        console.error(`[Preview PDF ERROR] ${error.message}`, { stack: error.stack });
        res.status(500).json({ message: 'Failed to generate PDF preview.' });
    } finally {
        if (client) client.release();
        if (tempPdfPath) {
            fs.unlink(tempPdfPath).catch(e => console.error(`[Cleanup] Error deleting temp preview PDF: ${e.message}`));
        }
    }
};

// Replace your existing createCheckoutSessionForTextBook function with this one

export const createCheckoutSessionForTextBook = async (req, res) => {
    const { bookId } = req.params;
    const { shippingAddress, selectedShippingLevel, quoteToken } = req.body;
    let client;
    let tempInteriorPdfPath = null;
    let tempCoverPdfPath = null;

    if (!shippingAddress || !selectedShippingLevel || !quoteToken) {
        return res.status(400).json({ message: "Missing shipping address, selected shipping level, or quote token." });
    }

    try {
        let decodedQuote;
        try {
            decodedQuote = jsonwebtoken.verify(quoteToken, JWT_QUOTE_SECRET);
        } catch (tokenError) {
            console.error('[Checkout] Quote token verification failed:', tokenError.message);
            return res.status(403).json({ message: 'Invalid or expired shipping quote. Please get a new quote.' });
        }
        if (decodedQuote.bookId !== bookId || decodedQuote.bookType !== 'textBook') {
            return res.status(400).json({ message: 'Shipping quote details do not match the selected book.' });
        }

        const pool = await getDb();
        client = await pool.connect();
        const book = await getFullTextBook(bookId, req.userId, client);
        if (!book) return res.status(404).json({ message: 'Text book not found.' });
        
        const selectedProductConfig = luluService.findProductConfiguration(book.lulu_product_id);
        if (!selectedProductConfig) {
            return res.status(400).json({ message: 'Invalid product ID.' });
        }

        const estimatedPages = calculateEstimatedPages(book, selectedProductConfig);
        if (estimatedPages < selectedProductConfig.minPageCount || estimatedPages > selectedProductConfig.maxPageCount) {
            return res.status(400).json({ 
                message: `This book cannot be printed because its length is outside the allowed range for the selected format.` 
            });
        }
        
        // FIX: Start emitting progress updates
        emitProgress(req, bookId, { step: 1, totalSteps: 6, message: 'Generating your book pages...' });
        const { pageCount: actualFinalPageCount, path: interiorPath } = await pdfService.generateAndSaveTextBookPdf(book, selectedProductConfig, estimatedPages);
        tempInteriorPdfPath = interiorPath;
        
        emitProgress(req, bookId, { step: 2, totalSteps: 6, message: 'Creating your cover...' });
        const coverDimensions = await luluService.getCoverDimensions(selectedProductConfig.luluSku, actualFinalPageCount);
        const { path: coverPath } = await pdfService.generateTextbookCoverPdf(book, selectedProductConfig, coverDimensions);
        tempCoverPdfPath = coverPath;

        emitProgress(req, bookId, { step: 3, totalSteps: 6, message: 'Uploading files for printing...' });
        const interiorPdfUrl = await fileHostService.uploadPrintFile(tempInteriorPdfPath, `interior_${bookId}_${Date.now()}`);
        const coverPdfUrl = await fileHostService.uploadPrintFile(tempCoverPdfPath, `cover_${bookId}_${Date.now()}`);
        
        emitProgress(req, bookId, { step: 4, totalSteps: 6, message: 'Validating files with our printer...' });
        const [interiorValidation, coverValidation] = await Promise.all([
            luluService.validateInteriorFile(interiorPdfUrl, selectedProductConfig.luluSku),
            luluService.validateCoverFile(coverPdfUrl, selectedProductConfig.luluSku, actualFinalPageCount)
        ]);
        
        if (!['VALIDATED', 'NORMALIZED'].includes(interiorValidation.status) || !['VALIDATED', 'NORMALIZED'].includes(coverValidation.status)) {
            const validationErrors = [...(interiorValidation.errors || []), ...(coverValidation.errors || [])];
            console.error('[Checkout TB ERROR] Lulu file validation failed:', validationErrors);
            emitProgress(req, bookId, { error: 'File validation failed. Please check your book content.' });
            return res.status(400).json({
                message: 'One or more of your files failed Lulu’s validation.',
                detailedError: 'Please check your book content for issues and try again.',
                validationErrors
            });
        }
        
        console.log('[Checkout TB] ✅ Both interior and cover files validated successfully!');
        emitProgress(req, bookId, { step: 5, totalSteps: 6, message: 'Calculating final costs...' });
        
        const selectedOption = decodedQuote.shippingOptions.find(opt => opt.level === selectedShippingLevel);
        if (!selectedOption) {
            return res.status(400).json({ message: `The selected shipping option is not valid for this quote. Please refresh and try again.` });
        }

        const basePriceAUD = decodedQuote.basePrice;
        const shippingCostAUD = selectedOption.cost;
        const luluTotalCostAUD = basePriceAUD + shippingCostAUD;
        const finalPriceAUD = luluTotalCostAUD + PROFIT_MARGIN_AUD;
        const finalPriceInCents = Math.round(finalPriceAUD * 100);

        const orderId = randomUUID();
        const insertOrderSql = `
            INSERT INTO orders (
                id, user_id, book_id, book_type, book_title, lulu_product_id, status,
                total_price, currency, actual_page_count, shipping_level_selected,
                interior_pdf_url, cover_pdf_url, order_date, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, 'AUD', $8, $9, $10, $11, $12, $13)`;
        await client.query(insertOrderSql, [
            orderId, req.userId, bookId, 'textBook', book.title, selectedProductConfig.luluSku,
            parseFloat(finalPriceAUD.toFixed(2)), actualFinalPageCount,
            selectedShippingLevel, interiorPdfUrl, coverPdfUrl, new Date(), new Date()
        ]);
        
        emitProgress(req, bookId, { step: 6, totalSteps: 6, message: 'Redirecting to payment...' });
        const session = await stripeService.createStripeCheckoutSession(
            {
                name: book.title,
                description: `Custom Text Book - ${selectedProductConfig.name}`,
                priceInCents: finalPriceInCents
            },
            shippingAddress, req.userId, orderId, bookId, 'textBook'
        );
        
        await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]);
        res.status(200).json({ url: session.url, sessionId: session.id });

    } catch (error) {
        console.error("[Checkout TB ERROR]", error);
        const detailedError = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        emitProgress(req, bookId, { error: 'An unexpected error occurred. Please try again.' });
        res.status(500).json({ message: 'Failed to create checkout session.', detailedError });
    } finally {
        if (client) client.release();
        if (tempInteriorPdfPath) { try { await fs.unlink(tempInteriorPdfPath); } catch (e) { console.error(`[Cleanup] Error deleting temp interior PDF: ${e.message}`); } }
        if (tempCoverPdfPath) { try { await fs.unlink(tempCoverPdfPath); } catch (e) { console.error(`[Cleanup] Error deleting temp cover PDF: ${e.message}`); } }
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
            await client.query('ROLLBACK');
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