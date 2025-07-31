import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import { Alert } from '../components/common'; // Assuming Alert is in common.jsx

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (delay = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, delay },
    }),
};

const SelectionCard = ({ title, description, icon, onClick, delay }) => (
    <motion.div
        variants={fadeUp}
        custom={delay}
        initial="hidden"
        animate="visible"
        // MODIFIED: Added shadow and hover effects, refined padding and background
        className="relative content-card group cursor-pointer transform hover:-translate-y-2 transition-transform duration-300 flex flex-col items-center text-center p-8 bg-slate-800 rounded-xl shadow-xl hover:shadow-2xl border border-slate-700"
        onClick={onClick}
    >
        <div className="absolute inset-0 rounded-xl pointer-events-none transition-all duration-300 group-hover:ring-2 group-hover:ring-indigo-500"></div> {/* NEW: Hover ring effect */}
        <div className="text-7xl mb-6 transition-transform duration-300 group-hover:scale-110"> {/* MODIFIED: Increased icon size, added spacing */}
            {icon}
        </div>
        <h3 className="text-3xl font-bold text-white font-serif mb-3">{title}</h3> {/* MODIFIED: Text color, font family */}
        <p className="text-slate-400 mt-2 flex-grow text-lg">{description}</p> {/* MODIFIED: Font size */}
        <button className="mt-6 w-full md:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition shadow-md"> {/* MODIFIED: Button styling */}
            Begin
        </button>
    </motion.div>
);

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
            navigate(`/project/${data.bookId}`);
        },
        onError: (error) => {
            console.error("Error creating picture book:", error);
            alert(`Failed to create picture book: ${error.response?.data?.message || error.message}`);
        },
    });

    const handlePictureBookCreation = () => {
        const title = window.prompt("Title for your new picture book:");
        if (title && title.trim() !== '') {
            createPictureBookMutation.mutate(title.trim());
        } else if (title !== null) {
            alert("Picture book title cannot be empty.");
        }
    };

    return (
        <motion.div
            // MODIFIED: Removed 'flex-col justify-center' and adjusted padding for better top alignment
            className="fade-in min-h-screen py-12"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
        >
            <motion.div
                className="text-center mb-16" // MODIFIED: Increased bottom margin
                variants={fadeUp}
                custom={0}
                initial="hidden"
                animate="visible"
            >
                <h1 className="text-5xl md:text-6xl font-bold text-white font-serif relative z-10"> {/* MODIFIED: Text color */}
                    Choose Your Creation
                    {/* NEW: Subtle gradient/shadow for title pop */}
                    <span className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50 transform translate-y-2"></span>
                </h1>
                <p className="text-xl text-slate-400 mt-4 max-w-2xl mx-auto"> {/* MODIFIED: Centered and limited width */}
                    Select a format to begin your personalized story.
                </p>
            </motion.div>

            {/* MODIFIED: Responsive grid layout with more spacing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <SelectionCard
                    title="Text-Based Book"
                    description="Create a novel or storybook with our AI author, chapter by chapter."
                    icon="✍️"
                    onClick={() => navigate('/select-novel')}
                    delay={0.2}
                />
                <SelectionCard
                    title="Picture Book"
                    description="Design a beautiful, illustrated story page by page with AI art."
                    icon="🎨"
                    onClick={handlePictureBookCreation}
                    delay={0.4}
                />
            </div>
            {createPictureBookMutation.isPending && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <Alert title="Creating Picture Book">Please wait while your new picture book is being prepared...</Alert>
                </div>
            )}
        </motion.div>
    );
}

export default ProductSelectionPage;