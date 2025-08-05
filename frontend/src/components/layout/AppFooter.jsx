// frontend/src/components/layout/AppFooter.jsx
import React from 'react';
import { Link } from 'react-router-dom';

export const AppFooter = () => (
    <footer className="bg-black/20 mt-auto py-8 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-400 text-sm">
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                <Link to="/policies#terms-of-service-section" className="hover:text-white transition-colors">Terms of Service</Link>
                <Link to="/policies#privacy-policy-section" className="hover:text-white transition-colors">Privacy Policy</Link>
                <Link to="/policies#shipping-policy-section" className="hover:text-white transition-colors">Shipping Policy</Link>
                <Link to="/policies#refund-policy-section" className="hover:text-white transition-colors">Refund Policy</Link>
            </div>
            <p className="mt-6">&copy; {new Date().getFullYear()} Inkwell AI. All Rights Reserved.</p>
        </div>
    </footer>
);