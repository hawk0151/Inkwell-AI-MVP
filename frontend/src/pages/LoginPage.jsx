// frontend/src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
// import apiClient from '../services/apiClient'; // No longer needed for login/signup
// import { GoogleLogin } from '@react-oauth/google'; // REMOVED: This is the conflicting library

function LoginPage() {
    const navigate = useNavigate();
    const [isSigningUp, setIsSigningUp] = useState(false);
    // NEW: Add username state for sign-up form
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // NEW: Get all auth functions from our context
    const { login, signup, signInWithGoogle } = useAuth();

    // NEW: Simplified Google Sign-In handler
    const handleGoogleSignIn = async () => {
        setError('');
        setIsLoading(true);
        try {
            await signInWithGoogle();
            navigate('/feed'); // Navigate to the feed after successful login
        } catch (err) {
            console.error("Google Sign-In Error:", err);
            setError("Google Sign-In failed. Please try again.");
            setIsLoading(false);
        }
    };

    // UPDATED: Email/Password form handler
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (isSigningUp) {
                if (!username) {
                    setError("Username is required for sign up.");
                    setIsLoading(false);
                    return;
                }
                // Use the signup function from our context
                await signup(email, password, username);
            } else {
                // Use the login function from our context
                await login(email, password);
            }
            navigate('/feed'); // Navigate to the feed after success
        } catch (err) {
            console.error("Form Submit Error:", err);
            // Provide more specific Firebase error messages
            setError(err.message || 'An error occurred.');
            setIsLoading(false);
        }
    };

    // The styles below are simplified to match your existing theme.
    // Feel free to adjust them as needed.
    return (
        <div className="w-full max-w-sm mx-auto">
            <div className="bg-gray-800 shadow-lg rounded-lg p-8">
                <h2 className="text-2xl font-bold text-center text-white mb-6">
                    {isSigningUp ? 'Create Account' : 'Member Login'}
                </h2>

                {/* REPLACED: The old GoogleLogin component with a simple button */}
                <button
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 bg-white text-gray-700 font-semibold py-2 px-4 rounded-md border border-gray-300 hover:bg-gray-100 transition"
                >
                    <svg className="w-5 h-5" viewBox="0 0 48 48">
                        <path fill="#4285F4" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#34A853" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l5.657,5.657C41.848,35.62,44,30.338,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FBBC05" d="M10.22,28.492l5.657-5.657C14.956,21.68,14,19.95,14,18s0.956-3.68,1.863-4.835l-5.657-5.657C8.904,9.657,8,13.66,8,18s0.904,8.343,2.22,10.492z"></path><path fill="#EA4335" d="M24,48c5.268,0,10.046-1.953,13.571-5.222l-5.657-5.657C30.046,38.24,27.059,39,24,39c-3.956,0-7.343-2.231-9.016-5.492l-5.657,5.657C7.657,43.047,13.48,48,24,48z"></path><path fill="none" d="M0,0h48v48H0z"></path>
                    </svg>
                    Sign in with Google
                </button>

                <div className="my-6 flex items-center">
                    <div className="flex-grow border-t border-gray-600"></div>
                    <span className="flex-shrink mx-4 text-gray-400 text-sm">OR</span>
                    <div className="flex-grow border-t border-gray-600"></div>
                </div>

                <form className="space-y-4" onSubmit={handleSubmit}>
                    {/* NEW: Username field for sign-up */}
                    {isSigningUp && (
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-300">Username</label>
                            <input type="text" id="username" value={username} onChange={e => setUsername(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required />
                        </div>
                    )}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300">Email Address</label>
                        <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300">Password</label>
                        <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required />
                    </div>
                    
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    
                    <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition disabled:bg-gray-500">
                        {isLoading ? 'Please wait...' : (isSigningUp ? 'Sign Up' : 'Sign In')}
                    </button>
                </form>

                <p className="text-center text-sm text-gray-400 mt-6">
                    {isSigningUp ? 'Already have an account?' : "Don't have an account?"}
                    <a href="#" onClick={(e) => { e.preventDefault(); setError(''); setIsSigningUp(!isSigningUp); }} className="font-medium text-indigo-400 hover:text-indigo-300 ml-1">
                        {isSigningUp ? 'Sign In' : 'Sign Up'}
                    </a>
                </p>
            </div>
        </div>
    );
}

export default LoginPage;