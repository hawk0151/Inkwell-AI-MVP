// backend/src/services/stripe.service.js
import stripe from 'stripe';

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

        const clientUrl = process.env.CLIENT_URL || 'localhost:5173';
        const baseUrl = clientUrl.startsWith('http') ? clientUrl : `http://${clientUrl}`;

        const session = await stripeClient.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            
            customer_email: shippingAddress.email,

            shipping_address_collection: {
                allowed_countries: ['US', 'AU', 'CA', 'GB', 'DE', 'FR'],
            },

            line_items: [
                {
                    price_data: {
                        currency: 'aud',
                        product_data: {
                            name: productDetails.name,
                            description: productDetails.description,
                        },
                        unit_amount: productDetails.priceInCents,
                    },
                    quantity: 1,
                },
            ],
            
            success_url: `${baseUrl}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/`,

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
        throw error;
    }
};