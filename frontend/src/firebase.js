// frontend/src/firebase.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics"; // Keep getAnalytics here if you want it initialized globally

// Your web app's Firebase configuration from your .env files
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase app instance
const app = initializeApp(firebaseConfig);

// Export the app instance. Services will be obtained from this instance where needed.
export default app;

// Optionally, you can still export analytics if you want it to be initialized immediately
export const analytics = getAnalytics(app);