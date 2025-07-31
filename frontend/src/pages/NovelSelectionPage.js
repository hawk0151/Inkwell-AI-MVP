// frontend/src/pages/NovelSelectionPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { LoadingSpinner, Alert } from '../components/common';

const ProductCard = ({ product, onSelect }) => (
    <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-6 flex flex-col items-center text-center">
        <div className="text-5xl mb-4">{product.icon}</div>
        <h3 className="text-2xl font-bold font-serif text-slate-800">{product.name}</h3>
        <p className="text-slate-600 my-2">{product.description}</p>
        <p className="text-3xl font-light text-slate-900 my-4">${product.price}</p>
        <button
            onClick={() => onSelect(product)}
            className="mt-auto bg-slate-800 text-white font-bold py-2 px-8 rounded-lg hover:bg-slate-700 transition"
        >
            Select
        </button>
    </div>
);

function NovelSelectionPage() {
    const navigate = useNavigate();
    const [novelProducts, setNovelProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        apiClient.getBookOptions()
            .then(response => {
                const novels = response.data.filter(p => p.type === 'novel');
                setNovelProducts(novels);
            })
            .catch(err => {
                console.error("Failed to fetch product options:", err);
                setError("Sorry, we couldn't load the book options right now. Please try again later.");
            })
            .finally(() => setIsLoading(false));
    }, []);

    const handleProductSelection = (product) => {
        // Navigate to the generator, passing the selected product in the state
        navigate('/novel', { state: { selectedProduct: product } });
    };

    return (
        <div className="fade-in">
            <div className="text-center py-12">
                <h1 className="text-5xl font-bold font-serif text-slate-800">Select a Novel Format</h1>
                <p className="text-xl text-slate-600 mt-4">Choose the perfect size for your text-based story.</p>
            </div>

            {isLoading && <LoadingSpinner text="Loading options..." />}
            {error && <Alert title="Error">{error}</Alert>}
            
            {!isLoading && !error && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {novelProducts.map(product => (
                        <ProductCard key={product.id} product={product} onSelect={handleProductSelection} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default NovelSelectionPage;