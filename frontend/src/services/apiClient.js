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
                const token = await user.getIdToken();
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            console.error("Error getting Firebase ID token:", error);
            // Optionally, handle token refresh or redirect to login
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
            // Unauthorized - redirect to login, refresh token etc.
            console.warn("Unauthorized API call. Consider redirecting to login.");
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