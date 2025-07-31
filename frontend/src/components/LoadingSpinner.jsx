import React from 'react';

const LoadingSpinner = ({ text = "Loading..." }) => (
    <div className="flex flex-col justify-center items-center p-8 gap-4">
        <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin"></div>
        <p className="text-slate-600 font-medium">{text}</p>
    </div>
);

export default LoadingSpinner;