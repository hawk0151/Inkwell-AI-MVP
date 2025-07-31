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
        const response = await apiClient.get('/orders');
        setOrders(response?.data || []);
      } catch (err) {
        console.error('Failed to fetch orders:', err);
        setError('Failed to load your orders.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [currentUser]);

  if (loading) return <LoadingSpinner text="Loading your orders..." />;
  if (error) return <Alert type="error" message={error} />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">My Orders</h1>
      {orders.length === 0 ? (
        <p>You have no orders.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li
              key={order._id}
              className="border p-4 rounded shadow-sm bg-white dark:bg-gray-800"
            >
              <h2 className="font-semibold">{order.productName || 'Unnamed Product'}</h2>
              <p>Status: {order.status || 'Unknown'}</p>
              <p>Ordered on: {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MyOrdersPage;
