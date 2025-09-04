// frontend/src/services/apiClient.js
import axios from 'axios';
import { auth } from '../firebase'; // Import the auth instance directly

const apiClient = axios.create({
    baseURL: 'http://localhost:5001/api',
    headers: {
        'Content-Type': 'application/json',
    },
    // NOTE: Removed `withCredentials: true` as it's not needed for token-based auth
    // and can sometimes cause CORS issues. The Authorization header handles authentication.
});

// Request Interceptor: Attach Firebase ID token to outgoing requests
apiClient.interceptors.request.use(
    async (config) => {
        const user = auth.currentUser;

        // This logic is fine for a development environment where unauthenticated
        // access is restricted. For production, you might want to allow certain
        // public routes to pass through without a user.
        if (!user) {
            if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
                window.location.href = '/login';
                return Promise.reject(new Error("No authenticated user. Redirecting to login."));
            }
            return config;
        }

        try {
            const token = await user.getIdToken();
            config.headers.Authorization = `Bearer ${token}`;
        } catch (error) {
            console.error("API Client Interceptor: Error getting Firebase ID token:", error);
            if (!['/login', '/signup'].includes(window.location.pathname)) {
                window.location.href = '/login';
            }
            return Promise.reject(new Error("Failed to authenticate Firebase user."));
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle auth errors globally
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const statusCode = error.response ? error.response.status : null;
        // Handle 401 Unauthorized by redirecting to login
        if (statusCode === 401) {
            if (!['/login', '/signup'].includes(window.location.pathname)) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;