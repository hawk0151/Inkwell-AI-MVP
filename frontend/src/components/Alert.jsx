import React from 'react';

const Alert = ({ title, children }) => (
    <div className="bg-red-100 border-l-4 border-red-500 text-red-800 p-4 rounded-lg shadow-md" role="alert">
        <p className="font-bold">{title}</p>
        <p>{children}</p>
    </div>
);

export default Alert;