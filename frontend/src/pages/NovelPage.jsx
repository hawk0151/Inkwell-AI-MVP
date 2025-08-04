// frontend/src/pages/NovelPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react'; // ADDED useRef, useCallback
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import { LoadingSpinner, Alert, MagicWandIcon } from '../components/common.jsx';

// Re-introducing useDebouncedEffect from PictureBookPage.jsx for consistency
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
const COUNTRIES = [
    { code: 'US', name: 'United States' },
    { code: 'AU', name: 'Australia' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'CA', name: 'Canada' },
    { code: 'MX', name: 'Mexico' },
    { code: 'NZ', name: 'New Zealand' },
    // Add other common countries you support for shipping.
];

// --- Sub-component: Chapter (Accordion for displaying story chapters) ---
const Chapter = ({ chapter, isOpen, onToggle }) => {
    // Using a simple SVG icon for consistency
    const ChevronDownIcon = (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
    );

    return (
        <div className="border-b border-slate-700 last:border-b-0">
            <button
                onClick={onToggle}
                className="w-full flex justify-between items-center text-left py-5 px-4 hover:bg-slate-700/50 rounded-lg transition-colors duration-200"
            >
                {/* Enhanced chapter title styling */}
                <h2 className="text-3xl md:text-4xl font-serif text-amber-400 m-0 p-0 font-bold">
                    Chapter {chapter.chapter_number}
                </h2>
                <ChevronDownIcon
                    className={`w-7 h-7 text-slate-300 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{
                            height: 'auto',
                            opacity: 1,
                            transition: {
                                height: { duration: 0.4, ease: 'easeInOut' },
                                opacity: { duration: 0.25, delay: 0.15 },
                            },
                        }}
                        exit={{
                            height: 0,
                            opacity: 0,
                            transition: {
                                height: { duration: 0.4, ease: 'easeInOut' },
                                opacity: { duration: 0.25 },
                            },
                        }}
                        className="overflow-hidden"
                    >
                        {/* Enhanced prose styling for chapter content */}
                        <div className="prose prose-lg lg:prose-xl max-w-none text-slate-200 prose-p:text-slate-200
                                             prose-p:mb-5 pt-4 pb-8 px-4 font-light leading-relaxed">
                            {chapter.content.split('\n').map((paragraph, index) => (
                                <p key={index} className="mb-4">
                                    {paragraph}
                                </p>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- Sub-component: PromptForm (User input form for new book details) ---
const PromptForm = ({ isLoading, onSubmit, productName }) => {
    const [details, setDetails] = useState({
        title: '',
        recipientName: '',
        characterName: '',
        interests: '',
        genre: 'Adventure',
    });

    const genres = ['Adventure', 'Fantasy', 'Sci-Fi', 'Mystery', 'Fairy Tale', 'Comedy'];

    const handleChange = (e) => setDetails((prev) => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isLoading) return;
        onSubmit(details);
    };

    const inputClasses = "w-full p-3 text-base bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition text-white placeholder-slate-400";
    const labelClasses = "block text-sm font-medium text-slate-300 mb-1";

    return (
        <div className="fade-in max-w-2xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
                <h1 className="text-5xl md:text-6xl font-extrabold font-serif text-white leading-tight">
                    Create Your <span className="text-amber-400">{productName}</span>
                </h1>
                <p className="text-xl text-slate-400 mt-4 font-light">Fill in the details below to begin the magic.</p>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-slate-700">
                <form onSubmit={handleSubmit} className="w-full space-y-7"> {/* Increased space-y */}
                    {/* Book Title Input */}
                    <div>
                        <label htmlFor="title" className={labelClasses}>Book Title</label>
                        <input
                            type="text"
                            id="title"
                            name="title"
                            value={details.title}
                            onChange={handleChange}
                            placeholder="e.g., The Adventures of Captain Alistair"
                            className={inputClasses}
                            required
                        />
                    </div>

                    {/* Recipient Name Input */}
                    <div>
                        <label htmlFor="recipientName" className={labelClasses}>Who is this book for?</label>
                        <input
                            type="text"
                            id="recipientName"
                            name="recipientName"
                            value={details.recipientName}
                            onChange={handleChange}
                            placeholder="e.g., My Dad"
                            className={inputClasses}
                            required
                        />
                    </div>

                    {/* Main Character Name Input */}
                    <div>
                        <label htmlFor="characterName" className={labelClasses}>Main character's name?</label>
                        <input
                            type="text"
                            id="characterName"
                            name="characterName"
                            value={details.characterName}
                            onChange={handleChange}
                            placeholder="e.g., Captain Alistair"
                            className={inputClasses}
                            required
                        />
                    </div>

                    {/* Interests Textarea */}
                    <div>
                        <label htmlFor="interests" className={labelClasses}>What do they love? (e.g., sailing, classic cars, the color yellow)</label>
                        <textarea
                            id="interests"
                            name="interests"
                            value={details.interests}
                            onChange={handleChange}
                            placeholder="Separate interests with commas"
                            className={`${inputClasses} h-28`} // Increased height slightly
                            required
                        />
                    </div>

                    {/* Genre Select */}
                    <div>
                        <label htmlFor="genre" className={labelClasses}>Choose a genre</label>
                        <select
                            id="genre"
                            name="genre"
                            value={details.genre}
                            onChange={handleChange}
                            className={inputClasses}
                            required
                        >
                            {genres.map((g) => (
                                <option key={g} value={g}>
                                    {g}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center
                                         bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg
                                         hover:bg-indigo-700 disabled:bg-slate-500 disabled:cursor-not-allowed
                                         transition-transform transform hover:scale-105 shadow-lg
                                         text-lg mt-8" // Increased font size and margin-top
                    >
                        <MagicWandIcon className="h-6 w-6 mr-3" /> {/* Adjusted icon size */}
                        {isLoading ? 'Crafting your first chapter...' : 'Create My Book'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// --- NEW/ADAPTED SUB-COMPONENT: Multi-step Shipping & Checkout Modal ---
// Combines functionality of ShippingAddressForm and adds shipping option selection
const CheckoutModal = ({ isOpen, onClose, bookId, bookType, onSubmit }) => {
    const [checkoutStep, setCheckoutStep] = useState('shipping_input'); // 'shipping_input', 'shipping_options', 'full_address_form'
    const [basicShippingAddress, setBasicShippingAddress] = useState({ // Only country & postcode initially
        country_code: 'AU', // Default country
        postcode: '',
        street1: '' // Added as it might be useful for initial Lulu validation
    });
    const [fullShippingAddress, setFullShippingAddress] = useState({
        name: '',
        street1: '',
        street2: '',
        city: '',
        state_code: '',
        postcode: '',
        country_code: '',
        phone_number: '',
        email: '',
    });
    const [formErrors, setFormErrors] = useState({});
    const [shippingOptions, setShippingOptions] = useState([]);
    const [selectedShippingLevel, setSelectedShippingLevel] = useState(null);
    const [quoteDetails, setQuoteDetails] = useState(null); // Stores quote_token, expires_at, print_cost_usd, base_product_price_usd
    const [isLoadingOptions, setIsLoadingOptions] = useState(false);
    const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
    const [modalError, setModalError] = useState(null);

    const inputClasses = "w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-green-500";
    const buttonClasses = "bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 disabled:bg-green-300 transition";

    const handleBasicAddressChange = (e) => {
        setBasicShippingAddress(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setFormErrors({}); // Clear errors on change
    };

    const handleFullAddressChange = (e) => {
        setFullShippingAddress(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setFormErrors({}); // Clear errors on change
    };

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
        // Phone number is optional for Lulu print job, but you can make it required here if needed for UX
        // if (!fullShippingAddress.phone_number.trim()) errors.phone_number = 'Phone number is required.'; 

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const fetchShippingQuotes = useCallback(async () => {
        if (!bookId || !basicShippingAddress.country_code) {
            setFormErrors({ country_code: 'Country is required.' });
            return;
        }
        if (!COUNTRIES.some(c => c.code === basicShippingAddress.country_code.toUpperCase())) {
            setFormErrors({ country_code: 'Invalid country code.' });
            return;
        }

        setIsLoadingOptions(true);
        setModalError(null);
        setShippingOptions([]);
        setSelectedShippingLevel(null);
        setQuoteDetails(null);

        try {
            const response = await apiClient.post('/shipping/quotes', {
                bookId,
                bookType,
                shippingAddress: basicShippingAddress,
            });
            setShippingOptions(response.data.shipping_options);
            setQuoteDetails({
                quote_token: response.data.quote_token,
                expires_at: response.data.expires_at,
                print_cost_usd: response.data.print_cost_usd,
                base_product_price_usd: response.data.base_product_price_usd,
                currency: response.data.currency,
            });
            // Auto-select the cheapest option
            if (response.data.shipping_options.length > 0) {
                const cheapest = response.data.shipping_options.reduce((min, current) => current.costUsd < min.costUsd ? current : min);
                setSelectedShippingLevel(cheapest.level);
            }
            setCheckoutStep('shipping_options');
        } catch (err) {
            console.error("Error fetching shipping quotes:", err.response?.data || err);
            setModalError(err.response?.data?.message || "Failed to fetch shipping options. Please try again.");
            setShippingOptions([]);
        } finally {
            setIsLoadingOptions(false);
        }
    }, [bookId, bookType, basicShippingAddress]);

    // Debounce the call to fetchShippingQuotes when basic address changes
    useDebouncedEffect(() => {
        if (checkoutStep === 'shipping_input' && basicShippingAddress.country_code.length === 2 && !isLoadingOptions) {
            fetchShippingQuotes();
        }
    }, 500, [basicShippingAddress.country_code, basicShippingAddress.postcode, fetchShippingQuotes, checkoutStep]);


    const handleProceedToNextStep = async () => {
        setModalError(null);
        setFormErrors({});

        if (checkoutStep === 'shipping_input') {
            if (!basicShippingAddress.country_code) {
                setFormErrors({ country_code: 'Country is required.' });
                setModalError('Please select a country.');
                return;
            }
            if (!COUNTRIES.some(c => c.code === basicShippingAddress.country_code.toUpperCase())) {
                setFormErrors({ country_code: 'Invalid country selection.' });
                setModalError('Please select a valid country.');
                return;
            }
            await fetchShippingQuotes(); // Explicitly fetch on button click if not already triggered by debounce
            return;
        }

        if (checkoutStep === 'shipping_options') {
            if (!selectedShippingLevel) {
                setFormErrors({ general: 'Please select a shipping option.' });
                setModalError('Please select a shipping option to proceed.');
                return;
            }
            // Pre-fill full address form with basic details
            setFullShippingAddress(prev => ({
                ...prev,
                country_code: basicShippingAddress.country_code,
                postcode: basicShippingAddress.postcode,
                street1: basicShippingAddress.street1 // Carry over street1 if already entered
            }));
            setCheckoutStep('full_address_form');
            return;
        }

        if (checkoutStep === 'full_address_form') {
            if (!validateFullAddressForm()) {
                setModalError("Please correct the errors in the shipping address form.");
                return;
            }

            setIsProcessingCheckout(true);
            try {
                const finalShippingOption = shippingOptions.find(opt => opt.level === selectedShippingLevel);
                if (!finalShippingOption || !quoteDetails || !quoteDetails.quote_token) {
                    throw new Error("Missing shipping option details or quote token for checkout.");
                }

                // Pass selected shipping level AND quote token to final checkout endpoint
                const response = await apiClient.post(`/text-books/${bookId}/checkout`, {
                    shippingAddress: fullShippingAddress,
                    selectedShippingLevel: selectedShippingLevel,
                    quoteToken: quoteDetails.quote_token,
                });
                window.location.href = response.data.url;
            } catch (err) {
                console.error('handleProceedToNextStep (Final Checkout): Could not proceed to checkout:', err);
                setModalError(err.response?.data?.detailedError || err.response?.data?.message || 'Could not proceed to checkout. Please try again.');
            } finally {
                setIsProcessingCheckout(false);
            }
        }
    };

    // Determine current displayed price based on step and selection
    const getDisplayPrice = () => {
        if (!quoteDetails) return null;

        let totalShippingCostUsd = 0;
        if (selectedShippingLevel) {
            const selectedOption = shippingOptions.find(opt => opt.level === selectedShippingLevel);
            if (selectedOption) {
                totalShippingCostUsd = selectedOption.costUsd;
            }
        } else if (shippingOptions.length > 0) {
            // Show price for the cheapest option if nothing explicitly selected yet
            totalShippingCostUsd = shippingOptions[0].costUsd;
        }

        const totalPrice = quoteDetails.print_cost_usd + totalShippingCostUsd + (quoteDetails.base_product_price_usd - quoteDetails.print_cost_usd); // Profit re-calculated
        return totalPrice;
    };

    const currentTotalDisplayPrice = getDisplayPrice();

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: -20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        className="bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 w-full max-w-md p-8"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-3xl font-bold text-white mb-4">
                            {checkoutStep === 'shipping_input' && 'Enter Shipping Destination'}
                            {checkoutStep === 'shipping_options' && 'Select Shipping Option'}
                            {checkoutStep === 'full_address_form' && 'Complete Shipping Details'}
                        </h2>
                        <p className="text-slate-300 mb-6 text-base">
                            {checkoutStep === 'shipping_input' && 'We need your country and postal code to fetch available shipping methods.'}
                            {checkoutStep === 'shipping_options' && 'Choose a shipping method. Prices are estimates and finalized at checkout.'}
                            {checkoutStep === 'full_address_form' && 'Provide full details for final checkout. Your current quote is active for a limited time.'}
                        </p>

                        {modalError && <Alert type="error" message={modalError} onClose={() => setModalError(null)} className="mb-4" />}
                        {isLoadingOptions && <LoadingSpinner text="Getting shipping options..." className="my-4" />}
                        {isProcessingCheckout && <LoadingSpinner text="Processing checkout..." className="my-4" />}

                        <form onSubmit={(e) => { e.preventDefault(); handleProceedToNextStep(); }} className="space-y-5">
                            {checkoutStep === 'shipping_input' && (
                                <>
                                    <div>
                                        <label htmlFor="country_code" className="block text-sm font-medium text-slate-300 mb-1">Country</label>
                                        <select
                                            id="country_code"
                                            name="country_code"
                                            value={basicShippingAddress.country_code}
                                            onChange={handleBasicAddressChange}
                                            className={inputClasses}
                                            required
                                        >
                                            <option value="">Select a country</option>
                                            {COUNTRIES.map(c => (
                                                <option key={c.code} value={c.code}>{c.name}</option>
                                            ))}
                                        </select>
                                        {formErrors.country_code && <p className="text-red-400 text-xs mt-1">{formErrors.country_code}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="postcode" className="block text-sm font-medium text-slate-300 mb-1">Postal Code (Optional)</label>
                                        <input
                                            type="text"
                                            id="postcode"
                                            name="postcode"
                                            value={basicShippingAddress.postcode}
                                            onChange={handleBasicAddressChange}
                                            className={inputClasses}
                                            placeholder="e.g., 12345 or 3000"
                                        />
                                        {formErrors.postcode && <p className="text-red-400 text-xs mt-1">{formErrors.postcode}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="street1" className="block text-sm font-medium text-slate-300 mb-1">Street Address 1 (Optional)</label>
                                        <input
                                            type="text"
                                            id="street1"
                                            name="street1"
                                            value={basicShippingAddress.street1}
                                            onChange={handleBasicAddressChange}
                                            className={inputClasses}
                                            placeholder="e.g., 123 Main St"
                                        />
                                    </div>
                                </>
                            )}

                            {checkoutStep === 'shipping_options' && (
                                <>
                                    {shippingOptions.length === 0 && !isLoadingOptions ? (
                                        <p className="text-slate-300">No shipping options available for the selected destination. Please try a different country or postal code.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {shippingOptions.map(option => (
                                                <label key={option.level} className="flex items-center text-slate-300 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="shipping_level"
                                                        value={option.level}
                                                        checked={selectedShippingLevel === option.level}
                                                        onChange={() => setSelectedShippingLevel(option.level)}
                                                        className="form-radio h-4 w-4 text-green-600"
                                                    />
                                                    <span className="ml-2">
                                                        {option.name} - ${option.costUsd.toFixed(2)} USD (Est. {option.estimatedDeliveryDate || 'N/A'})
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                    {formErrors.general && <p className="text-red-400 text-xs mt-1">{formErrors.general}</p>}
                                </>
                            )}

                            {checkoutStep === 'full_address_form' && (
                                <>
                                    {/* Populate these from basicShippingAddress and existing user profile if available */}
                                    <div>
                                        <label htmlFor="fullName" className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                                        <input type="text" id="fullName" name="name" value={fullShippingAddress.name} onChange={handleFullAddressChange} placeholder="John Doe" required className={inputClasses} />
                                        {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                                        <input type="email" id="email" name="email" value={fullShippingAddress.email} onChange={handleFullAddressChange} placeholder="john.doe@example.com" required className={inputClasses} />
                                        {formErrors.email && <p className="text-red-400 text-xs mt-1">{formErrors.email}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="street1" className="block text-sm font-medium text-slate-300 mb-1">Street Address 1</label>
                                        <input type="text" id="street1" name="street1" value={fullShippingAddress.street1} onChange={handleFullAddressChange} placeholder="123 Main St" required className={inputClasses} />
                                        {formErrors.street1 && <p className="text-red-400 text-xs mt-1">{formErrors.street1}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="street2" className="block text-sm font-medium text-slate-300 mb-1">Street Address 2 (Optional)</label>
                                        <input type="text" id="street2" name="street2" value={fullShippingAddress.street2} onChange={handleFullAddressChange} placeholder="Apt 4B" className={inputClasses} />
                                    </div>
                                    <div>
                                        <label htmlFor="city" className="block text-sm font-medium text-slate-300 mb-1">City</label>
                                        <input type="text" id="city" name="city" value={fullShippingAddress.city} onChange={handleFullAddressChange} placeholder="Springfield" required className={inputClasses} />
                                        {formErrors.city && <p className="text-red-400 text-xs mt-1">{formErrors.city}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="state_code" className="block text-sm font-medium text-slate-300 mb-1">State/Province Code (Optional)</label>
                                        <input type="text" id="state_code" name="state_code" value={fullShippingAddress.state_code} onChange={handleFullAddressChange} placeholder="NY" className={inputClasses} />
                                    </div>
                                    <div>
                                        <label htmlFor="postcodeFull" className="block text-sm font-medium text-slate-300 mb-1">Postal Code</label>
                                        <input type="text" id="postcodeFull" name="postcode" value={fullShippingAddress.postcode} onChange={handleFullAddressChange} placeholder="12345" required className={inputClasses} />
                                        {formErrors.postcode && <p className="text-red-400 text-xs mt-1">{formErrors.postcode}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="country_codeFull" className="block text-sm font-medium text-slate-300 mb-1">Country (ISO 2-letter)</label>
                                        <select id="country_codeFull" name="country_code" value={fullShippingAddress.country_code} onChange={handleFullAddressChange} required className={inputClasses}>
                                            <option value="">Select a country</option>
                                            {COUNTRIES.map(c => (
                                                <option key={c.code} value={c.code}>{c.name}</option>
                                            ))}
                                        </select>
                                        {formErrors.country_code && <p className="text-red-400 text-xs mt-1">{formErrors.country_code}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="phone_number" className="block text-sm font-medium text-slate-300 mb-1">Phone Number</label>
                                        <input type="tel" id="phone_number" name="phone_number" value={fullShippingAddress.phone_number} onChange={handleFullAddressChange} placeholder="555-123-4567" required className={inputClasses} />
                                        {formErrors.phone_number && <p className="text-red-400 text-xs mt-1">{formErrors.phone_number}</p>}
                                    </div>
                                </>
                            )}

                            <div className="pt-6 flex items-center justify-between space-x-4">
                                <button type="button" onClick={onClose} className="text-slate-400 hover:text-white transition text-lg">Cancel</button>
                                <button
                                    type="submit"
                                    disabled={isLoadingOptions || isProcessingCheckout || (checkoutStep === 'shipping_options' && !selectedShippingLevel) || (checkoutStep === 'full_address_form' && !currentTotalDisplayPrice)}
                                    className={`${buttonClasses} text-lg`}
                                >
                                    {isLoadingOptions || isProcessingCheckout ? 'Processing...' : (
                                        checkoutStep === 'shipping_input' ? 'Get Shipping Options' :
                                        checkoutStep === 'shipping_options' ? 'Proceed to Address' :
                                        'Confirm & Pay'
                                    )}
                                </button>
                            </div>
                            {/* Display Calculated Price if available and on relevant steps */}
                            {currentTotalDisplayPrice !== null && (checkoutStep === 'shipping_options' || checkoutStep === 'full_address_form') && (
                                <p className="text-lg font-bold text-white mt-4 text-center">
                                    Total Estimated Price: ${currentTotalDisplayPrice.toFixed(2)} USD
                                    {quoteDetails?.expires_at && (
                                        <span className="block text-sm text-slate-400 font-normal">
                                            Quote valid until: {new Date(quoteDetails.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </span>
                                    )}
                                    {/* Breakdown only if on final steps and quote details are comprehensive */}
                                    {quoteDetails && (checkoutStep === 'full_address_form' || (checkoutStep === 'shipping_options' && selectedShippingLevel)) && (
                                        <span className="block text-sm text-slate-400 font-normal mt-1">
                                            (Print: ${quoteDetails.print_cost_usd.toFixed(2)}, Shipping: {selectedShippingLevel ? shippingOptions.find(opt => opt.level === selectedShippingLevel)?.costUsd?.toFixed(2) : 'N/A'})
                                        </span>
                                    )}
                                </p>
                            )}
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};


// --- Sub-component: FauxReview ---
const FauxReview = ({ quote, author, avatar }) => (
    <div className="bg-slate-800/60 backdrop-blur-md p-7 rounded-2xl shadow-xl border border-slate-700 hover:border-indigo-600 transition-colors duration-200"> {/* Subtle border hover */}
        <p className="text-slate-200 italic text-xl leading-relaxed mb-4">"{quote}"</p> {/* Larger text, more line height */}
        <div className="flex items-center">
            <img src={avatar} alt={author} className="w-12 h-12 rounded-full mr-4 object-cover border-2 border-amber-400" /> {/* Larger avatar, accent border */}
            <span className="font-semibold text-amber-300 text-lg">{author}</span> {/* Accent color for author */}
        </div>
    </div>
);

// --- Helper function: fetchBookOptions ---
const fetchBookOptions = async () => {
    const { data } = await apiClient.get('/products/book-options');
    return data;
};

// --- Main Component: NovelPage ---
function NovelPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { bookId: paramBookId } = useParams();

    // State for book data
    const [bookId, setBookId] = useState(paramBookId && paramBookId !== 'new' ? paramBookId : null);
    const [bookDetails, setBookDetails] = useState(null);
    const [chapters, setChapters] = useState([]);
    const [openChapter, setOpenChapter] = useState(null);

    // State for loading and error management
    const [isLoadingPage, setIsLoadingPage] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isStoryComplete, setIsStoryComplete] = useState(false);

    // --- NEW: State for shipping modal ---
    const [isCheckoutModalOpen, setCheckoutModalOpen] = useState(false); // Renamed for clarity, handles all checkout steps

    // Fetch all book options (product configurations) using React Query
    const { data: allBookOptions, isLoading: isLoadingBookOptions, isError: isErrorBookOptions } = useQuery({
        queryKey: ['allBookOptions'],
        queryFn: fetchBookOptions,
        staleTime: Infinity,
        enabled: true,
    });

    const [selectedProductForNew, setSelectedProductForNew] = useState(null);

    useEffect(() => {
        setError(null);
        if (paramBookId && paramBookId !== 'new') {
            if (!bookDetails || (bookDetails.id && bookDetails.id !== paramBookId)) {
                setIsLoadingPage(true);
                apiClient.get(`/text-books/${paramBookId}`)
                    .then((res) => {
                        const bookData = res.data.book;
                        const fetchedChapters = res.data.chapters || [];
                        setBookDetails(bookData);
                        setChapters(fetchedChapters);
                        setBookId(paramBookId);
                        setIsStoryComplete(fetchedChapters.length >= (bookData.total_chapters || 1));
                        setOpenChapter(fetchedChapters.length > 0 ? fetchedChapters[fetchedChapters.length - 1].chapter_number : null);
                        const product = allBookOptions?.find((p) => p.id === bookData.lulu_product_id); // Corrected property name here
                        if (product) {
                            setSelectedProductForNew(product);
                        } else {
                            // Fallback for product data if not found in options
                            setSelectedProductForNew({
                                id: bookData.lulu_product_id, // Corrected property name here
                                name: bookData.title || 'Unknown Product',
                                type: 'textBook', // Assume textBook for this page
                                price: 0, // Placeholder
                                defaultPageCount: bookData.prompt_details?.pageCount || 66,
                                defaultWordsPerPage: bookData.prompt_details?.wordsPerPage || 250,
                                totalChapters: bookData.total_chapters || 6
                            });
                        }
                        setIsLoadingPage(false);
                    })
                    .catch((err) => {
                        console.error('NovelPage useEffect: Error loading existing book details:', err);
                        setError(err.response?.data?.message || 'Could not load your project.');
                        setIsLoadingPage(false);
                    });
            } else {
                setIsLoadingPage(false);
            }
        }
        else if (paramBookId === 'new' || !paramBookId) {
            if (bookDetails) {
                setIsLoadingPage(false);
                return;
            }
            if (allBookOptions && location.state?.selectedProductId && !selectedProductForNew) {
                const product = allBookOptions.find((p) => p.id === location.state.selectedProductId);
                if (product) {
                    setSelectedProductForNew(product);
                    setIsLoadingPage(false);
                } else {
                    setError('Invalid book format selected. Please go back and choose a format.');
                    setIsLoadingPage(false);
                }
            }
            else if (selectedProductForNew && isLoadingPage) {
                setIsLoadingPage(false);
            }
            else if (!selectedProductForNew && !location.state?.selectedProductId && !isLoadingBookOptions && isLoadingPage) {
                setError('To create a new novel, please select a book format first.');
                setIsLoadingPage(false);
            }
        }
        else if (isLoadingPage) {
            setIsLoadingPage(false);
        }
    }, [
        paramBookId, allBookOptions, isLoadingBookOptions, location.state?.selectedProductId, bookDetails, selectedProductForNew, isLoadingPage
    ]);

    const handleCreateBook = async (formData) => {
        setIsActionLoading(true);
        setError(null);
        if (!selectedProductForNew || !selectedProductForNew.id) {
            setError('Internal error: Book format not selected during creation. Please try again from selection page.');
            setIsActionLoading(false);
            return;
        }
        const { title, ...restOfPromptDetails } = formData;
        const aiGenerationParams = {
            pageCount: selectedProductForNew.defaultPageCount,
            wordsPerPage: selectedProductForNew.defaultWordsPerPage,
            totalChapters: selectedProductForNew.totalChapters,
        };
        if (typeof aiGenerationParams.pageCount === 'undefined' || typeof aiGenerationParams.wordsPerPage === 'undefined' || typeof aiGenerationParams.totalChapters === 'undefined') {
            const missing = [];
            if (typeof aiGenerationParams.pageCount === 'undefined') missing.push('pageCount');
            if (typeof aiGenerationParams.wordsPerPage === 'undefined') missing.push('wordsPerPage');
            if (typeof aiGenerationParams.totalChapters === 'undefined') missing.push('totalChapters');
            const errorMessage = `Missing AI generation parameters for selected product: ${missing.join(', ')}. Please check backend LULU_PRODUCT_CONFIGURATIONS.`;
            console.error("ERROR:", errorMessage, selectedProductForNew);
            setError(errorMessage);
            setIsActionLoading(false);
            return;
        }
        const promptDetails = { ...restOfPromptDetails, ...aiGenerationParams };
        const bookData = { title, promptDetails, luluProductId: selectedProductForNew.id };
        try {
            const response = await apiClient.post('/text-books', bookData);
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            setBookId(response.data.bookId);
            setBookDetails(
                response.data.bookDetails || {
                    title: bookData.title,
                    lulu_product_id: bookData.luluProductId, // Corrected property name here for consistency
                    prompt_details: promptDetails,
                    total_chapters: aiGenerationParams.totalChapters,
                }
            );
            setChapters([{ chapter_number: 1, content: response.data.firstChapter }]);
            setOpenChapter(1);
            setIsStoryComplete(1 >= aiGenerationParams.totalChapters);
            navigate(`/novel/${response.data.bookId}`, { replace: true });
        } catch (err) {
            console.error('handleCreateBook: Failed to create the book:', err);
            setError(err.response?.data?.message || 'Failed to create the book.');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleGenerateNextChapter = async () => {
        setIsActionLoading(true);
        setError(null);
        try {
            const response = await apiClient.post(`/text-books/${bookId}/generate-chapter`);
            const newChapterData = {
                chapter_number: response.data.chapterNumber,
                content: response.data.newChapter,
            };
            setChapters((prev) => {
                const updatedChapters = [...prev, newChapterData];
                setIsStoryComplete(updatedChapters.length >= (bookDetails?.total_chapters || 1));
                return updatedChapters;
            });
            setOpenChapter(newChapterData.chapter_number);
        } catch (err) {
            console.error('handleGenerateNextChapter: Failed to generate the next chapter:', err);
            setError(err.response?.data?.message || 'Failed to generate the next chapter.');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleToggleChapter = (chapterNumber) => {
        setOpenChapter(openChapter === chapterNumber ? null : chapterNumber);
    };

    const handleFinalizeAndPurchase = () => {
        setCheckoutModalOpen(true); // Open the new multi-step checkout modal
    };

    // This function will now be called by the CheckoutModal with the final, selected options
    const submitFinalCheckout = async (shippingAddress, selectedShippingLevel, quoteToken) => {
        // This 'isCheckingOut' state is internal to the modal now,
        // but can be used here if you want to show a global spinner too.
        // For simplicity, let's just pass it through the modal's onSubmit.
        try {
            const response = await apiClient.post(`/text-books/${bookId}/checkout`, {
                shippingAddress,
                selectedShippingLevel,
                quoteToken,
            });
            window.location.href = response.data.url;
        } catch (err) {
            console.error('submitFinalCheckout: Could not proceed to checkout:', err);
            const detailedError = err.response?.data?.detailedError;
            console.error('DETAILED ERROR FROM BACKEND:', detailedError);
            setError(detailedError || err.response?.data?.message || 'Could not proceed to checkout.');
            // Close modal on error, user can try again
            setCheckoutModalOpen(false);
        }
    };


    // Main render logic based on component state
    if (error) {
        return <Alert type="error" message={error} onClose={() => setError(null)} />; // Allow closing alert
    }
    if (isErrorBookOptions) {
        return <Alert type="error" message="Could not load book options." />;
    }
    if (isLoadingPage || isLoadingBookOptions) {
        return <LoadingSpinner text="Getting your book ready..." />;
    }

    // Condition for displaying the initial prompt form for a new book
    if ((paramBookId === 'new' || !paramBookId) && selectedProductForNew && !bookDetails) {
        return <PromptForm isLoading={isActionLoading} onSubmit={handleCreateBook} productName={selectedProductForNew?.name || 'Novel'} />;
    }

    // Condition for displaying the created/loaded book content
    if (bookId && bookDetails) {
        const totalChaptersToDisplay = bookDetails.total_chapters || selectedProductForNew?.totalChapters || 1;

        return (
            <>
                <CheckoutModal
                    isOpen={isCheckoutModalOpen}
                    onClose={() => setCheckoutModalOpen(false)}
                    onSubmit={submitFinalCheckout}
                    bookId={bookId}
                    bookType="textBook" // Explicitly pass bookType
                />
                <div className="fade-in min-h-screen bg-gradient-to-br from-slate-900 to-gray-950 py-12 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-4xl mx-auto"> {/* Centered content */}
                        <div className="bg-slate-800/50 backdrop-blur-md p-8 md:p-14 rounded-3xl shadow-2xl border border-slate-700"> {/* Increased padding, rounded corners */}
                            <div className="text-center mb-12"> {/* Increased margin-bottom */}
                                <h1 className="text-4xl md:text-5xl font-extrabold font-serif text-white leading-tight">{bookDetails?.title}</h1>
                                <p className="text-xl text-slate-400 mt-4 font-light">Your personalized story</p>
                            </div>
                            <div className="space-y-3"> {/* Slightly increased space-y for chapters */}
                                {chapters.map((chapter) => (
                                    <Chapter
                                        key={chapter.chapter_number}
                                        chapter={chapter}
                                        isOpen={openChapter === chapter.chapter_number}
                                        onToggle={() => handleToggleChapter(chapter.chapter_number)}
                                    />
                                ))}
                            </div>
                            {isActionLoading && (
                                <div className="mt-10"> {/* Increased margin-top */}
                                    <LoadingSpinner text={`Generating Chapter ${chapters.length + 1}...`} />
                                </div>
                            )}
                            <div className="mt-14 border-t border-dashed border-slate-600 pt-10 text-center"> {/* Thinner dashed border, increased padding */}
                                {!isStoryComplete ? (
                                    <button
                                        onClick={handleGenerateNextChapter}
                                        disabled={isActionLoading}
                                        className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg
                                                     hover:bg-indigo-700 disabled:bg-slate-500 disabled:cursor-not-allowed
                                                     transition-transform transform hover:scale-105 shadow-lg text-lg"
                                    >
                                        {isActionLoading ? 'Writing...' : `Continue Story (${chapters.length}/${totalChaptersToDisplay})`}
                                    </button>
                                ) : (
                                    <div>
                                        <p className="text-2xl text-green-400 font-bold mb-5 leading-relaxed">Your story is complete! Ready to bring it to life?</p> {/* Larger text, bolder */}
                                        <button
                                            onClick={handleFinalizeAndPurchase}
                                            disabled={isActionLoading} // Use isActionLoading to prevent multiple clicks while fetching options
                                            className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg
                                                     hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed
                                                     transition-transform transform hover:scale-105 shadow-lg text-lg"
                                        >
                                            {isActionLoading ? 'Preparing Checkout...' : 'Finalize & Purchase'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Faux Reviews Section */}
                        <div className="mt-20 max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8"> {/* Increased margin-top, gap */}
                            <FauxReview
                                quote="A heartwarming tale my whole family enjoyed. The personalized details made it truly special!"
                                author="Jane D."
                                avatar="/avatars/jane.jpg"
                            />
                            <FauxReview
                                quote="This book truly captured my son's imagination. He loves being the main character!"
                                author="Mike S."
                                avatar="/avatars/mike.jpg"
                            />
                            <FauxReview
                                quote="Incredible story, perfect for kids who love adventure! A unique gift idea."
                                author="Sarah P."
                                avatar="/avatars/sarah.jpg"
                            />
                        </div>
                    </div>
                </div>
            </>
        );
    }
    // Fallback if no valid state to render, e.g., direct navigation without selectedProductId
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-gray-950 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 text-center">
            <Alert type="info" message="To create a new novel, please select a book format first." />
            <button
                onClick={() => navigate('/select-novel')}
                className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-transform transform hover:scale-105"
            >
                Back to Selection
            </button>
        </div>
    );
}

export default NovelPage;