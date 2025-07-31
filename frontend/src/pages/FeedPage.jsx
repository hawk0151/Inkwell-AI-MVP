// frontend/src/pages/FeedPage.jsx
import React from 'react';
import { ForYouFeed } from '../components/feed/ForYouFeed'; // We will create this next

function FeedPage() {
    return (
        <div>
            <header className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    For You
                </h1>
                <p className="mt-2 text-lg text-slate-400">
                    Discover new books and creators from the Inkwell AI community.
                </p>
            </header>
            
            {/* This component will handle fetching and displaying the feed */}
            <ForYouFeed />
        </div>
    );
}

export default FeedPage;