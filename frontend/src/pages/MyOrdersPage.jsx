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
    // --- NEW: State to cache Lulu statuses to avoid re-fetching ---
    const [statusCache, setStatusCache] = useState({});

    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        const fetchOrders = async () => {
            setLoading(true);
            setError(null);
            try {
                // This API endpoint `/my-orders` is correct based on your routes file
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
    }, [currentUser]);

    // --- NEW: Function to fetch real-time status from Lulu via our backend ---
    const fetchLuluStatus = async (luluJobId) => {
        if (!luluJobId || statusCache[luluJobId]?.loading) {
            return; // Don't fetch if no ID or already in progress
        }

        setStatusCache(prev => ({ ...prev, [luluJobId]: { loading: true, data: null, error: null } }));
        try {
            // This will call a new backend endpoint we need to create
            const response = await apiClient.get(`/orders/status/${luluJobId}`);
            setStatusCache(prev => ({ ...prev, [luluJobId]: { loading: false, data: response.data, error: null } }));
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to get latest status.';
            setStatusCache(prev => ({ ...prev, [luluJobId]: { loading: false, data: null, error: errorMessage } }));
        }
    };

    if (loading) return <LoadingSpinner text="Loading your orders..." />;
    if (error) return <Alert type="error" message={error} onClose={() => setError(null)} />;

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
                    {orders.map((order) => {
                        const luluStatusInfo = statusCache[order.lulu_job_id];

                        return (
                            <li
                                key={order.id}
                                className="border border-slate-700 p-6 rounded-lg shadow-lg bg-slate-800"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <h2 className="text-xl font-semibold text-green-400">{order.book_title || 'Unnamed Book'}</h2>
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium 
                                        ${order.status === 'completed' || order.status === 'processing' ? 'bg-green-600' : 
                                          order.status === 'pending' ? 'bg-yellow-600' : 
                                          'bg-gray-600'}`}
                                    >
                                        {order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Unknown'}
                                    </span>
                                </div>
                                <div className="space-y-2 text-gray-300 text-sm">
                                    <p>
                                        Order ID: <span className="font-mono">{order.id}</span>
                                    </p>
                                    <p>
                                        Total Price: <span className="font-bold">
                                            {/* MODIFIED: Correctly formats price from total_cost and currency */}
                                            {new Intl.NumberFormat('en-US', {
                                                style: 'currency',
                                                currency: order.currency || 'USD'
                                            }).format((order.total_cost || 0) / 100)}
                                        </span>
                                    </p>
                                    <p>
                                        {/* MODIFIED: Uses created_at which is a more common DB column name */}
                                        Ordered on: {order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'}
                                    </p>
                                </div>
                                
                                {/* --- NEW: Real-time Lulu Status Section --- */}
                                {order.lulu_job_id && (
                                    <div className="mt-4 pt-4 border-t border-slate-700">
                                        <button
                                            onClick={() => fetchLuluStatus(order.lulu_job_id)}
                                            disabled={luluStatusInfo?.loading}
                                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-wait"
                                        >
                                            {luluStatusInfo?.loading ? 'Checking...' : 'Check Live Shipping Status'}
                                        </button>
                                        {luluStatusInfo?.data && (
                                            <div className="mt-4 p-3 bg-slate-900/50 rounded-md text-sm">
                                                <p className="font-bold">Latest Status: <span className="font-normal capitalize text-cyan-400">{luluStatusInfo.data.status?.replaceAll("_", " ")}</span></p>
                                                {luluStatusInfo.data.tracking_urls?.length > 0 && (
                                                    <a href={luluStatusInfo.data.tracking_urls[0]} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">
                                                        View Tracking Information
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                        {luluStatusInfo?.error && <p className="text-red-400 text-sm mt-2">{luluStatusInfo.error}</p>}
                                    </div>
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    );
};

export default MyOrdersPage;