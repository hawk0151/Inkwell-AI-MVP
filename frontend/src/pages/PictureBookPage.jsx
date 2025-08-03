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

const VALID_ISO_COUNTRY_CODES = new Set([
    'AF', 'AX', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW', 'BR', 'IO', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH', 'CM', 'CA', 'KY', 'CF', 'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM', 'CD', 'CG', 'CK', 'CR', 'CI', 'HR', 'CU', 'CW', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FK', 'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'VA', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR', 'QA', 'MK', 'RO', 'RU', 'RW', 'RE', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES', 'LK', 'SD', 'SR', 'SJ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU', 'VE', 'VN', 'VG', 'VI', 'WF', 'EH', 'YE', 'ZM', 'ZW'
]);

function PictureBookPage() {
    const { bookId } = useParams();
    const [book, setBook] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showShippingForm, setShowShippingForm] = useState(false);
    const [shippingAddress, setShippingAddress] = useState({
        name: '',
        street1: '',
        street2: '',
        city: '',
        state_code: '',
        postcode: '',
        country_code: 'US',
        phone_number: '',
    });
    const [shippingFormErrors, setShippingFormErrors] = useState({});
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

    // REFINED AGAIN: Ensure the modified event object is ALWAYS a new reference
    const handleFieldChange = (pageIndex, field, value) => {
        setTimeline(prevTimeline => {
            const newTimeline = [...prevTimeline]; // Copy the array
            
            // Ensure the specific event object at pageIndex is also a new object
            // This is crucial for React's change detection in child components.
            const currentEventData = newTimeline[pageIndex] || {}; // Get existing or empty object
            const updatedEvent = { ...currentEventData }; // Create a fresh copy of the event data

            // Initialize new page properties if they don't exist (e.g., for newly added pages)
            if (!updatedEvent.page_number) {
                 updatedEvent.page_number = pageIndex + 1;
                 updatedEvent.story_text = '';
                 updatedEvent.event_date = '';
                 updatedEvent.image_url = null;
                 updatedEvent.uploaded_image_url = null;
                 updatedEvent.overlay_text = '';
                 updatedEvent.is_bold_story_text = false;
            }

            // Special handling for image URLs: nullify the other one if one is set
            if (field === 'image_url' && value !== null) {
                updatedEvent['uploaded_image_url'] = null;
            } else if (field === 'uploaded_image_url' && value !== null) {
                updatedEvent['image_url'] = null;
            }
            updatedEvent[field] = value; // Update the specific field

            newTimeline[pageIndex] = updatedEvent; // Assign the new object back to the array copy
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

    const validateShippingForm = () => {
        const errors = {};
        if (!shippingAddress.name.trim()) errors.name = 'Name is required.';
        if (!shippingAddress.street1.trim()) errors.street1 = 'Street address is required.';
        if (!shippingAddress.city.trim()) errors.city = 'City is required.';
        if (!shippingAddress.postcode.trim()) errors.postcode = 'Postal code is required.';
        if (!shippingAddress.country_code.trim()) {
            errors.country_code = 'Country code is required.';
        } else if (!VALID_ISO_COUNTRY_CODES.has(shippingAddress.country_code.toUpperCase())) {
            errors.country_code = 'Invalid country code (e.g., US, AU).';
        }
        
        setShippingFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleFinalizeAndCheckout = async () => {
        setError(null);

        if (!showShippingForm) {
            if (!meetsPageMinimum) {
                setError(`Your picture book needs at least ${minPageCount} pages to be printed.`);
                return;
            }
            setShowShippingForm(true);
            return;
        }

        if (!validateShippingForm()) {
            setError("Please correct the errors in the shipping address.");
            return;
        }

        setIsCheckingOut(true);
        try {
            console.log("Sending checkout request with shipping address:", shippingAddress);
            const response = await apiClient.post(`/picture-books/${bookId}/checkout`, { shippingAddress });
            window.location.href = response.data.url;
        } catch (err) {
            setError(err.response?.data?.message || "Could not proceed to checkout. Please try again.");
            setIsCheckingOut(false);
        }
    };

    if (isLoading) return <LoadingSpinner text="Loading your project..." />;
    if (error) return <Alert type="error" message={error} onClose={() => setError(null)} />;

    const currentEvent = timeline[currentPage - 1] || {};
    const meetsPageMinimum = timeline.length >= minPageCount;

    const ShippingAddressForm = () => (
        <div className="space-y-4 p-4 bg-slate-700 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-white mb-4">Shipping Information</h3>
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                <input
                    type="text"
                    id="name"
                    value={shippingAddress.name}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, name: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="John Doe"
                />
                {shippingFormErrors.name && <p className="text-red-400 text-xs mt-1">{shippingFormErrors.name}</p>}
            </div>
            <div>
                <label htmlFor="street1" className="block text-sm font-medium text-slate-300 mb-1">Street Address 1</label>
                <input
                    type="text"
                    id="street1"
                    value={shippingAddress.street1}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, street1: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="123 Main St"
                />
                {shippingFormErrors.street1 && <p className="text-red-400 text-xs mt-1">{shippingFormErrors.street1}</p>}
            </div>
            <div>
                <label htmlFor="street2" className="block text-sm font-medium text-slate-300 mb-1">Street Address 2 (Optional)</label>
                <input
                    type="text"
                    id="street2"
                    value={shippingAddress.street2}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, street2: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="Apt 4B"
                />
            </div>
            <div>
                <label htmlFor="city" className="block text-sm font-medium text-slate-300 mb-1">City</label>
                <input
                    type="text"
                    id="city"
                    value={shippingAddress.city}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="Springfield"
                />
                {shippingFormErrors.city && <p className="text-red-400 text-xs mt-1">{shippingFormErrors.city}</p>}
            </div>
            <div>
                <label htmlFor="state_code" className="block text-sm font-medium text-slate-300 mb-1">State/Province Code (Optional)</label>
                <input
                    type="text"
                    id="state_code"
                    value={shippingAddress.state_code}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, state_code: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="NY"
                />
            </div>
            <div>
                <label htmlFor="postcode" className="block text-sm font-medium text-slate-300 mb-1">Postal Code</label>
                <input
                    type="text"
                    id="postcode"
                    value={shippingAddress.postcode}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, postcode: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="12345"
                />
                {shippingFormErrors.postcode && <p className="text-red-400 text-xs mt-1">{shippingFormErrors.postcode}</p>}
            </div>
            <div>
                <label htmlFor="country_code" className="block text-sm font-medium text-slate-300 mb-1">Country Code (ISO 2-letter)</label>
                <input
                    type="text"
                    id="country_code"
                    value={shippingAddress.country_code}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, country_code: e.target.value.toUpperCase() })}
                    className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="US"
                    maxLength="2"
                />
                {shippingFormErrors.country_code && <p className="text-red-400 text-xs mt-1">{shippingFormErrors.country_code}</p>}
            </div>
            <div>
                <label htmlFor="phone_number" className="block text-sm font-medium text-slate-300 mb-1">Phone Number (Optional)</label>
                <input
                    type="tel"
                    id="phone_number"
                    value={shippingAddress.phone_number}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, phone_number: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="555-123-4567"
                />
            </div>
        </div>
    );

    return (
        <div className="container mx-auto p-4 text-white min-h-screen flex flex-col">
            <div className="flex-grow flex flex-col md:flex-row gap-8 bg-slate-900/50 p-6 rounded-lg shadow-xl border border-slate-700">

                {/* Left Panel: Controls & Input Fields */}
                <div className="md:w-1/3 flex flex-col space-y-6 p-4 bg-slate-800 rounded-lg shadow-md border border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                        <h1 className="text-2xl font-bold text-white">{book?.title || 'New Picture Book'}</h1>
                        {isSaving && <div className="text-sm text-blue-400 animate-pulse">Saving...</div>}
                    </div>

                    {!showShippingForm ? (
                        <>
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

                                {/* NEW: Story Text input */}
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
                                {/* NEW: Bold Story Text checkbox */}
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

                            {/* Page Navigation and Actions (only shown if not on shipping form) */}
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
                            </div>
                        </>
                    ) : (
                        <>
                            <ShippingAddressForm />
                            <button
                                onClick={() => setShowShippingForm(false)}
                                className="w-full mt-4 px-6 py-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition shadow-lg"
                            >
                                Edit Book Details
                            </button>
                        </>
                    )}

                    {/* Shipping Form or Checkout Button */}
                    <div className="text-center pt-4 border-t border-slate-700">
                        <button
                            onClick={handleFinalizeAndCheckout}
                            disabled={isCheckingOut || (!showShippingForm && !meetsPageMinimum)}
                            className={`w-full mt-4 px-6 py-3 font-bold rounded-lg transition shadow-lg
                                ${isCheckingOut ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}
                                ${(!showShippingForm && !meetsPageMinimum) ? 'disabled:bg-gray-500 disabled:cursor-not-allowed' : ''}
                            `}
                        >
                            {isCheckingOut ? 'Finalizing...' : (showShippingForm ? 'Confirm & Pay' : 'Finalize & Checkout')}
                        </button>
                        {!showShippingForm && !meetsPageMinimum && (
                            <p className="text-sm text-red-400 mt-2">
                                Minimum {minPageCount} pages to print. ({timeline.length}/{minPageCount})
                            </p>
                        )}
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