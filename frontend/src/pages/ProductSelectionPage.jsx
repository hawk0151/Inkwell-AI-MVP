// frontend/src/pages/ProductSelectionPage.jsx
import React, { useState } from 'react'; // Added useState for local error state
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import { Alert, LoadingSpinner } from '../components/common'; // Imported LoadingSpinner
import PageHeader from '../components/PageHeader';
import CreationCard from '../components/CreationCard';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.2,
        },
    },
};

function ProductSelectionPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [localError, setLocalError] = useState(null); // Local state for errors

    const createPictureBookMutation = useMutation({
        mutationFn: async (title) => {
            const response = await apiClient.post('/picture-books', { title });
            return response.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            navigate(`/picture-book/${data.bookId}`);
        },
        onError: (error) => {
            console.error("Error creating picture book:", error);
            setLocalError(`Failed to create picture book: ${error.response?.data?.message || error.message}`);
        },
    });

    const handlePictureBookCreation = () => {
        // Using a custom modal/input for title instead of window.prompt for better UX
        // For now, keeping window.prompt for simplicity as per previous discussions,
        // but adding an alert for empty title.
        const title = window.prompt("What is the title of your new picture book?");
        if (title && title.trim() !== '') {
            createPictureBookMutation.mutate(title.trim());
        } else if (title !== null) { // User clicked OK but left title empty
            setLocalError("Picture book title cannot be empty.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] px-4 sm:px-6 lg:px-8">
            <PageHeader 
                title="Choose Your Creation"
                subtitle="Select a format to begin your personalized story."
            />

            {localError && <Alert type="error" message={localError} onClose={() => setLocalError(null)} />}

            <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 max-w-5xl mx-auto"
            >
                <CreationCard
                    title="Text-Based Book"
                    description="Create a novel or storybook with our AI author, chapter by chapter."
                    onClick={() => navigate('/select-novel')}
                    type="textBook" // Added type prop
                />
                <CreationCard
                    title="Picture Book"
                    description="Design a beautiful, illustrated story page by page with AI art."
                    onClick={handlePictureBookCreation}
                    type="pictureBook" // Added type prop
                />
            </motion.div>

            {createPictureBookMutation.isPending && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <LoadingSpinner text="Preparing your new picture book..." />
                </div>
            )}
        </div>
    );
}

export default ProductSelectionPage;