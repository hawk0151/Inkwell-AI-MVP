// frontend/src/pages/CancelPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const CancelPage = () => {
    const navigate = useNavigate();

    const iconPathVariants = {
        hidden: { pathLength: 0, opacity: 0 },
        visible: (i) => ({
            pathLength: 1,
            opacity: 1,
            transition: {
                delay: 0.2 + i * 0.2, // Stagger the two lines of the 'X'
                duration: 0.5,
                ease: "easeInOut"
            }
        })
    };

    return (
        <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] flex items-center justify-center p-4 text-center">
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
                    initial="hidden"
                    animate="visible"
                >
                    {/* Circle */}
                    <motion.path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" variants={iconPathVariants} custom={0} />
                    {/* Cross lines */}
                    <motion.path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-4 4" variants={iconPathVariants} custom={1} />
                    <motion.path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 10l4 4" variants={iconPathVariants} custom={1.2} />
                </motion.svg>
                <h1 className="text-4xl font-bold mb-4 text-red-400 font-serif">Payment Cancelled</h1>
                <p className="text-lg mb-6 text-slate-300">Your payment process was not completed.</p>
                <p className="text-sm text-slate-400 mb-8">
                    You have not been charged. Feel free to return to your projects and try again when you're ready.
                </p>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 shadow-lg"
                    onClick={() => navigate('/my-projects')}
                >
                    Return to My Projects
                </motion.button>
            </motion.div>
        </div>
    );
};

export default CancelPage;