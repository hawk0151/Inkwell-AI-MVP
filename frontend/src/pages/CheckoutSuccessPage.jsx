// frontend/src/pages/CheckoutSuccessPage.jsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link as RouterLink } from 'react-router-dom'; // Renamed to avoid conflict
import { motion } from 'framer-motion';
import apiClient from '../services/apiClient'; // Import apiClient

// Make the React Router Link component animatable
const MotionLink = motion(RouterLink);

const CheckoutSuccessPage = () => {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const [status, setStatus] = useState('verifying');

    useEffect(() => {
        if (sessionId) {
            // In a real app, you would verify the session on your backend
            // This is just a simulation for the UI
            const timer = setTimeout(() => {
                setStatus('success');
            }, 1500);
            return () => clearTimeout(timer);
        } else {
            setStatus('invalid');
        }
    }, [sessionId]);

    const iconPathVariants = {
        hidden: { pathLength: 0, opacity: 0 },
        visible: {
            pathLength: 1,
            opacity: 1,
            transition: {
                delay: 0.2,
                duration: 0.8,
                ease: "easeInOut"
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] flex items-center justify-center p-4 text-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="bg-slate-800/50 backdrop-blur-md p-10 rounded-3xl shadow-2xl border border-slate-700 max-w-lg w-full"
            >
                {status === 'verifying' && (
                    <div className="text-white">
                        <svg className="animate-spin h-10 w-10 text-teal-400 mx-auto mb-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 0020 13a8 8 0 00-6.002-7.792M6 13a8 8 0 1112 0v0A8.002 8.002 0 0110 21m-4 0h-.582m15.356-2a8.001 8.001 0 00-15.356 0" />
                        </svg>
                        <h2 className="text-3xl font-bold text-white mb-4 font-serif">Processing Your Order...</h2>
                        <p className="text-slate-300">Please do not close this page. We are confirming your payment.</p>
                    </div>
                )}
                {status === 'success' && (
                    <div className="text-white">
                        <motion.svg className="h-24 w-24 text-teal-500 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <motion.path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth="2" 
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                variants={iconPathVariants}
                                initial="hidden"
                                animate="visible"
                            />
                        </motion.svg>
                        <h2 className="text-4xl font-extrabold text-teal-400 mb-4 font-serif">Order Confirmed!</h2>
                        <p className="text-xl text-slate-200 mb-6">Thank you for your purchase!</p>
                        <p className="text-lg text-slate-300 mb-8">
                            Your order has been successfully placed. You will receive an email confirmation shortly.
                        </p>
                        <MotionLink 
                            to="/my-orders" 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="inline-block bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-indigo-500 transition-colors duration-300 shadow-lg text-lg"
                        >
                            View My Orders
                        </MotionLink>
                    </div>
                )}
                {status === 'invalid' && (
                     <div className="text-white">
                        {/* ... Invalid status content ... */}
                     </div>
                )}
            </motion.div>
        </div>
    );
};

export default CheckoutSuccessPage;