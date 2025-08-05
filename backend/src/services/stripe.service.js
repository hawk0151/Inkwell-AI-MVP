// backend/src/services/stripe.service.js
import stripe from 'stripe';
import { getDb } from '../db/database.js';
import { createLuluPrintJob } from './lulu.service.js';

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Creates a Stripe Checkout Session with pre-filled customer and shipping details.
 * @param {object} productDetails - Contains name, description, priceInCents.
 * @param {object} shippingAddress - The customer's full shipping address.
 * @param {string} userId - The user's ID.
 * @param {string} orderId - The internal order ID.
 * @param {string} bookId - The book's ID.
 * @param {string} bookType - The type of book ('textBook' or 'pictureBook').
 * @returns {object} The Stripe session object.
 */
export const createStripeCheckoutSession = async (productDetails, shippingAddress, userId, orderId, bookId, bookType) => {
    try {
        console.log('[Stripe Service] Creating checkout session with pre-filled address...');

        const session = await stripeClient.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            
            // FIX: The API version you are using requires 'customer_email' instead of 'customer_details'
            // We will provide the customer's email directly and let Stripe handle the rest.
            customer_email: shippingAddress.email,

            // We must still enable shipping address collection for the physical product.
            shipping_address_collection: {
                allowed_countries: ['US', 'AU', 'CA', 'GB', 'DE', 'FR'], // Add any countries you ship to
            },

            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: productDetails.name,
                            description: productDetails.description,
                        },
                        // This is the TOTAL price (retail + print + ship + fulfill + profit)
                        unit_amount: productDetails.priceInCents,
                    },
                    quantity: 1,
                },
            ],
            
            // Success and cancel URLs
            success_url: `${process.env.CLIENT_URL}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/`, // User is sent here if they cancel

            // Metadata to link the Stripe session back to our internal records
            metadata: {
                userId: userId,
                orderId: orderId,
                bookId: bookId,
                bookType: bookType
            },
        });

        console.log(`[Stripe Service] Successfully created session ${session.id}`);
        return session;

    } catch (error) {
        console.error("Error creating Stripe checkout session:", error);
        throw error; // Re-throw the error to be handled by the calling controller
    }
};

/**
 * Handles the 'checkout.session.completed' webhook event from Stripe.
 * @param {object} session - The completed checkout session object from Stripe.
 */
const handleSuccessfulCheckout = async (session) => {
    console.log("✅ Webhook received for Session ID:", session.id);

    const { userId, orderId, bookId, bookType } = session.metadata;

    if (!orderId || !userId) {
        console.error("❌ Missing required metadata in Stripe session (orderId or userId). Aborting.");
        return;
    }

    // The shipping details are now consistently available in `session.customer_details`
    // or `session.shipping_details` upon completion.
    const shippingDetails = session.shipping_details;
    const customerDetails = session.customer_details;

    if (!shippingDetails || !shippingDetails.address) {
        console.error("❌ Shipping details are missing from the completed session. Aborting.");
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
            console.warn(`⚠️ Order with ID ${orderId} not found or already processed. Webhook ignored.`);
            await client.query('COMMIT');
            return;
        }

        // Map the address from the confirmed Stripe session
        const shippingInfo = {
            name: shippingDetails.name,
            street1: shippingDetails.address.line1,
            street2: shippingDetails.address.line2,
            city: shippingDetails.address.city, // BUG FIX: Correctly access city
            postcode: shippingDetails.address.postal_code,
            country_code: shippingDetails.address.country,
            state_code: shippingDetails.address.state,
            email: customerDetails.email,
            phone_number: customerDetails.phone || 'N/A',
        };
        
        const luluOrderDetails = {
            id: order.id,
            book_title: order.book_title,
            lulu_product_id: order.lulu_product_id,
            cover_pdf_url: order.cover_pdf_url,
            interior_pdf_url: order.interior_pdf_url,
            shipping_level_selected: order.shipping_level_selected,
        };

        const luluJob = await createLuluPrintJob(luluOrderDetails, shippingInfo);
        
        const orderSqlUpdate = `UPDATE orders SET lulu_job_id = $1, status = $2, lulu_job_status = $3, stripe_charge_id = $4 WHERE id = $5`;
        await client.query(orderSqlUpdate, [luluJob.id, 'processing', luluJob.status.name, session.payment_intent, order.id]);

        console.log('✅ Order record updated with Lulu Job ID and status. Order ID:', order.id);
        await client.query('COMMIT');

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("❌ CRITICAL: Failed to process successful checkout:", error);
    } finally {
        if (client) client.release();
    }
};

/**
 * The main webhook handler that verifies the signature and routes the event.
 */
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