import React from 'react'; // React is needed for JSX

export const LoadingSpinner = ({ text = "Loading..." }) => (
    <div className="flex flex-col justify-center items-center p-8 gap-4">
        <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin"></div>
        <p className="text-slate-600 font-medium">{text}</p>
    </div>
);

export const Alert = ({ title, children }) => (
    <div className="bg-red-100 border-l-4 border-red-500 text-red-800 p-4 rounded-lg shadow-md" role="alert">
        <p className="font-bold">{title}</p>
        <p>{children}</p>
    </div>
);

// DEFINITIVE: Logo Component - ENSURE THIS IS EXPORTED
export const Logo = () => (
  <div className="flex items-center gap-2 cursor-pointer">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3C10.8954 3 10 3.89543 10 5V12.7846C8.06437 13.443 7.23423 15.6942 8.19675 17.4202L11.5 9.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <path d="M12 3C13.1046 3 14 3.89543 14 5V12.7846C15.9356 13.443 16.7658 15.6942 15.8032 17.4202L12.5 9.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <path d="M8.19675 17.4202C8.76116 18.4913 9.82674 19.2154 11 19.428V21H13V19.428C14.1733 19.2154 15.2388 18.4913 15.8032 17.4202" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
    <span className="font-serif font-bold text-2xl text-white">Inkwell AI</span>
  </div>
);

// DEFINITIVE: MagicWandIcon Component - ENSURE THIS IS EXPORTED
export const MagicWandIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
        <path d="M15 4V2"/>
        <path d="M15 16v-2"/>
        <path d="M8 9h2"/>
        <path d="M20 9h2"/>
        <path d="M17.8 11.8 19 13"/>
        <path d="M15 9h.01"/>
        <path d="M17.8 6.2 19 5"/>
        <path d="m3 21 9-9"/>
        <path d="M12.2 6.2 11 5"/>
    </svg>
);