// frontend/src/pages/EditProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext.jsx';
import apiClient from '../services/apiClient';
import { LoadingSpinner, Alert } from '../components/common.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { motion } from 'framer-motion';

const updateProfile = (formData) => {
    return apiClient.put('/profile/me', formData);
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
            setCurrentUser(prev => ({
                ...prev,
                username: variables.username,
                bio: variables.bio,
                avatar_url: variables.avatar_url,
            }));
            queryClient.invalidateQueries({ queryKey: ['userProfile', variables.username] });
            queryClient.invalidateQueries({ queryKey: ['userProfile', currentUser.username] });
            queryClient.invalidateQueries({ queryKey: ['forYouFeed'] });
            queryClient.invalidateQueries({ queryKey: ['comments'] });
        },
        onError: (err) => {
            console.error('Error updating profile:', err.response?.data?.message || err.message);
        },
    });

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setSuccessMessage('');
        const trimmedFormData = { ...formData, username: formData.username.trim() };
        mutation.mutate(trimmedFormData);
    };

    if (!currentUser) {
        return <LoadingSpinner text="Loading profile..." />;
    }

    return (
        <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <PageHeader 
                title="Edit Profile"
                subtitle="Update your public username, bio, and avatar."
            />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-slate-800/50 backdrop-blur-md p-8 md:p-10 rounded-2xl shadow-2xl border border-slate-700"
            >
                {mutation.isError && (
                    <Alert type="error" message={mutation.error.response?.data?.message || mutation.error.message} />
                )}
                {successMessage && (
                    <div className="mb-4 p-3 bg-green-900/50 border border-green-700 text-green-300 rounded text-center">{successMessage}</div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="username" className="block mb-2 font-medium text-slate-300">Username</label>
                        <input
                            type="text"
                            name="username"
                            id="username"
                            value={formData.username}
                            onChange={handleChange}
                            className="w-full px-4 py-3 rounded bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="bio" className="block mb-2 font-medium text-slate-300">Bio</label>
                        <textarea
                            name="bio"
                            id="bio"
                            rows={4}
                            value={formData.bio}
                            onChange={handleChange}
                            className="w-full px-4 py-3 rounded bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="avatar_url" className="block mb-2 font-medium text-slate-300">Avatar URL</label>
                        <input
                            type="url"
                            name="avatar_url"
                            id="avatar_url"
                            value={formData.avatar_url}
                            onChange={handleChange}
                            placeholder="https://example.com/image.png"
                            className="w-full px-4 py-3 rounded bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded text-white font-semibold disabled:bg-slate-500 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg"
                        >
                            {mutation.isPending ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

export default EditProfilePage;