// frontend/src/pages/CancelPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

function CancelPage() {
  const navigate = useNavigate();

  return (
    <div className="fade-in max-w-2xl mx-auto py-12 px-4 text-center">
      <div className="bg-white p-10 rounded-2xl shadow-2xl">
        <div className="text-6xl mb-4">😞</div>
        <h1 className="text-4xl font-bold font-serif text-red-600 mb-4">Order Cancelled</h1>
        <p className="text-lg text-slate-700 mb-8">
          Your order has been cancelled, and you have not been charged. Your creation is safe if you'd like to try again.
        </p>
        <button 
          onClick={() => navigate('/')} 
          className="bg-slate-800 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-700 transition"
        >
          Back to Creator
        </button>
      </div>
    </div>
  );
}

export default CancelPage;