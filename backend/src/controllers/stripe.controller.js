// backend/src/controllers/stripe.controller.js
import stripe from 'stripe';
import { getDb } from '../db/database.js';

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

// This is the crucial function that will link Stripe to Lulu
const handleSuccessfulCheckout = async (session) => {
    console.log("✅ Payment successful! Session ID:", session.id);
    console.log("📚 Order metadata:", session.metadata);
    
    const { bookId, bookType, userId } = session.metadata;

    if (!bookId || !bookType || !userId) {
        console.error("❌ Missing required metadata in Stripe session.");
        return;
    }

    // TODO:
    // 1. Fetch the book's full details from our database.
    // 2. Generate the PDF or gather the image/text assets for the book.
    // 3. Call the Lulu API to create a print job with these assets.
    // 4. Update the order status in our database to 'processing'.
    
    console.log(`[TODO] Trigger Lulu print job for ${bookType} with ID ${bookId}`);
};


export const stripeWebhook = (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        // The raw body is needed for verification, so we use a special parser in server.js
        event = stripeClient.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error(`❌ Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            handleSuccessfulCheckout(session);
            break;
        // ... handle other event types
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
};