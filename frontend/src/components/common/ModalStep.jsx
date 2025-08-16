// src/components/common/ModalStep.jsx

import React from 'react';

export const ModalStep = ({ title, description, children }) => (
    <>
        <div className="p-8 pb-6 border-b border-slate-700">
            <h2 className="text-3xl font-bold text-white">{title}</h2>
            <p className="text-slate-300 mt-2">{description}</p>
        </div>
        <div className="py-6 overflow-y-auto flex-grow">
            {children}
        </div>
    </>
);