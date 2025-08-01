// backend/src/controllers/stripe.controller.js

import stripe from 'stripe';
import { getDb } from '../db/database.js';
// MODIFIED: Import the NEW file-saving PDF generation functions
import { generateAndSaveTextBookPdf, generateAndSavePictureBookPdf, generateCoverPdf } from '../services/pdf.service.js';
import { uploadImageToCloudinary } from '../services/image.service.js';
import { createLuluPrintJob } from '../services/lulu.service.js';
import { randomUUID } from 'crypto';
import fs from 'fs/promises'; // Import fs.promises for async file operations
import path from 'path';     // Import path for handling file paths

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

const handleSuccessfulCheckout = async (session) => {
    console.log("✅ Webhook received for Session ID:", session.id);

    const fullSession = await stripeClient.checkout.sessions.retrieve(session.id, {
        expand: ['customer'],
    });

    const { userId, bookId, bookType, luluProductId, productName } = fullSession.metadata;

    console.log("DEBUG: Stripe Session Metadata -> userId:", userId, "bookId:", bookId, "bookType:", bookType, "luluProductId:", luluProductId, "productName:", productName);

    if (!bookId || !bookType || !userId || !luluProductId) {
        console.error("❌ Missing required metadata in Stripe session.");
        return;
    }
    if (!fullSession.shipping_details || !fullSession.shipping_details.address) {
        console.error("❌ Shipping details are missing from the completed session.");
        return;
    }

    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');

        let shippingInfo = {
            name: fullSession.shipping_details.name,
            street1: fullSession.shipping_details.address.line1,
            city: fullSession.shipping_details.address.city,
            postcode: fullSession.shipping_details.address.postal_code,
            country_code: fullSession.shipping_details.address.country,
            state_code: fullSession.shipping_details.address.state,
            email: fullSession.customer_details.email,
            phone_number: fullSession.customer_details.phone || '000-000-0000',
        };

        let bookTitle;
        let interiorPdfUrl;
        let coverPdfUrl;
        let luluOrderDetails = null;
        let pageCountForCover = 0; // To fetch page count for spine calculation

        // Define a temporary directory for PDFs
        const tempPdfsDir = path.resolve(process.cwd(), 'tmp', 'pdfs'); // Creates a 'tmp/pdfs' directory at your project root

        if (bookType === 'textBook') {
            const bookResult = await client.query(`SELECT * FROM text_books WHERE id = $1`, [bookId]);
            const book = bookResult.rows[0];
            if (!book) throw new Error(`Text book with ID ${bookId} not found in DB.`);

            bookTitle = book.title;
            
            // Re-fetch product info to get pageCount accurately as per blueprint
            const luluService = await import('../services/lulu.service.js');
            const product = luluService.PRODUCTS_TO_OFFER.find(p => p.id === luluProductId);
            if (!product) throw new Error(`Lulu product ${luluProductId} not found for cover page count.`);
            pageCountForCover = product.pageCount; // Use the product's defined pageCount

            const chaptersResult = await client.query(`SELECT chapter_number, content FROM chapters WHERE book_id = $1 ORDER BY chapter_number ASC`, [bookId]);
            console.log(`DEBUG: Generating PDF for text book: ${book.title}. Chapters count: ${chaptersResult.rows.length}`);

            // MODIFIED: Call the new file-saving function and get the file path
            const interiorPdfPath = await generateAndSaveTextBookPdf(book.title, chaptersResult.rows, luluProductId, tempPdfsDir);
            console.log(`Interior PDF saved temporarily at: ${interiorPdfPath}`);

            // TEMPORARY: Read the PDF back into a buffer for Cloudinary upload.
            // This will be refactored in a later step to directly upload the file path.
            const interiorPdfBuffer = await fs.readFile(interiorPdfPath);
            console.log(`DEBUG: Uploading Interior PDF to Cloudinary for book: ${bookId}. PDF Buffer length: ${interiorPdfBuffer ? interiorPdfBuffer.length : 'null'}`);
            interiorPdfUrl = await uploadImageToCloudinary(interiorPdfBuffer, `inkwell-ai/user_${userId}/books`);

            // --- MODIFICATION START: Generate dynamic cover PDF ---
            console.log(`DEBUG: Generating Cover PDF for text book: ${book.title} with product ID ${luluProductId} and page count ${pageCountForCover}.`);
            const coverPdfBuffer = await generateCoverPdf(book.title, book.author_name || 'Inkwell AI', luluProductId, pageCountForCover); // Assuming book has author_name or default
            coverPdfUrl = await uploadImageToCloudinary(coverPdfBuffer, `inkwell-ai/user_${userId}/covers`);
            // --- MODIFICATION END ---

            await client.query(`UPDATE text_books SET interior_pdf_url = $1, cover_pdf_url = $2 WHERE id = $3`, [interiorPdfUrl, coverPdfUrl, bookId]);

            luluOrderDetails = {
                id: bookId,
                product_name: bookTitle,
                lulu_product_id: luluProductId,
                cover_pdf_url: coverPdfUrl,
                interior_pdf_url: interiorPdfUrl
            };

        } else if (bookType === 'pictureBook') {
            const bookResult = await client.query(`SELECT * FROM picture_books WHERE id = $1`, [bookId]);
            const book = bookResult.rows[0];
            if (!book) throw new Error(`Picture book with ID ${bookId} not found in DB.`);

            bookTitle = book.title;
            // Re-fetch product info to get pageCount accurately as per blueprint
            const luluService = await import('../services/lulu.service.js');
            const product = luluService.PRODUCTS_TO_OFFER.find(p => p.id === luluProductId);
            if (!product) throw new Error(`Lulu product ${luluProductId} not found for cover page count.`);
            pageCountForCover = product.pageCount; // Use the product's defined pageCount

            const timelineResult = await client.query(`SELECT * FROM timeline_events WHERE book_id = $1 ORDER BY page_number ASC`, [bookId]);

            console.log(`DEBUG: Generating Interior PDF for picture book: ${book.title}`);
            // MODIFIED: Call the new file-saving function and get the file path
            const interiorPdfPath = await generateAndSavePictureBookPdf(book, timelineResult.rows, luluProductId, tempPdfsDir);
            console.log(`Interior PDF saved temporarily at: ${interiorPdfPath}`);

            // TEMPORARY: Read the PDF back into a buffer for Cloudinary upload.
            // This will be refactored in a later step to directly upload the file path.
            const interiorPdfBuffer = await fs.readFile(interiorPdfPath);
            console.log(`DEBUG: Uploading Interior PDF to Cloudinary for book: ${bookId}. PDF Buffer length: ${interiorPdfBuffer ? interiorPdfBuffer.length : 'null'}`);
            interiorPdfUrl = await uploadImageToCloudinary(interiorPdfBuffer, `inkwell-ai/user_${userId}/books`);

            // --- MODIFICATION START: Generate dynamic cover PDF ---
            console.log(`DEBUG: Generating Cover PDF for picture book: ${book.title} with product ID ${luluProductId} and page count ${pageCountForCover}.`);
            const coverPdfBuffer = await generateCoverPdf(book.title, book.author_name || 'Inkwell AI', luluProductId, pageCountForCover); // Assuming book has author_name or default
            coverPdfUrl = await uploadImageToCloudinary(coverPdfBuffer, `inkwell-ai/user_${userId}/covers`);
            // --- MODIFICATION END ---

            await client.query(`UPDATE picture_books SET interior_pdf_url = $1, cover_pdf_url = $2 WHERE id = $3`, [interiorPdfUrl, coverPdfUrl, bookId]);

            luluOrderDetails = {
                id: bookId,
                product_name: bookTitle,
                lulu_product_id: luluProductId,
                cover_pdf_url: coverPdfUrl,
                interior_pdf_url: interiorPdfUrl
            };

        } else {
            console.error(`❌ CRITICAL: Unknown book type received in webhook: ${bookType}`);
            throw new Error(`Unknown book type: ${bookType}`);
        }

        if (luluOrderDetails === null) {
            console.error("❌ CRITICAL: luluOrderDetails was not assigned for bookType:", bookType);
            throw new Error("Lulu order details could not be prepared for the print job.");
        }

        console.log("--- DEBUG: CHECKING PDF URLS (before Lulu call) ---");
        console.log("Interior PDF URL:", luluOrderDetails.interior_pdf_url);
        console.log("Cover PDF URL:", luluOrderDetails.cover_pdf_url);
        console.log("Lulu Product ID:", luluOrderDetails.lulu_product_id);
        console.log("Shipping Info:", shippingInfo);
        console.log("--------------------------------------------------");

        console.log('Submitting print job to Lulu...');
        // The `createLuluPrintJob` function in lulu.service.js needs to be updated
        // to accept the new structure. We will do this in a later step.
        // For now, `pageCountForCover` is still being passed for the `lulu.service.js` function.
        // The blueprint states that `createLuluPrintJob` will take the `verified page count`.
        // This `pageCountForCover` will eventually be the *actual* page count extracted from the PDF.
        const luluJob = await createLuluPrintJob(
            luluOrderDetails.lulu_product_id, // SKU
            pageCountForCover, // Placeholder: This will be replaced with actual page count from PDF
            luluOrderDetails.interior_pdf_url,
            luluOrderDetails.cover_pdf_url,
            luluOrderDetails.id, // bookId as external_id
            userId, // for customer details lookup if needed inside createLuluPrintJob
            shippingInfo // Pass the full shipping info
        );


        const orderRecordResult = await client.query('SELECT id FROM orders WHERE stripe_session_id = $1', [fullSession.id]);
        const orderIdFromDB = orderRecordResult.rows[0]?.id;

        if (!orderIdFromDB) {
            console.error("❌ Order record not found in DB for Stripe Session ID:", fullSession.id);
            throw new Error("Order record missing for completed session.");
        }

        const orderSqlUpdate = `UPDATE orders SET lulu_order_id = $1, status = $2, lulu_job_status = $3, updated_at = NOW(), lulu_job_id = $4 WHERE id = $5`;
        await client.query(orderSqlUpdate, [luluJob.id, 'completed', luluJob.status, luluJob.id, orderIdFromDB]);

        console.log('✅ Order record updated with Lulu Job ID and status. Order ID:', orderIdFromDB);

        await client.query('COMMIT');
        console.log('✅ Transaction committed successfully.');

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("❌ CRITICAL: Failed to process successful checkout:", error);
    } finally {
        if (client) client.release();
    }
};

export const stripeWebhook = (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
        const rawBody = req.rawBody || req.body;
        console.log("DEBUG: Type of rawBody for Stripe webhook:", typeof rawBody, rawBody instanceof Buffer ? " (Buffer)" : "");

        event = stripeClient.webhooks.constructEvent(rawBody, sig, endpointSecret);
    } catch (err) {
        console.error(`❌ Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    switch (event.type) {
        case 'checkout.session.completed':
            handleSuccessfulCheckout(event.data.object);
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }
    res.json({ received: true });
};