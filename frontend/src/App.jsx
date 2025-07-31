import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ProductSelectionPage from './pages/ProductSelectionPage.jsx';
import PictureBookPage from './pages/PictureBookPage.jsx';
import MyProjectsPage from './pages/MyProjectsPage.jsx';
import MyOrdersPage from './pages/MyOrdersPage.jsx';
// import AboutPage from './pages/AboutPage.jsx'; // REMOVED: Old About Page - ensure this line is gone
import SuccessPage from './pages/SuccessPage.jsx';
import CancelPage from './pages/CancelPage.jsx';
import NovelPage from './pages/NovelPage.jsx';
import NovelSelectionPage from './pages/NovelSelectionPage.jsx';
import FeedPage from './pages/FeedPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import EditProfilePage from './pages/EditProfilePage.jsx';
// import HowItWorksPage from './pages/HowItWorksPage.jsx'; // REMOVED: Old How It Works Page - ensure this line is gone
import AboutHowItWorksPage from './pages/AboutHowItWorksPage.jsx'; // NEW: Combined About & How It Works Page
import { Logo } from './components/common.jsx';
// import { ProfileHeader } from './components/ProfileHeader.jsx'; // REMOVED: No longer a named export in App.jsx

function ProtectedRoute({ children }) {
    const { currentUser } = useAuth();
    if (!currentUser) return <LoginPage />;
    return children;
}

function App() {
    const { currentUser, logout, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Helper to determine if a link is active based on current path
    const isLinkActive = (path) => location.pathname.startsWith(path);

    // Custom NavLink component for desktop navigation
    const NavLink = ({ to, children }) => (
        <a
            href={to}
            onClick={(e) => {
                e.preventDefault();
                navigate(to);
                setIsMobileMenuOpen(false); // Close mobile menu on click
            }}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isLinkActive(to) ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
        >
            {children}
        </a>
    );

    // Custom MobileNavLink component for mobile navigation
    const MobileNavLink = ({ to, children }) => (
        <a
            href={to}
            onClick={(e) => {
                e.preventDefault();
                navigate(to);
                setIsMobileMenuOpen(false); // Close mobile menu on click
            }}
            className="block px-3 py-2 text-base font-medium text-white hover:bg-gray-700 rounded-md"
        >
            {children}
        </a>
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex justify-center items-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white font-inter">
            <nav className="bg-black/20 backdrop-blur-lg shadow-lg sticky top-0 z-50 border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo/Home link */}
                        <a
                            href="/"
                            onClick={(e) => {
                                e.preventDefault();
                                navigate('/');
                                setIsMobileMenuOpen(false);
                            }}
                            className="cursor-pointer"
                        >
                            <Logo />
                        </a>
                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center space-x-4">
                            <NavLink to="/">Create</NavLink>
                            <NavLink to="/feed">Feed</NavLink>
                            {/* Updated NavLink for the combined page */}
                            <NavLink to="/about-how-it-works">About & How It Works</NavLink>
                            {currentUser ? (
                                <>
                                    {currentUser.username && (
                                        <NavLink to={`/profile/${encodeURIComponent(currentUser.username)}`}>
                                            My Profile
                                        </NavLink>
                                    )}
                                    <NavLink to="/my-projects">My Projects</NavLink>
                                    <NavLink to="/my-orders">My Orders</NavLink>
                                    <button
                                        onClick={() => {
                                            logout();
                                            navigate('/');
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className="text-slate-300 hover:bg-white/10 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                                    >
                                        Logout
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => navigate('/login')}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition shadow-sm"
                                >
                                    Login
                                </button>
                            )}
                        </div>
                        {/* Mobile Menu Button */}
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

                {/* Mobile Menu Content */}
                {isMobileMenuOpen && (
                    <div className="md:hidden">
                        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                            <MobileNavLink to="/">Create</MobileNavLink>
                            <MobileNavLink to="/feed">Feed</MobileNavLink>
                            {/* Updated MobileNavLink for the combined page */}
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
            <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
                <Routes>
                    <Route path="/" element={<ProductSelectionPage />} />
                    <Route path="/select-novel" element={<NovelSelectionPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    {/* New combined route */}
                    <Route path="/about-how-it-works" element={<AboutHowItWorksPage />} />
                    <Route path="/success" element={<SuccessPage />} />
                    <Route path="/cancel" element={<CancelPage />} />
                    <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
                    <Route path="/profile/:username" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                    <Route path="/profile/edit" element={<ProtectedRoute><EditProfilePage /></ProtectedRoute>} />
                    <Route path="/novel/new" element={<ProtectedRoute><NovelPage /></ProtectedRoute>} />
                    <Route path="/novel/:bookId" element={<ProtectedRoute><NovelPage /></ProtectedRoute>} />
                    <Route path="/my-projects" element={<ProtectedRoute><MyProjectsPage /></ProtectedRoute>} />
                    <Route path="/my-orders" element={<ProtectedRoute><MyOrdersPage /></ProtectedRoute>} />
                    <Route path="/project/:bookId" element={<ProtectedRoute><PictureBookPage /></ProtectedRoute>} />
                </Routes>
            </main>
        </div>
    );
}

export default App;