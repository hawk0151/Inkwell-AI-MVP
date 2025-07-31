// frontend/src/components/PurchaseFlow.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';
import { Alert } from './common.jsx';

// This function is needed to load the Stripe.js script dynamically
const loadStripe = () => {
    if (window.Stripe) {
        return Promise.resolve(window.Stripe('pk_test_51RnwscBS9VcPMjr2OLreWYHivpASEoSxH3u2QZNv6Wdc6LVuJ9Aanyl5sQNUw2pJzjvzpgHiK7gmn6TdnaeVrfNL007Sw67vPt'));
    }
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.async = true;
        script.onload = () => {
            if (window.Stripe) {
                resolve(window.Stripe('pk_test_51RnwscBS9VcPMjr2OLreWYHivpASEoSxH3u2QZNv6Wdc6LVuJ9Aanyl5sQNUw2pJzjvzpgHiK7gmn6TdnaeVrfNL007Sw67vPt'));
            } else {
                reject(new Error('Stripe.js failed to load'));
            }
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
};


function PurchaseFlow({ story, selectedProduct, navigate }) {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState(null);
  const { user, token } = useAuth();

  const handleCheckout = async () => {
    if (!user || !token) {
      alert("Please log in to purchase your book.");
      navigate('login');
      return;
    }
    setIsCheckingOut(true);
    setError(null);
    try {
      const orderDetails = { selections: selectedProduct, totalPrice: selectedProduct.price };
      const { data } = await apiClient.createCheckoutSession(orderDetails, token);
      const stripe = await loadStripe();
      await stripe.redirectToCheckout({ sessionId: data.id });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to initiate checkout.");
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="fade-in space-y-12">
      <div className="w-full bg-white/90 backdrop-blur-lg p-6 sm:p-10 rounded-xl shadow-2xl border border-slate-200/80">
        <h2 className="text-3xl sm:text-4xl font-bold font-serif text-slate-900 mb-8 border-b-2 border-amber-200 pb-4">Your Generated Story</h2>
        <div className="prose prose-lg max-w-none font-serif text-slate-800 leading-relaxed space-y-6">
          {story.split('\n').filter(p => p.trim() !== '').map((p, index) => <p key={index}>{p}</p>)}
        </div>
      </div>
      <div className="w-full bg-white/90 backdrop-blur-lg p-6 sm:p-10 rounded-xl shadow-2xl border border-slate-200/80">
        <h2 className="text-3xl sm:text-4xl font-bold font-serif text-slate-900 mb-8">Finalize Your Order</h2>
        {error && <Alert title="Checkout Error">{error}</Alert>}
        <div className="mt-12 pt-8 border-t-2 border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-xl text-slate-700">Your Chosen Book: <span className="font-bold">{selectedProduct.name}</span></p>
            <p className="font-bold text-3xl text-amber-600">${selectedProduct.price.toFixed(2)}</p>
          </div>
          <button onClick={handleCheckout} disabled={isCheckingOut} className="w-full md:w-auto bg-gradient-to-br from-amber-500 to-amber-600 text-white font-bold text-lg py-4 px-10 rounded-xl shadow-lg hover:shadow-xl disabled:from-slate-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:-translate-y-1">
            {isCheckingOut ? 'Redirecting...' : 'Proceed to Checkout'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PurchaseFlow;
