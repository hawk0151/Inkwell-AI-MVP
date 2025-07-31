// frontend/src/pages/CancelPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const CancelPage = () => {
    const navigate = useNavigate();

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4"
        >
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl text-center max-w-md w-full">
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
                <h1 className="text-3xl font-bold mb-4">Payment Cancelled</h1>
                <p className="text-lg mb-6">Your payment was not completed.</p>
                <p className="text-sm text-gray-400 mb-8">
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
                <button
                    className="mt-4 text-indigo-400 hover:text-indigo-200 transition-colors duration-200"
                    onClick={() => navigate('/')}
                >
                    Return to Home
                </button>
            </div>
        </motion.div>
    );
};

export default CancelPage;