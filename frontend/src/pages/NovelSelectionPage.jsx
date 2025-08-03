// frontend/src/pages/NovelSelectionPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import { LoadingSpinner, Alert } from '../components/common';

// Import Heroicons
import { BookOpenIcon, DocumentTextIcon, BookmarkSquareIcon } from '@heroicons/react/24/solid';

const fetchBookOptions = async () => {
    const { data } = await apiClient.get('/products/book-options');
    return data;
};

// Helper function to get the appropriate Heroicon component
const getProductIcon = (productId) => {
    switch (productId) {
        case 'NOVBOOK_BW_5.25x8.25':
            return DocumentTextIcon; // Represents a document/shorter text
        case 'A4NOVEL_PB_8.52x11.94':
            return BookOpenIcon; // Represents a standard open book
        case 'ROYAL_HARDCOVER_6.39x9.46':
            return BookmarkSquareIcon; // Represents a more formal/bound item
        default:
            return BookOpenIcon; // Fallback
    }
};

const ProductCard = ({ product, onSelect }) => {
    const IconComponent = getProductIcon(product.id); // Get the correct icon component

    return (
        <div
            onClick={() => onSelect(product)}
            // Enhanced styling: richer background, stronger shadow on hover
            className="bg-slate-800 border border-slate-700 p-8 rounded-xl group cursor-pointer 
                       transform hover:-translate-y-2 hover:shadow-xl transition-all duration-300 
                       flex flex-col items-center text-center"
        >
            <div className="text-indigo-400 mb-5 transition-transform duration-300 group-hover:scale-110">
                {/* Render the Heroicon component */}
                <IconComponent className="h-24 w-24" /> 
            </div>
            <h3 className="text-3xl font-extrabold text-white mb-2 tracking-wide">
                {product.name}
            </h3>
            <p className="text-lg text-slate-300 mb-4 font-normal">
                Approx. {product.defaultPageCount} pages
            </p>
            <p className="text-5xl font-bold text-teal-400 mt-auto mb-6 tracking-tight">
                ${product.price}
            </p>
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 
                               rounded-lg transition transform hover:scale-105 duration-200 shadow-lg">
                Select
            </button>
        </div>
    );
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

    if (isLoading) {
        return <LoadingSpinner text="Loading book formats..." />;
    }

    if (isError) {
        return (
            <Alert type="error" message="Sorry, we couldn't load the book options right now." />
        );
    }

    const novelProducts = allProducts?.filter((p) => p.type === 'textBook') || [];

    return (
        <div className="fade-in min-h-screen bg-gradient-to-br from-slate-900 to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="text-center py-10">
                <h1 className="text-6xl md:text-7xl font-extrabold text-white leading-tight">
                    Select a Novel Format
                </h1>
                <p className="text-2xl text-slate-400 mt-6 max-w-2xl mx-auto font-light">
                    Choose the perfect size for your captivating text-based story.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-7xl mx-auto">
                {novelProducts.map((product) => (
                    <ProductCard key={product.id} product={product} onSelect={handleProductSelection} />
                ))}
            </div>

            {/* How-to / Suggestion Box - Enhanced Styling */}
            <div className="max-w-6xl mx-auto mt-16 p-10 bg-gradient-to-br from-gray-800 to-slate-800 
                          rounded-2xl shadow-2xl border border-indigo-700/50 text-white">
                <h2 className="text-4xl font-extrabold mb-6 text-center text-indigo-300">
                    Which Format is Right for Your Story?
                </h2>
                <div className="text-lg space-y-6 text-slate-200 leading-relaxed font-light">
                    <p>
                        <span className="font-semibold text-white">
                            <DocumentTextIcon className="h-6 w-6 inline-block mr-2 text-indigo-400" /> Novella (5.25 x 8.25" Paperback):
                        </span>
                        &nbsp;Ideal for compact, impactful narratives. Perfect for short stories, novellas, or if you envision a quick, engaging read. A charming gift that fits in any bag.
                    </p>
                    <p>
                        <span className="font-semibold text-white">
                            <BookOpenIcon className="h-6 w-6 inline-block mr-2 text-indigo-400" /> A4 Novel (8.52 x 11.94" Paperback):
                        </span>
                        &nbsp;Our most popular choice for comprehensive stories. This full-size paperback offers ample space for intricate plots, character development, and immersive worlds. The classic novel experience.
                    </p>
                    <p>
                        <span className="font-semibold text-white">
                            <BookmarkSquareIcon className="h-6 w-6 inline-block mr-2 text-indigo-400" /> 80-page Novel (6.39 x 9.46" Hardcover):
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