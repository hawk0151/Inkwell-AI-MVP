// frontend/src/components/feed/LikeButton.jsx
import React from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient.js';

// --- API Service Functions using apiClient ---
const likeBookApi = ({ bookId, bookType }) => apiClient.post('/social/like', { bookId, bookType });
const unlikeBookApi = ({ bookId, bookType }) => apiClient.post('/social/unlike', { bookId, bookType });

// --- MODIFIED: Removed fill="none" from the SVG element ---
const HeartIcon = ({ className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
    </svg>
);

export function LikeButton({ book }) {
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: (isCurrentlyLiked) => {
            const payload = { bookId: book.id, bookType: book.book_type };
            return isCurrentlyLiked ? unlikeBookApi(payload) : likeBookApi(payload);
        },
        onMutate: async (isCurrentlyLiked) => {
            await queryClient.cancelQueries({ queryKey: ['forYouFeed'] });
            await queryClient.cancelQueries({ queryKey: ['userProfile', book.author_username] });

            const previousFeed = queryClient.getQueryData(['forYouFeed']);
            const previousProfile = queryClient.getQueryData(['userProfile', book.author_username]);

            const updateBookInCache = (oldData) => {
                if (!oldData) return oldData;
                const updater = (b) => b.id === book.id && b.book_type === book.book_type
                    ? { ...b, isLiked: !isCurrentlyLiked, like_count: b.like_count + (isCurrentlyLiked ? -1 : 1) }
                    : b;

                if (oldData.pages) {
                    return {
                        ...oldData,
                        pages: oldData.pages.map(page => ({
                            ...page,
                            books: page.books ? page.books.map(updater) : []
                        }))
                    };
                }
                if (oldData.profile && oldData.books) {
                    return { ...oldData, books: oldData.books.map(updater) };
                }
                return oldData;
            };

            queryClient.setQueryData(['forYouFeed'], updateBookInCache);
            queryClient.setQueryData(['userProfile', book.author_username], updateBookInCache);

            return { previousFeed, previousProfile };
        },
        onError: (err, variables, context) => {
            if (context.previousFeed) queryClient.setQueryData(['forYouFeed'], context.previousFeed);
            if (context.previousProfile) queryClient.setQueryData(['userProfile', book.author_username], context.previousProfile);
            console.error("Like/Unlike mutation failed:", err);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['forYouFeed'] });
            queryClient.invalidateQueries({ queryKey: ['userProfile', book.author_username] });
        },
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
    const heartClass = isBookLiked ? "text-red-500 fill-current" : "hover:text-red-500";

    return (
        <button onClick={handleLikeClick} disabled={mutation.isPending} className="flex items-center gap-1.5 transition-colors">
            <HeartIcon className={heartClass} />
            <span className="text-sm font-medium">{book.like_count || 0}</span>
        </button>
    );
}