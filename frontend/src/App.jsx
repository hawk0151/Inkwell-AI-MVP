// frontend/src/App.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';

// Import Layout Components
import { AppNavbar } from './components/layout/AppNavbar.jsx';
import { AppFooter } from './components/layout/AppFooter.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx'; // Assuming ProtectedRoute is moved to components

// Import Pages
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
import PolicyPage from './pages/PolicyPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx'; // Import the new 404 page

function App() {
    const { loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex justify-center items-center">
                <div className="text-white text-xl">Loading Application...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] text-slate-200 font-sans flex flex-col">
            <AppNavbar />
            <main className="flex-grow w-full">
                <Routes>
                    <Route path="/" element={<ProductSelectionPage />} />
                    <Route path="/select-novel" element={<NovelSelectionPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/about-how-it-works" element={<AboutHowItWorksPage />} />
                    <Route path="/checkout-success" element={<CheckoutSuccessPage />} />
                    <Route path="/cancel" element={<CancelPage />} />
                    <Route path="/policies" element={<PolicyPage />} />
                    
                    {/* Protected Routes */}
                    <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
                    <Route path="/profile/:username" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                    <Route path="/profile/edit" element={<ProtectedRoute><EditProfilePage /></ProtectedRoute>} />
                    <Route path="/novel/new" element={<ProtectedRoute><NovelPage /></ProtectedRoute>} />
                    <Route path="/novel/:bookId" element={<ProtectedRoute><NovelPage /></ProtectedRoute>} />
                    <Route path="/my-projects" element={<ProtectedRoute><MyProjectsPage /></ProtectedRoute>} />
                    <Route path="/my-orders" element={<ProtectedRoute><MyOrdersPage /></ProtectedRoute>} />
                    <Route path="/picture-book/:bookId" element={<ProtectedRoute><PictureBookPage /></ProtectedRoute>} />

                    {/* This catch-all route MUST be last */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </main>
            <AppFooter />
        </div>
    );
}

export default App;