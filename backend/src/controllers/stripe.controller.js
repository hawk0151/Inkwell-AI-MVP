// backend/src/controllers/stripe.controller.js

// CHANGES:
// - CRITICAL FIX: Moved createLuluPrintJob function from lulu.service.js into this controller as a private helper
//   to resolve recurring deployment import errors. This makes stripe.controller.js self-contained for print job submission.
// - Ensures proper handling of shippingInfo and Lulu API communication.
// - Added necessary helper functions (retryWithBackoff, ensureHostnameResolvable) and constants (LULU_API_BASE_URL, etc.) as private helpers.

import stripe from 'stripe';
import { getDb } from '../db/database.js';
import { getLuluAuthToken } from '../services/lulu.service.js'; // Only import auth token helper
import axios from 'axios';
import dns from 'dns/promises'; // For ensureHostnameResolvable
import { Buffer } from 'buffer'; // For basicAuth in getLuluAuthToken's dependencies

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

// --- Private Helper: retryWithBackoff (Copied from lulu.service.js) ---
async function retryWithBackoff(fn, attempts = 3, baseDelayMs = 300) {
    let attempt = 0;
    while (attempt < attempts) {
        try {
            return await fn();
        } catch (err) {
            attempt++;
            if (attempt >= attempts) {
                throw err;
            }
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            console.warn(`Retrying after error (attempt ${attempt}/${attempts}) in ${delay}ms:`, err.message || err);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

// --- Private Helper: ensureHostnameResolvable (Copied from lulu.service.js) ---
async function ensureHostnameResolvable(url) {
    try {
        const { hostname } = new URL(url);
        await dns.lookup(hostname);
        return;
    } catch (err) {
        throw new Error(`DNS resolution failed for Lulu host in URL "${url}": ${err.message}`);
    }
}

// --- Private Constant: LULU_API_BASE_URL (Copied from lulu.service.js) ---
const LULU_API_BASE_URL = process.env.LULU_API_BASE_URL || 'https://api.lulu.com/print-api/v0';

// --- Moved Function: createLuluPrintJob (from lulu.service.js, now a private helper) ---
export async function createLuluPrintJob(orderDetails, shippingInfo, shippingLevel = "MAIL") { // Exported for use by handleSuccessfulCheckout
    try {
        const token = await getLuluAuthToken(); // getLuluAuthToken is still imported from lulu.service.js
        const printJobUrl = `${LULU_API_BASE_URL.replace(/\/$/, '')}/print-jobs/`;
        await ensureHostnameResolvable(printJobUrl);
        const payload = {
            contact_email: shippingInfo.email,
            external_id: `inkwell-order-${orderDetails.id}`,
            shipping_level: shippingLevel,
            shipping_address: {
                name: shippingInfo.name,
                street1: shippingInfo.street1,
                street2: shippingInfo.street2 || '',
                city: shippingInfo.city,
                postcode: shippingInfo.postcode,
                country_code: shippingInfo.country_code,
                state_code: shippingInfo.state_code || '',
                phone_number: shippingInfo.phone_number,
                email: shippingInfo.email
            },
            line_items: [{
                title: orderDetails.book_title,
                quantity: 1,
                pod_package_id: orderDetails.lulu_product_id,
                cover: { source_url: orderDetails.cover_pdf_url },
                interior: { source_url: orderDetails.interior_pdf_url }
            }],
        };
        console.log("DEBUG: Submitting print job to Lulu...");
        const response = await retryWithBackoff(async () => {
            return await axios.post(printJobUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 60000
            });
        }, 3, 500);
        console.log("✅ Successfully created Lulu print job:", response.data.id);
        return response.data;
    } catch (error) {
        if (error.response) {
            console.error("❌ Error creating Lulu Print Job (API response):", {
                status: error.response.status,
                data: error.response.data
            });
        } else {
            console.error("❌ Error creating Lulu Print Job (network/unknown):", error.message);
        }
        throw new Error('Failed to create Lulu Print Job.');
    }
}


const handleSuccessfulCheckout = async (session) => {
    console.log("✅ Stripe Webhook received for Session ID:", session.id);

    const { orderId } = session.metadata;

    if (!orderId) {
        console.error("❌ CRITICAL: Stripe session is missing the 'orderId' in metadata.");
        return;
    }

    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');

        const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 AND status = $2', [orderId, 'pending']);
        const order = orderResult.rows[0];

        if (!order) {
            console.warn(`⚠️ Order with ID ${orderId} not found or already processed.`);
            await client.query('COMMIT');
            return;
        }
        
        console.log(`Found pending order ${order.id}. Preparing for Lulu submission.`);

        const shippingDetails = session.shipping_details;
        if (!shippingDetails || !shippingDetails.address) {
            throw new Error("Shipping details are missing from the completed session.");
        }
        const shippingInfo = {
            name: shippingDetails.name,
            street1: shippingDetails.address.line1,
            city: shippingDetails.address.city,
            postcode: shippingDetails.address.postal_code,
            country_code: shippingDetails.address.country,
            state_code: shippingDetails.address.state,
            email: session.customer_details.email,
            phone_number: session.customer_details.phone || '000-000-0000',
        };

        if (order.is_fallback) {
            console.warn(`⚠️ Order ${order.id} was created with fallback dimensions. Submitting to Lulu, but cover may require manual adjustment later.`);
        }

        const luluOrderDetails = {
            id: order.id,
            book_title: order.book_title,
            lulu_product_id: order.lulu_product_id,
            cover_pdf_url: order.cover_pdf_url,
            interior_pdf_url: order.interior_pdf_url
        };

        // Call the moved function (now a private helper)
        const luluJob = await createLuluPrintJob(luluOrderDetails, shippingInfo);

        await client.query(
            `UPDATE orders SET lulu_job_id = $1, status = $2, lulu_job_status = $3 WHERE id = $4`,
            [luluJob.id, 'processing', luluJob.status, order.id]
        );
        console.log(`✅ Order ${order.id} submitted to Lulu. Job ID: ${luluJob.id}`);

        await client.query('COMMIT');

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error(`❌ CRITICAL: Failed to process successful checkout for Order ID ${orderId}:`, error);
    } finally {
        if (client) client.release();
    }
};

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
    
    if (event.type === 'checkout.session.completed') {
        stripeClient.checkout.sessions.retrieve(event.data.object.id, {
            expand: ['customer'],
        }).then(session => {
            handleSuccessfulCheckout(session);
        }).catch(err => {
            console.error("Error retrieving full session from Stripe:", err);
        });
    } else {
        console.log(`Unhandled event type ${event.type}`);
    }
    
    res.json({ received: true });
};