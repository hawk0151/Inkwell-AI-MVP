// frontend/src/services/apiClient.js
import axios from 'axios';
import { getAuth } from 'firebase/auth'; // Import getAuth from Firebase

// Determine the backend URL based on the environment variable
// In a Vite app, environment variables prefixed with VITE_ are exposed via import.meta.env
const BACKEND_URL = import.meta.env.VITE_APP_BACKEND_URL || 'http://localhost:5001';

// Create an Axios instance
const apiClient = axios.create({
    baseURL: `${BACKEND_URL}/api`, // Use the environment variable for the base URL
    withCredentials: true, // Send cookies with requests
});

// Request Interceptor: Attach Firebase ID token to outgoing requests
apiClient.interceptors.request.use(
    async (config) => {
        try {
            const auth = getAuth();
            const user = auth.currentUser;
            if (user) {
                // MODIFIED: Added a timeout for getIdToken and better error handling
                const token = await Promise.race([
                    user.getIdToken(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase ID token retrieval timed out')), 5000)) // 5 second timeout
                ]);
                config.headers.Authorization = `Bearer ${token}`;
            } else {
                // If no user is logged in, ensure Authorization header is not sent.
                // Or, if it's an authenticated route, redirect to login.
                // For now, let's allow non-auth requests to proceed, but for critical pages like NovelPage,
                // we assume user must be logged in.
            }
        } catch (error) {
            console.error("Error getting Firebase ID token in interceptor:", error);
            // If token retrieval fails (e.g., auth/popup-closed-by-user, timeout),
            // prevent the API request from proceeding without auth.
            // For now, reject the config, which will cause the API call to fail.
            // The component's error handling for the API call will then take over.
            // If the error is auth-related, a redirect to login might be appropriate here.

            // MODIFIED: If it's a known auth issue, redirect to login
            if (error.code === 'auth/popup-closed-by-user' || error.message.includes('timed out')) {
                console.warn("Auth token error. Redirecting to login.");
                // Prevent infinite redirect loops. Only redirect if not already on login page.
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login'; // Force full page reload to ensure Firebase state is reset
                }
            }
            return Promise.reject(error); // Stop the original API request
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle errors globally
apiClient.interceptors.response.use(
    (response) => response, // Just return response for success
    (error) => {
        const statusCode = error.response ? error.response.status : null;
        console.error("API call error:", error.response?.data || error.message);

        // Example error handling:
        if (statusCode === 401) {
            // Unauthorized - redirect to login
            console.warn("Unauthorized API call. Redirecting to login.");
            // Prevent infinite redirect loops. Only redirect if not already on login page.
            if (window.location.pathname !== '/login') {
                window.location.href = '/login'; // Force full page reload to ensure Firebase state is reset
            }
        } else if (statusCode === 403) {
            // Forbidden - user doesn't have permission
            console.warn("Forbidden API call. User lacks permission.");
        } else if (statusCode === 404) {
            // Not Found - log or show user a generic error
            console.warn("API endpoint not found. Check URL or backend status.");
        }

        return Promise.reject(error); // Re-throw the error
    }
);

export default apiClient;