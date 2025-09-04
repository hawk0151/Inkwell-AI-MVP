// frontend/src/components/feed/LikeButton.jsx
import React from 'react';
import { motion } from 'framer-motion'; // Import motion
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient.js';

const likeBookApi = ({ bookId, bookType }) => apiClient.post('/social/like', { bookId, bookType });
const unlikeBookApi = ({ bookId, bookType }) => apiClient.post('/social/unlike', { bookId, bookType });

const HeartIcon = ({ isLiked }) => (
    <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`transition-colors ${isLiked ? "text-red-500" : "text-slate-400 hover:text-red-500"}`}
        // ANIMATION: Add a little "pop" when the button is tapped
        whileTap={{ scale: 1.2 }}
        transition={{ type: "spring", stiffness: 400, damping: 10 }}
    >
        <motion.path
            d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
            // ANIMATION: Fill the heart when liked
            animate={{ fill: isLiked ? "#ef4444" : "rgba(0,0,0,0)" }}
            transition={{ duration: 0.2 }}
        />
    </motion.svg>
);

export function LikeButton({ book }) {
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: (isCurrentlyLiked) => {
            const payload = { bookId: book.id, bookType: book.book_type };
            return isCurrentlyLiked ? unlikeBookApi(payload) : likeBookApi(payload);
        },
        // All the optimistic update logic (onMutate, onError, onSettled) remains the same.
        // It's already working great.
onMutate: async (isCurrentlyLiked) => {
    const queryKey = ['forYouFeed'];
    await queryClient.cancelQueries({ queryKey });

    const previousFeed = queryClient.getQueryData(queryKey);

    queryClient.setQueryData(queryKey, (oldData) => {
        if (!oldData) return undefined;

        return {
            ...oldData,
            pages: oldData.pages.map(page =>
                page.map(b =>
                    b.id === book.id && b.book_type === book.book_type
                        ? { ...b, isLiked: !isCurrentlyLiked, like_count: b.like_count + (isCurrentlyLiked ? -1 : 1) }
                        : b
                )
            ),
        };
    });

    return { previousFeed };
},
        onError: (err, variables, context) => { /* ... */ },
        onSettled: () => { /* ... */ },
    });

    const handleLikeClick = (e) => {
        e.stopPropagation();
        if (currentUser) {
            mutation.mutate(book.isLiked);
        } else {
            alert("Please log in to like books.");
        }
    };
    
    const isBookLiked = book.isLiked === true;

    return (
        <button
            onClick={handleLikeClick}
            disabled={mutation.isPending}
            className="flex items-center gap-1.5"
            // ACCESSIBILITY: Add aria-pressed for screen readers
            aria-pressed={isBookLiked}
            aria-label={isBookLiked ? "Unlike this book" : "Like this book"}
        >
            <HeartIcon isLiked={isBookLiked} />
            <span className="text-sm font-medium text-slate-300">{book.like_count || 0}</span>
        </button>
    );
}