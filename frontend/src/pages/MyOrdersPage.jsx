// frontend/src/pages/MyOrdersPage.jsx
import React, { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';
import { LoadingSpinner } from '../components/common.jsx';

const MyOrdersPage = () => {
    const [orders, setOrders] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                // --- This now calls the unprotected test route ---
                const response = await apiClient.get('/orders/test-no-auth');
                setOrders(response.data);
            } catch (err) {
                setError(err.response ? `Server responded with status ${err.response.status}` : `Network Error`);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, []);

    if (loading) {
        return <LoadingSpinner text="Running auth isolation test..." />;
    }

    if (error) {
        return (
            <div className="container mx-auto p-4 text-white">
                <h1 className="text-3xl font-bold text-red-500 mb-4">An Error Occurred</h1>
                <p className="font-mono bg-slate-800 p-4 rounded-md">{error}</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 text-white">
            <h1 className="text-3xl font-bold mb-4">My Orders (Auth Isolation Test)</h1>
            {orders && orders.length > 0 ? (
                <ul className="space-y-4">
                    {orders.map((order) => (
                        <li key={order.id} className="bg-slate-800 p-4 rounded-md">
                            <p className="font-mono">Order ID: {order.id}</p>
                            <p>Title: {order.book_title}</p>
                        </li>
                    ))}
                </ul>
            ) : (
                 <p className="text-lg">No sample orders found.</p>
            )}
        </div>
    );
};

export default MyOrdersPage;