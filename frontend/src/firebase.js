// frontend/src/firebase.js
import { initializeApp } from "firebase/app";
import { getAnalytics, setAnalyticsCollectionEnabled } from "firebase/analytics"; // 1. ADD `setAnalyticsCollectionEnabled`
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

// 2. ADD THIS FUNCTION TO ENABLE ANALYTICS ON USER CONSENT
export const enableAnalytics = () => {
    // This 'gtag' function is now available globally from the script in index.html
    window.gtag('consent', 'update', {
        'analytics_storage': 'granted'
    });
    setAnalyticsCollectionEnabled(analytics, true);
    console.log("Firebase Analytics collection has been enabled.");
};