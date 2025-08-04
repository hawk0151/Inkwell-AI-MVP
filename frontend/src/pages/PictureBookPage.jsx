import React, { useState, useEffect, useRef, useCallback } from 'react';
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

// Simplified list of valid countries for the dropdown, expanded from your previous list.
// In a real app, you might fetch this from a country API or a more comprehensive local list.
const COUNTRIES = [
    { code: 'US', name: 'United States' },
    { code: 'AU', name: 'Australia' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'CA', name: 'Canada' },
    { code: 'MX', name: 'Mexico' },
    { code: 'NZ', name: 'New Zealand' },
    // Add other common countries you support for shipping.
    // Full VALID_ISO_COUNTRY_CODES is large; this is for the dropdown display.
];

const REQUIRED_CONTENT_PAGES = 20;

function PictureBookPage() {
    const { bookId } = useParams();
    const [book, setBook] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // State for managing checkout flow steps:
    // 'book_details': User is editing book, not yet ready for shipping/checkout.
    // 'shipping_input': User needs to enter country/postcode to get shipping options.
    // 'shipping_options': User can view/select shipping options and see final price.
    // 'full_address_form': User needs to fill out full shipping details before Stripe redirect.
    const [checkoutStep, setCheckoutStep] = useState('book_details'); 

    // Shipping states
    const [countryCode, setCountryCode] = useState('AU'); // Default to Australia
    const [postcode, setPostcode] = useState('');
    const [shippingOptionErrors, setShippingOptionErrors] = useState({});
    const [availableShippingOptions, setAvailableShippingOptions] = useState([]);
    const [selectedShippingLevel, setSelectedShippingLevel] = useState(null); // e.g., 'MAIL', 'STANDARD'
    const [calculatedPriceDetails, setCalculatedPriceDetails] = useState(null); // Stores costs from backend
    const [shippingOptionsLoading, setShippingOptionsLoading] = useState(false);

    // Full shipping address to send to Stripe (will be collected in a later step/popup if not pre-filled)
    const [fullShippingAddress, setFullShippingAddress] = useState({
        name: '',
        street1: '',
        street2: '',
        city: '',
        state_code: '',
        postcode: '', // This will be pre-filled from the initial postcode state
        country_code: '', // This will be pre-filled from the initial countryCode state
        phone_number: '',
        email: ''
    });
    const [fullAddressFormErrors, setFullAddressFormErrors] = useState({});

    // --- Helper for Full Address Form Validation (similar to your old one, but for a new context) ---
    const validateFullAddressForm = () => {
        const errors = {};
        if (!fullShippingAddress.name.trim()) errors.name = 'Full Name is required.';
        if (!fullShippingAddress.street1.trim()) errors.street1 = 'Street Address is required.';
        if (!fullShippingAddress.city.trim()) errors.city = 'City is required.';
        if (!fullShippingAddress.postcode.trim()) errors.postcode = 'Postal code is required.';
        if (!fullShippingAddress.country_code.trim() || !COUNTRIES.some(c => c.code === fullShippingAddress.country_code.toUpperCase())) {
            errors.country_code = 'Please select a valid country.';
        }
        if (!fullShippingAddress.email.trim() || !fullShippingAddress.email.includes('@')) errors.email = 'Valid email is required.';
        // Phone number is optional based on backend, but can be validated if required by UX
        // if (!fullShippingAddress.phone_number.trim()) errors.phone_number = 'Phone number is required.'; 

        setFullAddressFormErrors(errors);
        return Object.keys(errors).length === 0;
    };


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
            // Pre-fill fullShippingAddress with available data if user info exists
            // This would typically come from a user profile API endpoint, if you had one.
            // For now, it defaults to empty strings except for country/postcode from state.
            setFullShippingAddress(prev => ({
                ...prev,
                country_code: countryCode,
                postcode: postcode,
                // Add fields like name, email if available from user context
            }));

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

    // --- NEW: Function to fetch shipping options ---
    const fetchShippingOptions = useCallback(async () => {
        if (!bookId || !countryCode.trim()) {
            setShippingOptionErrors({ country_code: 'Country is required.' });
            setAvailableShippingOptions([]);
            setCalculatedPriceDetails(null);
            return;
        }
        if (!COUNTRIES.some(c => c.code === countryCode.toUpperCase())) {
            setShippingOptionErrors({ country_code: 'Invalid country code.' });
            setAvailableShippingOptions([]);
            setCalculatedPriceDetails(null);
            return;
        }

        setShippingOptionsLoading(true);
        setShippingOptionErrors({});
        setError(null);
        setAvailableShippingOptions([]);
        setSelectedShippingLevel(null);
        setCalculatedPriceDetails(null);

        try {
            const response = await apiClient.get(`/picture-books/${bookId}/shipping-options`, {
                params: { country_code: countryCode, postcode: postcode || '' }
            });
            setAvailableShippingOptions(response.data.shippingOptions);
            // Optionally auto-select the cheapest option
            if (response.data.shippingOptions.length > 0) {
                const cheapest = response.data.shippingOptions.reduce((min, current) => current.costUsd < min.costUsd ? current : min);
                setSelectedShippingLevel(cheapest.level);
            }
            // For now, we only get the options. The full calculation with print cost will be done at final step.
            // A more advanced approach would fetch full price breakdown including print costs here as well.

        } catch (err) {
            console.error("Error fetching shipping options:", err.response?.data || err);
            setShippingOptionErrors({ general: err.response?.data?.message || "Failed to fetch shipping options. Please try again." });
            setError(err.response?.data?.message || "Failed to fetch shipping options. Please try again.");
            setAvailableShippingOptions([]);
        } finally {
            setShippingOptionsLoading(false);
        }
    }, [bookId, countryCode, postcode]);

    // --- NEW: Effect to trigger shipping options fetch when country/postcode changes ---
    // Debounce this call to avoid rapid API calls as user types postcode
    useDebouncedEffect(() => {
        if (checkoutStep === 'shipping_options' || checkoutStep === 'full_address_form') {
            fetchShippingOptions();
        }
    }, 500, [countryCode, postcode, checkoutStep, fetchShippingOptions]);

    // --- NEW: Function to get final price from backend after shipping level selection ---
    const calculateFinalPrice = useCallback(async () => {
        if (!bookId || !selectedShippingLevel || !countryCode) {
            setShippingOptionErrors({ general: "Please select a shipping option and ensure country is chosen." });
            return;
        }
        setShippingOptionsLoading(true); // Reuse loading state
        setError(null);
        try {
            // This call mimics what createBookCheckoutSession will do, just to get prices
            const response = await apiClient.post(`/picture-books/${bookId}/calculate-price`, { // NEW hypothetical endpoint (backend will need this)
                 country_code: countryCode, 
                 postcode: postcode || '',
                 selectedShippingLevel: selectedShippingLevel
            });
            setCalculatedPriceDetails(response.data); // This will include print, shipping, profit, total
        } catch (err) {
            console.error("Error calculating final price:", err.response?.data || err);
            setShippingOptionErrors({ general: err.response?.data?.message || "Failed to calculate final price." });
            setError(err.response?.data?.message || "Failed to calculate final price.");
            setCalculatedPriceDetails(null);
        } finally {
            setShippingOptionsLoading(false);
        }
    }, [bookId, countryCode, postcode, selectedShippingLevel]);

    useEffect(() => {
        // Trigger recalculation when selectedShippingLevel changes
        if (checkoutStep === 'shipping_options' && selectedShippingLevel) {
            calculateFinalPrice();
        }
    }, [selectedShippingLevel, checkoutStep, calculateFinalPrice]);


    // --- MODIFIED: Consolidated Checkout Button Handler ---
    const handleProceedToCheckout = async () => {
        setError(null);
        setFullAddressFormErrors({}); // Clear previous full address errors

        if (checkoutStep === 'book_details') {
            if (timeline.length !== REQUIRED_CONTENT_PAGES) {
                setError(`Your picture book must have exactly ${REQUIRED_CONTENT_PAGES} pages to be printed. You currently have ${timeline.length}.`);
                return;
            }
            setCheckoutStep('shipping_input'); // Move to collecting country/postcode
            // Also ensure countryCode and postcode are initialized or fetched from user profile if available
            setFullShippingAddress(prev => ({
                ...prev,
                country_code: countryCode,
                postcode: postcode
            }));
            return;
        }

        if (checkoutStep === 'shipping_input') {
            if (!countryCode.trim()) {
                setShippingOptionErrors({ country_code: 'Country is required.' });
                setError('Please select a country.');
                return;
            }
            if (!COUNTRIES.some(c => c.code === countryCode.toUpperCase())) {
                setShippingOptionErrors({ country_code: 'Invalid country selection.' });
                setError('Please select a valid country.');
                return;
            }
            // Trigger fetchShippingOptions via useEffect based on countryCode/postcode change
            setCheckoutStep('shipping_options'); // Move to displaying options
            return;
        }

        if (checkoutStep === 'shipping_options') {
            if (!selectedShippingLevel) {
                setShippingOptionErrors({ general: 'Please select a shipping option.' });
                setError('Please select a shipping option to proceed.');
                return;
            }
            // Set the full shipping address with the country and postcode chosen so far
            setFullShippingAddress(prev => ({
                ...prev,
                country_code: countryCode,
                postcode: postcode
            }));
            setCheckoutStep('full_address_form'); // Move to collecting full address
            return;
        }

        if (checkoutStep === 'full_address_form') {
            if (!validateFullAddressForm()) {
                setError("Please correct the errors in the full shipping address form.");
                return;
            }

            setIsCheckingOut(true);
            try {
                // The backend `createBookCheckoutSession` will receive the FULL shippingAddress and selectedShippingLevel
                console.log("Sending final checkout request with full shipping address and selected shipping level:", fullShippingAddress, selectedShippingLevel);
                const response = await apiClient.post(`/picture-books/${bookId}/checkout`, { 
                    shippingAddress: fullShippingAddress,
                    selectedShippingLevel: selectedShippingLevel
                });
                window.location.href = response.data.url;
            } catch (err) {
                setError(err.response?.data?.message || "Could not proceed to checkout. Please try again.");
                setIsCheckingOut(false);
            }
        }
    };


    if (isLoading) return <LoadingSpinner text="Loading your project..." />;
    if (error) return <Alert type="error" message={error} onClose={() => setError(null)} />;

    const currentEvent = timeline[currentPage - 1] || {};
    const meetsPageRequirement = timeline.length === REQUIRED_CONTENT_PAGES;

    const ShippingInputForm = () => (
        <div className="space-y-4 p-4 bg-slate-700 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-white mb-4">Shipping Destination</h3>
            <div>
                <label htmlFor="country_code" className="block text-sm font-medium text-slate-300 mb-1">Country</label>
                <select
                    id="country_code"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">Select a country</option>
                    {COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                </select>
                {shippingOptionErrors.country_code && <p className="text-red-400 text-xs mt-1">{shippingOptionErrors.country_code}</p>}
            </div>
            <div>
                <label htmlFor="postcode" className="block text-sm font-medium text-slate-300 mb-1">Postal Code (Optional)</label>
                <input
                    type="text"
                    id="postcode"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., 12345 or 3000"
                />
            </div>
            {shippingOptionsLoading && <LoadingSpinner text="Getting shipping options..." />}
            {shippingOptionErrors.general && <p className="text-red-400 text-xs mt-1">{shippingOptionErrors.general}</p>}
        </div>
    );

    const ShippingOptionSelection = () => (
        <div className="space-y-4 p-4 bg-slate-700 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-white mb-4">Select Shipping Option</h3>
            {availableShippingOptions.length === 0 && !shippingOptionsLoading ? (
                <p className="text-slate-300">No shipping options available for the selected destination. Please try a different country or postal code.</p>
            ) : (
                <div className="space-y-2">
                    {availableShippingOptions.map(option => (
                        <label key={option.level} className="flex items-center text-slate-300 cursor-pointer">
                            <input
                                type="radio"
                                name="shipping_level"
                                value={option.level}
                                checked={selectedShippingLevel === option.level}
                                onChange={() => setSelectedShippingLevel(option.level)}
                                className="form-radio h-4 w-4 text-indigo-600"
                            />
                            <span className="ml-2">
                                {option.name} - ${option.costUsd.toFixed(2)} USD (Est. {option.estimatedDeliveryDate || 'N/A'})
                            </span>
                        </label>
                    ))}
                </div>
            )}
            {shippingOptionsLoading && <LoadingSpinner text="Updating price..." />}
            {shippingOptionErrors.general && <p className="text-red-400 text-xs mt-1">{shippingOptionErrors.general}</p>}
        </div>
    );

    const FullShippingAddressForm = () => (
        <div className="space-y-4 p-4 bg-slate-700 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-white mb-4">Complete Shipping Details</h3>
            <p className="text-sm text-slate-300 mb-4">These details are sent to Stripe for secure processing and pre-filling your checkout form.</p>
            <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                <input
                    type="text"
                    id="fullName"
                    value={fullShippingAddress.name}
                    onChange={(e) => setFullShippingAddress({ ...fullShippingAddress, name: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="John Doe"
                />
                {fullAddressFormErrors.name && <p className="text-red-400 text-xs mt-1">{fullAddressFormErrors.name}</p>}
            </div>
            <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                <input
                    type="email"
                    id="email"
                    value={fullShippingAddress.email}
                    onChange={(e) => setFullShippingAddress({ ...fullShippingAddress, email: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="john.doe@example.com"
                />
                {fullAddressFormErrors.email && <p className="text-red-400 text-xs mt-1">{fullAddressFormErrors.email}</p>}
            </div>
            <div>
                <label htmlFor="street1" className="block text-sm font-medium text-slate-300 mb-1">Street Address 1</label>
                <input
                    type="text"
                    id="street1"
                    value={fullShippingAddress.street1}
                    onChange={(e) => setFullShippingAddress({ ...fullShippingAddress, street1: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="123 Main St"
                />
                {fullAddressFormErrors.street1 && <p className="text-red-400 text-xs mt-1">{fullAddressFormErrors.street1}</p>}
            </div>
            <div>
                <label htmlFor="street2" className="block text-sm font-medium text-slate-300 mb-1">Street Address 2 (Optional)</label>
                <input
                    type="text"
                    id="street2"
                    value={fullShippingAddress.street2}
                    onChange={(e) => setFullShippingAddress({ ...fullShippingAddress, street2: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="Apt 4B"
                />
            </div>
            <div>
                <label htmlFor="city" className="block text-sm font-medium text-slate-300 mb-1">City</label>
                <input
                    type="text"
                    id="city"
                    value={fullShippingAddress.city}
                    onChange={(e) => setFullShippingAddress({ ...fullShippingAddress, city: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="Springfield"
                />
                {fullAddressFormErrors.city && <p className="text-red-400 text-xs mt-1">{fullAddressFormErrors.city}</p>}
            </div>
            <div>
                <label htmlFor="state_code" className="block text-sm font-medium text-slate-300 mb-1">State/Province Code (Optional)</label>
                <input
                    type="text"
                    id="state_code"
                    value={fullShippingAddress.state_code}
                    onChange={(e) => setFullShippingAddress({ ...fullShippingAddress, state_code: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="NY"
                />
            </div>
            <div>
                <label htmlFor="postcodeFull" className="block text-sm font-medium text-slate-300 mb-1">Postal Code</label>
                <input
                    type="text"
                    id="postcodeFull"
                    value={fullShippingAddress.postcode}
                    onChange={(e) => setFullShippingAddress({ ...fullShippingAddress, postcode: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="12345"
                />
                {fullAddressFormErrors.postcode && <p className="text-red-400 text-xs mt-1">{fullAddressFormErrors.postcode}</p>}
            </div>
            <div>
                <label htmlFor="country_codeFull" className="block text-sm font-medium text-slate-300 mb-1">Country (ISO 2-letter)</label>
                <select
                    id="country_codeFull"
                    value={fullShippingAddress.country_code}
                    onChange={(e) => setFullShippingAddress({ ...fullShippingAddress, country_code: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">Select a country</option>
                    {COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                </select>
                {fullAddressFormErrors.country_code && <p className="text-red-400 text-xs mt-1">{fullAddressFormErrors.country_code}</p>}
            </div>
            <div>
                <label htmlFor="phone_number" className="block text-sm font-medium text-slate-300 mb-1">Phone Number (Optional)</label>
                <input
                    type="tel"
                    id="phone_number"
                    value={fullShippingAddress.phone_number}
                    onChange={(e) => setFullShippingAddress({ ...fullShippingAddress, phone_number: e.target.value })}
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

                    {checkoutStep === 'book_details' && (
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

                            {/* Page Navigation and Actions (only shown if not on shipping form) */}
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
                    )}

                    {checkoutStep === 'shipping_input' && <ShippingInputForm />}
                    {checkoutStep === 'shipping_options' && <ShippingOptionSelection />}
                    {checkoutStep === 'full_address_form' && <FullShippingAddressForm />}


                    {/* Universal Checkout/Navigation Button */}
                    <div className="text-center pt-4 border-t border-slate-700">
                        <button
                            onClick={handleProceedToCheckout}
                            disabled={isCheckingOut || (checkoutStep === 'book_details' && !meetsPageRequirement) || (checkoutStep === 'shipping_options' && !selectedShippingLevel && !shippingOptionsLoading) || shippingOptionsLoading}
                            className={`w-full mt-4 px-6 py-3 font-bold rounded-lg transition shadow-lg
                                ${isCheckingOut || shippingOptionsLoading ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}
                                ${(!meetsPageRequirement && checkoutStep === 'book_details') ? 'disabled:bg-gray-500 disabled:cursor-not-allowed' : ''}
                            `}
                        >
                            {isCheckingOut ? 'Finalizing...' : (
                                checkoutStep === 'book_details' ? 'Finalize & Checkout' :
                                checkoutStep === 'shipping_input' ? 'Get Shipping Options' :
                                checkoutStep === 'shipping_options' ? 'Proceed to Checkout' :
                                'Confirm & Pay' // For full_address_form
                            )}
                        </button>
                        {checkoutStep === 'book_details' && !meetsPageRequirement && (
                            <p className="text-sm text-red-400 mt-2">
                                Book must have exactly {REQUIRED_CONTENT_PAGES} pages. ({timeline.length}/{REQUIRED_CONTENT_PAGES})
                            </p>
                        )}
                        {/* Display Calculated Price if available and on relevant steps */}
                        {(checkoutStep === 'shipping_options' || checkoutStep === 'full_address_form') && calculatedPriceDetails && !shippingOptionsLoading && (
                            <p className="text-lg font-bold text-white mt-4">
                                Total Price: ${calculatedPriceDetails.finalPriceDollars.toFixed(2)} USD
                                <br/>
                                <span className="text-sm text-slate-400">(Print: ${calculatedPriceDetails.luluPrintCostUSD.toFixed(2)}, Shipping: ${calculatedPriceDetails.luluShippingCostUSD.toFixed(2)}, Fulfillment: ${calculatedPriceDetails.luluFulfillmentCostUSD.toFixed(2)}, Profit: ${calculatedPriceDetails.profitUsd.toFixed(2)})</span>
                            </p>
                        )}
                         {(checkoutStep === 'shipping_options' || checkoutStep === 'full_address_form') && !calculatedPriceDetails && !shippingOptionsLoading && !shippingOptionErrors.general && (
                            <p className="text-sm text-slate-400 mt-2">Select shipping option to see final price.</p>
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