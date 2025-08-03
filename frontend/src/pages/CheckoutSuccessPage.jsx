// frontend/src/pages/CheckoutSuccessPage.jsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

// This component will handle the redirect after a successful Stripe checkout
const CheckoutSuccessPage = () => {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id'); // Get the session_id from URL query params
    const [status, setStatus] = useState('verifying'); // State to show loading, success, or error

    // --- NEW: Debugging Logs and Status Display ---
    console.log('CheckoutSuccessPage: Component mounted.');
    console.log('CheckoutSuccessPage: Initial sessionId from URL:', sessionId);
    console.log('CheckoutSuccessPage: Initial status state:', status);
    // --- END NEW ---

    // In a real application, you would typically make a backend API call here
    // to verify the Stripe session ID and confirm the order in your database.
    // For this task, we'll simulate success.
    useEffect(() => {
        // --- NEW: Debugging Log inside useEffect ---
        console.log('CheckoutSuccessPage: useEffect triggered. sessionId:', sessionId);
        // --- END NEW ---

        if (sessionId) {
            // Simulate an API call delay for verification
            const timer = setTimeout(() => {
                setStatus('success'); // Assuming success for now
                console.log(`CheckoutSuccessPage: Received session_id: ${sessionId}. Order presumed successful. Status set to 'success'.`);
                // Here, you would typically call your backend:
                // apiClient.get(`/api/orders/verify-stripe-session?sessionId=${sessionId}`)
                //   .then(response => setStatus('success'))
                //   .catch(error => setStatus('error'));
            }, 1500); // Simulate a network delay
            return () => clearTimeout(timer);
        } else {
            setStatus('invalid'); // No session ID found in URL
            console.error("CheckoutSuccessPage: No session_id found in URL. Status set to 'invalid'.");
        }
    }, [sessionId]);

    const pageVariants = {
        initial: { opacity: 0, y: 20 },
        in: { opacity: 1, y: 0 },
        out: { opacity: 0, y: -20 }
    };

    const pageTransition = {
        type: "tween",
        ease: "anticipate",
        duration: 0.5
    };

    return (
        <motion.div
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="min-h-screen bg-gradient-to-br from-slate-900 to-gray-950 flex items-center justify-center p-4 text-center"
        >
            <div className="bg-slate-800/50 backdrop-blur-md p-10 rounded-3xl shadow-2xl border border-slate-700 max-w-lg w-full">
                {/* --- NEW: Temporary Debugging Display --- */}
                <p className="text-slate-500 text-xs mb-4">
                    Debug Info: Session ID - {sessionId || 'N/A'}, Status - {status}
                </p>
                {/* --- END NEW --- */}

                {status === 'verifying' && (
                    <div className="text-white">
                        <svg className="animate-spin h-10 w-10 text-green-400 mx-auto mb-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 0020 13a8 8 0 00-6.002-7.792M6 13a8 8 0 1112 0v0A8.002 8.002 0 0110 21m-4 0h-.582m15.356-2a8.001 8.001 0 00-15.356 0" />
                        </svg>
                        <h2 className="text-3xl font-bold text-white mb-4">Processing Your Order...</h2>
                        <p className="text-slate-300">Please do not close this page. We are confirming your payment.</p>
                    </div>
                )}
                {status === 'success' && (
                    <div className="text-white">
                        <svg className="h-20 w-20 text-green-500 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <h2 className="text-4xl font-extrabold text-green-400 mb-4 font-serif">Order Confirmed!</h2>
                        <p className="text-xl text-slate-200 mb-6">Thank you for your purchase!</p>
                        <p className="text-lg text-slate-300 mb-8">
                            Your order has been successfully placed. You will receive an email confirmation shortly with your order details.
                        </p>
                        <Link to="/my-orders" className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-indigo-700 transition-transform transform hover:scale-105 shadow-lg text-lg">
                            View My Orders
                        </Link>
                    </div>
                )}
                {status === 'error' && (
                    <div className="text-white">
                        <svg className="h-20 w-20 text-red-500 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <h2 className="text-4xl font-extrabold text-red-400 mb-4 font-serif">Payment Error</h2>
                        <p className="text-xl text-slate-200 mb-6">There was an issue processing your payment.</p>
                        <p className="text-lg text-slate-300 mb-8">
                            Please check your payment details or try again. If the problem persists, contact support.
                        </p>
                        <Link to="/my-orders" className="bg-yellow-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-yellow-700 transition-transform transform hover:scale-105 shadow-lg text-lg">
                            Go to My Orders
                        </Link>
                    </div>
                )}
                {status === 'invalid' && (
                    <div className="text-white">
                        <svg className="h-20 w-20 text-gray-400 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <h2 className="text-4xl font-extrabold text-slate-400 mb-4 font-serif">Invalid Request</h2>
                        <p className="text-xl text-slate-200 mb-6">No order session information found.</p>
                        <p className="text-lg text-slate-300 mb-8">
                            Please ensure you are accessing this page correctly, or view your orders to check status.
                        </p>
                        <Link to="/my-orders" className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-indigo-700 transition-transform transform hover:scale-105 shadow-lg text-lg">
                            Go to My Orders
                        </Link>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default CheckoutSuccessPage;