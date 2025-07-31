// frontend/src/pages/SuccessPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

function SuccessPage() {
    const navigate = useNavigate();

    return (
        <div className="fade-in max-w-2xl mx-auto py-12 px-4 text-center">
            <div className="bg-white p-10 rounded-2xl shadow-2xl">
                <div className="text-6xl mb-4">🎉</div>
                <h1 className="text-4xl font-bold font-serif text-green-600 mb-4">Order Successful!</h1>
                <p className="text-lg text-slate-700 mb-8">
                    Thank you for your purchase! Your book is now in production. You can view the status of your order on your "My Orders" page.
                </p>
                <button 
                    onClick={() => navigate('/my-orders')} 
                    className="bg-slate-800 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-700 transition"
                >
                    View My Orders
                </button>
            </div>
        </div>
    );
}

export default SuccessPage;