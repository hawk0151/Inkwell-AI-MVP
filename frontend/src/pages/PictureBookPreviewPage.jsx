// frontend/src/pages/PictureBookPreviewPage.jsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import { motion } from 'framer-motion';
import PageHeader from '../components/PageHeader';
import { LoadingSpinner, Alert } from '../components/common';

const fetchBookData = async (bookId) => {
    if (!bookId) return null;
    const { data } = await apiClient.get(`/picture-books/${bookId}`);
    return data;
};

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2 } },
};

const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
};

function PictureBookPreviewPage() {
    const { bookId } = useParams();
    const navigate = useNavigate();

    const { data, isLoading, isError } = useQuery({
        queryKey: ['pictureBookPreview', bookId],
        queryFn: () => fetchBookData(bookId),
        enabled: !!bookId,
    });

    if (isLoading) return <LoadingSpinner text="Loading preview..." />;
    if (isError) return <Alert type="error" message="Failed to load project preview." />;

    const book = data?.book;
    const timeline = data?.timeline || [];

    return (
        <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
            <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <PageHeader 
                    title={book?.title || "Book Preview"}
                    subtitle="A preview of your personalized story"
                />

                <motion.div 
                    className="space-y-16"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <motion.div variants={itemVariants} className="bg-slate-800/50 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-slate-700 text-center h-96 flex flex-col justify-center items-center">
                        <h2 className="text-5xl font-serif text-white">{book?.title}</h2>
                        <p className="mt-4 text-xl text-slate-300">by Inkwell AI</p>
                    </motion.div>

                    {timeline.map((event, index) => (
                        <motion.div key={index} variants={itemVariants} className="bg-slate-800/50 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-slate-700">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                <div className={index % 2 === 0 ? 'md:order-1' : 'md:order-2'}>
                                    {event.uploaded_image_url || event.image_url ? (
                                        <img src={event.uploaded_image_url || event.image_url} alt={event.event_date || 'Timeline image'} className="rounded-lg object-cover w-full h-80 shadow-lg" />
                                    ) : (
                                        <div className="bg-slate-700 rounded-lg w-full h-80 flex items-center justify-center">
                                            <p className="text-slate-400">No Image</p>
                                        </div>
                                    )}
                                </div>
                                <div className={index % 2 === 0 ? 'md:order-2' : 'md:order-1'}>
                                    <h3 className="text-3xl font-bold font-serif text-white mb-3">{event.event_date}</h3>
                                    <p className="text-slate-300 leading-relaxed text-lg">{event.story_text}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
                
                <div className="text-center mt-16">
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate(`/picture-book/${bookId}`)} 
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-300 shadow-lg"
                    >
                        Back to Editor
                    </motion.button>
                </div>
            </div>
        </div>
    );
}

export default PictureBookPreviewPage;