// frontend/src/pages/MyOrdersPage.jsx
import React, { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Alert, LoadingSpinner } from '../components/common.jsx';

const MyOrdersPage = () => {
    const { currentUser } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!currentUser) {
            setLoading(false); // No user, so no loading needed
            return;
        }

        const fetchOrders = async () => {
            setLoading(true);
            setError(null);
            try {
                // Corrected API endpoint for fetching user's orders
                const response = await apiClient.get('/orders/my-orders'); 
                setOrders(response?.data || []);
            } catch (err) {
                console.error('Failed to fetch orders:', err.response?.data?.message || err.message);
                setError('Failed to load your orders.');
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, [currentUser]); // Re-fetch orders if currentUser changes

    if (loading) return <LoadingSpinner text="Loading your orders..." />;
    if (error) return <Alert type="error" message={error} onClose={() => setError(null)} />; // Added onClose for Alert

    return (
        <div className="container mx-auto p-4 text-white min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-center text-indigo-400">My Orders</h1>
            {orders.length === 0 ? (
                <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-center">
                    <p className="text-lg text-gray-300">You haven't placed any orders yet.</p>
                    <p className="text-md text-gray-400 mt-2">Start by creating a new book!</p>
                </div>
            ) : (
                <ul className="space-y-6">
                    {orders.map((order) => (
                        <li
                            key={order.id} // Use order.id from PostgreSQL
                            className="border border-slate-700 p-6 rounded-lg shadow-lg bg-slate-800 hover:bg-slate-700 transition-colors duration-200"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <h2 className="text-xl font-semibold text-green-400">{order.book_title || 'Unnamed Book'}</h2>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium 
                                    ${order.status === 'completed' ? 'bg-green-600' : 
                                      order.status === 'processing' ? 'bg-blue-600' : 
                                      order.status === 'pending' ? 'bg-yellow-600' : 
                                      'bg-gray-600'}`}
                                >
                                    {order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Unknown'}
                                </span>
                            </div>
                            <p className="text-gray-300 text-sm mb-1">
                                Order ID: <span className="font-mono break-all">{order.id}</span>
                            </p>
                            <p className="text-gray-300 text-sm mb-1">
                                Total Price: <span className="font-bold">${order.total_price_usd ? order.total_price_usd.toFixed(2) : 'N/A'} USD</span>
                            </p>
                            <p className="text-gray-300 text-sm mb-1">
                                Ordered on: {order.order_date ? new Date(order.order_date).toLocaleString() : 'N/A'}
                            </p>
                            <p className="text-gray-300 text-sm">
                                Lulu Status: <span className="font-medium">
                                    {order.lulu_job_status ? order.lulu_job_status.charAt(0).toUpperCase() + order.lulu_job_status.slice(1) : 'Not yet submitted to Lulu'}
                                </span>
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default MyOrdersPage;