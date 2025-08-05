// backend/src/controllers/picturebook.controller.js

import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';
import { generateAndSavePictureBookPdf, generateCoverPdf, finalizePdfPageCount } from '../services/pdf.service.js';
// Correctly import the new helper function
import { findProductConfiguration, getCoverDimensionsFromApi, getPrintJobCosts } from '../services/lulu.service.js';
import { createStripeCheckoutSession } from '../services/stripe.service.js';
import { uploadPdfFileToCloudinary } from '../services/image.service.js';
import jsonwebtoken from 'jsonwebtoken';
import fs from 'fs/promises';

const AUD_TO_USD_EXCHANGE_RATE = 0.66;
const JWT_QUOTE_SECRET = process.env.JWT_QUOTE_SECRET || 'your_super_secret_jwt_quote_key';
const PROFIT_MARGIN_USD = 10.00;

// Helper function to get full book data
async function getFullPictureBook(bookId, userId, client) {
    const bookResult = await client.query(`SELECT * FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
    const book = bookResult.rows[0];
    if (!book) return null;

    const eventsSql = `SELECT *, uploaded_image_url, overlay_text, story_text, is_bold_story_text FROM timeline_events WHERE book_id = $1 ORDER BY page_number ASC`;
    const timelineResult = await client.query(eventsSql, [bookId]);
    book.timeline = timelineResult.rows;
    return book;
}

// All other exports (create, get, addEvent, etc.) remain the same as your provided file...
// ...
export const createPictureBook = async (req, res) => { /* ... NO CHANGES ... */ };
export const getPictureBook = async (req, res) => { /* ... NO CHANGES ... */ };
export const getPictureBooks = async (req, res) => { /* ... NO CHANGES ... */ };
export const addTimelineEvent = async (req, res) => { /* ... NO CHANGES ... */ };
export const deletePictureBook = async (req, res) => { /* ... NO CHANGES ... */ };
export const deleteTimelineEvent = async (req, res) => { /* ... NO CHANGES ... */ };
export const togglePictureBookPrivacy = async (req, res) => { /* ... NO CHANGES ... */ };
// ... (I have omitted the unchanged functions for brevity, but they should remain in your file)


/**
 * REWRITTEN AND UNIFIED CHECKOUT SESSION CREATION
 */
export const createBookCheckoutSession = async (req, res) => {
    const { bookId } = req.params;
    const { shippingAddress, selectedShippingLevel, quoteToken } = req.body;
    let client;
    let tempInteriorPdfPath = null;
    let tempCoverPdfPath = null;

    if (!shippingAddress || !selectedShippingLevel || !quoteToken) {
        return res.status(400).json({ message: "Missing shipping address, selected shipping level, or quote token." });
    }
    
    try {
        // 1. Verify Quote Token
        const decodedQuote = jsonwebtoken.verify(quoteToken, JWT_QUOTE_SECRET);
        if (decodedQuote.bookId !== bookId || decodedQuote.bookType !== 'pictureBook') {
            return res.status(400).json({ message: 'Shipping quote details do not match the selected book.' });
        }
        console.log(`[Checkout PB] Quote token verified for book ${bookId}.`);
        
        // 2. Get Book Data and Configuration
        const pool = await getDb();
        client = await pool.connect();
        const book = await getFullPictureBook(bookId, req.userId, client);
        if (!book) {
            return res.status(404).json({ message: "Project not found." });
        }
        const productConfig = findProductConfiguration(book.lulu_product_id);
        if (!productConfig) {
            return res.status(500).json({ message: `Internal Error: Product configuration not found for ID ${book.lulu_product_id}.` });
        }
        console.log(`[Checkout PB] Found product config: ${productConfig.id}`);
        
        // 3. Generate Final PDFs for Print
        console.log(`[Checkout PB] Generating final PDFs for order...`);
        const { path: interiorPath, pageCount: finalPageCount } = await generateAndSavePictureBookPdf(book, book.timeline, productConfig);
        tempInteriorPdfPath = interiorPath;
        const interiorPdfUrl = await uploadPdfFileToCloudinary(tempInteriorPdfPath, `inkwell-ai/user_${req.userId}/books`, `book_${bookId}_interior`);
        
        const coverDimensions = await getCoverDimensionsFromApi(productConfig.luluSku, finalPageCount);
        tempCoverPdfPath = await generateCoverPdf(book, productConfig, coverDimensions);
        const coverPdfUrl = await uploadPdfFileToCloudinary(tempCoverPdfPath, `inkwell-ai/user_${req.userId}/covers`, `book_${bookId}_cover`);
        console.log(`[Checkout PB] PDFs generated and uploaded successfully.`);

        // 4. Get Final Print Job Costs from Lulu
        const lineItems = [{ pod_package_id: productConfig.luluSku, page_count: finalPageCount, quantity: 1 }];
        const luluCosts = await getPrintJobCosts(lineItems, shippingAddress, selectedShippingLevel);
        
        // 5. Calculate Final Price
        if (!luluCosts?.lineItemCosts?.[0]?.total_cost_incl_tax) {
            throw new Error("Lulu cost response was missing expected print cost data.");
        }
        
        const luluPrintCostAUD = parseFloat(luluCosts.lineItemCosts[0].total_cost_incl_tax);
        const luluFulfillmentCostAUD = parseFloat(luluCosts.fulfillmentCost?.total_cost_incl_tax || 0);
        const selectedShippingOption = luluCosts.shippingOptions.find(opt => opt.level === selectedShippingLevel);
        if (!selectedShippingOption) {
            throw new Error(`The selected shipping level '${selectedShippingLevel}' was not available in the final cost calculation from Lulu.`);
        }
        const luluShippingCostAUD = parseFloat(selectedShippingOption.total_cost_incl_tax);

        const luluPrintCostUSD = parseFloat((luluPrintCostAUD * AUD_TO_USD_EXCHANGE_RATE).toFixed(2));
        const luluFulfillmentCostUSD = parseFloat((luluFulfillmentCostAUD * AUD_TO_USD_EXCHANGE_RATE).toFixed(2));
        const luluShippingCostUSD = parseFloat((luluShippingCostAUD * AUD_TO_USD_EXCHANGE_RATE).toFixed(2));
        
        const finalPriceDollars = luluPrintCostUSD + luluShippingCostUSD + luluFulfillmentCostUSD + PROFIT_MARGIN_USD;
        const finalPriceInCents = Math.round(finalPriceDollars * 100);

        console.log(`[Checkout PB] Final Pricing (USD): Print=$${luluPrintCostUSD}, Ship=$${luluShippingCostUSD}, Fulfill=$${luluFulfillmentCostUSD}, Profit=$${PROFIT_MARGIN_USD} -> TOTAL=$${finalPriceDollars.toFixed(2)}`);

        // 6. Create Pending Order in Database
        const orderId = randomUUID();
        const insertOrderSql = `
            INSERT INTO orders (
                id, user_id, book_id, book_type, book_title, lulu_product_id, status,
                total_price_usd, currency, interior_pdf_url, cover_pdf_url, actual_page_count,
                lulu_print_cost_usd, lulu_shipping_cost_usd, profit_usd,
                shipping_level_selected, lulu_fulfillment_cost_usd, order_date, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`;
        
        await client.query(insertOrderSql, [
            orderId, req.userId, bookId, 'pictureBook', book.title, productConfig.luluSku,
            'pending', parseFloat(finalPriceDollars.toFixed(2)), 'USD', interiorPdfUrl, coverPdfUrl, finalPageCount,
            luluPrintCostUSD, luluShippingCostUSD, PROFIT_MARGIN_USD,
            selectedShippingLevel, luluFulfillmentCostUSD, new Date(), new Date()
        ]);
        console.log(`[Checkout PB] Created pending order record ${orderId}.`);

        // 7. Create Stripe Session
        const session = await createStripeCheckoutSession(
            {
                name: book.title,
                description: `Custom Picture Book - ${productConfig.name}`,
                priceInCents: finalPriceInCents
            },
            shippingAddress,
            req.userId, orderId, bookId, 'pictureBook'
        );

        await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]);
        console.log(`[Checkout PB] Stripe session ${session.id} created.`);
        
        res.status(200).json({ url: session.url, sessionId: session.id });

    } catch (error) {
        console.error("[Checkout PB ERROR]", error.stack);
        const detailedError = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ message: 'Failed to create checkout session.', detailedError });
    } finally {
        if (client) client.release();
        // Clean up temp files
        if (tempInteriorPdfPath) { try { await fs.unlink(tempInteriorPdfPath); } catch (e) { console.error(`[Cleanup] Error deleting temp file: ${e.message}`); } }
        if (tempCoverPdfPath) { try { await fs.unlink(tempCoverPdfPath); } catch (e) { console.error(`[Cleanup] Error deleting temp file: ${e.message}`); } }
    }
};