import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import { LoadingSpinner, Alert } from '../components/common.jsx';

// --- API Functions (unchanged) ---
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

// --- Sub-components (unchanged) ---
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

const ProjectCard = ({ project, onClick, onDelete, onPublishToggle }) => (
    <div
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
    </div>
);

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
        onSuccess: (res) => navigate(`/project/${res.data.bookId}`),
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
            navigate(`/project/${project.id}`);
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
        // MODIFIED: Adjusted max-w and removed fixed horizontal padding to use responsive padding
        <div className="fade-in max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8"> 
            {/* MODIFIED: Changed to flex-wrap on small screens to prevent overflow */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 flex-wrap"> 
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 sm:mb-0">My Projects</h1> {/* MODIFIED: Added bottom margin for mobile */}
                {/* MODIFIED: Flex container for buttons, allows wrapping on small screens */}
                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto"> 
                    <button
                        onClick={handleNewTextBook}
                        disabled={isLoading || (allProjects && allProjects.length >= projectLimit)}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition shadow-sm disabled:opacity-50"
                    >
                        + New Text Book
                    </button>
                    <button
                        onClick={handleNewPictureBook}
                        disabled={createMutation.isPending || (allProjects && allProjects.length >= projectLimit)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition shadow-sm disabled:opacity-50"
                    >
                        {createMutation.isPending ? 'Creating...' : '+ New Picture Book'}
                    </button>
                </div>
            </div>
            {isError && <Alert title="Error">Could not fetch your projects.</Alert>}
            {error && <Alert title="Error" onClose={() => setError(null)}>{error}</Alert>}
            <div className="bg-slate-800/50 rounded-lg p-6">
                {isLoading ? <LoadingSpinner text="Fetching your projects..." /> : (
                    allProjects && allProjects.length > 0 ? (
                        <div className="space-y-4">
                            {allProjects.map(project => (
                                <ProjectCard
                                    key={`${project.type}-${project.id}`}
                                    project={project}
                                    onClick={() => handleProjectClick(project)}
                                    onDelete={handleDelete}
                                    onPublishToggle={privacyMutation}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-400 text-center py-8 font-sans">You don't have any saved projects yet. Go create one!</p>
                    )
                )}
            </div>
        </div>
    );
}

export default MyProjectsPage;