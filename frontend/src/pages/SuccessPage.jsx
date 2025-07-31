// frontend/src/pages/SuccessPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

function SuccessPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [sessionId, setSessionId] = useState(null);
    const [orderConfirmed, setOrderConfirmed] = useState(false);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const id = queryParams.get('session_id');
        if (id) {
            setSessionId(id);
            setOrderConfirmed(true);
            // In a real application, you might fetch order details from your backend
            // using this session_id to confirm the order and display more specifics.
        } else {
            // If no session_id, you might still want to show a generic success message
            // or redirect, depending on how strict you want this page to be.
            setOrderConfirmed(false); // Can't confirm without session ID
        }
    }, [location]); // Depend on 'location' to re-run if query params change

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4"
        >
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl text-center max-w-2xl w-full">
                {orderConfirmed ? (
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
                        <p className="text-lg text-gray-300 mb-8">
                            Thank you for your purchase! Your book is now in production.
                            You can view the status of your order on your "My Orders" page.
                        </p>
                        {sessionId && (
                            <p className="text-xs text-gray-500 mb-4">
                                Stripe Session ID: <span className="font-mono break-all">{sessionId}</span>
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
                ) : (
                    <>
                        <motion.div
                            className="text-6xl mb-4"
                            initial={{ scale: 0.5 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        >
                            🤔
                        </motion.div>
                        <h1 className="text-4xl font-bold font-serif text-yellow-400 mb-4">Something went wrong.</h1>
                        <p className="text-lg text-gray-300 mb-8">
                            We couldn't confirm your order details. Please check your "My Orders" page.
                        </p>
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