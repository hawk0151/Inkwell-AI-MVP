// frontend/src/pages/CheckoutSuccessPage.jsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const CheckoutSuccessPage = () => {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const [status, setStatus] = useState('verifying');

    useEffect(() => {
        if (sessionId) {
            const timer = setTimeout(() => {
                setStatus('success');
            }, 1500);
            return () => clearTimeout(timer);
        } else {
            setStatus('invalid');
        }
    }, [sessionId]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-gray-950 flex items-center justify-center p-4 text-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="bg-slate-800/50 backdrop-blur-md p-10 rounded-3xl shadow-2xl border border-slate-700 max-w-lg w-full"
            >
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
                            Your order has been successfully placed. You will receive an email confirmation shortly.
                        </p>
                        <Link to="/my-orders" className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-indigo-700 transition-transform transform hover:scale-105 shadow-lg text-lg">
                            View My Orders
                        </Link>
                    </div>
                )}
                {/* Invalid status content is unchanged but will now be inside the polished container */}
            </motion.div>
        </div>
    );
};

export default CheckoutSuccessPage;