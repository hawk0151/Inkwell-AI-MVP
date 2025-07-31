// frontend/src/components/feed/BookCard.jsx
import React, { useState } from 'react';
import { LikeButton } from './LikeButton.jsx';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';

const MessageCircleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>;
const XIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
const SendIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V6"/><path d="M8 6V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2"/></svg>;


const BookPreviewModal = ({ book, onClose }) => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();
    const [newCommentText, setNewCommentText] = useState('');

    // Fetch comments for the book
    const { data: comments, isLoading: isLoadingComments, error: commentsError } = useQuery({
        queryKey: ['comments', book.id, book.book_type],
        queryFn: async () => {
            const { data } = await apiClient.get(`/social/comments/${book.book_type}/${book.id}`);
            return data;
        },
        enabled: !!book.id && !!book.book_type,
    });

    // Mutation for adding a new comment
    const addCommentMutation = useMutation({
        mutationFn: async (comment) => {
            await apiClient.post('/social/comment', {
                bookId: book.id,
                bookType: book.book_type,
                commentText: comment
            });
        },
        onSuccess: () => {
            setNewCommentText('');
            queryClient.invalidateQueries({ queryKey: ['comments', book.id, book.book_type] });
            queryClient.invalidateQueries({ queryKey: ['forYouFeed'] });
            queryClient.invalidateQueries({ queryKey: ['userProfile', book.author_username] });
        },
        onError: (err) => {
            console.error('Failed to add comment:', err);
            alert(`Failed to add comment: ${err.response?.data?.message || err.message}`);
        },
    });

    // NEW: Mutation for deleting a comment
    const deleteCommentMutation = useMutation({
        mutationFn: async ({ commentId, bookId, bookType }) => {
            await apiClient.delete(`/social/comment/${bookType}/${bookId}/${commentId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['comments', book.id, book.book_type] });
            queryClient.invalidateQueries({ queryKey: ['forYouFeed'] });
            queryClient.invalidateQueries({ queryKey: ['userProfile', book.author_username] });
        },
        onError: (err) => {
            console.error('Failed to delete comment:', err);
            alert(`Failed to delete comment: ${err.response?.data?.message || err.message}`);
        },
    });

    const handleAddComment = (e) => {
        e.preventDefault();
        if (!currentUser) {
            alert("Please log in to add comments.");
            return;
        }
        if (newCommentText.trim()) {
            addCommentMutation.mutate(newCommentText);
        }
    };

    // NEW: Handle comment deletion click
    const handleDeleteComment = (commentId) => {
        if (window.confirm("Are you sure you want to delete this comment?")) {
            deleteCommentMutation.mutate({ commentId, bookId: book.id, bookType: book.book_type });
        }
    };

    const goToProfile = (e) => {
        e.stopPropagation();
        onClose();
        navigate(`/profile/${book.author_username}`);
    };

    const goToFullBook = (e) => {
        e.stopPropagation();
        onClose();
        const path = book.type === 'pictureBook' ? `/project/${book.id}` : `/novel`;
        navigate(path, { state: { bookId: book.id } });
    };

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={book.cover_image_url || 'https://via.placeholder.com/400x533'}
                    alt={`Cover for ${book.title}`}
                    className="w-full md:w-1/3 h-auto object-cover"
                />
                <div className="p-6 flex flex-col flex-1 overflow-y-auto">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-white">{book.title}</h2>
                            <button onClick={goToProfile} className="text-md text-slate-400 hover:text-indigo-400">
                                by @{book.author_username}
                            </button>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-white">
                            <XIcon />
                        </button>
                    </div>
                    <p className="text-slate-300 mt-4 flex-grow">
                        {book.description || "No description available."}
                    </p>

                    {/* Comments Section */}
                    <div className="mt-6 border-t border-slate-700 pt-4">
                        <h3 className="text-xl font-semibold text-white mb-3">Comments ({book.comment_count || 0})</h3>
                        <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {isLoadingComments ? (
                                <p className="text-slate-400">Loading comments...</p>
                            ) : commentsError ? (
                                <p className="text-red-400">Failed to load comments.</p>
                            ) : comments && comments.length > 0 ? (
                                comments.map((comment) => (
                                    <div key={comment.id} className="bg-slate-800 p-3 rounded-lg text-sm flex justify-between items-start"> {/* Added flex and justify-between */}
                                        <div>
                                            <p className="font-semibold text-white">{comment.username}</p>
                                            <p className="text-slate-300">{comment.comment_text}</p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {new Date(comment.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                        {/* NEW: Delete Button (only if current user owns the comment) */}
                                        {currentUser && currentUser.uid === comment.user_id && (
                                            <button
                                                onClick={() => handleDeleteComment(comment.id)}
                                                className="text-slate-500 hover:text-red-500 transition-colors ml-2 p-1 rounded-full hover:bg-slate-700"
                                                disabled={deleteCommentMutation.isPending}
                                                title="Delete comment"
                                            >
                                                <TrashIcon />
                                            </button>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-400">No comments yet. Be the first to comment!</p>
                            )}
                        </div>

                        {/* Comment Input Form */}
                        {currentUser && (
                            <form onSubmit={handleAddComment} className="mt-4 flex gap-2">
                                <input
                                    type="text"
                                    value={newCommentText}
                                    onChange={(e) => setNewCommentText(e.target.value)}
                                    placeholder="Add a comment..."
                                    className="flex-grow p-2 rounded-md bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    disabled={addCommentMutation.isPending}
                                />
                                <button
                                    type="submit"
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-md transition disabled:bg-indigo-400"
                                    disabled={addCommentMutation.isPending || !newCommentText.trim()}
                                >
                                    {addCommentMutation.isPending ? 'Posting...' : <SendIcon />}
                                </button>
                            </form>
                        )}
                    </div>

                    <div className="border-t border-slate-700 pt-4 mt-4 flex items-center justify-between text-slate-400">
                        <div className="flex items-center gap-4">
                            <LikeButton book={book} />
                            <div className="flex items-center gap-1.5">
                                <MessageCircleIcon />
                                <span className="text-sm font-medium">{book.comment_count || 0}</span>
                            </div>
                        </div>
                        <button onClick={goToFullBook} className="text-sm font-semibold text-indigo-400 hover:text-indigo-300">
                            View Full Book
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export function BookCard({ book }) {
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    return (
        <>
            <div
                className="bg-slate-800/50 rounded-lg shadow-lg overflow-hidden flex flex-col group transition-all duration-300 hover:shadow-indigo-500/30 hover:scale-105 cursor-pointer"
                onClick={() => setIsPreviewOpen(true)}
            >
                <div className="p-4 flex items-center gap-3">
                    <img
                        src={book.author_avatar_url || 'https://via.placeholder.com/40'}
                        alt={book.author_username}
                        className="w-10 h-10 rounded-full object-cover border-2 border-slate-700"
                    />
                    <div>
                        <p className="font-semibold text-white truncate group-hover:text-indigo-400">{book.title}</p>
                        <p className="text-sm text-slate-400">by @{book.author_username}</p>
                    </div>
                </div>
                <div className="w-full aspect-[3/4] bg-slate-700">
                    <img
                        src={book.cover_image_url || 'https://via.placeholder.com/300x400'}
                        alt={`Cover for ${book.title}`}
                        className="w-full h-full object-cover"
                    />
                </div>

                <div className="p-4 mt-auto">
                    <div className="flex items-center justify-between text-slate-400">
                        <div className="flex items-center gap-4">
                            <LikeButton book={book} />
                            <button className="flex items-center gap-1.5 hover:text-sky-500 transition-colors" onClick={(e) => { e.stopPropagation(); setIsPreviewOpen(true); }}>
                                <MessageCircleIcon />
                                <span className="text-sm font-medium">{book.comment_count || 0}</span>
                            </button>
                        </div>
                        <button className="text-sm font-semibold text-indigo-400 hover:text-indigo-300" onClick={(e) => { e.stopPropagation(); setIsPreviewOpen(true); }}>
                            View
                        </button>
                    </div>
                </div>
            </div>

            {isPreviewOpen && <BookPreviewModal book={book} onClose={() => setIsPreviewOpen(false)} />}
        </>
    );
}