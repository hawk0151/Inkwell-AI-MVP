// frontend/src/pages/NovelSelectionPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import { motion } from 'framer-motion';
import { LoadingSpinner, Alert } from '../components/common';
import PageHeader from '../components/PageHeader';
import ProductCard from '../components/ProductCard';
import { BookOpenIcon, DocumentTextIcon, BookmarkSquareIcon } from '@heroicons/react/24/solid';
import Testimonials from '../components/Testimonials';

const fetchBookOptions = async () => {
    const { data } = await apiClient.get('/products/book-options');
    return data;
};

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.15 },
    },
};

function NovelSelectionPage() {
    const navigate = useNavigate();
    const { data: allProducts, isLoading, isError } = useQuery({
        queryKey: ['bookOptions'],
        queryFn: fetchBookOptions
    });

    const handleProductSelection = (product) => {
        navigate('/novel/new', { state: { 
            selectedProductId: product.id,
            isNewCreation: true,
            wordsPerPage: product.defaultWordsPerPage,
            totalChapters: product.totalChapters,
            maxPageCount: product.defaultPageCount
        }});
    };

    if (isLoading) return <LoadingSpinner text="Loading book formats..." />;
    if (isError) return <Alert type="error" message="Sorry, we couldn't load the book options right now." />;

    const productsToRender = Array.isArray(allProducts) ? allProducts : [];
    const novelProducts = productsToRender.filter((p) => p.type === 'textBook');

    return (
        <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] px-4 sm:px-6 lg:px-8">
            
            {/* --- MODIFICATION START --- */}
            <PageHeader 
                title="Choose Your Book's Format"
                subtitle="Select the perfect canvas for your story. All books are free to create and write online."
            />
            {/* A more prominent note to reassure users */}
            <p className="text-center text-lg text-slate-300 max-w-3xl mx-auto -mt-6 mb-12">
                Prices shown are only for ordering a physical, printed copy of your completed book later.
            </p>
            {/* --- MODIFICATION END --- */}

            <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-7xl mx-auto"
            >
                {novelProducts.map((product) => (
                    <ProductCard key={product.id} product={product} onSelect={handleProductSelection} />
                ))}
            </motion.div>

            <Testimonials />

            <div className="max-w-6xl mx-auto my-24 p-10 bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700 text-white">
                <h2 className="text-4xl font-serif font-extrabold mb-6 text-center text-blue-300">
                    Which Format is Right for Your Story?
                </h2>
                <div className="text-lg space-y-6 text-slate-300 leading-relaxed font-sans">
                    <p>
                        <span className="font-semibold text-blue-300">
                            <DocumentTextIcon className="h-6 w-6 inline-block mr-2 align-middle text-blue-400" /> Novella:
                        </span>
                        &nbsp;Ideal for compact, impactful narratives. Perfect for short stories or a quick, engaging read.
                    </p>
                    <p>
                        <span className="font-semibold text-blue-300">
                            <BookOpenIcon className="h-6 w-6 inline-block mr-2 align-middle text-blue-400" /> A4 Novel:
                        </span>
                        &nbsp;Our most popular choice for comprehensive stories. This full-size paperback offers ample space for intricate plots.
                    </p>
                    <p>
                        <span className="font-semibold text-blue-300">
                            <BookmarkSquareIcon className="h-6 w-6 inline-block mr-2 align-middle text-blue-400" /> Hardcover:
                        </span>
                        &nbsp;The ultimate heirloom. With a durable hardcover binding, this format is designed to be cherished for generations.
                    </p>
                    <p className="text-center mt-8 text-xl font-bold text-blue-300">
                        Choose the canvas that best allows your vision to unfold!
                    </p>
                </div>
            </div>
        </div>
    );
}

export default NovelSelectionPage;