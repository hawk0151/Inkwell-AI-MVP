// frontend/src/pages/MyOrdersPage.jsx
import React, { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';
import { motion } from 'framer-motion';
import PageHeader from '../components/PageHeader';
import { LoadingSpinner, Alert } from '../components/common.jsx';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
};

const MyOrdersPage = () => {
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
        <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <PageHeader 
                title="My Orders"
                subtitle="A history of your completed purchases and their shipping status."
            />
            
            {orders.length === 0 ? (
                <div className="bg-slate-800/50 rounded-lg p-6">
                    <p className="text-slate-400 text-center py-8">You haven't placed any orders yet.</p>
                </div>
            ) : (
                <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-6"
                >
                    {orders.map(order => (
                        <motion.div key={order.id} variants={itemVariants} className="bg-slate-800 p-6 rounded-lg shadow-lg">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-bold">{order.book_title}</h2>
                                    <p className="text-sm text-slate-400">Order ID: {order.id}</p>
                                    <p className="text-sm text-slate-400">
                                        Last Updated: {new Date(order.updated_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-semibold">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency || 'USD' }).format(order.total_price_usd)}
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
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </div>
    );
};

export default MyOrdersPage;