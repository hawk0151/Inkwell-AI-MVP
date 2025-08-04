// frontend/src/App.jsx
// MODIFIED: Added useRef and useEffect for the dropdown, and automatic hash scrolling support
import React, { useState, useRef, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ProductSelectionPage from './pages/ProductSelectionPage.jsx';
import PictureBookPage from './pages/PictureBookPage.jsx';
import MyProjectsPage from './pages/MyProjectsPage.jsx';
import MyOrdersPage from './pages/MyOrdersPage.jsx';
import CancelPage from './pages/CancelPage.jsx';
import CheckoutSuccessPage from './pages/CheckoutSuccessPage.jsx';
import NovelPage from './pages/NovelPage.jsx';
import NovelSelectionPage from './pages/NovelSelectionPage.jsx';
import FeedPage from './pages/FeedPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import EditProfilePage from './pages/EditProfilePage.jsx';
import AboutHowItWorksPage from './pages/AboutHowItWorksPage.jsx';
import PolicyPage from './pages/PolicyPage.jsx'; // Consolidated policy page
import Home from './pages/Home'; // assuming Home exists
import Logo from './components/Logo.jsx'; // assuming Logo component exists

function ProtectedRoute({ children }) {
    const { currentUser } = useAuth();
    if (!currentUser) return <LoginPage />;
    return children;
}

// Scroll-to-hash helper: scrolls into view when the location hash changes or on initial load
function ScrollToHash() {
    const location = useLocation();

    useEffect(() => {
        if (location.hash) {
            // slight delay to allow target element to render
            setTimeout(() => {
                const id = location.hash.substring(1);
                const el = document.getElementById(id);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 50);
        } else {
            // no hash: optionally scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [location]);

    return null;
}

const AppFooter = () => (
    <footer className="bg-black/20 mt-20 py-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-400 text-sm">
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                <Link to="/policies#terms-of-service-section" className="hover:text-white transition-colors">Terms of Service</Link>
                <Link to="/policies#privacy-policy-section" className="hover:text-white transition-colors">Privacy Policy</Link>
                <Link to="/policies#shipping-policy-section" className="hover:text-white transition-colors">Shipping Policy</Link>
                <Link to="/policies#refund-policy-section" className="hover:text-white transition-colors">Refund Policy</Link>
                <Link to="/policies#return-policy-section" className="hover:text-white transition-colors">Return Policy</Link>
            </div>
            <p className="mt-4">&copy; {new Date().getFullYear()} Inkwell AI. All Rights Reserved.</p>
        </div>
    </footer>
);

// Profile Dropdown Component
const ProfileDropdown = ({ user, onLogout }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNavigate = (path) => {
        navigate(path);
        setIsOpen(false);
    };

    const handleLogout = () => {
        onLogout();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center space-x-2 p-1 rounded-full hover:bg-white/10 transition-colors">
                <img
                    src={user.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user.username || user.email)}`}
                    alt="Profile"
                    className="w-8 h-8 rounded-full bg-slate-700 object-cover"
                />
                <span className="text-white font-medium text-sm hidden lg:block">{user.username}</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-20"
                    >
                        <div className="py-1">
                            <button onClick={() => handleNavigate(`/profile/${encodeURIComponent(user.username)}`)} className="w-full text-left block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">My Profile</button>
                            <button onClick={() => handleNavigate('/my-projects')} className="w-full text-left block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">My Projects</button>
                            <button onClick={() => handleNavigate('/my-orders')} className="w-full text-left block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">My Orders</button>
                            <div className="border-t border-slate-700 my-1"></div>
                            <button onClick={handleLogout} className="w-full text-left block px-4 py-2 text-sm text-red-400 hover:bg-slate-700">Logout</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

function App() {
    const { currentUser, logout, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const isLinkActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

    const NavLink = ({ to, children }) => (
        <Link
            to={to}
            onClick={() => setIsMobileMenuOpen(false)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isLinkActive(to) ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
        >
            {children}
        </Link>
    );

    const MobileNavLink = ({ to, children }) => (
        <Link
            to={to}
            onClick={() => setIsMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-medium text-white hover:bg-gray-700 rounded-md"
        >
            {children}
        </Link>
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex justify-center items-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white font-inter flex flex-col">
            <ScrollToHash />
            <nav className="bg-black/20 backdrop-blur-lg shadow-lg sticky top-0 z-50 border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="cursor-pointer">
                            <Logo />
                        </Link>
                        <div className="hidden md:flex items-center space-x-4">
                            <NavLink to="/">Create</NavLink>
                            <NavLink to="/feed">Feed</NavLink>
                            <NavLink to="/about-how-it-works">About & How It Works</NavLink>
                            {currentUser ? (
                                <ProfileDropdown
                                    user={currentUser}
                                    onLogout={() => {
                                        logout();
                                        navigate('/');
                                    }}
                                />
                            ) : (
                                <button
                                    onClick={() => navigate('/login')}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition shadow-sm"
                                >
                                    Login
                                </button>
                            )}
                        </div>
                        <div className="-mr-2 flex md:hidden">
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                            >
                                <span className="sr-only">Open main menu</span>
                                {!isMobileMenuOpen ? (
                                    <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                ) : (
                                    <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
                {isMobileMenuOpen && (
                    <div className="md:hidden">
                        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                            <MobileNavLink to="/">Create</MobileNavLink>
                            <MobileNavLink to="/feed">Feed</MobileNavLink>
                            <MobileNavLink to="/about-how-it-works">About & How It Works</MobileNavLink>
                            {currentUser ? (
                                <>
                                    {currentUser.username && (
                                        <MobileNavLink to={`/profile/${encodeURIComponent(currentUser.username)}`}>
                                            My Profile
                                        </MobileNavLink>
                                    )}
                                    <MobileNavLink to="/my-projects">My Projects</MobileNavLink>
                                    <MobileNavLink to="/my-orders">My Orders</MobileNavLink>
                                    <button
                                        onClick={() => {
                                            logout();
                                            navigate('/');
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className="block w-full text-left px-3 py-2 text-base font-medium text-white hover:bg-gray-700 rounded-md"
                                    >
                                        Logout
                                    </button>
                                </>
                            ) : (
                                <MobileNavLink to="/login">Login</MobileNavLink>
                            )}
                        </div>
                    </div>
                )}
            </nav>

            <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 flex-grow w-full">
                <Routes>
                    <Route path="/" element={<ProductSelectionPage />} />
                    <Route path="/select-novel" element={<NovelSelectionPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/about-how-it-works" element={<AboutHowItWorksPage />} />
                    <Route path="/checkout-success" element={<CheckoutSuccessPage />} />
                    <Route path="/cancel" element={<CancelPage />} />
                    <Route path="/policies" element={<PolicyPage />} />
                    {/* Legacy shortcuts */}
                    <Route path="/terms" element={<Navigate to="/policies#terms-of-service-section" replace />} />
                    <Route path="/privacy" element={<Navigate to="/policies#privacy-policy-section" replace />} />
                    <Route path="/refund" element={<Navigate to="/policies#refund-policy-section" replace />} />
                    <Route path="/return" element={<Navigate to="/policies#return-policy-section" replace />} />
                    <Route path="/shipping" element={<Navigate to="/policies#shipping-policy-section" replace />} />

                    <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
                    <Route path="/profile/:username" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                    <Route path="/profile/edit" element={<ProtectedRoute><EditProfilePage /></ProtectedRoute>} />
                    <Route path="/novel/new" element={<ProtectedRoute><NovelPage /></ProtectedRoute>} />
                    <Route path="/novel/:bookId" element={<ProtectedRoute><NovelPage /></ProtectedRoute>} />
                    <Route path="/my-projects" element={<ProtectedRoute><MyProjectsPage /></ProtectedRoute>} />
                    <Route path="/my-orders" element={<ProtectedRoute><MyOrdersPage /></ProtectedRoute>} />
                    <Route path="/project/:bookId" element={<ProtectedRoute><PictureBookPage /></ProtectedRoute>} />
                    {/* Fallback to home for unknown routes */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>

            <AppFooter />
        </div>
    );
}

export default App;
