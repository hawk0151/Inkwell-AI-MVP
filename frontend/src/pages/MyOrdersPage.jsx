// frontend/src/pages/MyOrdersPage.jsx
import React, { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';
import { motion } from 'framer-motion';
import PageHeader from '../components/PageHeader';
import { LoadingSpinner, Alert } from '../components/common.jsx';
import { ArchiveBoxIcon } from '@heroicons/react/24/outline';

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
        <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
            <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <PageHeader 
                    title="My Orders"
                    subtitle="A history of your completed purchases and their shipping status."
                />
                
                {orders.length === 0 ? (
                    <div className="text-center py-16 bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700">
                        <ArchiveBoxIcon className="mx-auto h-24 w-24 text-slate-600" />
                        <h3 className="mt-4 text-2xl font-semibold text-white font-serif">No Orders Found</h3>
                        <p className="mt-2 text-slate-400">When you purchase a book, your order will appear here.</p>
                    </div>
                ) : (
                    <motion.div 
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="space-y-6"
                    >
                        {orders.map(order => (
                            <motion.div 
                                key={order.id} 
                                variants={itemVariants} 
                                whileHover={{ y: -5 }}
                                className="bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-slate-700"
                            >
                                <div className="flex flex-col sm:flex-row justify-between items-start">
                                    <div className="mb-4 sm:mb-0">
                                        <h2 className="text-xl font-bold font-serif text-white">{order.book_title}</h2>
                                        <p className="text-sm text-slate-400">Order ID: {order.id}</p>
                                        <p className="text-sm text-slate-400">
                                            Last Updated: {new Date(order.updated_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <p className="text-2xl font-bold text-teal-400">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency || 'USD' }).format(order.total_price_usd)}
                                        </p>
                                        <p className="text-sm capitalize font-medium text-cyan-400">{order.status}</p>
                                    </div>
                                </div>
                                {order.lulu_job_id && (
                                    <div className="mt-4 pt-4 border-t border-slate-700">
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => fetchLuluStatus(order.lulu_job_id)}
                                            disabled={statusCache[order.lulu_job_id]?.loading}
                                            className="bg-indigo-600 px-4 py-2 rounded-lg text-white font-semibold hover:bg-indigo-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {statusCache[order.lulu_job_id]?.loading ? 'Checking...' : 'Check Shipping Status'}
                                        </motion.button>
                                        {statusCache[order.lulu_job_id]?.data && (
                                            <div className="mt-4 p-4 bg-slate-700/50 rounded-lg">
                                                <p className="text-white"><span className="font-bold text-slate-300">Lulu Status:</span> {statusCache[order.lulu_job_id].data.status}</p>
                                                {statusCache[order.lulu_job_id].data.tracking_urls?.length > 0 && (
                                                     <a href={statusCache[order.lulu_job_id].data.tracking_urls[0]} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">
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
        </div>
    );
};

export default MyOrdersPage;