// frontend/src/pages/PictureBookPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../services/apiClient';
import ImageEditor from '../components/ImageEditor.jsx';
import { LoadingSpinner, Alert } from '../components/common.jsx';
import CheckoutModal from '../components/CheckoutModal.jsx';

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

    const autoSave = async () => { /* ... Unchanged ... */ };
    useDebouncedEffect(() => { autoSave(); }, 2000, [timeline[currentPage - 1]]);

    const addPage = () => { /* ... Unchanged ... */ };
    const handleDeletePage = async () => { /* ... Unchanged ... */ };
    const handleFinalizeAndPurchase = () => { /* ... Unchanged ... */ };
    const submitFinalCheckout = async (shippingAddress, selectedShippingLevel, quoteToken) => { /* ... Unchanged ... */ };

    if (isLoading) return <LoadingSpinner text="Loading your project..." />;
    if (error) return <Alert type="error" message={error} onClose={() => setError(null)} />;

    const currentEvent = timeline[currentPage - 1] || {};
    const meetsPageRequirement = timeline.length === REQUIRED_CONTENT_PAGES;

    return (
        <>
            <CheckoutModal isOpen={isCheckoutModalOpen} onClose={() => setCheckoutModalOpen(false)} onSubmit={submitFinalCheckout} bookId={bookId} bookType="pictureBook" book={book} />
            <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 text-white min-h-screen flex flex-col">
                <div className="flex-grow flex flex-col md:flex-row gap-8">
                    <div className="md:w-1/3 flex flex-col space-y-6 p-6 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
                        <div className="border-b border-slate-700 pb-4">
                            <div className="flex justify-between items-center">
                                <h1 className="text-3xl font-bold text-white tracking-tight">{book?.title || 'Picture Book Editor'}</h1>
                                {isSaving && <div className="text-sm text-blue-400 animate-pulse">Saving...</div>}
                            </div>
                            <p className="text-slate-400 mt-2">Page {currentPage} of {timeline.length} (Required: {REQUIRED_CONTENT_PAGES})</p>
                        </div>
                        <div className="space-y-4 flex-grow">
                            <div>
                                <label htmlFor="event_date" className="block text-sm font-medium text-slate-300 mb-1">Date / Event Title</label>
                                <input id="event_date" type="text" value={currentEvent.event_date || ''} onChange={(e) => handleFieldChange(currentPage - 1, 'event_date', e.target.value)} className="w-full px-4 py-3 rounded bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g., Summer of 2023" />
                            </div>
                            <div>
                                <label htmlFor="story_text" className="block text-sm font-medium text-slate-300 mb-1">Story Text</label>
                                <textarea id="story_text" value={currentEvent.story_text || ''} onChange={(e) => handleFieldChange(currentPage - 1, 'story_text', e.target.value)} className="w-full px-4 py-3 rounded bg-slate-700 border border-slate-600 h-32 resize-y text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Write the story for this page..." />
                            </div>
                            <div className="flex items-center">
                                <input id="is_bold_story_text" type="checkbox" checked={currentEvent.is_bold_story_text || false} onChange={(e) => handleFieldChange(currentPage - 1, 'is_bold_story_text', e.target.checked)} className="h-4 w-4 text-indigo-600 bg-slate-600 border-slate-500 focus:ring-indigo-500 rounded" />
                                <label htmlFor="is_bold_story_text" className="ml-2 block text-sm text-slate-300">Bold Story Text</label>
                            </div>
                        </div>
                        <div className="mt-auto pt-6 border-t border-slate-700 flex flex-col space-y-4">
                            <div className="flex justify-between items-center">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 bg-slate-700 text-white rounded-md disabled:opacity-50 hover:bg-slate-600 transition">Previous</button>
                                <span className="text-lg font-semibold">{currentPage} / {timeline.length}</span>
                                <button onClick={() => setCurrentPage(p => Math.min(timeline.length, p + 1))} disabled={currentPage === timeline.length} className="px-4 py-2 bg-slate-700 text-white rounded-md disabled:opacity-50 hover:bg-slate-600 transition">Next</button>
                            </div>
                            <div className="flex flex-col space-y-2">
                                <button onClick={addPage} disabled={timeline.length >= REQUIRED_CONTENT_PAGES} className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition shadow-md disabled:bg-indigo-400 disabled:cursor-not-allowed">Add New Page</button>
                                <button onClick={handleDeletePage} disabled={timeline.length <= 1} className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-400 transition shadow-md">Delete Current Page</button>
                            </div>
                        </div>
                    </div>
                    <div className="md:w-2/3">
                        <ImageEditor currentEvent={currentEvent} onImageUpdate={handleFieldChange} />
                    </div>
                </div>
                <div className="mt-8 text-center">
                    <button onClick={handleFinalizeAndPurchase} disabled={!meetsPageRequirement} className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 disabled:bg-green-800 disabled:text-slate-400 disabled:cursor-not-allowed transition-transform transform hover:scale-105 shadow-lg text-lg">
                        Finalize & Purchase
                    </button>
                    {!meetsPageRequirement && (
                        <p className="text-sm text-red-400 mt-2">
                            A picture book must have exactly {REQUIRED_CONTENT_PAGES} pages. ({timeline.length}/{REQUIRED_CONTENT_PAGES})
                        </p>
                    )}
                </div>
            </div>
        </>
    );
}

export default PictureBookPage;