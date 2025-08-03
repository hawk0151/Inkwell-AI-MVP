// frontend/src/pages/MyOrdersPage.jsx
import React, { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';
import { LoadingSpinner } from '../components/common.jsx';

const MyOrdersPage = () => {
    const [orders, setOrders] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        console.log('[MyOrdersPage] Component mounted. Starting data fetch...');

        const fetchOrders = async () => {
            try {
                // --- MODIFIED: API call changed for testing ---
                console.log('[MyOrdersPage] Making API call to GET /orders/my-orders-v2');
                const response = await apiClient.get('/orders/my-orders-v2');
                
                console.log('[MyOrdersPage] API call successful. Data received:', response.data);
                setOrders(response.data);

            } catch (err) {
                console.error('[MyOrdersPage] API call FAILED. Full error object:', err);
                setError(err.response ? `Server responded with status ${err.response.status}: ${err.response.data?.message}` : `Network Error: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, []);

    if (loading) {
        return <LoadingSpinner text="Attempting to load orders..." />;
    }

    if (error) {
        return (
            <div className="container mx-auto p-4 text-white">
                <h1 className="text-3xl font-bold text-red-500 mb-4">An Error Occurred</h1>
                <p className="font-mono bg-slate-800 p-4 rounded-md">{error}</p>
            </div>
        );
    }

    if (orders && orders.length === 0) {
        return (
            <div className="container mx-auto p-4 text-white">
                <h1 className="text-3xl font-bold mb-4">My Orders</h1>
                <p className="text-lg">No orders found.</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 text-white">
            <h1 className="text-3xl font-bold mb-4">My Orders (Success!)</h1>
            <ul className="space-y-4">
                {orders && orders.map((order) => (
                    <li key={order.id} className="bg-slate-800 p-4 rounded-md">
                        <p className="font-mono">Order ID: {order.id}</p>
                        <p>Title: {order.book_title}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default MyOrdersPage;