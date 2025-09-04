// frontend/src/components/feed/CommentButton.jsx
import React from 'react';
import { motion } from 'framer-motion';

const CommentIcon = () => (
    <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-slate-400 group-hover:text-blue-400 transition-colors"
        whileTap={{ scale: 0.8 }}
    >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>
    </motion.svg>
);

// The button now receives an onClick prop and has no internal state
export function CommentButton({ book, onClick }) {
    const handleClick = (e) => {
        e.stopPropagation(); // Prevent any parent click events
        if (onClick) {
            onClick(); // Call the function passed from the parent (BookCard)
        }
    };

    return (
        <button
            onClick={handleClick}
            className="flex items-center gap-1.5 transition-colors group"
            aria-label="View comments"
        >
            <CommentIcon />
            <span className="text-sm font-medium text-slate-300">{book.comment_count || 0}</span>
        </button>
    );
}