// frontend/src/components/ProfileHeader.jsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext.jsx'; // Corrected relative path
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient.js'; // Corrected relative path

// API Service Functions
const followUserApi = (userId) => apiClient.post(`/profile/follow/${userId}`);
const unfollowUserApi = (userId) => apiClient.delete(`/profile/unfollow/${userId}`);

// Changed to DEFAULT EXPORT for the main component
export default function ProfileHeader({ user, isOwnProfile, isFollowing, onToggleFollow, isTogglingFollow, onEditProfile }) {
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const mutation = useMutation({
        mutationFn: (isCurrentlyFollowing) => {
            return isCurrentlyFollowing ? unfollowUserApi(user.uid) : followUserApi(user.uid);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userProfile', user.username] });
        },
        onError: (error) => {
            console.error("Failed to update follow status:", error.response?.data?.message || error.message);
        }
    });

    const handleFollowClick = () => {
        if (onToggleFollow) {
            onToggleFollow();
        } else {
            mutation.mutate(isFollowing || false);
        }
    };

    const handleEditProfileClick = () => {
        if (onEditProfile) {
            onEditProfile();
        } else {
            navigate('/profile/edit');
        }
    };

    const getButtonContent = () => {
        if (isTogglingFollow || mutation.isPending) {
            return 'Loading...';
        }
        return isFollowing ? 'Following' : 'Follow';
    };

    const buttonClass = isFollowing
        ? "bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition"
        : "bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition shadow-sm";

    return (
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <img
                src={user.avatar_url || 'https://via.placeholder.com/128'}
                alt={user.username}
                className="w-32 h-32 rounded-full object-cover border-4 border-slate-700 shadow-lg"
            />
            <div className="flex-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-between">
                    <h1 className="text-3xl font-bold text-white">@{user.username}</h1>
                    {isOwnProfile ? (
                        <button onClick={handleEditProfileClick} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition">
                            Edit Profile
                        </button>
                    ) : (
                        <button onClick={handleFollowClick} disabled={isTogglingFollow || mutation.isPending} className={buttonClass}>
                            {getButtonContent()}
                        </button>
                    )}
                </div>

                <div className="mt-4 flex justify-center sm:justify-start gap-6 text-slate-300">
                    <span>
                        <strong className="text-white">{user.followers_count ?? 0}</strong> Followers
                    </span>
                    <span>
                        <strong className="text-white">{user.following_count ?? 0}</strong> Following
                    </span>
                </div>

                <p className="mt-2 text-slate-400">
                    {user.bio || 'This user has not set a bio yet.'}
                </p>
            </div>
        </div>
    );
}

// Named export for ProfileSkeleton remains, as it's a separate utility component
export function ProfileSkeleton() {
    return (
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 animate-pulse">
            <div className="w-32 h-32 rounded-full bg-slate-700"></div>
            <div className="flex-1 w-full">
                <div className="h-8 bg-slate-700 rounded w-1/3 mb-4"></div>
                <div className="flex gap-6">
                    <div className="h-4 bg-slate-700 rounded w-1/4"></div>
                    <div className="h-4 bg-slate-700 rounded w-1/4"></div>
                </div>
                <div className="h-4 bg-slate-700 rounded w-full mt-4 mb-2"></div>
                <div className="h-4 bg-slate-700 rounded w-2/3"></div>
            </div>
        </div>
    );
}