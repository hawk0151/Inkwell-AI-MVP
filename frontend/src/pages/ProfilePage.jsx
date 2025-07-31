import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient.js'; // Corrected relative path
import { useAuth } from '../contexts/AuthContext.jsx'; // Corrected relative path
// CORRECTED: Importing ProfileHeader as a default import
import ProfileHeader, { ProfileSkeleton } from '../components/ProfileHeader.jsx'; // ProfileSkeleton is still a named export
import { BookCard } from '../components/feed/BookCard.jsx'; // Corrected relative path

// Fetch user profile without /api prefix
const fetchUserProfile = async (username) => {
    const { data } = await apiClient.get(`/profile/${username}`);
    return data;
};

// Toggle follow state without /api prefix
const toggleFollowUser = (userId) => {
    return apiClient.post(`/profile/${userId}/toggle-follow`);
};

function ProfilePage() {
    const { username } = useParams();
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['userProfile', username],
        queryFn: () => fetchUserProfile(username),
        enabled: !!username,
    });

    const followMutation = useMutation({
        mutationFn: toggleFollowUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userProfile', username] });
        },
        onError: (err) => {
            console.error('Failed to toggle follow:', err);
        }
    });

    const profile = data?.profile;
    const books = data?.books;
    const isOwnProfile = currentUser?.uid === profile?.uid;

    const handleEditProfileNavigate = () => {
        navigate('/profile/edit');
    };

    if (isLoading) return <ProfileSkeleton />;

    if (isError)
        return (
            <div className="text-center py-10 px-4 bg-red-900/20 rounded-lg">
                <h3 className="text-lg font-semibold text-red-400">Could not load profile.</h3>
                <p className="text-red-500 mt-1">{error?.response?.data?.message || error.message || 'Unknown error'}</p>
            </div>
        );

    return (
        <div>
            {profile && (
                <>
                    <ProfileHeader
                        user={profile}
                        isOwnProfile={isOwnProfile}
                        isFollowing={profile?.isFollowing}
                        onToggleFollow={() => followMutation.mutate(profile.uid)}
                        isTogglingFollow={followMutation.isLoading}
                        onEditProfile={handleEditProfileNavigate}
                    />
                    <hr className="my-8 border-slate-700" />
                    <h2 className="text-2xl font-bold text-white mb-6">Creations by @{profile.username}</h2>
                    {books && books.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {books.map((book) => (
                                <BookCard key={`${book.book_type}-${book.id}`} book={book} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 px-4 bg-slate-800/50 rounded-lg">
                            <h3 className="text-lg font-semibold text-white">No creations yet!</h3>
                            <p className="text-slate-400 mt-1">This user hasn't published any books.</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default ProfilePage;