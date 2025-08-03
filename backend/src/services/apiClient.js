// frontend/src/services/apiClient.js
import axios from 'axios';
import { getAuth } from 'firebase/auth';

// --- MODIFIED: Renamed variable to match what's in Render ---
const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

// Create an Axios instance
const apiClient = axios.create({
    // --- MODIFIED: Removed the extra '/api' ---
    baseURL: VITE_API_BASE_URL,
    withCredentials: true,
});

// Request Interceptor: Attach Firebase ID token to outgoing requests
apiClient.interceptors.request.use(
    async (config) => {
        const auth = getAuth();
        const user = auth.currentUser;

        console.log("API Client Interceptor: Checking current Firebase user...");
        if (user) {
            console.log("API Client Interceptor: User found:", user.uid);
        } else {
            console.log("API Client Interceptor: No user currently logged in.");
            if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
                console.warn("API Client Interceptor: No user found for authenticated route. Redirecting to login.");
                window.location.href = '/login';
                return Promise.reject(new Error("No authenticated user. Redirecting to login."));
            }
            return config;
        }

        try {
            const token = await Promise.race([
                user.getIdToken(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase ID token retrieval timed out')), 7000))
            ]);
            console.log("API Client Interceptor: Successfully retrieved Firebase ID token.");
            config.headers.Authorization = `Bearer ${token}`;
        } catch (error) {
            console.error("API Client Interceptor: Error getting Firebase ID token:", error);
            if (error.code && error.code.startsWith('auth/')) {
                console.warn(`API Client Interceptor: Firebase Auth error (${error.code}). User session might be invalid. Redirecting to login.`);
                if (!['/login', '/signup'].includes(window.location.pathname)) {
                    window.location.href = '/login';
                }
            } else if (error.message.includes('timed out')) {
                 console.warn("API Client Interceptor: Firebase ID token retrieval timed out. Network or Firebase issue. Redirecting to login.");
                 if (!['/login', '/signup'].includes(window.location.pathname)) {
                    window.location.href = '/login';
                 }
            } else {
                console.warn("API Client Interceptor: Unknown error getting Firebase ID token. Redirecting to login.");
                if (!['/login', '/signup'].includes(window.location.pathname)) {
                    window.location.href = '/login';
                }
            }
            return Promise.reject(new Error("Failed to authenticate Firebase user."));
        }
        return config;
    },
    (error) => {
        console.error("API Client Interceptor: Request config error:", error);
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle errors globally
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const statusCode = error.response ? error.response.status : null;
        console.error("API Client Interceptor: API call failed with status:", statusCode, error.response?.data || error.message);

        if (statusCode === 401) {
            console.warn("API Client Interceptor: 401 Unauthorized API call. Redirecting to login.");
            if (!['/login', '/signup'].includes(window.location.pathname)) {
                window.location.href = '/login';
            }
        } else if (statusCode === 403) {
            console.warn("API Client Interceptor: 403 Forbidden API call. User lacks permission.");
        } else if (statusCode === 404) {
            console.warn("API Client Interceptor: 404 Not Found. Check URL or backend route definition.");
        } else if (statusCode === 500) {
            console.error("API Client Interceptor: 500 Internal Server Error. Check backend logs.");
        }

        return Promise.reject(error);
    }
);

export default apiClient;