// frontend/src/pages/SuccessPage.jsx
import React, { useEffect, useState } from 'react'; // Added useEffect and useState
import { useNavigate, useLocation } from 'react-router-dom'; // Added useLocation
import { motion } from 'framer-motion'; // Added motion for consistency with other pages if desired

function SuccessPage() {
    const navigate = useNavigate();
    const location = useLocation(); // To get URL query parameters
    const [sessionId, setSessionId] = useState(null); // State to store session ID

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const id = queryParams.get('session_id'); // Get session_id from URL
        if (id) {
            setSessionId(id);
            // You could potentially make an API call here to your backend
            // to fetch more specific order details using the session ID.
            // For now, simply setting the ID is sufficient.
        }
        // If no session_id, you might still want to show the success message,
        // or redirect them to home if it's considered an invalid access.
        // For an MVP, just displaying the success message without specific session_id details is fine.
    }, [location]); // Depend on 'location' to re-run if query params change

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4" // Use full screen for better centering
        >
            <div className="bg-white p-10 rounded-2xl shadow-2xl text-center max-w-2xl mx-auto"> {/* Centered content */}
                <motion.div
                    className="text-6xl mb-4"
                    initial={{ scale: 0.5, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                >
                    🎉
                </motion.div>
                <h1 className="text-4xl font-bold font-serif text-green-600 mb-4">Order Successful!</h1>
                <p className="text-lg text-slate-700 mb-8">
                    Thank you for your purchase! Your book is now in production. You can view the status of your order on your "My Orders" page.
                </p>
                {/* Optionally display session ID for debugging or user confirmation */}
                {sessionId && (
                    <p className="text-sm text-gray-500 mb-4">
                        Stripe Session ID: <span className="font-mono">{sessionId}</span>
                    </p>
                )}
                <button
                    onClick={() => navigate('/my-orders')}
                    className="bg-slate-800 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-700 transition"
                >
                    View My Orders
                </button>
            </div>
        </motion.div>
    );
}

export default SuccessPage;