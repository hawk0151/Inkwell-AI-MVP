// frontend/src/pages/MyOrdersPage.jsx
import React, { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';
import { LoadingSpinner, Alert } from '../components/common.jsx';

const MyOrdersPage = () => {
    // --- MODIFIED: Initial state changed from null to an empty array [] to prevent crash ---
    const [orders, setOrders] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusCache, setStatusCache] = useState({});

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await apiClient.get('/orders/my-orders');
                setOrders(response.data || []);
            } catch (err) {
                setError('Failed to load your orders.');
                console.error('Failed to fetch orders:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, []);

    const fetchLuluStatus = async (luluJobId) => {
        if (!luluJobId || statusCache[luluJobId]?.loading) { return; }
        setStatusCache(prev => ({ ...prev, [luluJobId]: { loading: true } }));
        try {
            const response = await apiClient.get(`/orders/status/${luluJobId}`);
            setStatusCache(prev => ({ ...prev, [luluJobId]: { loading: false, data: response.data } }));
        } catch (err) {
            setStatusCache(prev => ({ ...prev, [luluJobId]: { loading: false, error: 'Failed to get status.' } }));
        }
    };

    if (loading) return <LoadingSpinner text="Loading your orders..." />;
    if (error) return <Alert type="error" message={error} />;

    return (
        <div className="container mx-auto p-4 text-white">
            <h1 className="text-3xl font-bold mb-6">My Orders</h1>
            {orders.length === 0 ? (
                <p>You haven't placed any orders yet.</p>
            ) : (
                <div className="space-y-6">
                    {orders.map(order => (
                        <div key={order.id} className="bg-slate-800 p-6 rounded-lg shadow-lg">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-bold">{order.book_title}</h2>
                                    <p className="text-sm text-slate-400">Order ID: {order.id}</p>
                                    <p className="text-sm text-slate-400">
                                        Placed on: {new Date(order.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-semibold">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency || 'USD' }).format((order.total_cost || 0) / 100)}
                                    </p>
                                    <p className="text-sm capitalize font-medium text-cyan-400">{order.status}</p>
                                </div>
                            </div>
                            {order.lulu_job_id && (
                                <div className="mt-4 pt-4 border-t border-slate-700">
                                    <button
                                        onClick={() => fetchLuluStatus(order.lulu_job_id)}
                                        disabled={statusCache[order.lulu_job_id]?.loading}
                                        className="bg-blue-600 px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-400"
                                    >
                                        {statusCache[order.lulu_job_id]?.loading ? 'Checking...' : 'Check Shipping Status'}
                                    </button>
                                    {statusCache[order.lulu_job_id]?.data && (
                                        <div className="mt-4 p-4 bg-slate-700 rounded-md">
                                            <p><span className="font-bold">Lulu Status:</span> {statusCache[order.lulu_job_id].data.status}</p>
                                            {statusCache[order.lulu_job_id].data.tracking_urls?.length > 0 && (
                                                 <a href={statusCache[order.lulu_job_id].data.tracking_urls[0]} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">
                                                    View Tracking
                                                 </a>
                                            )}
                                        </div>
                                    )}
                                    {statusCache[order.lulu_job_id]?.error && (
                                        <p className="text-red-400 mt-2">{statusCache[order.lulu_job_id].error}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default MyOrdersPage;