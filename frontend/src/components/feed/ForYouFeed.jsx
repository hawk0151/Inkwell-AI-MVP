// frontend/src/components/feed/ForYouFeed.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useIntersection } from '@mantine/hooks';
import { BookCard } from './BookCard';
import { BookModal } from './BookModal'; // <-- Import our new modal
import apiClient from '../../services/apiClient';

// Updated fetch function to accept a page parameter
const fetchForYouFeed = async ({ pageParam = 1 }) => {
    const { data } = await apiClient.get('/feed/foryou', {
        params: { page: pageParam, limit: 12 } // Request 12 books per page
    });
    return data;
};

export function ForYouFeed() {
    // STATE MANAGEMENT: Centralize the modal state here
    const [selectedBook, setSelectedBook] = useState(null);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        error
    } = useInfiniteQuery({
        queryKey: ['forYouFeed'],
        queryFn: fetchForYouFeed,
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length > 0 ? allPages.length + 1 : undefined;
        },
    });

    const lastBookRef = useRef(null);
    const { ref, entry } = useIntersection({
        root: lastBookRef.current,
        threshold: 1,
    });

    useEffect(() => {
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [entry, hasNextPage, fetchNextPage, isFetchingNextPage]);

    if (isLoading) {
        return <FeedSkeleton />;
    }

    if (isError) {
        return (
            <div className="text-center py-10 px-4 bg-red-900/20 rounded-lg">
                <h3 className="text-lg font-semibold text-red-400">Oops! Something went wrong.</h3>
                <p className="text-red-500 mt-1">{error.message}</p>
            </div>
        );
    }
    
    const books = data?.pages.flat() || [];

    if (books.length === 0) {
        return (
            <div className="text-center py-10 px-4 bg-slate-800/50 rounded-lg">
                <h3 className="text-lg font-semibold text-white">Your Feed is Empty!</h3>
                <p className="text-slate-400 mt-1">Explore and like some books to tune your recommendations.</p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {books.map((book, i) => (
                    <div key={`${book.book_type}-${book.id}`} ref={i === books.length - 1 ? ref : null}>
                       <BookCard 
                           book={book} 
                           onView={() => setSelectedBook(book)} // Pass the handler to the card
                       />
                    </div>
                ))}
            </div>
            
            {/* RENDER THE MODAL: It sits here and waits to be activated */}
            <BookModal 
                book={selectedBook}
                isOpen={!!selectedBook}
                onClose={() => setSelectedBook(null)}
            />

            {isFetchingNextPage && <div className="text-center col-span-full py-4"><p className="text-slate-400">Loading more...</p></div>}
            {!hasNextPage && books.length > 0 && <div className="text-center col-span-full py-4"><p className="text-slate-500">You've reached the end!</p></div>}
        </>
    );
}

// Keep the skeleton component for the initial loading state
function FeedSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="bg-slate-800/50 rounded-lg shadow-md animate-pulse">
                    <div className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-700"></div>
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                            <div className="h-3 bg-slate-700 rounded w-1/2"></div>
                        </div>
                    </div>
                    <div className="w-full aspect-[3/4] bg-slate-700"></div>
                    <div className="p-4 h-16"></div>
                </div>
            ))}
        </div>
    );
}