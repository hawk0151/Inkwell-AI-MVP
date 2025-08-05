import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import { Alert } from '../components/common';
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
            alert(`Failed to create picture book: ${error.response?.data?.message || error.message}`);
        },
    });

    const handlePictureBookCreation = () => {
        const title = window.prompt("What is the title of your new picture book?");
        if (title && title.trim() !== '') {
            createPictureBookMutation.mutate(title.trim());
        } else if (title !== null) {
            alert("Picture book title cannot be empty.");
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-gray-950 px-4 sm:px-6 lg:px-8">
            <PageHeader 
                title="Choose Your Creation"
                subtitle="Select a format to begin your personalized story."
            />
            <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 max-w-5xl mx-auto"
            >
                <CreationCard
                    title="Text-Based Book"
                    description="Create a novel or storybook with our AI author, chapter by chapter."
                    icon="✍️"
                    onClick={() => navigate('/select-novel')}
                />
                <CreationCard
                    title="Picture Book"
                    description="Design a beautiful, illustrated story page by page with AI art."
                    icon="🎨"
                    onClick={handlePictureBookCreation}
                />
            </motion.div>

            {createPictureBookMutation.isPending && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <Alert title="Creating Picture Book">Please wait while your new project is being prepared...</Alert>
                </div>
            )}
        </div>
    );
}

export default ProductSelectionPage;