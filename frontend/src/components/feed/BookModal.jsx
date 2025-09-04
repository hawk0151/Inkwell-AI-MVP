// frontend/src/components/feed/BookModal.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { LikeButton } from './LikeButton.jsx';
import { PurchaseButton } from './PurchaseButton.jsx';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '../common.jsx'; // <-- IMPORTED your spinner

// Icon Components
const XIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> );
const TrashIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V6"/><path d="M8 6V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2"/></svg> );
const SendIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/></svg> );

export function BookModal({ book, isOpen, onClose }) {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();
    const [newCommentText, setNewCommentText] = useState('');
    const isOwnBook = currentUser?.uid === book?.user_id;

    const { data: comments, isLoading: isLoadingComments } = useQuery({
        queryKey: ['comments', book?.id, book?.book_type],
        queryFn: () => apiClient.get(`/social/comments/${book.book_type}/${book.id}`).then(res => res.data),
        enabled: !!isOpen && !!book,
    });
    
    const previewPdfMutation = useMutation({
        mutationFn: (bookToPreview) => {
            const bookTypePath = bookToPreview.book_type === 'text_book' ? 'text-books' : 'picture-books';
            return apiClient.get(`/${bookTypePath}/${bookToPreview.id}/preview`);
        },
        onSuccess: (response) => {
            window.open(response.data.previewUrl, '_blank');
            toast.success("Your preview is ready!");
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to generate PDF preview.');
        },
    });

    const addCommentMutation = useMutation({
        mutationFn: (commentText) => apiClient.post('/social/comment', { bookId: book.id, bookType: book.book_type, commentText }),
        onSuccess: () => {
            setNewCommentText('');
            queryClient.invalidateQueries({ queryKey: ['comments', book.id, book.book_type] });
            queryClient.invalidateQueries({ queryKey: ['forYouFeed'] });
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to post comment.'),
    });

    const deleteCommentMutation = useMutation({
        mutationFn: (commentId) => apiClient.delete(`/social/comment/${book.book_type}/${book.id}/${commentId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['comments', book.id, book.book_type] });
            queryClient.invalidateQueries({ queryKey: ['forYouFeed'] });
            toast.success("Comment deleted.");
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete comment.'),
    });
    
    const handleAddComment = (e) => { e.preventDefault(); if (newCommentText.trim()) addCommentMutation.mutate(newCommentText); };
    const handleDeleteComment = (commentId) => { if (window.confirm("Delete this comment?")) deleteCommentMutation.mutate(commentId); };

    useEffect(() => {
        const handleEsc = (event) => { if (event.keyCode === 27) onClose(); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!isOpen || !book) return null;

    return (
        <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={onClose}>
                <motion.div role="dialog" aria-modal="true" initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }} transition={{ type: "spring", damping: 25, stiffness: 400 }} className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    <div className="w-full md:w-1/2 h-64 md:h-auto bg-slate-800"><img src={book.cover_image_url} alt={`Cover for ${book.title}`} className="w-full h-full object-cover" /></div>
                    <div className="p-6 flex flex-col flex-1 overflow-y-auto custom-scrollbar md:w-1/2">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold text-white">{book.title}</h2>
                                <button onClick={() => navigate(`/profile/${book.author_username}`)} className="text-md text-slate-400 hover:text-indigo-400">by @{book.author_username}</button>
                            </div>
                            <button onClick={onClose} className="text-slate-400 hover:text-white"><XIcon /></button>
                        </div>

                        <div className="mt-4 flex flex-col sm:flex-row gap-3">
                            {/* --- UPDATED BUTTON CODE --- */}
                            <button 
                                onClick={() => previewPdfMutation.mutate(book)} 
                                disabled={previewPdfMutation.isPending} 
                                className="flex-1 flex items-center justify-center font-semibold text-indigo-400 bg-slate-800 hover:bg-slate-700 transition-colors py-2 px-4 rounded-md disabled:opacity-75 disabled:cursor-not-allowed"
                            >
                                {previewPdfMutation.isPending ? (
                                    // Use your existing spinner component, but with a custom, smaller size for the button
                                    <div className="flex items-center">
                                        <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mr-2"></div>
                                        <span>Generating...</span>
                                    </div>
                                ) : (
                                    'View Full Book'
                                )}
                            </button>
                            {!isOwnBook && ( <div className="flex-1"><PurchaseButton book={book} /></div> )}
                        </div>

                        <div className="mt-4 border-t border-slate-700 pt-4 flex items-center gap-6 text-slate-400"><LikeButton book={book} /></div>

                        <div className="mt-4 border-t border-slate-700 pt-4 flex-1 flex flex-col min-h-0">
                            <h3 className="text-xl font-semibold text-white mb-3">Comments ({book.comment_count || 0})</h3>
                            <div className="flex-grow space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                                {isLoadingComments && <p className="text-slate-400">Loading comments...</p>}
                                {comments && comments.length > 0 ? (
                                    comments.map((comment) => (
                                        <div key={comment.id} className="bg-slate-800 p-3 rounded-lg text-sm flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold text-white">{comment.username}</p>
                                                <p className="text-slate-300">{comment.comment_text}</p>
                                            </div>
                                            {currentUser && currentUser.uid === comment.user_id && (
                                                <button onClick={() => handleDeleteComment(comment.id)} disabled={deleteCommentMutation.isPending} className="text-slate-500 hover:text-red-500 p-1"><TrashIcon /></button>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    !isLoadingComments && <p className="text-slate-400">No comments yet.</p>
                                )}
                            </div>
                            {currentUser && (
                                <form onSubmit={handleAddComment} className="mt-4 flex gap-2">
                                    <input type="text" value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} placeholder="Add a comment..." className="flex-grow p-2 rounded-md bg-slate-700 border border-slate-600 text-white" disabled={addCommentMutation.isPending} />
                                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-md" disabled={addCommentMutation.isPending || !newCommentText.trim()}>
                                        {addCommentMutation.isPending ? '...' : <SendIcon />}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}