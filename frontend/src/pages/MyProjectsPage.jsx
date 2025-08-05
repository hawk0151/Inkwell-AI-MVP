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
const PublishButton = ({ project, onPublishToggle }) => {
    const { mutate, isPending } = onPublishToggle;
    const handleClick = (e) => {
        e.stopPropagation();
        mutate({ bookId: project.id, bookType: project.type, is_public: !project.is_public });
    };
    const buttonText = project.is_public ? 'Unpublish' : 'Publish';
    const Icon = project.is_public ? EyeSlashIcon : EyeIcon;
    const buttonClass = project.is_public ? "text-slate-400 hover:text-white" : "text-teal-400 hover:text-teal-300";

    return (
        <button onClick={handleClick} disabled={isPending} className={`flex items-center gap-2 text-sm font-semibold transition-colors duration-200 ${buttonClass}`}>
            <Icon className="h-5 w-5" />
            {isPending ? 'Updating...' : buttonText}
        </button>
    );
};

const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
};

const ProjectCard = ({ project, onClick, onDelete, onPublishToggle }) => (
    <motion.div
        variants={cardVariants}
        whileHover={{ y: -5, scale: 1.02, boxShadow: "0px 10px 25px rgba(0, 0, 0, 0.3)" }}
        onClick={onClick}
        className="group relative cursor-pointer overflow-hidden bg-slate-800/50 backdrop-blur-md rounded-xl p-6 border border-slate-700 transition-all duration-300 hover:border-indigo-500/50"
    >
        <div className="flex justify-between items-start">
            <div>
                <h3 className="font-bold text-xl text-white font-serif">{project.title}</h3>
                <p className="text-sm text-indigo-300 font-sans mt-1">
                    {project.type === 'pictureBook' ? 'Picture Book' : 'Text Book'}
                </p>
                <p className="text-xs text-slate-500 font-sans mt-2">Last modified: {new Date(project.last_modified).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-4 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100">
                <PublishButton project={project} onPublishToggle={onPublishToggle} />
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(project); }}
                    className="text-red-500 hover:text-red-400 font-semibold"
                >
                    Delete
                </button>
            </div>
        </div>
    </motion.div>
);

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};


// --- Main Page Component ---
function MyProjectsPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [error, setError] = useState(null);
    const projectLimit = 5;

    const { data: allProjects, isLoading, isError } = useQuery({
        queryKey: ['projects'],
        queryFn: fetchProjects,
    });

    const createMutation = useMutation({
        mutationFn: createPictureBook,
        onSuccess: (response) => navigate(`/picture-book/${response.bookId}`),
        onError: () => setError("Failed to create new project."),
    });

    const deleteMutation = useMutation({
        mutationFn: (project) => {
            if (project.type === 'pictureBook') return deletePictureBook(project.id);
            if (project.type === 'textBook') return deleteTextBook(project.id);
            return Promise.reject(new Error("Unknown project type."));
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
        onError: (err) => setError(err.message || "Failed to delete project."),
    });

    const privacyMutation = useMutation({
        mutationFn: toggleBookPrivacy,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
        onError: () => setError("Failed to update privacy status."),
    });

    const handleProjectClick = (project) => {
        if (project.type === 'pictureBook') {
            navigate(`/picture-book/${project.id}`);
        } else if (project.type === 'textBook') {
            navigate(`/novel/${project.id}`);
        }
    };
    
    const handleDelete = (project) => {
        if (window.confirm(`Are you sure you want to delete "${project.title}"?`)) {
            deleteMutation.mutate(project);
        }
    };

    const handleNewPictureBook = () => {
        if (allProjects && allProjects.length >= projectLimit) {
            setError(`You have reached the project limit of ${projectLimit}.`);
            return;
        }
        const title = window.prompt("Title for your new picture book:");
        if (title && title.trim() !== '') {
            createMutation.mutate(title);
        }
    };

    const handleNewTextBook = () => {
        if (allProjects && allProjects.length >= projectLimit) {
            setError(`You have reached the project limit of ${projectLimit}.`);
            return;
        }
        navigate('/select-novel');
    };

    return (
        <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
            <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8"> 
                <PageHeader 
                    title="My Projects"
                    subtitle="This is your creative dashboard. Continue your stories or start a new one."
                />

                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 mb-8"> 
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleNewTextBook}
                        disabled={isLoading || (allProjects && allProjects.length >= projectLimit)}
                        className="w-full sm:w-auto flex-grow flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md disabled:opacity-50"
                    >
                        <DocumentPlusIcon className="h-5 w-5" />
                        New Text Book
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleNewPictureBook}
                        disabled={createMutation.isPending || (allProjects && allProjects.length >= projectLimit)}
                        className="w-full sm:w-auto flex-grow flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md disabled:opacity-50"
                    >
                        <PhotoIcon className="h-5 w-5" />
                        {createMutation.isPending ? 'Creating...' : 'New Picture Book'}
                    </motion.button>
                </div>

                {isError && <Alert type="error" message="Could not fetch your projects." />}
                {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
                
                <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-slate-700">
                    {isLoading ? <LoadingSpinner text="Fetching your projects..." /> : (
                        allProjects && allProjects.length > 0 ? (
                            <motion.div 
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                                className="space-y-4"
                            >
                                {allProjects.map(project => (
                                    <ProjectCard
                                        key={`${project.type}-${project.id}`}
                                        project={project}
                                        onClick={() => handleProjectClick(project)}
                                        onDelete={handleDelete}
                                        onPublishToggle={privacyMutation}
                                    />
                                ))}
                            </motion.div>
                        ) : (
                            <div className="text-center py-16">
                                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-24 w-24 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
                                <h3 className="mt-4 text-2xl font-semibold text-white font-serif">No Projects Yet</h3>
                                <p className="mt-2 text-slate-400">Click 'New Picture Book' or 'New Text Book' to get started!</p>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

export default MyProjectsPage;