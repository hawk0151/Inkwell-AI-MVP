// frontend/src/pages/FeedPage.jsx
import React from 'react';
import { ForYouFeed } from '../components/feed/ForYouFeed';
import PageHeader from '../components/PageHeader'; // Import our new header

function FeedPage() {
    return (
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <PageHeader
                title="For You"
                subtitle="Discover new books and creators from the Inkwell AI community."
            />
            
            {/* This component will handle fetching and displaying the feed */}
            <ForYouFeed />
        </div>
    );
}

export default FeedPage;