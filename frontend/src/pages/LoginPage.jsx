// frontend/src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { Alert } from '../components/common';

function LoginPage() {
    const navigate = useNavigate();
    const [isSigningUp, setIsSigningUp] = useState(false);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const { login, signup, signInWithGoogle } = useAuth();

    const handleGoogleSignIn = async () => {
        setError('');
        setIsLoading(true);
        try {
            await signInWithGoogle();
            navigate('/my-projects'); // Navigate to projects after successful login
        } catch (err) {
            console.error("Google Sign-In Error:", err);
            setError("Google Sign-In failed. Please try again.");
            setIsLoading(false);
        }
    };

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
                await signup(email, password, username);
            } else {
                await login(email, password);
            }
            navigate('/my-projects'); // Navigate to projects after success
        } catch (err) {
            console.error("Form Submit Error:", err);
            setError(err.message || 'An error occurred.');
            setIsLoading(false);
        }
    };

    const inputClasses = "w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500";
    const labelClasses = "block text-sm font-medium text-slate-300 mb-2";

    return (
        <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="w-full max-w-md mx-auto bg-slate-800/50 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-slate-700"
            >
                <h2 className="text-4xl font-bold text-center text-white mb-6 font-serif">
                    {isSigningUp ? 'Create Account' : 'Welcome Back'}
                </h2>
                {error && <Alert type="error" message={error} onClose={() => setError('')} />}

                <button
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-3 bg-slate-100 text-slate-800 font-semibold py-3 px-4 rounded-lg border border-slate-300 hover:bg-white transition-colors duration-300"
                >
                    <svg className="w-5 h-5" viewBox="0 0 48 48">
                        <path fill="#4285F4" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#34A853" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l5.657,5.657C41.848,35.62,44,30.338,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FBBC05" d="M10.22,28.492l5.657-5.657C14.956,21.68,14,19.95,14,18s0.956-3.68,1.863-4.835l-5.657-5.657C8.904,9.657,8,13.66,8,18s0.904,8.343,2.22,10.492z"></path><path fill="#EA4335" d="M24,48c5.268,0,10.046-1.953,13.571-5.222l-5.657-5.657C30.046,38.24,27.059,39,24,39c-3.956,0-7.343-2.231-9.016-5.492l-5.657,5.657C7.657,43.047,13.48,48,24,48z"></path><path fill="none" d="M0,0h48v48H0z"></path>
                    </svg>
                    Sign in with Google
                </button>

                <div className="my-6 flex items-center">
                    <div className="flex-grow border-t border-slate-700"></div>
                    <span className="flex-shrink mx-4 text-slate-400 text-sm">OR</span>
                    <div className="flex-grow border-t border-slate-700"></div>
                </div>

                <form className="space-y-4" onSubmit={handleSubmit}>
                    {isSigningUp && (
                        <div>
                            <label htmlFor="username" className={labelClasses}>Username</label>
                            <input type="text" id="username" value={username} onChange={e => setUsername(e.target.value)} className={inputClasses} required />
                        </div>
                    )}
                    <div>
                        <label htmlFor="email" className={labelClasses}>Email Address</label>
                        <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClasses} required />
                    </div>
                    <div>
                        <label htmlFor="password" className={labelClasses}>Password</label>
                        <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} className={inputClasses} required />
                    </div>
                    
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="submit" 
                        disabled={isLoading} 
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 disabled:bg-slate-500 disabled:cursor-not-allowed shadow-lg"
                    >
                        {isLoading ? 'Please wait...' : (isSigningUp ? 'Create Account' : 'Sign In')}
                    </motion.button>
                </form>

                <p className="text-center text-sm text-slate-400 mt-6">
                    {isSigningUp ? 'Already have an account?' : "Don't have an account?"}
                    <button onClick={() => { setError(''); setIsSigningUp(!isSigningUp); }} className="font-medium text-indigo-400 hover:text-indigo-300 ml-1 transition-colors">
                        {isSigningUp ? 'Sign In' : 'Sign Up'}
                    </button>
                </p>
            </motion.div>
        </div>
    );
}

export default LoginPage;