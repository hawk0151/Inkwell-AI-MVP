// frontend/src/pages/CancelPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const CancelPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-gray-950 flex items-center justify-center p-4 text-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="bg-slate-800/50 backdrop-blur-md p-10 rounded-3xl shadow-2xl border border-slate-700 max-w-lg w-full"
            >
                <motion.svg
                    className="mx-auto h-24 w-24 text-red-500 mb-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </motion.svg>
                <h1 className="text-3xl font-bold text-red-400 mb-4">Payment Cancelled</h1>
                <p className="text-lg mb-6 text-slate-200">Your payment was not completed.</p>
                <p className="text-sm text-slate-400 mb-8">
                    If you experienced an issue, please try again or contact support.
                </p>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200"
                    onClick={() => navigate('/my-projects')}
                >
                    Return to My Projects
                </motion.button>
            </motion.div>
        </div>
    );
};

export default CancelPage;