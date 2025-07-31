import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext.jsx';
import apiClient from '../services/apiClient';
import { LoadingSpinner, Alert } from '../components/common.jsx';

// MODIFIED: Removed the redundant '/api' prefix from the path
const updateProfile = (formData) => {
    return apiClient.put('/profile/me', formData); // Changed from '/api/profile/me'
};

function EditProfilePage() {
    const { currentUser, setCurrentUser } = useAuth();
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        username: '',
        bio: '',
        avatar_url: ''
    });
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        if (currentUser) {
            setFormData({
                username: currentUser.username || '',
                bio: currentUser.bio || '',
                avatar_url: currentUser.avatar_url || ''
            });
        }
    }, [currentUser]);

    const mutation = useMutation({
        mutationFn: updateProfile,
        onSuccess: (data, variables) => {
            setSuccessMessage('Profile updated successfully!');
            // Update currentUser in context to reflect changes immediately
            // Backend's profile.controller.js updateMyProfile doesn't return the user,
            // so we'll rely on variables to update the frontend state.
            setCurrentUser(prev => ({
                ...prev,
                username: variables.username,
                bio: variables.bio,
                avatar_url: variables.avatar_url,
            }));
            // Invalidate queries that fetch user profile data to ensure they re-fetch fresh data
            queryClient.invalidateQueries({ queryKey: ['userProfile', variables.username] }); // Invalidate for the new username
            queryClient.invalidateQueries({ queryKey: ['userProfile', currentUser.username] }); // Invalidate for the old username (if changed)
            queryClient.invalidateQueries({ queryKey: ['forYouFeed'] }); // Invalidate feed if usernames show there
            queryClient.invalidateQueries({ queryKey: ['comments'] }); // Invalidate comments to show updated usernames
        },
        onError: (err) => {
            console.error('Error updating profile:', err.response?.data?.message || err.message);
            // Optionally set an error message to display
            // mutation.error will be available in the render
        },
    });

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setSuccessMessage(''); // Clear any previous success message
        const trimmedFormData = { ...formData, username: formData.username.trim() };
        mutation.mutate(trimmedFormData);
    };

    // If currentUser is null (still loading or not logged in), display loading spinner
    // The ProtectedRoute should handle not logged in case, but this is a fallback
    if (!currentUser) {
        return <LoadingSpinner text="Loading profile..." />;
    }

    return (
        <div className="max-w-xl mx-auto bg-slate-800 p-6 rounded-md shadow-md">
            <h2 className="text-2xl font-semibold mb-4 text-white">Edit Your Profile</h2>

            {mutation.isError && (
                <Alert title="Error">{mutation.error.response?.data?.message || mutation.error.message}</Alert>
            )}
            {successMessage && (
                <div className="mb-4 p-3 bg-green-700 text-white rounded">{successMessage}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="username" className="block mb-1 font-medium text-gray-300">Username</label>
                    <input
                        type="text"
                        name="username"
                        id="username"
                        value={formData.username}
                        onChange={handleChange}
                        className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="bio" className="block mb-1 font-medium text-gray-300">Bio</label>
                    <textarea
                        name="bio"
                        id="bio"
                        rows={4}
                        value={formData.bio}
                        onChange={handleChange}
                        className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <div>
                    <label htmlFor="avatar_url" className="block mb-1 font-medium text-gray-300">Avatar URL</label>
                    <input
                        type="url"
                        name="avatar_url"
                        id="avatar_url"
                        value={formData.avatar_url}
                        onChange={handleChange}
                        placeholder="https://example.com/image.png"
                        className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded text-white font-semibold disabled:bg-gray-500"
                >
                    {mutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
            </form>
        </div>
    );
}

export default EditProfilePage;