import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import ImageEditor from '../components/ImageEditor.jsx';
import { LoadingSpinner, Alert } from '../components/common.jsx';
import { AnimatePresence, motion } from 'framer-motion'; // Ensure motion and AnimatePresence are imported

// --- NEW SUB-COMPONENT: ShippingAddressForm (Copied from NovelPage.jsx) ---
const ShippingAddressForm = ({ isOpen, onClose, onSubmit, isLoading }) => {
    const [address, setAddress] = useState({
        name: '',
        street1: '',
        street2: '', // Optional
        city: '',
        state_code: '',
        postcode: '',
        country_code: 'AU', // Default country for Australian context
        phone_number: '', // Add phone number field for Lulu
    });

    const allowedCountries = [
        { code: 'AU', name: 'Australia' },
        { code: 'US', name: 'United States' },
        { code: 'CA', name: 'Canada' },
        { code: 'GB', name: 'United Kingdom' },
        { code: 'NZ', name: 'New Zealand' },
    ];

    const handleChange = (e) => {
        setAddress(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(address);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: -20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 w-full max-w-md p-8"
                        onClick={(e) => e.stopPropagation()} // Prevent closing modal when clicking inside
                    >
                        <h2 className="text-2xl font-bold text-white mb-4">Enter Shipping Address</h2>
                        <p className="text-slate-400 mb-6">We need your address to calculate the final price including shipping.</p>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <input name="name" value={address.name} onChange={handleChange} placeholder="Full Name" required className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white" />
                            <input name="street1" value={address.street1} onChange={handleChange} placeholder="Street Address 1" required className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white" />
                            <input name="street2" value={address.street2} onChange={handleChange} placeholder="Street Address 2 (Optional)" className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white" />
                            <div className="flex space-x-4">
                                <input name="city" value={address.city} onChange={handleChange} placeholder="City" required className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white" />
                                <input name="postcode" value={address.postcode} onChange={handleChange} placeholder="Postal Code" required className="w-1/2 p-3 bg-slate-700 border border-slate-600 rounded-lg text-white" />
                            </div>
                            <div className="flex space-x-4">
                                <input name="state_code" value={address.state_code} onChange={handleChange} placeholder="State/Province Code (e.g., SA)" className="w-1/2 p-3 bg-slate-700 border border-slate-600 rounded-lg text-white" />
                                <select name="country_code" value={address.country_code} onChange={handleChange} required className="w-1/2 p-3 bg-slate-700 border border-slate-600 rounded-lg text-white">
                                    {allowedCountries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                </select>
                            </div>
                            <input name="phone_number" value={address.phone_number} onChange={handleChange} placeholder="Phone Number (e.g., 0412345678)" required className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white" /> {/* Added phone number field */}
                            <div className="pt-4 flex items-center justify-end space-x-4">
                                <button type="button" onClick={onClose} className="text-slate-400 hover:text-white transition">Cancel</button>
                                <button type="submit" disabled={isLoading} className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 disabled:bg-green-300 transition">
                                    {isLoading ? 'Processing...' : 'Continue to Payment'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
// --- END NEW SUB-COMPONENT ---


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
    const navigate = useNavigate();
    const [book, setBook] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const minPageCount = 24; // This minPageCount should ideally come from productConfig in the future

    // --- NEW: State for shipping modal ---
    const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);

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

    // --- MODIFIED: handleFinalizeAndCheckout now opens modal ---
    const handleFinalizeAndCheckout = () => {
        setIsShippingModalOpen(true);
    };

    // --- NEW: handleShippingSubmit for actual checkout API call ---
    const handleShippingSubmit = async (shippingAddress) => {
        setIsCheckingOut(true);
        setError(null);
        try {
            // Include shippingAddress in the POST request body
            const response = await apiClient.post(`/picture-books/${bookId}/checkout`, { shippingAddress });
            window.location.href = response.data.url; // Redirect to Stripe
        } catch (err) {
            console.error('handleShippingSubmit (PictureBookPage): Could not proceed to checkout:', err);
            const detailedError = err.response?.data?.message || 'Could not proceed to checkout.';
            setError(detailedError);
            setIsCheckingOut(false);
            setIsShippingModalOpen(false); // Close modal on error
        }
    };


    if (isLoading) return <LoadingSpinner text="Loading your project..." />;
    if (error) return <div className="text-red-500 font-bold p-4">Error: {error}</div>;

    const currentEvent = timeline[currentPage - 1] || {};
    // Ensure book.minPageCount is used, or a fallback if book is null/missing
    const actualMinPageCount = book?.minPageCount || minPageCount; 
    const meetsPageMinimum = timeline.length >= actualMinPageCount; 

    return (
        <div className="container mx-auto p-4 text-white min-h-screen flex flex-col">
            {/* Render the shipping modal here */}
            <ShippingAddressForm
                isOpen={isShippingModalOpen}
                onClose={() => setIsShippingModalOpen(false)}
                onSubmit={handleShippingSubmit}
                isLoading={isCheckingOut}
            />

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
                            <button onClick={handleDeletePage} disabled={timeline.length <= 1} className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-400 transition shadow-md">Delete Current Page</button>
                        </div>
                        
                        <div className="text-center pt-4">
                            <button onClick={handleFinalizeAndCheckout} disabled={!meetsPageMinimum || isCheckingOut} className="w-full px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition shadow-lg">
                                {isCheckingOut ? 'Finalizing...' : 'Finalize & Checkout'}
                            </button>
                            {!meetsPageMinimum && (
                                <p className="text-sm text-red-400 mt-2">
                                    Minimum {actualMinPageCount} pages to print. ({timeline.length}/{actualMinPageCount})
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