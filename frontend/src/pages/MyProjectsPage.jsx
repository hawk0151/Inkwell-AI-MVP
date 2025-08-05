// frontend/src/pages/MyProjectsPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import { motion } from 'framer-motion';
import PageHeader from '../components/PageHeader';
import { LoadingSpinner, Alert } from '../components/common.jsx';
import { DocumentPlusIcon, PhotoIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';

// --- OPTIMIZED API Function ---
const fetchProjects = async () => {
    // Now just one single API call to our new efficient endpoint
    const response = await apiClient.get('/projects');
    return response.data; // The data is already combined and sorted by the server
};

// --- Other API functions remain the same ---
const deletePictureBook = (bookId) => apiClient.delete(`/picture-books/${bookId}`);
const deleteTextBook = (bookId) => apiClient.delete(`/text-books/${bookId}`);
const createPictureBook = (title) => apiClient.post('/picture-books', { title });
const toggleBookPrivacy = ({ bookId, bookType, is_public }) => {
    const basePath = bookType === 'pictureBook' ? 'picture-books' : 'text-books';
    const endpoint = `/${basePath}/${bookId}/privacy`;
    return apiClient.patch(endpoint, { is_public });
};

// --- Sub-components (unchanged from our last update) ---
const PublishButton = ({ project, onPublishToggle }) => { /* ... */ };
const ProjectCard = ({ project, onClick, onDelete, onPublishToggle }) => { /* ... */ };
const containerVariants = { /* ... */ };
const cardVariants = { /* ... */ };


// --- Main Page Component ---
function MyProjectsPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [error, setError] = useState(null);
    const projectLimit = 5;

    const { data: allProjects, isLoading, isError } = useQuery({
        queryKey: ['projects'],
        queryFn: fetchProjects, // Using our new, simpler fetch function
    });

    // All mutation and handler functions remain exactly the same
    const createMutation = useMutation({ /* ... */ });
    const deleteMutation = useMutation({ /* ... */ });
    const privacyMutation = useMutation({ /* ... */ });
    const handleProjectClick = (project) => { /* ... */ };
    const handleDelete = (project) => { /* ... */ };
    const handleNewPictureBook = () => { /* ... */ };
    const handleNewTextBook = () => { /* ... */ };

    return (
        <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
            <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8"> 
                <PageHeader 
                    title="My Projects"
                    subtitle="This is your creative dashboard. Continue your stories or start a new one."
                />
                {/* The rest of the JSX is unchanged from our last polished version */}
            </div>
        </div>
    );
}

export default MyProjectsPage;