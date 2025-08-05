// frontend/src/pages/NovelPage.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
        const handler = setTimeout(() => {
            if (deps.every(dep => dep !== undefined)) {
                callbackRef.current();
            }
        }, delay);
        return () => { clearTimeout(handler); };
    }, [delay, ...deps]);
};

// Simplified list of valid countries for the dropdown
const COUNTRIES = [
    { code: 'US', name: 'United States', stateRequired: true },
    { code: 'AU', name: 'Australia', stateRequired: true },
    { code: 'GB', name: 'United Kingdom', stateRequired: false },
    { code: 'CA', name: 'Canada', stateRequired: true },
    { code: 'MX', name: 'Mexico', stateRequired: false },
    { code: 'NZ', name: 'New Zealand', stateRequired: false },
];

// --- Sub-component: Chapter (Accordion for displaying story chapters) ---
const Chapter = ({ chapter, isOpen, onToggle }) => {
    const ChevronDownIcon = (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
    );
    return (
        <div className="border-b border-slate-700 last:border-b-0">
            <button onClick={onToggle} className="w-full flex justify-between items-center text-left py-5 px-4 hover:bg-slate-700/50 rounded-lg transition-colors duration-200">
                <h2 className="text-3xl md:text-4xl font-serif text-amber-400 m-0 p-0 font-bold">
                    Chapter {chapter.chapter_number}
                </h2>
                <ChevronDownIcon className={`w-7 h-7 text-slate-300 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div key="content" initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1, transition: { height: { duration: 0.4, ease: 'easeInOut' }, opacity: { duration: 0.25, delay: 0.15 } } }}
                                exit={{ height: 0, opacity: 0, transition: { height: { duration: 0.4, ease: 'easeInOut' }, opacity: { duration: 0.25 } } }}
                                className="overflow-hidden">
                        <div className="prose prose-lg lg:prose-xl max-w-none text-slate-200 prose-p:text-slate-200 prose-p:mb-5 pt-4 pb-8 px-4 font-light leading-relaxed">
                            {chapter.content.split('\n').map((paragraph, index) => (
                                <p key={index} className="mb-4">{paragraph}</p>
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
    const handleSubmit = (e) => { e.preventDefault(); if (isLoading) return; onSubmit(details); };
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
                <form onSubmit={handleSubmit} className="w-full space-y-7">
                    <div><label htmlFor="title" className={labelClasses}>Book Title</label>
                        <input type="text" id="title" name="title" value={details.title} onChange={handleChange} placeholder="e.g., The Adventures of Captain Alistair" className={inputClasses} required />
                    </div>
                    <div><label htmlFor="recipientName" className={labelClasses}>Who is this book for?</label>
                        <input type="text" id="recipientName" name="recipientName" value={details.recipientName} onChange={handleChange} placeholder="e.g., My Dad" className={inputClasses} required />
                    </div>
                    <div><label htmlFor="characterName" className={labelClasses}>Main character's name?</label>
                        <input type="text" id="characterName" name="characterName" value={details.characterName} onChange={handleChange} placeholder="e.g., Captain Alistair" className={inputClasses} required />
                    </div>
                    <div><label htmlFor="interests" className={labelClasses}>What do they love? (e.g., sailing, classic cars, the color yellow)</label>
                        <textarea id="interests" name="interests" value={details.interests} onChange={handleChange} placeholder="Separate interests with commas" className={`${inputClasses} h-28`} required />
                    </div>
                    <div><label htmlFor="genre" className={labelClasses}>Choose a genre</label>
                        <select id="genre" name="genre" value={details.genre} onChange={handleChange} className={inputClasses} required>
                            {genres.map((g) => (<option key={g} value={g}>{g}</option>))}
                        </select>
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 disabled:bg-slate-500 disabled:cursor-not-allowed transition-transform transform hover:scale-105 shadow-lg text-lg mt-8">
                        <MagicWandIcon className="h-6 w-6 mr-3" />
                        {isLoading ? 'Crafting your first chapter...' : 'Create My Book'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// --- CORRECTED CheckoutModal COMPONENT ---
const CheckoutModal = ({ isOpen, onClose, bookId, bookType, onSubmit }) => {
    const [checkoutStep, setCheckoutStep] = useState('shipping_input');
    const [shippingAddress, setShippingAddress] = useState({
        name: '', street1: '', street2: '', city: '', state_code: '', postcode: '', country_code: '', phone_number: '', email: ''
    });
    const [formErrors, setFormErrors] = useState({});
    const [shippingOptions, setShippingOptions] = useState([]);
    const [selectedShippingLevel, setSelectedShippingLevel] = useState(null);
    const [quoteDetails, setQuoteDetails] = useState(null);
    const [isLoadingOptions, setIsLoadingOptions] = useState(false);
    const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
    const [modalError, setModalError] = useState(null);

    const inputClasses = "w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-green-500";
    const buttonClasses = "bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 disabled:bg-green-300 transition";

    const handleFullAddressChange = (e) => {
        setShippingAddress(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setFormErrors({});
    };

    const isShippingFormComplete = () => {
        const requiredFields = ['name', 'street1', 'city', 'postcode', 'country_code', 'phone_number', 'email'];
        const selectedCountry = COUNTRIES.find(c => c.code === shippingAddress.country_code);

        let allFieldsFilled = requiredFields.every(field => shippingAddress[field] && shippingAddress[field].trim() !== '');
        if (selectedCountry?.stateRequired && !shippingAddress.state_code.trim()) {
            allFieldsFilled = false;
        }
        return allFieldsFilled;
    };
    
    const fetchShippingQuotes = useCallback(async () => {
        setModalError(null);
        setIsLoadingOptions(true);
        setShippingOptions([]);
        setSelectedShippingLevel(null);
        setQuoteDetails(null);
        
        try {
            const response = await apiClient.post('/shipping/quotes', {
                bookId,
                bookType,
                shippingAddress,
            });
            setShippingOptions(response.data.shipping_options);
            setQuoteDetails({
                quote_token: response.data.quote_token,
                expires_at: response.data.expires_at,
                print_cost_usd: response.data.print_cost_usd,
                base_product_price_usd: response.data.base_product_price_usd,
                currency: response.data.currency,
            });
            if (response.data.shipping_options.length > 0) {
                const cheapest = response.data.shipping_options.reduce((min, current) => current.costUsd < min.costUsd ? current : min);
                setSelectedShippingLevel(cheapest.level);
            }
            setCheckoutStep('shipping_options');
        } catch (err) {
            console.error("Error fetching shipping quotes:", err.response?.data || err);
            setModalError(err.response?.data?.message || "Failed to fetch shipping options. Please try again with a valid address.");
            setShippingOptions([]);
        } finally {
            setIsLoadingOptions(false);
        }
    }, [bookId, bookType, shippingAddress]);

    const handleGetOptions = async (e) => {
        e.preventDefault();
        setModalError(null);
        const isValid = validateFullAddressForm(); // Run full validation first
        if (isValid) {
            await fetchShippingQuotes();
        } else {
            setModalError("Please correct the errors in the shipping address form.");
        }
    };
    
    const validateFullAddressForm = () => {
        const errors = {};
        const selectedCountry = COUNTRIES.find(c => c.code === shippingAddress.country_code);

        if (!shippingAddress.name.trim()) errors.name = 'Full Name is required.';
        if (!shippingAddress.street1.trim()) errors.street1 = 'Street Address is required.';
        if (!shippingAddress.city.trim()) errors.city = 'City is required.';
        if (!shippingAddress.postcode.trim()) errors.postcode = 'Postal code is required.';
        if (!shippingAddress.country_code.trim()) errors.country_code = 'Country is required.';
        if (selectedCountry?.stateRequired && !shippingAddress.state_code.trim()) errors.state_code = 'State/Province is required for this country.';
        if (!shippingAddress.email.trim() || !shippingAddress.email.includes('@')) errors.email = 'Valid email is required.';
        if (!shippingAddress.phone_number.trim()) errors.phone_number = 'Phone number is required.';

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleProceedToPayment = async () => {
        setModalError(null);
        if (!selectedShippingLevel) {
            setModalError('Please select a shipping option to proceed.');
            return;
        }
        setIsProcessingCheckout(true);
        try {
            const finalShippingOption = shippingOptions.find(opt => opt.level === selectedShippingLevel);
            if (!finalShippingOption || !quoteDetails || !quoteDetails.quote_token) {
                throw new Error("Missing shipping option details or quote token for checkout.");
            }
            await onSubmit(shippingAddress, selectedShippingLevel, quoteDetails.quote_token);
        } catch (err) {
            console.error('handleProceedToPayment (Final Checkout): Could not proceed to checkout:', err);
            setModalError(err.response?.data?.detailedError || err.response?.data?.message || 'Could not proceed to checkout. Please try again.');
        } finally {
            setIsProcessingCheckout(false);
        }
    };

    const getDisplayPrice = () => {
        if (!quoteDetails) return null;
        const selectedOption = shippingOptions.find(opt => opt.level === selectedShippingLevel);
        const totalShippingCostUsd = selectedOption ? selectedOption.costUsd : 0;
        // MODIFIED: Total price calculation now directly uses base_product_price_usd (retail price)
        const totalPrice = quoteDetails.base_product_price_usd + totalShippingCostUsd;
        return totalPrice;
    };
    const currentTotalDisplayPrice = getDisplayPrice();
    
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
                    <motion.div initial={{ scale: 0.9, y: -20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                                className="bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 w-full max-w-md p-8 overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}> {/* MODIFIED: Added overflow-y-auto and max-h */}
                        {/* MODIFIED: Consolidated header and message */}
                        <h2 className="text-3xl font-bold text-white mb-4">
                            {checkoutStep === 'shipping_input' ? 'Enter Full Shipping Details' : 'Select Shipping Option'}
                        </h2>
                        <p className="text-slate-300 mb-6 text-base">
                            {checkoutStep === 'shipping_input' ? 'These details are used to get an accurate shipping quote.' : 'Choose a shipping method. Prices are estimates and finalized at checkout.'}
                        </p>
                        
                        {modalError && <Alert type="error" message={modalError} onClose={() => setModalError(null)} className="mb-4" />}
                        {isLoadingOptions && <LoadingSpinner text="Getting shipping options..." className="my-4" />}
                        {isProcessingCheckout && <LoadingSpinner text="Processing checkout..." className="my-4" />}
                        
                        {/* Conditional rendering for shipping input form */}
                        {checkoutStep === 'shipping_input' && (
                            <form onSubmit={handleGetOptions} className="space-y-5">
                                {/* MODIFIED: Added md:grid for horizontal split on medium screens and up */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="fullName" className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                                        <input type="text" id="fullName" name="name" value={shippingAddress.name} onChange={handleFullAddressChange} placeholder="John Doe" required className={inputClasses} />
                                        {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                                        <input type="email" id="email" name="email" value={shippingAddress.email} onChange={handleFullAddressChange} placeholder="john.doe@example.com" required className={inputClasses} />
                                        {formErrors.email && <p className="text-red-400 text-xs mt-1">{formErrors.email}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="phone_number" className="block text-sm font-medium text-slate-300 mb-1">Phone Number</label>
                                        <input type="tel" id="phone_number" name="phone_number" value={shippingAddress.phone_number} onChange={handleFullAddressChange} placeholder="555-123-4567" required className={inputClasses} />
                                        {formErrors.phone_number && <p className="text-red-400 text-xs mt-1">{formErrors.phone_number}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="country_code" className="block text-sm font-medium text-slate-300 mb-1">Country</label>
                                        <select id="country_code" name="country_code" value={shippingAddress.country_code} onChange={handleFullAddressChange} required className={inputClasses}>
                                            <option value="">Select a country</option>
                                            {COUNTRIES.map(c => (<option key={c.code} value={c.code}>{c.name}</option>))}
                                        </select>
                                        {formErrors.country_code && <p className="text-red-400 text-xs mt-1">{formErrors.country_code}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="postcode" className="block text-sm font-medium text-slate-300 mb-1">Postal Code</label>
                                        <input type="text" id="postcode" name="postcode" value={shippingAddress.postcode} onChange={handleFullAddressChange} placeholder="12345" required className={inputClasses} />
                                        {formErrors.postcode && <p className="text-red-400 text-xs mt-1">{formErrors.postcode}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="state_code" className="block text-sm font-medium text-slate-300 mb-1">State/Province</label>
                                        <input type="text" id="state_code" name="state_code" value={shippingAddress.state_code} onChange={handleFullAddressChange} placeholder="NY" className={inputClasses} />
                                        {formErrors.state_code && <p className="text-red-400 text-xs mt-1">{formErrors.state_code}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="city" className="block text-sm font-medium text-slate-300 mb-1">City</label>
                                        <input type="text" id="city" name="city" value={shippingAddress.city} onChange={handleFullAddressChange} placeholder="Springfield" required className={inputClasses} />
                                        {formErrors.city && <p className="text-red-400 text-xs mt-1">{formErrors.city}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="street1" className="block text-sm font-medium text-slate-300 mb-1">Street Address 1</label>
                                        <input type="text" id="street1" name="street1" value={shippingAddress.street1} onChange={handleFullAddressChange} placeholder="123 Main St" required className={inputClasses} />
                                        {formErrors.street1 && <p className="text-red-400 text-xs mt-1">{formErrors.street1}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="street2" className="block text-sm font-medium text-slate-300 mb-1">Street Address 2 (Optional)</label>
                                        <input type="text" id="street2" name="street2" value={shippingAddress.street2} onChange={handleFullAddressChange} placeholder="Apt 4B" className={inputClasses} />
                                    </div>
                                </div> {/* End grid */}
                                <div className="mt-6 flex items-center justify-end space-x-4">
                                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-white transition text-lg">Cancel</button>
                                    <button type="submit" disabled={isLoadingOptions || !isShippingFormComplete()} className={`${buttonClasses} text-lg`}>
                                        {isLoadingOptions ? 'Getting Shipping Options...' : 'Get Shipping Options'}
                                    </button>
                                </div>
                            </form>
                        )}
                        
                        {/* Conditional rendering for shipping options selection */}
                        {checkoutStep === 'shipping_options' && (
                            <>
                                {shippingOptions.length === 0 && !isLoadingOptions ? (
                                    <p className="text-slate-300">No shipping options available for the selected destination. Please try a different country or postal code.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {shippingOptions.map(option => (
                                            <label key={option.level} className="flex items-center text-slate-300 cursor-pointer">
                                                <input type="radio" name="shipping_level" value={option.level} checked={selectedShippingLevel === option.level} onChange={() => setSelectedShippingLevel(option.level)} className="form-radio h-4 w-4 text-green-600" />
                                                <span className="ml-2">
                                                    {option.name} - ${option.costUsd.toFixed(2)} USD (Est. {option.estimatedDeliveryDate || 'N/A'})
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                                <div className="mt-8 flex items-center justify-end space-x-4">
                                    <button type="button" onClick={() => setCheckoutStep('shipping_input')} className="text-slate-400 hover:text-white transition text-lg">Go Back</button>
                                    <button onClick={handleProceedToPayment} disabled={isProcessingCheckout || !selectedShippingLevel} className={`${buttonClasses} text-lg`}>
                                        {isProcessingCheckout ? 'Processing...' : 'Proceed to Payment'}
                                    </button>
                                </div>
                                {/* MODIFIED: Simplified price display for end-user */}
                                {currentTotalDisplayPrice !== null && (
                                    <p className="text-lg font-bold text-white mt-4 text-center">
                                        Total Estimated Price: ${currentTotalDisplayPrice.toFixed(2)} USD
                                        {quoteDetails?.expires_at && (
                                            <span className="block text-sm text-slate-400 font-normal">
                                                Quote valid until: {new Date(quoteDetails.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                            </span>
                                        )}
                                    </p>
                                )}
                            </>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};


// --- Sub-component: FauxReview ---
const FauxReview = ({ quote, author, avatar }) => (
    <div className="bg-slate-800/60 backdrop-blur-md p-7 rounded-2xl shadow-xl border border-slate-700 hover:border-indigo-600 transition-colors duration-200">
        <p className="text-slate-200 italic text-xl leading-relaxed mb-4">"{quote}"</p>
        <div className="flex items-center">
            <img src={avatar} alt={author} className="w-12 h-12 rounded-full mr-4 object-cover border-2 border-amber-400" />
            <span className="font-semibold text-amber-300 text-lg">{author}</span>
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

    const [bookId, setBookId] = useState(paramBookId && paramBookId !== 'new' ? paramBookId : null);
    const [bookDetails, setBookDetails] = useState(null);
    const [chapters, setChapters] = useState([]);
    const [openChapter, setOpenChapter] = useState(null);
    const [isLoadingPage, setIsLoadingPage] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isStoryComplete, setIsStoryComplete] = useState(false);
    const [isCheckoutModalOpen, setCheckoutModalOpen] = useState(false);

    const { data: allBookOptions, isLoading: isLoadingBookOptions, isError: isErrorBookOptions } = useQuery({
        queryKey: ['allBookOptions'], queryFn: fetchBookOptions, staleTime: Infinity, enabled: true,
    });
    const [selectedProductForNew, setSelectedProductForNew] = useState(null);

    useEffect(() => {
        setError(null);
        if (paramBookId && paramBookId !== 'new') {
            if (!bookDetails || (bookDetails.id && bookDetails.id !== paramBookId)) {
                setIsLoadingPage(true);
                apiClient.get(`/text-books/${paramBookId}`).then((res) => {
                    const bookData = res.data.book;
                    const fetchedChapters = res.data.chapters || [];
                    setBookDetails(bookData);
                    setChapters(fetchedChapters);
                    setBookId(paramBookId);
                    setIsStoryComplete(fetchedChapters.length >= (bookData.total_chapters || 1));
                    setOpenChapter(fetchedChapters.length > 0 ? fetchedChapters[fetchedChapters.length - 1].chapter_number : null);
                    const product = allBookOptions?.find((p) => p.id === bookData.lulu_product_id);
                    if (product) {
                        setSelectedProductForNew(product);
                    } else {
                        setSelectedProductForNew({
                            id: bookData.lulu_product_id,
                            name: bookData.title || 'Unknown Product',
                            type: 'textBook',
                            price: 0,
                            defaultPageCount: bookData.prompt_details?.pageCount || 66,
                            defaultWordsPerPage: bookData.prompt_details?.wordsPerPage || 250,
                            totalChapters: bookData.total_chapters || 6
                        });
                    }
                    setIsLoadingPage(false);
                }).catch((err) => {
                    console.error('NovelPage useEffect: Error loading existing book details:', err);
                    setError(err.response?.data?.message || 'Could not load your project.');
                    setIsLoadingPage(false);
                });
            } else {
                setIsLoadingPage(false);
            }
        }
        else if (paramBookId === 'new' || !paramBookId) {
            if (bookDetails) { setIsLoadingPage(false); return; }
            if (allBookOptions && location.state?.selectedProductId && !selectedProductForNew) {
                const product = allBookOptions.find((p) => p.id === location.state.selectedProductId);
                if (product) {
                    setSelectedProductForNew(product);
                    setIsLoadingPage(false);
                } else {
                    setError('Invalid book format selected. Please go back and choose a format.');
                    setIsLoadingPage(false);
                }
            } else if (selectedProductForNew && isLoadingPage) {
                setIsLoadingPage(false);
            } else if (!selectedProductForNew && !location.state?.selectedProductId && !isLoadingBookOptions && isLoadingPage) {
                setError('To create a new novel, please select a book format first.');
                setIsLoadingPage(false);
            }
        }
        else if (isLoadingPage) {
            setIsLoadingPage(false);
        }
    }, [paramBookId, allBookOptions, isLoadingBookOptions, location.state?.selectedProductId, bookDetails, selectedProductForNew, isLoadingPage]);

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
            setBookDetails(response.data.bookDetails || {
                title: bookData.title,
                lulu_product_id: bookData.luluProductId,
                prompt_details: promptDetails,
                total_chapters: aiGenerationParams.totalChapters,
            });
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
        setCheckoutModalOpen(true);
    };

    const submitFinalCheckout = async (shippingAddress, selectedShippingLevel, quoteToken) => {
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
            setError(detailedError || err.response?.data?.message || 'Could not proceed to checkout. Please try again.');
            setCheckoutModalOpen(false);
        }
    };

    if (error) { return <Alert type="error" message={error} onClose={() => setError(null)} />; }
    if (isErrorBookOptions) { return <Alert type="error" message="Could not load book options." />; }
    if (isLoadingPage || isLoadingBookOptions) { return <LoadingSpinner text="Getting your book ready..." />; }

    if ((paramBookId === 'new' || !paramBookId) && selectedProductForNew && !bookDetails) {
        return <PromptForm isLoading={isActionLoading} onSubmit={handleCreateBook} productName={selectedProductForNew?.name || 'Novel'} />;
    }

    if (bookId && bookDetails) {
        const totalChaptersToDisplay = bookDetails.total_chapters || selectedProductForNew?.totalChapters || 1;
        return (
            <>
                <CheckoutModal
                    isOpen={isCheckoutModalOpen}
                    onClose={() => setCheckoutModalOpen(false)}
                    onSubmit={submitFinalCheckout}
                    bookId={bookId}
                    bookType="textBook"
                />
                <div className="fade-in min-h-screen bg-gradient-to-br from-slate-900 to-gray-950 py-12 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-slate-800/50 backdrop-blur-md p-8 md:p-14 rounded-3xl shadow-2xl border border-slate-700">
                            <div className="text-center mb-12">
                                <h1 className="text-4xl md:text-5xl font-extrabold font-serif text-white leading-tight">{bookDetails?.title}</h1>
                                <p className="text-xl text-slate-400 mt-4 font-light">Your personalized story</p>
                            </div>
                            <div className="space-y-3">
                                {chapters.map((chapter) => (
                                    <Chapter key={chapter.chapter_number} chapter={chapter} isOpen={openChapter === chapter.chapter_number} onToggle={() => handleToggleChapter(chapter.chapter_number)} />
                                ))}
                            </div>
                            {isActionLoading && (
                                <div className="mt-10"><LoadingSpinner text={`Generating Chapter ${chapters.length + 1}...`} /></div>
                            )}
                            <div className="mt-14 border-t border-dashed border-slate-600 pt-10 text-center">
                                {!isStoryComplete ? (
                                    <button onClick={handleGenerateNextChapter} disabled={isActionLoading} className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-indigo-700 disabled:bg-slate-500 disabled:cursor-not-allowed transition-transform transform hover:scale-105 shadow-lg text-lg">
                                        {isActionLoading ? 'Writing...' : `Continue Story (${chapters.length}/${totalChaptersToDisplay})`}
                                    </button>
                                ) : (
                                    <div>
                                        <p className="text-2xl text-green-400 font-bold mb-5 leading-relaxed">Your story is complete! Ready to bring it to life?</p>
                                        <button onClick={handleFinalizeAndPurchase} disabled={isActionLoading} className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-transform transform hover:scale-105 shadow-lg text-lg">
                                            {isActionLoading ? 'Preparing Checkout...' : 'Finalize & Purchase'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="mt-20 max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                            <FauxReview quote="A heartwarming tale my whole family enjoyed. The personalized details made it truly special!" author="Jane D." avatar="/avatars/jane.jpg" />
                            <FauxReview quote="This book truly captured my son's imagination. He loves being the main character!" author="Mike S." avatar="/avatars/mike.jpg" />
                            <FauxReview quote="Incredible story, perfect for kids who love adventure! A unique gift idea." author="Sarah P." avatar="/avatars/sarah.jpg" />
                        </div>
                    </div>
                </div>
            </>
        );
    }
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-gray-950 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 text-center">
            <Alert type="info" message="To create a new novel, please select a book format first." />
            <button onClick={() => navigate('/select-novel')} className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-transform transform hover:scale-105">
                Back to Selection
            </button>
        </div>
    );
}

export default NovelPage;