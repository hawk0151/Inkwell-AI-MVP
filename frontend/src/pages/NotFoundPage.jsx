// frontend/src/pages/NotFoundPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageHeader from '../components/PageHeader';
import { MapIcon } from '@heroicons/react/24/outline';

const NotFoundPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] flex items-center justify-center">
            <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                >
                    <MapIcon className="mx-auto h-24 w-24 text-indigo-400/50 mb-4" />
                    <PageHeader 
                        title="404 - Page Not Found"
                        subtitle="Oops! It seems the page you're looking for has wandered off the script."
                    />
                    <div className="mt-8 flex justify-center items-center gap-4">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate('/my-projects')}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 shadow-lg"
                        >
                            Go to My Projects
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate('/')}
                            className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 shadow-lg"
                        >
                            Return Home
                        </motion.button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default NotFoundPage;