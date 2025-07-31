import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../services/apiClient';
import ImageEditor from '../components/ImageEditor.jsx';
import { LoadingSpinner, Alert } from '../components/common.jsx';

const useDebouncedEffect = (callback, delay, deps) => {
    const callbackRef = useRef(callback);
    useEffect(() => { callbackRef.current = callback; }, [callback]);
    useEffect(() => {
        if (deps.every(dep => dep !== undefined)) {
            const handler = setTimeout(() => { callbackRef.current(); }, delay);
            return () => { clearTimeout(handler); };
        }
    }, [delay, ...deps]);
};

function PictureBookPage() {
    const { bookId } = useParams();
    const [book, setBook] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const minPageCount = 24;

    const fetchBook = async () => {
        if (!bookId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const { data } = await apiClient.get(`/picture-books/${bookId}`);
            setBook(data.book);
            const fetchedTimeline = data.timeline.length > 0 ? data.timeline.map(event => ({
                ...event,
                uploaded_image_url: event.uploaded_image_url || null,
                overlay_text: event.overlay_text || '',
            })) : [{ page_number: 1, description: '', event_date: '', image_url: null, uploaded_image_url: null, overlay_text: '' }];
            setTimeline(fetchedTimeline);
        } catch (err) {
            setError('Failed to load project.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBook();
    }, [bookId]);

    const handleFieldChange = (pageIndex, field, value) => {
        const newTimeline = [...timeline];
        if (!newTimeline[pageIndex]) {
            newTimeline[pageIndex] = { 
                page_number: pageIndex + 1, 
                description: '', 
                event_date: '', 
                image_url: null, 
                uploaded_image_url: null,
                overlay_text: ''
            };
        }
        newTimeline[pageIndex][field] = value;
        setTimeline(newTimeline);
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
                    description: currentEvent.description,
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
    useDebouncedEffect(() => { autoSave(); }, 2000, [currentEventForDebounce?.description, currentEventForDebounce?.event_date, currentEventForDebounce?.image_url, currentEventForDebounce?.uploaded_image_url, currentEventForDebounce?.overlay_text]);

    const addPage = () => {
        const newPageNumber = timeline.length + 1;
        setTimeline([...timeline, { page_number: newPageNumber, description: '', event_date: '', image_url: null, uploaded_image_url: null, overlay_text: '' }]);
        setCurrentPage(newPageNumber);
    };

    const handleDeletePage = async () => {
        if (timeline.length === 1) { 
            alert("You cannot delete the last page of the book. To delete the book, go to My Projects.");
            return;
        }
        // Removed: if (timeline.length <= minPageCount) restriction for editing, now applies only to checkout
        
        if (window.confirm(`Are you sure you want to delete Page ${currentPage}? This action cannot be undone.`)) {
            try {
                await apiClient.delete(`/picture-books/${bookId}/events/${currentPage}`); 
                
                if (currentPage === timeline.length && currentPage > 1) {
                    setCurrentPage(prev => prev - 1);
                } else if (currentPage < timeline.length) {
                    // Stay on same page number, content will shift up
                } else {
                    setCurrentPage(1); 
                }

                await fetchBook(); 
            } catch (err) {
                setError("Failed to delete page. Please try again. Check console for details.");
                console.error("DEBUG: Error during delete API call:", err.response?.data?.message || err.message, err);
            }
        }
    };

    const handleFinalizeAndCheckout = async () => {
        setIsCheckingOut(true);
        setError(null);
        try {
            const response = await apiClient.post(`/picture-books/${bookId}/checkout`);
            window.location.href = response.data.url;
        } catch (err) {
            setError(err.response?.data?.message || "Could not proceed to checkout.");
            setIsCheckingOut(false);
        }
    };

    if (isLoading) return <LoadingSpinner text="Loading your project..." />;
    if (error) return <div className="text-red-500 font-bold p-4">Error: {error}</div>;

    const currentEvent = timeline[currentPage - 1] || {};
    const meetsPageMinimum = timeline.length >= minPageCount; // Still used for checkout button

    return (
        <div className="container mx-auto p-4 text-white min-h-screen flex flex-col">
            <div className="flex-grow flex flex-col md:flex-row gap-8 bg-slate-900/50 p-6 rounded-lg shadow-xl border border-slate-700">
                
                {/* Left Panel: Controls & Input Fields */}
                <div className="md:w-1/3 flex flex-col space-y-6 p-4 bg-slate-800 rounded-lg shadow-md border border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                        <h1 className="text-2xl font-bold text-white">{book?.title || 'New Picture Book'}</h1>
                        {isSaving && <div className="text-sm text-blue-400 animate-pulse">Saving...</div>}
                    </div>

                    <p className="text-sm text-slate-400">Page {currentPage} of {timeline.length}</p>

                    <div className="space-y-4 flex-grow">
                        <div>
                            <label htmlFor="event_date" className="block text-sm font-medium text-slate-300 mb-1">Date / Event Title</label>
                            <input 
                                type="text" 
                                id="event_date"
                                value={currentEvent.event_date || ''} 
                                onChange={(e) => handleFieldChange(currentPage - 1, 'event_date', e.target.value)} 
                                className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500" 
                                placeholder="e.g., Summer of 2023"
                            />
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-slate-300 mt-4 mb-1">Description</label>
                            <textarea 
                                id="description"
                                value={currentEvent.description || ''} 
                                onChange={(e) => handleFieldChange(currentPage - 1, 'description', e.target.value)} 
                                className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md h-40 resize-y text-white focus:ring-2 focus:ring-indigo-500" 
                                placeholder="Describe what happened on this page..."
                            />
                        </div>
                    </div>

                    {/* Page Navigation and Actions */}
                    <div className="mt-auto pt-6 border-t border-slate-700 flex flex-col space-y-4">
                        <div className="flex justify-between items-center">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 bg-gray-700 text-white rounded-md disabled:opacity-50 hover:bg-gray-600 transition">Previous</button>
                            <span className="text-lg font-semibold">{currentPage}</span>
                            <button onClick={() => setCurrentPage(p => Math.min(timeline.length, p + 1))} disabled={currentPage === timeline.length} className="px-4 py-2 bg-gray-700 text-white rounded-md disabled:opacity-50 hover:bg-gray-600 transition">Next</button>
                        </div>
                        <div className="flex flex-col space-y-2">
                            <button onClick={addPage} className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition shadow-md">Add New Page</button>
                            {/* MODIFIED disabled condition to allow deletion down to 1 page */}
                            <button onClick={handleDeletePage} disabled={timeline.length <= 1} className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-400 transition shadow-md">Delete Current Page</button>
                        </div>
                        
                        <div className="text-center pt-4">
                            <button onClick={handleFinalizeAndCheckout} disabled={!meetsPageMinimum || isCheckingOut} className="w-full px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition shadow-lg">
                                {isCheckingOut ? 'Finalizing...' : 'Finalize & Checkout'}
                            </button>
                            {!meetsPageMinimum && (
                                <p className="text-sm text-red-400 mt-2">
                                    Minimum {minPageCount} pages to print. ({timeline.length}/{minPageCount})
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Image Editor */}
                <div className="md:w-2/3">
                    <ImageEditor currentEvent={currentEvent} onImageUpdate={handleFieldChange} />
                </div>
            </div>
        </div>
    );
}

export default PictureBookPage;