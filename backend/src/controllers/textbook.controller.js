import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';
import { generateStoryFromApi } from '../services/gemini.service.js';
import { LULU_PRODUCT_CONFIGURATIONS, getCoverDimensionsFromApi, getPrintOptions, getPrintJobCosts } from '../services/lulu.service.js';
import { generateAndSaveTextBookPdf, generateCoverPdf, getPdfPageCount } from '../services/pdf.service.js';
import { uploadPdfFileToCloudinary } from '../services/image.service.js';
import { createStripeCheckoutSession } from '../services/stripe.service.js';
import path from 'path';
import fs from 'fs/promises';

let printOptionsCache = null;
const PROFIT_MARGIN_USD = 10.00;


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

    if (!title || !promptDetails || !luluProductId || typeof promptDetails.pageCount === 'undefined' || typeof promptDetails.wordsPerPage === 'undefined' || typeof promptDetails.totalChapters === 'undefined') {
        console.error('Validation Error: Missing title, product ID, or required prompt details for story generation.', { title, promptDetails, luluProductId });
        return res.status(400).json({ message: 'Missing title, product ID, or required story generation parameters (pageCount, wordsPerPage, totalChapters).' });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();

        if (!printOptionsCache) {
            printOptionsCache = await getPrintOptions(); 
        }
        
        const totalChaptersForBook = promptDetails.totalChapters; 
        const selectedProductConfig = printOptionsCache.find(p => p.id === luluProductId);
        if (!selectedProductConfig) {
             console.warn(`Product configuration for ID ${luluProductId} not found on backend. Using totalChapters from frontend payload.`);
        }

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
        const isFinalChapter = nextChapterNumber >= book.total_chapters;

        if (typeof promptDetails.pageCount === 'undefined' || typeof promptDetails.wordsPerPage === 'undefined' || typeof promptDetails.totalChapters === 'undefined') {
            const errorMessage = `Missing AI generation parameters in stored promptDetails for book ${bookId}.`;
            console.error('Validation Error:', errorMessage, promptDetails);
            return res.status(500).json({ message: 'Stored book data is missing required AI parameters for chapter generation.' });
        }

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
            SELECT tb.id, tb.title, tb.last_modified, tb.lulu_product_id, tb.is_public, tb.cover_image_url, tb.total_chapters, tb.prompt_details
            FROM text_books tb
            WHERE tb.user_id = $1
            ORDER BY tb.last_modified DESC`, [userId]);
        const books = booksResult.rows;
        
        if (!printOptionsCache) {
            printOptionsCache = await getPrintOptions();
        }

        const booksWithData = books.map(book => {
            const productConfig = printOptionsCache.find(p => p.id === book.lulu_product_id);
            return { 
                ...book, 
                productName: productConfig ? productConfig.name : 'Unknown Book', 
                type: productConfig ? productConfig.type : 'textBook'
            };
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
    const { shippingAddress } = req.body;
    let client;
    let tempInteriorPdfPath = null, tempCoverPdfPath = null, initialTempPdfPath = null;

    // --- MODIFIED: Relaxed validation to allow for countries without states/provinces ---
    if (!shippingAddress || !shippingAddress.name || !shippingAddress.street1 || !shippingAddress.city || !shippingAddress.postcode || !shippingAddress.country_code) {
        return res.status(400).json({ message: 'Address must include name, street, city, postal code, and country.' });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();
        
        const book = await getFullTextBook(bookId, req.userId, client);
        if (!book) return res.status(404).json({ message: 'Text book not found.' });
        
        const selectedProductConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === book.lulu_product_id);
        if (!selectedProductConfig) return res.status(400).json({ message: 'Invalid product ID.' });
        
        console.log(`Checkout for book ${bookId}. Generating PDFs...`);
        
        initialTempPdfPath = await generateAndSaveTextBookPdf(book, selectedProductConfig);
        const actualInteriorPageCount = await getPdfPageCount(initialTempPdfPath);
        
        let finalPageCount = actualInteriorPageCount;
        const needsBlankPage = actualInteriorPageCount % 2 !== 0;

        if (needsBlankPage) {
            finalPageCount++;
            await fs.unlink(initialTempPdfPath);
            initialTempPdfPath = null;
            tempInteriorPdfPath = await generateAndSaveTextBookPdf(book, selectedProductConfig, true);
        } else {
            tempInteriorPdfPath = initialTempPdfPath;
            initialTempPdfPath = null;
        }

        const interiorPdfUrl = await uploadPdfFileToCloudinary(tempInteriorPdfPath, `inkwell-ai/user_${req.userId}/books`, `book_${bookId}_interior`);
        
        const luluSku = selectedProductConfig.luluSku;
        const coverDimensions = await getCoverDimensionsFromApi(luluSku, finalPageCount);
        tempCoverPdfPath = await generateCoverPdf(book, selectedProductConfig, coverDimensions);
        const coverPdfUrl = await uploadPdfFileToCloudinary(tempCoverPdfPath, `inkwell-ai/user_${req.userId}/covers`, `book_${bookId}_cover`);
        console.log(`PDFs uploaded to Cloudinary.`);

        console.log("Fetching dynamic costs from Lulu...");
        const lineItems = [{ pod_package_id: luluSku, page_count: finalPageCount }];
        // Ensure state_code is passed, even if it's an empty string for countries that don't need it.
        const luluShippingAddress = { ...shippingAddress, state_code: shippingAddress.state_code || '' };
        const luluCosts = await getPrintJobCosts(lineItems, luluShippingAddress);
        
        const totalProductionCost = parseFloat(luluCosts.total_cost_incl_tax);
        if (isNaN(totalProductionCost)) {
            throw new Error("Failed to parse production cost from Lulu.");
        }
        
        const finalPriceDollars = totalProductionCost + PROFIT_MARGIN_USD;
        const finalPriceInCents = Math.round(finalPriceDollars * 100);

        console.log(`Lulu Cost: $${totalProductionCost.toFixed(2)}, Profit: $${PROFIT_MARGIN_USD.toFixed(2)}, Final Price: $${finalPriceDollars.toFixed(2)} (${finalPriceInCents} cents)`);
        
        const orderId = randomUUID();
        await client.query(
            `INSERT INTO orders (id, user_id, book_id, book_type, book_title, lulu_product_id, status, total_price, interior_pdf_url, cover_pdf_url, order_date, actual_page_count, is_fallback) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12)`,
            [orderId, req.userId, bookId, 'textBook', book.title, luluSku, 'pending', finalPriceDollars.toFixed(2), interiorPdfUrl, coverPdfUrl, finalPageCount, false]
        );
        console.log(`Created pending order record ${orderId} with final price.`);

        const session = await createStripeCheckoutSession(
            { 
                name: book.title, 
                description: `Inkwell AI Custom Book - ${selectedProductConfig.name}`, 
                priceInCents: finalPriceInCents
            },
            req.userId,
            orderId,
            bookId,
            'textBook'
        );
        
        await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]);
        
        res.status(200).json({ url: session.url });

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