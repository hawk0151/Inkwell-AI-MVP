import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import { LoadingSpinner, Alert } from '../components/common';

const fetchBookOptions = async () => {
    const { data } = await apiClient.get('/products/book-options');
    return data;
};

const ProductCard = ({ product, onSelect }) => (
    <div
        onClick={() => onSelect(product)}
        className="bg-gray-800 border border-gray-700 p-6 rounded-lg group cursor-pointer transform hover:-translate-y-2 transition-transform duration-300 flex flex-col items-center text-center"
    >
        <div className="text-6xl mb-4 transition-transform duration-300 group-hover:scale-110">
            {product.icon || '📖'}
        </div>
        <h3 className="text-2xl font-bold text-white">{product.name}</h3>
        <p className="text-slate-400 my-2 flex-grow font-sans">{product.description}</p>
        <p className="text-4xl font-light text-white my-4 font-sans">${product.price}</p>
        <button className="mt-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition">
            Select
        </button>
    </div>
);

function NovelSelectionPage() {
    const navigate = useNavigate();

    const { data: allProducts, isLoading, isError } = useQuery({
        queryKey: ['bookOptions'],
        queryFn: fetchBookOptions
    });

    const handleProductSelection = (product) => {
        // MODIFIED: Pass only the product ID and a 'isNewCreation' flag via state
        navigate('/novel/new', { state: { selectedProductId: product.id, isNewCreation: true } });
    };

    if (isLoading) {
        return <LoadingSpinner text="Loading book formats..." />;
    }

    if (isError) {
        return (
            <Alert title="Error">
                Sorry, we couldn't load the book options right now.
            </Alert>
        );
    }

    // --- FIX START ---
    // Change filter from 'novel' to 'textBook' to match backend data
    const novelProducts = allProducts?.filter((p) => p.type === 'textBook') || [];
    // --- FIX END ---

    return (
        <div className="fade-in">
            <div className="text-center py-12">
                <h1 className="text-5xl md:text-6xl font-bold text-white">Select a Novel Format</h1>
                <p className="text-xl text-slate-400 mt-4 font-sans">
                    Choose the perfect size for your text-based story.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                {novelProducts.map((product) => (
                    <ProductCard key={product.id} product={product} onSelect={handleProductSelection} />
                ))}
            </div>
        </div>
    );
}

export default NovelSelectionPage;