// frontend/src/services/apiClient.js
import axios from 'axios';
import { getAuth } from 'firebase/auth'; // Import getAuth from Firebase

// Determine the backend URL based on the environment variable
const BACKEND_URL = import.meta.env.VITE_APP_BACKEND_URL || 'http://localhost:5001';

// Create an Axios instance
const apiClient = axios.create({
    baseURL: `${BACKEND_URL}/api`,
    withCredentials: true,
});

// Request Interceptor: Attach Firebase ID token to outgoing requests
apiClient.interceptors.request.use(
    async (config) => {
        const auth = getAuth();
        const user = auth.currentUser;

        // --- DEBUG LOG START: Check user status before token attempt ---
        console.log("API Client Interceptor: Checking current Firebase user...");
        if (user) {
            console.log("API Client Interceptor: User found:", user.uid);
        } else {
            console.log("API Client Interceptor: No user currently logged in.");
            // If no user, and this is an authenticated route, redirect to login immediately.
            // Assuming most API calls require auth on NovelPage.
            if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
                console.warn("API Client Interceptor: No user found for authenticated route. Redirecting to login.");
                window.location.href = '/login'; // Force redirect to login
                return Promise.reject(new Error("No authenticated user. Redirecting to login.")); // Stop current request
            }
            // For non-authenticated routes or login page itself, just proceed without token.
            return config;
        }
        // --- DEBUG LOG END ---

        try {
            // Attempt to get ID token with a clear timeout
            const token = await Promise.race([
                user.getIdToken(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase ID token retrieval timed out')), 7000)) // Increased timeout to 7 seconds
            ]);
            console.log("API Client Interceptor: Successfully retrieved Firebase ID token.");
            config.headers.Authorization = `Bearer ${token}`;
        } catch (error) {
            console.error("API Client Interceptor: Error getting Firebase ID token:", error);
            // More specific error handling for auth failures
            if (error.code && error.code.startsWith('auth/')) {
                console.warn(`API Client Interceptor: Firebase Auth error (${error.code}). User session might be invalid. Redirecting to login.`);
                // Prevent infinite loops and ensure we only redirect if not already on auth pages
                if (!['/login', '/signup'].includes(window.location.pathname)) {
                    window.location.href = '/login'; // Force full page reload for clean Firebase state
                }
            } else if (error.message.includes('timed out')) {
                 console.warn("API Client Interceptor: Firebase ID token retrieval timed out. Network or Firebase issue. Redirecting to login.");
                 if (!['/login', '/signup'].includes(window.location.pathname)) {
                    window.location.href = '/login'; // Force full page reload
                 }
            } else {
                console.warn("API Client Interceptor: Unknown error getting Firebase ID token. Redirecting to login.");
                if (!['/login', '/signup'].includes(window.location.pathname)) {
                    window.location.href = '/login'; // Fallback redirect
                }
            }
            // Reject the config so the original API call fails immediately.
            return Promise.reject(new Error("Failed to authenticate Firebase user."));
        }
        return config;
    },
    (error) => {
        // This catch block handles errors *before* the request is sent, e.g., if config creation fails.
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
                window.location.href = '/login'; // Force full page reload for clean state
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