// frontend/src/components/layout/AppNavbar.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../common';

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
                <img src={user.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user.username || user.email)}`} alt="Profile" className="w-8 h-8 rounded-full bg-slate-700 object-cover" />
                <span className="text-white font-medium text-sm hidden lg:block">{user.username}</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2, ease: 'easeInOut' }} className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-20">
                        <div className="py-1">
                            <a onClick={() => handleNavigate(`/profile/${encodeURIComponent(user.username)}`)} className="cursor-pointer block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">My Profile</a>
                            <a onClick={() => handleNavigate('/my-projects')} className="cursor-pointer block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">My Projects</a>
                            <a onClick={() => handleNavigate('/my-orders')} className="cursor-pointer block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">My Orders</a>
                            <div className="border-t border-slate-700 my-1"></div>
                            <a onClick={handleLogout} className="cursor-pointer block px-4 py-2 text-sm text-red-400 hover:bg-slate-700">Logout</a>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const AppNavbar = () => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const isLinkActive = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    }

    const NavLink = ({ to, children }) => (
        <a href={to} onClick={(e) => { e.preventDefault(); navigate(to); }} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            // MODIFIED: 'Create' link uses teal for active/hover
            isLinkActive(to) 
                ? 'bg-teal-600 text-white' 
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
        }`}>
            {children}
        </a>
    );

    const MobileNavLink = ({ to, children }) => (
        <a href={to} onClick={(e) => { e.preventDefault(); navigate(to); setIsMobileMenuOpen(false); }} className="block px-3 py-2 text-base font-medium text-white hover:bg-slate-700 rounded-md">
            {children}
        </a>
    );
    
    return (
        <nav className="bg-black/20 backdrop-blur-lg shadow-lg sticky top-0 z-50 border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="cursor-pointer"><Logo /></a>
                    <div className="hidden md:flex items-center space-x-4">
                        <NavLink to="/">Create</NavLink>
                        <NavLink to="/feed">Feed</NavLink>
                        <NavLink to="/about-how-it-works">About & How It Works</NavLink>
                        {currentUser ? (
                            <ProfileDropdown user={currentUser} onLogout={() => { logout(); navigate('/'); }} />
                        ) : (
                            // MODIFIED: Login button uses teal
                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => navigate('/login')} className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors shadow-sm">
                                Login
                            </motion.button>
                        )}
                    </div>
                    <div className="-mr-2 flex md:hidden">
                        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 focus:outline-none">
                            <span className="sr-only">Open main menu</span>
                            {isMobileMenuOpen ? <svg className="block h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg> : <svg className="block h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>}
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
                                {currentUser.username && (<MobileNavLink to={`/profile/${encodeURIComponent(currentUser.username)}`}>My Profile</MobileNavLink>)}
                                <MobileNavLink to="/my-projects">My Projects</MobileNavLink>
                                <MobileNavLink to="/my-orders">My Orders</MobileNavLink>
                                <button onClick={() => { logout(); navigate('/'); setIsMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-base font-medium text-red-400 hover:bg-slate-700 rounded-md">Logout</button>
                            </>
                        ) : (<MobileNavLink to="/login">Login</MobileNavLink>)}
                    </div>
                </div>
            )}
        </nav>
    );
};