// frontend/src/pages/MyProjectsPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import { motion } from 'framer-motion';
import PageHeader from '../components/PageHeader';
import { LoadingSpinner, Alert } from '../components/common.jsx';

// --- API Functions ---
const fetchProjects = async () => {
    const [picBooksRes, textBooksRes] = await Promise.all([
        apiClient.get('/picture-books'),
        apiClient.get('/text-books')
    ]);
    const pictureBooks = picBooksRes.data.map(p => ({ ...p, type: 'pictureBook' }));
    const textBooks = textBooksRes.data.map(t => ({ ...t, type: 'textBook' }));
    return [...pictureBooks, ...textBooks].sort((a, b) => new Date(b.last_modified) - new Date(a.last_modified));
};

const deletePictureBook = (bookId) => apiClient.delete(`/picture-books/${bookId}`);
const deleteTextBook = (bookId) => apiClient.delete(`/text-books/${bookId}`);
const createPictureBook = (title) => apiClient.post('/picture-books', { title });

const toggleBookPrivacy = ({ bookId, bookType, is_public }) => {
    const basePath = bookType === 'pictureBook' ? 'picture-books' : 'text-books';
    const endpoint = `/${basePath}/${bookId}/privacy`;
    return apiClient.patch(endpoint, { is_public });
};

// --- Sub-components ---
const PublishButton = ({ project, onPublishToggle }) => {
    const { mutate, isPending } = onPublishToggle;
    const handleClick = (e) => {
        e.stopPropagation();
        mutate({ bookId: project.id, bookType: project.type, is_public: !project.is_public });
    };
    const buttonText = project.is_public ? 'Unpublish' : 'Publish';
    const buttonClass = project.is_public ? "text-slate-500 hover:text-slate-400" : "text-green-500 hover:text-green-400";

    return (
        <button onClick={handleClick} disabled={isPending} className={`text-sm font-semibold transition-colors ${buttonClass}`}>
            {isPending ? '...' : buttonText}
        </button>
    );
};

const cardVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } }
};

const ProjectCard = ({ project, onClick, onDelete, onPublishToggle }) => (
    <motion.div
        variants={cardVariants}
        onClick={onClick}
        className="p-5 border-l-4 border-indigo-500 bg-slate-800 rounded-r-lg flex justify-between items-center cursor-pointer hover:bg-slate-700/50 transition-colors duration-300 group"
    >
        <div>
            <h3 className="font-bold text-lg text-slate-200">{project.title}</h3>
            <p className="text-sm text-slate-400 font-sans">
                {project.type === 'pictureBook' ? 'Picture Book' : 'Text Book'}
            </p>
            <p className="text-sm text-slate-500 font-sans">Last modified: {new Date(project.last_modified).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-4">
            <PublishButton project={project} onPublishToggle={onPublishToggle} />
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(project); }}
                className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity font-semibold"
            >
                Delete
            </button>
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
        <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8"> 
            <PageHeader 
                title="My Projects"
                subtitle="This is your creative dashboard. Continue your stories or start a new one."
            />

            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 mb-8"> 
                <button
                    onClick={handleNewTextBook}
                    disabled={isLoading || (allProjects && allProjects.length >= projectLimit)}
                    className="w-full sm:w-auto flex-grow bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition shadow-md disabled:opacity-50"
                >
                    + New Text Book
                </button>
                <button
                    onClick={handleNewPictureBook}
                    disabled={createMutation.isPending || (allProjects && allProjects.length >= projectLimit)}
                    className="w-full sm:w-auto flex-grow bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition shadow-md disabled:opacity-50"
                >
                    {createMutation.isPending ? 'Creating...' : '+ New Picture Book'}
                </button>
            </div>

            {isError && <Alert type="error" message="Could not fetch your projects." />}
            {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
            
            <div className="bg-slate-800/50 rounded-lg p-6">
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
                        <p className="text-slate-400 text-center py-8">You don't have any projects yet. Let's create one!</p>
                    )
                )}
            </div>
        </div>
    );
}

export default MyProjectsPage;