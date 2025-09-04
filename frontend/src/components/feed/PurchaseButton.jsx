// frontend/src/components/feed/PurchaseButton.jsx
import React from 'react';
import { useMutation } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';

// This icon can be moved to a shared icons file if you prefer
const ShoppingCartIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
    </svg>
);


const purchaseFlowMutationFn = async ({ bookId, bookType }) => {
    // Step 1: Create the purchase order
    const orderResponse = await apiClient.post('/orders/purchase', { bookId, bookType });
    const newOrderId = orderResponse.data.id;

    if (!newOrderId) {
        throw new Error('Failed to create an order.');
    }

    // Step 2: Create the Stripe checkout session with the new order ID
    const checkoutResponse = await apiClient.post('/orders/create-checkout-session', { orderId: newOrderId });
    return checkoutResponse.data;
};

export function PurchaseButton({ book }) {
    const purchaseMutation = useMutation({
        mutationFn: purchaseFlowMutationFn,
        onSuccess: (data) => {
            // Step 3: Redirect to Stripe checkout
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            }
        },
        onError: (error) => {
            console.error('Purchase failed:', error);
            alert(`Could not complete purchase: ${error.response?.data?.message || error.message}`);
        },
    });

    const handlePurchase = (e) => {
        e.stopPropagation();
        purchaseMutation.mutate({ bookId: book.id, bookType: book.book_type });
    };

    return (
        <button
            onClick={handlePurchase}
            disabled={purchaseMutation.isPending}
            className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed"
        >
            {purchaseMutation.isPending ? (
                'Processing...'
            ) : (
                <>
                    <ShoppingCartIcon />
                    Purchase Copy
                </>
            )}
        </button>
    );
}