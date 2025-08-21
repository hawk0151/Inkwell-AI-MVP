// frontend/src/components/feed/CommentButton.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext.jsx';

const CommentIcon = ({ count }) => (
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
    className="text-slate-400 hover:text-blue-400"
    whileTap={{ scale: 0.8 }}
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>
  </motion.svg>
);

export function CommentButton({ book }) {
    const { currentUser } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [comments, setComments] = useState(book.comments || []);
    const [newComment, setNewComment] = useState("");

    const handleAddComment = (e) => {
        e.preventDefault();
        if (newComment.trim() === "") return;

        if (currentUser) {
            // TODO: In a later step, we will wire this up to an API mutation
            // For now, it's just local state
            setComments(prevComments => [...prevComments, { text: newComment, author: currentUser.username }]);
            setNewComment("");
        } else {
            alert("Please log in to add a comment.");
        }
    };

    return (
        <div className="w-full">
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="flex items-center gap-1.5 transition-colors"
            >
                <CommentIcon />
                <span className="text-sm font-medium">{book.comment_count || 0}</span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mt-2 p-3 bg-slate-800 rounded-lg overflow-hidden"
                    >
                        <p className="text-slate-400 text-sm mb-2">Comments</p>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {comments.length > 0 ? (
                                comments.map((comment, index) => (
                                    <div key={index} className="text-sm">
                                        <span className="font-semibold text-white">{comment.author}: </span>
                                        <span className="text-slate-200">{comment.text}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-400 text-xs italic">No comments yet. Be the first!</p>
                            )}
                        </div>
                        <form onSubmit={handleAddComment} className="flex gap-2 mt-4">
                            <input 
                                type="text" 
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Write a comment..." 
                                className="w-full px-3 py-2 rounded bg-slate-700 text-white focus:outline-none placeholder-slate-400"
                            />
                            <button type="submit" className="bg-blue-500 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-600 transition-colors">
                                Post
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}