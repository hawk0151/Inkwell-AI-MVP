// frontend/src/pages/PictureBookPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../services/apiClient';
import ImageEditor from '../components/ImageEditor.jsx';
import { LoadingSpinner, Alert } from '../components/common.jsx';
// MODIFIED: Import CheckoutModal from NovelPage.jsx (assuming it's in the same directory or common location)
import CheckoutModal from './NovelPage.jsx'; // Assuming CheckoutModal is exported from NovelPage.jsx

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
    }, [delay, ...deps]);
};

// Simplified list of valid countries for the dropdown (from NovelPage.jsx for consistency)
const COUNTRIES = [
    { code: 'US', name: 'United States', stateRequired: true },
    { code: 'AU', name: 'Australia', stateRequired: true },
    { code: 'GB', name: 'United Kingdom', stateRequired: false },
    { code: 'CA', name: 'Canada', stateRequired: true },
    { code: 'MX', name: 'Mexico', stateRequired: false },
    { code: 'NZ', name: 'New Zealand', stateRequired: false },
];

const REQUIRED_CONTENT_PAGES = 20;

function PictureBookPage() {
    const { bookId } = useParams();
    const [book, setBook] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // MODIFIED: Use isCheckoutModalOpen state to control the shared modal
    const [isCheckoutModalOpen, setCheckoutModalOpen] = useState(false);

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
                story_text: event.story_text || '',
                is_bold_story_text: event.is_bold_story_text || false,
                image_url: event.image_url || null,
            })) : [{
                page_number: 1,
                story_text: '',
                event_date: '',
                image_url: null,
                uploaded_image_url: null,
                overlay_text: '',
                is_bold_story_text: false
            }];
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
        setTimeline(prevTimeline => {
            const newTimeline = [...prevTimeline];
            const currentEventData = newTimeline[pageIndex] || {};
            const updatedEvent = { ...currentEventData };

            if (!updatedEvent.page_number) {
                updatedEvent.page_number = pageIndex + 1;
                updatedEvent.story_text = '';
                updatedEvent.event_date = '';
                updatedEvent.image_url = null;
                updatedEvent.uploaded_image_url = null;
                updatedEvent.overlay_text = '';
                updatedEvent.is_bold_story_text = false;
            }

            if (field === 'image_url' && value !== null) {
                updatedEvent['uploaded_image_url'] = null;
            } else if (field === 'uploaded_image_url' && value !== null) {
                updatedEvent['image_url'] = null;
            }
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
        if (timeline.length === 1) {
            alert("You cannot delete the last page of the book. To delete the book, go to My Projects.");
            return;
        }
        
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
            }
            catch (err) {
                setError("Failed to delete page. Please try again. Check console for details.");
                console.error("DEBUG: Error during delete API call:", err.response?.data?.message || err.message, err);
            }
        }
    };

    // MODIFIED: handleFinalizeAndPurchase now opens the shared CheckoutModal
    const handleFinalizeAndPurchase = () => {
        if (timeline.length !== REQUIRED_CONTENT_PAGES) {
            setError(`Your picture book must have exactly ${REQUIRED_CONTENT_PAGES} pages to be printed. You currently have ${timeline.length}.`);
            return;
        }
        setCheckoutModalOpen(true);
    };

    // MODIFIED: submitFinalCheckout function for the CheckoutModal
    const submitFinalCheckout = async (shippingAddress, selectedShippingLevel, quoteToken) => {
        try {
            // Note: The backend endpoint for picture books is /picture-books/:bookId/checkout
            const response = await apiClient.post(`/picture-books/${bookId}/checkout`, {
                shippingAddress,
                selectedShippingLevel,
                quoteToken,
            });
            window.location.href = response.data.url;
        } catch (err) {
            console.error('submitFinalCheckout (PictureBookPage): Could not proceed to checkout:', err);
            const detailedError = err.response?.data?.detailedError;
            console.error('DETAILED ERROR FROM BACKEND:', detailedError);
            setError(detailedError || err.response?.data?.message || 'Could not proceed to checkout. Please try again.');
            setCheckoutModalOpen(false);
        }
    };

    if (isLoading) return <LoadingSpinner text="Loading your project..." />;
    if (error) return <Alert type="error" message={error} onClose={() => setError(null)} />;

    const currentEvent = timeline[currentPage - 1] || {};
    const meetsPageRequirement = timeline.length === REQUIRED_CONTENT_PAGES;

    return (
        <>
            {/* MODIFIED: Render the shared CheckoutModal */}
            <CheckoutModal
                isOpen={isCheckoutModalOpen}
                onClose={() => setCheckoutModalOpen(false)}
                onSubmit={submitFinalCheckout}
                bookId={bookId}
                bookType="pictureBook" // Pass bookType as 'pictureBook'
            />

            <div className="container mx-auto p-4 text-white min-h-screen flex flex-col">
                <div className="flex-grow flex flex-col md:flex-row gap-8 bg-slate-900/50 p-6 rounded-lg shadow-xl border border-slate-700">

                    {/* Left Panel: Controls & Input Fields */}
                    <div className="md:w-1/3 flex flex-col space-y-6 p-4 bg-slate-800 rounded-lg shadow-md border border-slate-700">
                        <div className="flex justify-between items-center mb-4">
                            <h1 className="text-2xl font-bold text-white">{book?.title || 'New Picture Book'}</h1>
                            {isSaving && <div className="text-sm text-blue-400 animate-pulse">Saving...</div>}
                        </div>

                        <>
                            <p className="text-sm text-slate-400">Page {currentPage} of {timeline.length} (Required: {REQUIRED_CONTENT_PAGES})</p>

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

                                {/* Story Text input */}
                                <div>
                                    <label htmlFor="story_text" className="block text-sm font-medium text-slate-300 mt-4 mb-1">Story Text</label>
                                    <textarea
                                        id="story_text"
                                        value={currentEvent.story_text || ''}
                                        onChange={(e) => handleFieldChange(currentPage - 1, 'story_text', e.target.value)}
                                        className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md h-40 resize-y text-white focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Write the story for this page..."
                                    />
                                </div>
                                {/* Bold Story Text checkbox */}
                                <div className="flex items-center mt-2">
                                    <input
                                        id="is_bold_story_text"
                                        type="checkbox"
                                        checked={currentEvent.is_bold_story_text || false}
                                        onChange={(e) => handleFieldChange(currentPage - 1, 'is_bold_story_text', e.target.checked)}
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="is_bold_story_text" className="ml-2 block text-sm text-slate-300">
                                        Bold Story Text
                                    </label>
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
                                    <button onClick={addPage} disabled={timeline.length >= REQUIRED_CONTENT_PAGES} className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition shadow-md disabled:bg-blue-400 disabled:cursor-not-allowed">Add New Page</button>
                                    <button onClick={handleDeletePage} disabled={timeline.length <= 1} className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-400 transition shadow-md">Delete Current Page</button>
                                </div>
                            </div>
                        </>
                    </div>

                    {/* Right Panel: Image Editor */}
                    <div className="md:w-2/3">
                        <ImageEditor currentEvent={currentEvent} onImageUpdate={handleFieldChange} />
                    </div>
                </div>

                {/* Finalize & Purchase Button (outside the main content block) */}
                <div className="mt-8 text-center">
                    <button
                        onClick={handleFinalizeAndPurchase}
                        disabled={!meetsPageRequirement}
                        className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-transform transform hover:scale-105 shadow-lg text-lg"
                    >
                        Finalize & Purchase
                    </button>
                    {!meetsPageRequirement && (
                        <p className="text-sm text-red-400 mt-2">
                            Picture book must have exactly {REQUIRED_CONTENT_PAGES} pages. ({timeline.length}/{REQUIRED_CONTENT_PAGES})
                        </p>
                    )}
                </div>
            </div>
        </>
    );
}

export default PictureBookPage;