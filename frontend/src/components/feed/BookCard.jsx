// frontend/src/components/feed/BookCard.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { LikeButton } from './LikeButton.jsx';
import { CommentButton } from './CommentButton.jsx';

// The card now takes an `onView` prop to open the modal
export function BookCard({ book, onView }) {
    return (
        <motion.div
            className="bg-slate-800/50 rounded-lg shadow-lg overflow-hidden flex flex-col group transition-all duration-300 hover:shadow-indigo-500/30"
            whileHover={{ y: -5 }}
            layoutId={`book-card-${book.id}`}
        >
            <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={onView}>
                <img
                    src={book.author_avatar_url || 'https://via.placeholder.com/40'}
                    alt={book.author_username}
                    className="w-10 h-10 rounded-full object-cover border-2 border-slate-700"
                />
                <div>
                    <p className="font-semibold text-white truncate group-hover:text-indigo-400">{book.title}</p>
                    <p className="text-sm text-slate-400">by @{book.author_username}</p>
                </div>
            </div>
            
            <div className="w-full aspect-[3/4] bg-slate-700 cursor-pointer" onClick={onView}>
                <img
                    src={book.cover_image_url}
                    alt={`Cover for ${book.title}`}
                    className="w-full h-full object-cover"
                    loading="lazy" // PERFORMANCE: Lazy load card images
                />
            </div>
            
            <div className="p-4 mt-auto">
                <div className="flex items-center justify-between text-slate-400">
                    <div className="flex items-center gap-4">
                        <LikeButton book={book} />
                        {/* UX CONSISTENCY: Clicking the comment button now also opens the modal */}
                        <CommentButton book={book} onClick={onView} />
                    </div>
                    <button
                        className="text-sm font-semibold text-indigo-400 hover:text-indigo-300"
                        onClick={onView}
                    >
                        View
                    </button>
                </div>
            </div>
        </motion.div>
    );
}