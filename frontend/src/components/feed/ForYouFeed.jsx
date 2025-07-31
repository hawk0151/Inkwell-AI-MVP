import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { BookCard } from './BookCard';
import apiClient from '../../services/apiClient';

// Modified: Corrected the API endpoint path
const fetchForYouFeed = async (token) => {
    // apiClient already attaches the token via its interceptor and prepends '/api'
    const { data } = await apiClient.get('/feed/foryou'); // Changed from '/social/feed/foryou'
    return data;
};


export function ForYouFeed() {
    const { token } = useAuth();

    const { data: feed, isLoading, isError, error } = useQuery({
        queryKey: ['forYouFeed'],
        queryFn: () => fetchForYouFeed(token),
        enabled: !!token,
    });

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

    if (!feed || feed.length === 0) {
        return (
            <div className="text-center py-10 px-4 bg-slate-800/50 rounded-lg">
                <h3 className="text-lg font-semibold text-white">No Public Books Yet!</h3>
                <p className="text-slate-400 mt-1">Be the first to publish a book, or check back later!</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {feed.map((book) => (
                <BookCard key={`${book.book_type}-${book.id}`} book={book} />
            ))}
        </div>
    );
}

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
                    <div className="w-full h-80 bg-slate-700"></div>
                    <div className="p-4 h-16"></div>
                </div>
            ))}
        </div>
    );
}