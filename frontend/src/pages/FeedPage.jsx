// frontend/src/pages/FeedPage.jsx
import React from 'react';
import { ForYouFeed } from '../components/feed/ForYouFeed';
import PageHeader from '../components/PageHeader';

function FeedPage() {
    return (
        <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
            <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <PageHeader
                    title="For You"
                    subtitle="Discover new books and creators from the Inkwell AI community."
                />
                
                {/* This component will handle fetching and displaying the feed */}
                <ForYouFeed />
            </div>
        </div>
    );
}

export default FeedPage;