// backend/src/controllers/test.controller.js
import stripe from 'stripe';

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

export const createTestCheckout = async (req, res) => {
    const { bookId, userId, bookType = 'text_book' } = req.query;

    if (!bookId || !userId) {
        return res.status(400).json({ message: 'Please provide a bookId and userId as query parameters.' });
    }

    try {
        const session = await stripeClient.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            // Enable shipping address collection
            shipping_address_collection: {
                allowed_countries: ['US', 'CA', 'GB', 'AU'], // Add any countries you support
            },
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'Test Book Purchase',
                        description: `Test order for ${bookType} ID: ${bookId}`,
                    },
                    unit_amount: 3000, // Test amount: $30.00
                },
                quantity: 1,
            }],
            // Add our crucial metadata
            metadata: {
                bookId,
                userId,
                bookType,
            },
            success_url: `http://localhost:5173/success`, // Placeholder URLs
            cancel_url: `http://localhost:5173/cancel`,
        });

        // Redirect the browser to the Stripe checkout page
        res.redirect(303, session.url);

    } catch (error) {
        console.error("Error creating test checkout session:", error);
        res.status(500).json({ message: "Failed to create test checkout session." });
    }
};