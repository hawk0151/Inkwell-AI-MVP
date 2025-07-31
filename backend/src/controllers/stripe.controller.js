// backend/src/controllers/stripe.controller.js
import stripe from 'stripe';
import { getDb } from '../db/database.js';
import { generateTextBookPdf, generatePictureBookPdf } from '../services/pdf.service.js';
import { uploadImageToCloudinary } from '../services/image.service.js';
import { createLuluPrintJob } from '../services/lulu.service.js';
import { randomUUID } from 'crypto';
import fs from 'fs/promises'; // NEW: Import the file system module for saving the PDF
import path from 'path';     // NEW: Import path for creating file paths

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

const handleSuccessfulCheckout = async (session) => {
    console.log("✅ Webhook received for Session ID:", session.id);

    const fullSession = await stripeClient.checkout.sessions.retrieve(session.id, {
        expand: ['customer'],
    });
    
    const { userId, bookId, bookType, luluProductId, productName } = fullSession.metadata; // Destructure all relevant metadata

    console.log("DEBUG: Stripe Session Metadata -> userId:", userId, "bookId:", bookId, "bookType:", bookType, "luluProductId:", luluProductId, "productName:", productName);

    if (!bookId || !bookType || !userId) {
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
        let pdfBuffer; // To hold the generated PDF
        let luluProductIdentifier; // To hold the specific Lulu product ID for the print job

        // --- MODIFICATION START ---
        // Adjusting bookType check to match values from controller's INSERT
        if (bookType === 'textBook') { // Changed from 'text_book' to 'textBook'
            const bookResult = await client.query(`SELECT * FROM text_books WHERE id = $1`, [bookId]);
            const book = bookResult.rows[0];
            if (!book) throw new Error(`Text book with ID ${bookId} not found in DB.`);
            
            bookTitle = book.title;
            luluProductIdentifier = book.lulu_product_id; // Get Lulu product ID from book table
            const chaptersResult = await client.query(`SELECT chapter_number, content FROM chapters WHERE book_id = $1 ORDER BY chapter_number ASC`, [bookId]);
            
            console.log(`Generating PDF for text book: ${book.title}`);
            pdfBuffer = await generateTextBookPdf(book.title, chaptersResult.rows);
            
            interiorPdfUrl = await uploadImageToCloudinary(pdfBuffer, `inkwell-ai/user_${userId}/books`);
            coverPdfUrl = book.cover_image_url || "https://www.dropbox.com/s/7bv6mg2tj0h3l0r/lulu_trade_perfect_template.pdf?dl=1&raw=1";
            
            // This update is less critical here as interior/cover URLs are passed directly to Lulu
            // but keeping it for consistency if the text_books table uses these columns
            await client.query(`UPDATE text_books SET interior_pdf_url = $1, cover_pdf_url = $2 WHERE id = $3`, [interiorPdfUrl, coverPdfUrl, bookId]);
            
        } else if (bookType === 'pictureBook') { // Changed from 'picture_book' to 'pictureBook'
            const bookResult = await client.query(`SELECT * FROM picture_books WHERE id = $1`, [bookId]);
            const book = bookResult.rows[0];
            if (!book) throw new Error(`Picture book with ID ${bookId} not found in DB.`);

            bookTitle = book.title;
            luluProductIdentifier = book.lulu_product_id; // Get Lulu product ID from book table
            
            console.log(`Generating PDF for picture book: ${book.title}`);
            pdfBuffer = await generatePictureBookPdf(bookId); // Assuming this function handles data internally
            
            interiorPdfUrl = await uploadImageToCloudinary(pdfBuffer, `inkwell-ai/user_${userId}/books`);
            coverPdfUrl = book.cover_image_url || "https://www.dropbox.com/s/7bv6mg2tj0h3l0r/lulu_trade_perfect_template.pdf?dl=1&raw=1";

            // Update picture_books table with PDF URLs
            await client.query(`UPDATE picture_books SET interior_pdf_url = $1, cover_pdf_url = $2 WHERE id = $3`, [interiorPdfUrl, coverPdfUrl, bookId]);

        } else {
             console.error(`❌ CRITICAL: Unknown book type received in webhook: ${bookType}`);
             throw new Error(`Unknown book type: ${bookType}`);
        }

        // Common luluOrderDetails creation
        luluOrderDetails = { 
            id: bookId, 
            product_name: bookTitle, 
            lulu_product_id: luluProductIdentifier, 
            cover_pdf_url: coverPdfUrl, 
            interior_pdf_url: interiorPdfUrl 
        };
        // --- MODIFICATION END ---

        // --- NEW DEBUGGING STEP 1: SAVE PDF LOCALLY ---
        // (Only enable this for local debugging, comment out for production deploys)
        // const debugPdfPath = path.join(process.cwd(), 'debug_book.pdf');
        // console.log(`--- Saving debug PDF locally to: ${debugPdfPath} ---`);
        // await fs.writeFile(debugPdfPath, pdfBuffer);
        // console.log(`--- Debug PDF saved. ---`);

        console.log("--- DEBUG: CHECKING PDF URLS (before Lulu call) ---");
        console.log("Interior PDF URL:", luluOrderDetails.interior_pdf_url);
        console.log("Cover PDF URL:", luluOrderDetails.cover_pdf_url);
        console.log("Lulu Product ID:", luluOrderDetails.lulu_product_id);
        console.log("Shipping Info:", shippingInfo);
        console.log("--------------------------------------------------");

        console.log('Submitting print job to Lulu...');
        const luluJob = await createLuluPrintJob(luluOrderDetails, shippingInfo);

        // We receive the orderId from Stripe metadata now (passed from frontend).
        // Let's assume orderId from metadata is the one we want to update.
        // OR, if you are creating order record when Stripe session is created (which is what we set up previously),
        // then you need to retrieve that orderId from the database based on the Stripe session ID.
        //
        // Let's refine the orderId here for the update, to make sure we use the one created earlier.
        const orderRecordResult = await client.query('SELECT id FROM orders WHERE stripe_session_id = $1', [fullSession.id]);
        const orderIdFromDB = orderRecordResult.rows[0]?.id;

        if (!orderIdFromDB) {
            console.error("❌ Order record not found in DB for Stripe Session ID:", fullSession.id);
            // Consider handling this by creating a new order record if it wasn't pre-created.
            // For now, throw an error to highlight the issue.
            throw new Error("Order record missing for completed session.");
        }

        const orderSqlUpdate = `UPDATE orders SET lulu_order_id = $1, status = $2, lulu_job_status = $3, updated_at = NOW() WHERE id = $4`;
        await client.query(orderSqlUpdate, [luluJob.id, 'completed', luluJob.status, orderIdFromDB]);
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

// ... stripeWebhook function remains unchanged ...
export const stripeWebhook = (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
        event = stripeClient.webhooks.constructEvent(req.body, sig, endpointSecret);
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