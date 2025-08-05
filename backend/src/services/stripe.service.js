// backend/src/services/stripe.service.js
import stripe from 'stripe';
import { getDb } from '../db/database.js';
import { createLuluPrintJob } from '../services/lulu.service.js';
import { randomUUID } from 'crypto';

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

export const createStripeCheckoutSession = async (productDetails, shippingAddress, userId, orderId, bookId, bookType) => {
    try {
        const session = await stripeClient.checkout.sessions.create({
            payment_method_types: ['card'],
            shipping_address_collection: {
                allowed_countries: ['AU', 'US', 'CA', 'GB', 'NZ'],
            },
            // MODIFIED: Removed the incorrect top-level shipping_address parameter
            // shipping_address: { /* ... removed ... */ }, 
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: productDetails.name,
                            description: productDetails.description,
                        },
                        unit_amount: productDetails.priceInCents,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.CLIENT_URL}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/`,
            metadata: {
                userId: userId,
                orderId: orderId,
                bookId: bookId,
                bookType: bookType
            },
            // ADDED: Correct way to pre-fill customer and address details on Checkout Session
            customer_details: {
                email: shippingAddress.email,
                address: {
                    line1: shippingAddress.street1,
                    line2: shippingAddress.street2 || null, // Use null for empty optional fields
                    city: shippingAddress.city,
                    state: shippingAddress.state_code || null,
                    postal_code: shippingAddress.postcode,
                    country: shippingAddress.country_code
                },
                name: shippingAddress.name,
                phone: shippingAddress.phone_number || null
            },
        });
        return session;
    } catch (error) {
        console.error("Error creating Stripe checkout session:", error);
        throw error;
    }
};

const handleSuccessfulCheckout = async (session) => {
    console.log("✅ Webhook received for Session ID:", session.id);

    const fullSession = await stripeClient.checkout.sessions.retrieve(session.id, {
        expand: ['customer'],
    });

    const { userId, orderId, bookId, bookType } = fullSession.metadata;

    console.log("DEBUG: Stripe Session Metadata -> userId:", userId, "bookId:", bookId, "bookType:", bookType, "orderId:", orderId);

    if (!orderId || !userId) {
        console.error("❌ Missing required metadata in Stripe session (orderId or userId).");
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
        
        const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 AND status = $2', [orderId, 'pending']);
        const order = orderResult.rows[0];

        if (!order) {
            console.warn(`⚠️ Order with ID ${orderId} not found or already processed.`);
            await client.query('COMMIT');
            return;
        }

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

        const luluOrderDetails = {
            id: order.id,
            book_title: order.book_title,
            lulu_product_id: order.lulu_product_id,
            cover_pdf_url: order.cover_pdf_url,
            interior_pdf_url: order.interior_pdf_url
        };

        const luluJob = await createLuluPrintJob(luluOrderDetails, shippingInfo);
        
        const orderSqlUpdate = `UPDATE orders SET lulu_job_id = $1, status = $2, lulu_job_status = $3 WHERE id = $4`;
        await client.query(orderSqlUpdate, [luluJob.id, 'processing', luluJob.status, order.id]);

        console.log('✅ Order record updated with Lulu Job ID and status. Order ID:', order.id);

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