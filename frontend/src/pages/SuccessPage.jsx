// frontend/src/pages/SuccessPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import apiClient from '../services/apiClient';
import { LoadingSpinner, Alert } from '../components/common.jsx';

function SuccessPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [sessionId, setSessionId] = useState(null);
    const [order, setOrder] = useState(null);
    const [loadingOrder, setLoadingOrder] = useState(true);
    const [orderError, setOrderError] = useState(null);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const id = queryParams.get('session_id');

        const fetchOrderDetails = async (sessionId) => {
            setLoadingOrder(true);
            setOrderError(null);
            try {
                // Fetch order details from your backend using the sessionId
                const response = await apiClient.get(`/orders/session/${sessionId}`);
                setOrder(response.data);
            } catch (err) {
                console.error("Failed to fetch order details:", err.response?.data || err.message);
                setOrderError(err.response?.data?.message || "Failed to load order details.");
            } finally {
                setLoadingOrder(false);
            }
        };

        if (id) {
            setSessionId(id);
            fetchOrderDetails(id);
        } else {
            setLoadingOrder(false);
            setOrderError("No Stripe session ID found in the URL.");
        }
    }, [location]);

    if (loadingOrder) {
        return <LoadingSpinner text="Confirming your order..." />;
    }

    // --- MODIFIED: Simplified rendering logic ---
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4"
        >
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl text-center max-w-2xl w-full">
                {orderError ? (
                    // --- Error Display ---
                    <>
                        <motion.div
                            className="text-6xl mb-4"
                            initial={{ scale: 0.5 }} animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        >
                            🤔
                        </motion.div>
                        <h1 className="text-4xl font-bold font-serif text-yellow-400 mb-4">Something went wrong.</h1>
                        <p className="text-lg text-gray-300 mb-4">
                            {orderError}
                        </p>
                        <p className="text-lg text-gray-300 mb-8">
                            If you completed your purchase, please check your "My Orders" page for the latest status.
                        </p>
                        <button
                            className="mt-4 text-indigo-400 hover:text-indigo-200 transition-colors duration-200"
                            onClick={() => navigate('/')}
                        >
                            Return to Home
                        </button>
                    </>
                ) : (
                    // --- Success Display ---
                    <>
                        <motion.div
                            className="text-6xl mb-4"
                            initial={{ scale: 0.5, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        >
                            🎉
                        </motion.div>
                        <h1 className="text-4xl font-bold font-serif text-green-400 mb-4">Order Successful!</h1>
                        <p className="text-lg text-gray-300 mb-2">
                            {/* MODIFIED: Added optional chaining for safety */}
                            Thank you for your purchase of **{order?.book_title || 'your book'}**!
                        </p>
                        <p className="text-lg text-gray-300 mb-2">
                            {/* MODIFIED: Correctly formats price from total_cost and currency */}
                            Your payment of **
                            {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: order?.currency || 'USD'
                            }).format((order?.total_cost || 0) / 100)}
                            ** was successful.
                        </p>
                        <p className="text-lg text-gray-300 mb-8">
                            Your book is now in production. You can view the status of your order on your "My Orders" page.
                        </p>
                        {order?.id && (
                             <p className="text-xs text-gray-500 mb-4">
                                 Order ID: <span className="font-mono break-all">{order.id}</span>
                             </p>
                         )}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate('/my-orders')}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200"
                        >
                            View My Orders
                        </motion.button>
                        <button
                            className="mt-4 text-indigo-400 hover:text-indigo-200 transition-colors duration-200"
                            onClick={() => navigate('/')}
                        >
                            Return to Home
                        </button>
                    </>
                )}
            </div>
        </motion.div>
    );
}

export default SuccessPage;