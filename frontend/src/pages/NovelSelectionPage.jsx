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
        navigate('/novel/new', { state: { selectedProductId: product.id, isNewCreation: true } });
    };

    if (isLoading) return <LoadingSpinner text="Loading book formats..." />;
    if (isError) return <Alert type="error" message="Sorry, we couldn't load the book options right now." />;

    const novelProducts = allProducts?.filter((p) => p.type === 'textBook') || [];

    return (
        <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] px-4 sm:px-6 lg:px-8">
            <PageHeader 
                title="Select a Novel Format"
                subtitle="Choose the perfect size for your captivating text-based story."
            />
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

            <div className="max-w-6xl mx-auto my-24 p-10 bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700 text-white">
                <h2 className="text-4xl font-serif font-extrabold mb-6 text-center text-indigo-300">
                    Which Format is Right for Your Story?
                </h2>
                <div className="text-lg space-y-6 text-slate-300 leading-relaxed font-sans">
                    <p>
                        <span className="font-semibold text-white">
                            <DocumentTextIcon className="h-6 w-6 inline-block mr-2 align-middle text-indigo-400" /> Novella (5.25 x 8.25" Paperback):
                        </span>
                        &nbsp;Ideal for compact, impactful narratives. Perfect for short stories, novellas, or if you envision a quick, engaging read. A charming gift that fits in any bag.
                    </p>
                    <p>
                        <span className="font-semibold text-white">
                            <BookOpenIcon className="h-6 w-6 inline-block mr-2 align-middle text-indigo-400" /> A4 Novel (8.52 x 11.94" Paperback):
                        </span>
                        &nbsp;Our most popular choice for comprehensive stories. This full-size paperback offers ample space for intricate plots, character development, and immersive worlds. The classic novel experience.
                    </p>
                    <p>
                        <span className="font-semibold text-white">
                            <BookmarkSquareIcon className="h-6 w-6 inline-block mr-2 align-middle text-indigo-400" /> 80-page Novel (6.39 x 9.46" Hardcover):
                        </span>
                        &nbsp;The ultimate heirloom. With a durable hardcover binding and premium finish, this format is designed to be cherished for generations. Best for legacy projects, significant personal stories, or as an exquisite centerpiece gift.
                    </p>
                    <p className="text-center mt-8 text-xl font-bold text-teal-300">
                        Choose the canvas that best allows your vision to unfold!
                    </p>
                </div>
            </div>
        </div>
    );
}

export default NovelSelectionPage;