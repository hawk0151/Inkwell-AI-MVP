// backend/src/services/stripe.service.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Creates a Stripe Checkout Session for a given order.
 * @param {object} orderDetails - The details of the order.
 * @param {number} userId - The ID of the user placing the order.
 * @param {number} bookId - The ID of the book project being purchased.
 * @returns {Promise<Stripe.Checkout.Session>} The created Stripe session object.
 */
export const createStripeCheckoutSession = async (orderDetails, userId, bookId) => {
  const { selections, totalPrice } = orderDetails;
  
  // This should point to your frontend development server URL
  const clientDomain = 'http://localhost:5173'; 

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: selections.name,
            description: selections.description,
          },
          unit_amount: Math.round(totalPrice * 100), // Price in cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU'], // Example countries, you can change this
      },
      // Metadata is crucial for linking the payment back to our internal records
      metadata: {
        userId: userId,
        bookId: bookId, // Crucial for identifying which book to print
        luluProductId: selections.id, // The Lulu SKU for the print job
        productName: selections.name
      },
      // Use the correct routes for success and cancellation
      success_url: `${clientDomain}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientDomain}/cancel`,
    });
    return session;
  } catch (error) {
    console.error("Error creating Stripe session:", error);
    throw new Error("Failed to create Stripe checkout session.");
  }
};