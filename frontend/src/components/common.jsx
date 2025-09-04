import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon } from '@heroicons/react/24/solid';
import logoImage from '../assets/inkwell-logo.svg';
import CookieConsent from 'react-cookie-consent'; 
import { Link } from 'react-router-dom'; 
import { enableAnalytics } from '../firebase';
export const LoadingSpinner = ({ text = "Loading..." }) => (
    <div className="flex flex-col justify-center items-center p-8 gap-4">
        <div className="w-12 h-12 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium">{text}</p>
    </div>
);

export const Alert = ({ type = 'error', title, message, children, onClose }) => {
    const theme = {
        error: {
            icon: <XCircleIcon className="h-6 w-6 text-red-400" />,
            bgColor: 'bg-red-900/50',
            borderColor: 'border-red-500/50',
            titleColor: 'text-red-300',
        },
        success: {
            icon: <CheckCircleIcon className="h-6 w-6 text-teal-400" />,
            bgColor: 'bg-teal-900/50',
            borderColor: 'border-teal-500/50',
            titleColor: 'text-teal-300',
        },
        info: {
            icon: <InformationCircleIcon className="h-6 w-6 text-indigo-400" />,
            bgColor: 'bg-indigo-900/50',
            borderColor: 'border-indigo-500/50',
            titleColor: 'text-indigo-300',
        }
    };

    const selectedTheme = theme[type] || theme.error;

    return (
        <div className={`flex items-start w-full p-4 rounded-xl shadow-lg border ${selectedTheme.bgColor} ${selectedTheme.borderColor}`} role="alert">
            <div className="flex-shrink-0">{selectedTheme.icon}</div>
            <div className="ml-3 flex-grow">
                {title && <h3 className={`font-bold ${selectedTheme.titleColor}`}>{title}</h3>}
                <div className="text-sm text-slate-300 mt-1">
                    {message || children}
                </div>
            </div>
            {onClose && (
                <div className="ml-auto pl-3">
                    <button onClick={onClose} className="-mx-1.5 -my-1.5 p-1.5 rounded-lg text-slate-400 hover:bg-white/10 focus:outline-none">
                        <span className="sr-only">Dismiss</span>
                        <XCircleIcon className="h-5 w-5" />
                    </button>
                </div>
            )}
        </div>
    );
};

// --- FIX: Replaced the old "notice" banner with a fully functional consent banner ---

// A placeholder function for initializing non-essential scripts.
// This is where you would put your Google Analytics, Hotjar, etc. code.
const initializeAnalytics = () => {
    console.log("Analytics has been initialized because user gave consent!");
    // EXAMPLE:
    // window.dataLayer = window.dataLayer || [];
    // function gtag(){dataLayer.push(arguments);}
    // gtag('js', new Date());
    // gtag('config', 'GA_MEASUREMENT_ID');
};

export const CookieConsentBanner = () => {
    
    const handleAccept = () => {
        // 2. When the user accepts, call the function to enable analytics
        enableAnalytics();
    };

    const handleDecline = () => {
        console.log("User declined non-essential cookies. Analytics will remain disabled.");
    };

    return (
        <CookieConsent
            location="bottom"
            buttonText="Accept All"
            declineButtonText="Decline"
            enableDeclineButton
            cookieName="inkwellAiCookieConsent"
            style={{ 
                background: "linear-gradient(to right, #1e293b, #0f172a)", 
                borderTop: "1px solid #334155",
                boxShadow: "0 -4px 15px rgba(0, 0, 0, 0.2)",
                fontSize: "15px",
                alignItems: "center",
            }}
            buttonStyle={{ 
                backgroundColor: "#14b8a6", // Teal color
                color: "white", 
                fontSize: "14px",
                fontWeight: "bold",
                borderRadius: "8px",
                padding: "10px 20px"
            }}
            declineButtonStyle={{
                backgroundColor: "#475569", // Slate color
                color: "#e2e8f0",
                fontSize: "14px",
                borderRadius: "8px",
                padding: "10px 20px"
            }}
            expires={150}
            onAccept={handleAccept}
            onDecline={handleDecline}
        >
            This website uses cookies to enhance the user experience. With your consent, we may also use non-essential cookies for analytics.{" "}
            <Link to="/policies#privacy-policy-section" className="font-semibold underline text-slate-300 hover:text-white transition-colors">
                Learn more in our Privacy Policy.
            </Link>
        </CookieConsent>
    );
};

export const Logo = () => (
    <div className="flex items-center gap-3 cursor-pointer">
        <img src={logoImage} alt="Inkwell AI Logo" className="h-14 w-14" />
        <span className="font-serif font-bold text-2xl text-white">Inkwell AI</span>
    </div>
);

export const MagicWandIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/>
    </svg>
);