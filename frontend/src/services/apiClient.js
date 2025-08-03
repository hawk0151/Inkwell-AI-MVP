// frontend/src/services/apiClient.js
import axios from 'axios';
import { getAuth } from 'firebase/auth';

const apiClient = axios.create({
    // This uses the VITE_API_BASE_URL directly, which should be 'https://.../api'
    baseURL: import.meta.env.VITE_API_BASE_URL,
    withCredentials: true,
});

// Request Interceptor: Attach Firebase ID token to outgoing requests
apiClient.interceptors.request.use(
    async (config) => {
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
            if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
                window.location.href = '/login';
                return Promise.reject(new Error("No authenticated user."));
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

// Response Interceptor: Handle errors globally
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const statusCode = error.response ? error.response.status : null;
        if (statusCode === 401) {
            if (!['/login', '/signup'].includes(window.location.pathname)) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;