// frontend/src/pages/PictureBookPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import ImageEditor from '../components/ImageEditor.jsx';
import { LoadingSpinner, Alert } from '../components/common.jsx';
import CheckoutModal from '../components/CheckoutModal.jsx';
import { motion } from 'framer-motion';
import { ArrowLeftIcon, EyeIcon } from '@heroicons/react/24/solid';

const useDebouncedEffect = (callback, delay, deps) => {
    const callbackRef = useRef(callback);
    useEffect(() => { callbackRef.current = callback; }, [callback]);
    useEffect(() => {
        const handler = setTimeout(() => {
            if (deps.every(dep => dep !== undefined)) {
                callbackRef.current();
            }
        }, delay);
        return () => { clearTimeout(handler); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [delay, ...deps]);
};

const REQUIRED_CONTENT_PAGES = 20;

function PictureBookPage() {
    const { bookId } = useParams();
    const navigate = useNavigate();
    const [book, setBook] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isCheckoutModalOpen, setCheckoutModalOpen] = useState(false);

    const fetchBook = useCallback(async () => {
        if (!bookId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const { data } = await apiClient.get(`/picture-books/${bookId}`);
            setBook(data.book);
            const fetchedTimeline = data.timeline.length > 0 ? data.timeline.map(event => ({ ...event })) : [{ page_number: 1, story_text: '', event_date: '', image_url: null, uploaded_image_url: null, overlay_text: '', is_bold_story_text: false }];
            setTimeline(fetchedTimeline);
        } catch (err) {
            setError('Failed to load your picture book project.');
        } finally {
            setIsLoading(false);
        }
    }, [bookId]);

    useEffect(() => {
        fetchBook();
    }, [bookId, fetchBook]);

    const handleFieldChange = (pageIndex, field, value) => {
        setTimeline(prevTimeline => {
            const newTimeline = [...prevTimeline];
            const updatedEvent = { ...(newTimeline[pageIndex] || {}) };
            if (!updatedEvent.page_number) updatedEvent.page_number = pageIndex + 1;
            if (field === 'image_url' && value !== null) updatedEvent['uploaded_image_url'] = null;
            else if (field === 'uploaded_image_url' && value !== null) updatedEvent['image_url'] = null;
            updatedEvent[field] = value;
            newTimeline[pageIndex] = updatedEvent;
            return newTimeline;
        });
    };

    const autoSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        const currentEvent = timeline[currentPage - 1];
        if (currentEvent) {
            try {
                await apiClient.post(`/picture-books/${bookId}/events`, {
                    page_number: currentEvent.page_number,
                    event_date: currentEvent.event_date,
                    story_text: currentEvent.story_text,
                    is_bold_story_text: currentEvent.is_bold_story_text,
                    image_url: currentEvent.image_url,
                    image_style: currentEvent.image_style,
                    uploaded_image_url: currentEvent.uploaded_image_url,
                    overlay_text: currentEvent.overlay_text
                });
            } catch (err) {
                setError("Failed to save progress.");
            } finally {
                setTimeout(() => setIsSaving(false), 1000);
            }
        } else {
            setIsSaving(false);
        }
    };
    
    const currentEventForDebounce = timeline[currentPage - 1];
    useDebouncedEffect(() => {
        autoSave();
    }, 2000, [
        currentEventForDebounce?.story_text,
        currentEventForDebounce?.is_bold_story_text,
        currentEventForDebounce?.event_date,
        currentEventForDebounce?.image_url,
        currentEventForDebounce?.uploaded_image_url,
        currentEventForDebounce?.overlay_text
    ]);

    const addPage = () => {
        if (timeline.length >= REQUIRED_CONTENT_PAGES) {
            alert(`You have reached the maximum of ${REQUIRED_CONTENT_PAGES} pages for a picture book.`);
            return;
        }
        const newPageNumber = timeline.length + 1;
        setTimeline(prevTimeline => [
            ...prevTimeline,
            {
                page_number: newPageNumber,
                story_text: '',
                event_date: '',
                image_url: null,
                uploaded_image_url: null,
                overlay_text: '',
                is_bold_story_text: false
            }
        ]);
        setCurrentPage(newPageNumber);
    };

    const handleDeletePage = async () => {
        if (timeline.length <= 1) {
            alert("You cannot delete the last page.");
            return;
        }
        if (window.confirm(`Are you sure you want to delete Page ${currentPage}? This action cannot be undone.`)) {
            try {
                await apiClient.delete(`/picture-books/${bookId}/events/${currentPage}`);
                if (currentPage === timeline.length && currentPage > 1) {
                    setCurrentPage(prev => prev - 1);
                }
                await fetchBook();
            } catch (err) {
                setError("Failed to delete page. Please try again.");
            }
        }
    };

    const handleFinalizeAndPurchase = () => {
        if (timeline.length !== REQUIRED_CONTENT_PAGES) {
            setError(`Your picture book must have exactly ${REQUIRED_CONTENT_PAGES} pages to be printed. You currently have ${timeline.length}.`);
            return;
        }
        setCheckoutModalOpen(true);
    };

    const submitFinalCheckout = async (shippingAddress, selectedShippingLevel, quoteToken) => {
        try {
            const response = await apiClient.post(`/picture-books/${bookId}/checkout`, {
                shippingAddress,
                selectedShippingLevel,
                quoteToken,
            });
            window.location.href = response.data.url;
        } catch (err) {
            console.error('submitFinalCheckout (PictureBookPage): Could not proceed to checkout:', err);
            throw err;
        }
    };

    if (isLoading) return <LoadingSpinner text="Loading your project..." />;
    if (error) return <Alert type="error" message={error} onClose={() => setError(null)} />;

    const currentEvent = timeline[currentPage - 1] || {};
    const meetsPageRequirement = timeline.length === REQUIRED_CONTENT_PAGES;

    return (
        <>
            <CheckoutModal isOpen={isCheckoutModalOpen} onClose={() => setCheckoutModalOpen(false)} onSubmit={submitFinalCheckout} bookId={bookId} bookType="pictureBook" book={book} />
            
            <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] text-white">
                <div className="max-w-screen-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex flex-col min-h-screen">
                    
                    {/* New Compact Header for Editor */}
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex justify-between items-center mb-8"
                    >
                        <Link to="/my-projects" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
                            <ArrowLeftIcon className="h-5 w-5" />
                            Back to My Projects
                        </Link>
                        <div className="text-center">
                            <h1 className="text-2xl font-serif font-bold text-white tracking-tight">{book?.title || 'Picture Book Editor'}</h1>
                            {isSaving && <div className="text-xs text-blue-400 animate-pulse">Saving...</div>}
                        </div>
                        <button onClick={() => navigate(`/picture-book/${bookId}/preview`)} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                            <EyeIcon className="h-5 w-5" />
                            Preview
                        </button>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="flex-grow flex flex-col md:flex-row gap-8"
                    >
                        <div className="md:w-1/3 lg:w-1/4 flex flex-col space-y-6 p-6 bg-slate-800/50 backdrop-blur-md rounded-2xl shadow-lg border border-slate-700">
                            <div className="border-b border-slate-700 pb-4">
                                <h2 className="text-xl font-bold text-white">Page {currentPage} / {timeline.length}</h2>
                                <p className="text-slate-400 mt-1">Required: {REQUIRED_CONTENT_PAGES} pages</p>
                            </div>
                            <div className="space-y-4 flex-grow">
                                <div>
                                    <label htmlFor="event_date" className="block text-sm font-medium text-slate-300 mb-2">Date / Page Title</label>
                                    <input id="event_date" type="text" value={currentEvent.event_date || ''} onChange={(e) => handleFieldChange(currentPage - 1, 'event_date', e.target.value)} className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g., Summer of 2023" />
                                </div>
                                <div>
                                    <label htmlFor="story_text" className="block text-sm font-medium text-slate-300 mb-2">Story Text</label>
                                    <textarea id="story_text" value={currentEvent.story_text || ''} onChange={(e) => handleFieldChange(currentPage - 1, 'story_text', e.target.value)} className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 h-32 resize-y text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Write the story for this page..." />
                                </div>
                                <div className="flex items-center">
                                    <input id="is_bold_story_text" type="checkbox" checked={currentEvent.is_bold_story_text || false} onChange={(e) => handleFieldChange(currentPage - 1, 'is_bold_story_text', e.target.checked)} className="h-4 w-4 text-indigo-500 bg-slate-600 border-slate-500 focus:ring-indigo-500 rounded" />
                                    <label htmlFor="is_bold_story_text" className="ml-3 block text-sm text-slate-300">Display this page's story text in bold</label>
                                </div>
                            </div>
                            <div className="mt-auto pt-6 border-t border-slate-700 flex flex-col space-y-4">
                                <div className="flex justify-between items-center">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 bg-slate-700 text-white rounded-md disabled:opacity-50 hover:bg-slate-600 transition">Previous</button>
                                    <button onClick={() => setCurrentPage(p => Math.min(timeline.length, p + 1))} disabled={currentPage === timeline.length} className="px-4 py-2 bg-slate-700 text-white rounded-md disabled:opacity-50 hover:bg-slate-600 transition">Next</button>
                                </div>
                                <div className="flex flex-col space-y-2">
                                    <button onClick={addPage} disabled={timeline.length >= REQUIRED_CONTENT_PAGES} className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition shadow-md disabled:bg-slate-500 disabled:cursor-not-allowed">Add New Page</button>
                                    <button onClick={handleDeletePage} disabled={timeline.length <= 1} className="w-full px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:bg-red-800 disabled:text-slate-400 transition shadow-md">Delete Current Page</button>
                                </div>
                            </div>
                        </div>
                        <div className="md:w-2/3 lg:w-3/4">
                            <ImageEditor currentEvent={currentEvent} onImageUpdate={handleFieldChange} />
                        </div>
                    </motion.div>
                    <div className="mt-8 text-center">
                        <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleFinalizeAndPurchase} 
                            disabled={!meetsPageRequirement} 
                            className="bg-teal-600 text-white font-bold py-4 px-10 rounded-lg hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-all duration-300 transform shadow-lg text-lg"
                        >
                            Finalize & Purchase
                        </motion.button>
                        {!meetsPageRequirement && (
                            <p className="text-sm text-red-400 mt-2">
                                A picture book must have exactly {REQUIRED_CONTENT_PAGES} pages. ({timeline.length}/{REQUIRED_CONTENT_PAGES})
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export default PictureBookPage;