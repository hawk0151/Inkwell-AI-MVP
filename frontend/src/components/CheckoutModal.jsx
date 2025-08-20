import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client'; // FIX: Import Socket.IO client
import apiClient from '../services/apiClient';
import { LoadingSpinner, Alert } from './common.jsx';

const COUNTRIES = [
    { code: 'US', name: 'United States', stateRequired: true },
    { code: 'AU', name: 'Australia', stateRequired: true },
    { code: 'GB', name: 'United Kingdom', stateRequired: false },
    { code: 'CA', name: 'Canada', stateRequired: true },
    { code: 'MX', name: 'Mexico', stateRequired: false },
    { code: 'NZ', name: 'New Zealand', stateRequired: false },
];

const CheckoutModal = ({ isOpen, onClose, bookId, bookType, onSubmit, book }) => {
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
    const [loadingMessage, setLoadingMessage] = useState('');

    const inputClasses = "w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-green-500";
    const buttonClasses = "bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 disabled:bg-green-300 transition";

    // FIX: useEffect to handle the WebSocket connection lifecycle.
    useEffect(() => {
        if (!isProcessingCheckout) {
            return;
        }

        // Connect to the WebSocket server. Use your actual backend URL in production.
        const socket = io(process.env.NODE_ENV === 'production' ? 'https://your-backend-url.com' : 'http://localhost:5001');

        socket.on('connect', () => {
            console.log('[Socket.IO] Connected to server with ID:', socket.id);
            // Join a room specific to this book to only receive relevant updates.
            socket.emit('join_room', bookId);
        });

        // Listen for progress updates from the backend.
        socket.on('checkout_progress', (data) => {
            if (data.error) {
                setModalError(data.error);
                setLoadingMessage('An error occurred...'); // Set a generic error message
            } else {
                const progressMessage = `(Step ${data.step}/${data.totalSteps}) ${data.message}`;
                setLoadingMessage(progressMessage);
            }
        });

        socket.on('disconnect', () => {
            console.log('[Socket.IO] Disconnected from server.');
        });

        // Cleanup function: This runs when the modal closes or the process ends.
        return () => {
            console.log('[Socket.IO] Disconnecting socket...');
            socket.disconnect();
        };
    }, [isProcessingCheckout, bookId]); // This effect only runs when the checkout process starts/stops.


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
        setLoadingMessage('Getting shipping options...');
        setShippingOptions([]);
        setSelectedShippingLevel(null);
        setQuoteDetails(null);
        
        try {
            const response = await apiClient.post('/shipping/quotes', {
                bookId,
                bookType,
                shippingAddress,
            });

            const options = response.data.shipping_options || [];
            setShippingOptions(options);

            setQuoteDetails({
                quote_token: response.data.quote_token,
                expires_at: response.data.expires_at,
                base_product_price_aud: response.data.base_product_price_aud, 
                currency: response.data.currency,
            });

            if (options.length > 0) {
                const cheapest = options.reduce((min, current) => (current.cost < min.cost ? current : min));
                setSelectedShippingLevel(cheapest.level);
            }
            setCheckoutStep('shipping_options');
        } catch (err) {
            console.error("Error fetching shipping quotes:", err.response?.data || err);
            setModalError(err.response?.data?.message || "Failed to fetch shipping options. Please check the address and try again.");
            setShippingOptions([]);
        } finally {
            setIsLoadingOptions(false);
            setLoadingMessage('');
        }
    }, [bookId, bookType, shippingAddress]);

    const handleGetOptions = async (e) => {
        e.preventDefault();
        setModalError(null);
        const isValid = validateFullAddressForm();
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
        // Set an initial message before WebSocket takes over
        setLoadingMessage('Starting secure checkout...'); 
        try {
            const finalShippingOption = shippingOptions.find(opt => opt.level === selectedShippingLevel);
            if (!finalShippingOption || !quoteDetails || !quoteDetails.quote_token) {
                throw new Error("Missing shipping option details or quote token for checkout.");
            }
            // The onSubmit function will now trigger the backend process,
            // and our useEffect hook will listen for the progress.
            await onSubmit(shippingAddress, selectedShippingLevel, quoteDetails.quote_token);
        } catch (err) {
            console.error('handleProceedToPayment: Could not proceed to checkout:', err);
            setModalError(err.response?.data?.detailedError || err.response?.data?.message || 'Could not proceed to checkout. Please try again.');
            setIsProcessingCheckout(false); // Make sure to turn off processing on error
            setLoadingMessage('');
        }
        // We no longer set isProcessingCheckout to false in a finally block here,
        // as the parent component will handle closing the modal on success, which triggers the cleanup.
    };

    const getDisplayPrice = () => {
        if (!quoteDetails) return null;
        const selectedOption = shippingOptions.find(opt => opt.level === selectedShippingLevel);
        const totalShippingCost = selectedOption ? selectedOption.cost : 0;
        const totalPrice = (quoteDetails.base_product_price_aud || book.price) + totalShippingCost;
        return totalPrice;
    };
    const currentTotalDisplayPrice = getDisplayPrice();
    
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
                    <motion.div initial={{ scale: 0.9, y: -20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                                className="bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 w-full max-w-md p-8 overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        
                        <h2 className="text-3xl font-bold text-white mb-4">
                            {checkoutStep === 'shipping_input' ? 'Enter Shipping Details' : 'Select Shipping Option'}
                        </h2>
                        <p className="text-slate-300 mb-6 text-base">
                            {checkoutStep === 'shipping_input' ? 'These details are used to get an accurate shipping quote.' : 'Choose a shipping method. Prices are estimates and finalized at checkout.'}
                        </p>
                        
                        {modalError && <Alert type="error" message={modalError} onClose={() => setModalError(null)} className="mb-4" />}
                        
                        {/* The LoadingSpinner will now show the dynamic message from our state */}
                        {isLoadingOptions && <LoadingSpinner text={loadingMessage} className="my-4" />}
                        {isProcessingCheckout && <LoadingSpinner text={loadingMessage} className="my-4" />}
                        
                        {checkoutStep === 'shipping_input' && !isLoadingOptions && (
                            <form onSubmit={handleGetOptions} className="space-y-5">
                                {/* The form JSX remains unchanged */}
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
                                    <div className="md:col-span-2">
                                        <label htmlFor="street1" className="block text-sm font-medium text-slate-300 mb-1">Street Address 1</label>
                                        <input type="text" id="street1" name="street1" value={shippingAddress.street1} onChange={handleFullAddressChange} placeholder="123 Main St" required className={inputClasses} />
                                        {formErrors.street1 && <p className="text-red-400 text-xs mt-1">{formErrors.street1}</p>}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label htmlFor="street2" className="block text-sm font-medium text-slate-300 mb-1">Street Address 2 (Optional)</label>
                                        <input type="text" id="street2" name="street2" value={shippingAddress.street2} onChange={handleFullAddressChange} placeholder="Apt 4B" className={inputClasses} />
                                    </div>
                                    <div>
                                        <label htmlFor="city" className="block text-sm font-medium text-slate-300 mb-1">City</label>
                                        <input type="text" id="city" name="city" value={shippingAddress.city} onChange={handleFullAddressChange} placeholder="Springfield" required className={inputClasses} />
                                        {formErrors.city && <p className="text-red-400 text-xs mt-1">{formErrors.city}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="state_code" className="block text-sm font-medium text-slate-300 mb-1">State/Province</label>
                                        <input type="text" id="state_code" name="state_code" value={shippingAddress.state_code} onChange={handleFullAddressChange} placeholder="NY" className={inputClasses} />
                                        {formErrors.state_code && <p className="text-red-400 text-xs mt-1">{formErrors.state_code}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="postcode" className="block text-sm font-medium text-slate-300 mb-1">Postal Code</label>
                                        <input type="text" id="postcode" name="postcode" value={shippingAddress.postcode} onChange={handleFullAddressChange} placeholder="12345" required className={inputClasses} />
                                        {formErrors.postcode && <p className="text-red-400 text-xs mt-1">{formErrors.postcode}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="country_code" className="block text-sm font-medium text-slate-300 mb-1">Country</label>
                                        <select id="country_code" name="country_code" value={shippingAddress.country_code} onChange={handleFullAddressChange} required className={inputClasses}>
                                            <option value="">Select a country</option>
                                            {COUNTRIES.map(c => (<option key={c.code} value={c.code}>{c.name}</option>))}
                                        </select>
                                        {formErrors.country_code && <p className="text-red-400 text-xs mt-1">{formErrors.country_code}</p>}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label htmlFor="phone_number" className="block text-sm font-medium text-slate-300 mb-1">Phone Number</label>
                                        <input type="tel" id="phone_number" name="phone_number" value={shippingAddress.phone_number} onChange={handleFullAddressChange} placeholder="555-123-4567" required className={inputClasses} />
                                        {formErrors.phone_number && <p className="text-red-400 text-xs mt-1">{formErrors.phone_number}</p>}
                                    </div>
                                </div>
                                <div className="mt-6 flex items-center justify-end space-x-4">
                                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-white transition text-lg">Cancel</button>
                                    <button type="submit" disabled={isLoadingOptions || !isShippingFormComplete()} className={`${buttonClasses} text-lg`}>
                                        {isLoadingOptions ? 'Getting Options...' : 'Get Shipping Options'}
                                    </button>
                                </div>
                            </form>
                        )}
                        
                        {checkoutStep === 'shipping_options' && !isProcessingCheckout && (
                            <>
                                {shippingOptions.length === 0 && !isLoadingOptions ? (
                                    <p className="text-slate-300">No shipping options available for the selected destination. Please try a different address.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {shippingOptions.map(option => (
                                            <label key={option.level} className="flex items-center p-3 border-2 border-slate-700 rounded-lg cursor-pointer transition-all hover:border-green-500 has-[:checked]:border-green-500 has-[:checked]:bg-green-900/20">
                                                <input type="radio" name="shipping_level" value={option.level} checked={selectedShippingLevel === option.level} onChange={() => setSelectedShippingLevel(option.level)} className="form-radio h-5 w-5 text-green-600 bg-slate-600 border-slate-500 focus:ring-green-500" />
                                                <span className="ml-3 flex-grow text-slate-200">
                                                    {option.name}
                                                    <span className="block text-xs text-slate-400">Est. Delivery: {option.estimatedDeliveryDate || 'N/A'}</span>
                                                </span>
                                                <span className="font-semibold text-white">${option.cost.toFixed(2)}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                                <div className="mt-8 flex items-center justify-between space-x-4">
                                    <button type="button" onClick={() => setCheckoutStep('shipping_input')} className="text-slate-400 hover:text-white transition text-lg">Go Back</button>
                                    <button onClick={handleProceedToPayment} disabled={isProcessingCheckout || !selectedShippingLevel} className={`${buttonClasses} text-lg`}>
                                        {isProcessingCheckout ? 'Processing...' : 'Proceed to Payment'}
                                    </button>
                                </div>
                                
                                {currentTotalDisplayPrice !== null && (
                                    <div className="mt-6 border-t border-slate-700 pt-4">
                                        <div className="flex justify-between items-center text-slate-300">
                                            <span>Base Price:</span>
                                            <span>${(quoteDetails.base_product_price_aud || book.price).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-slate-300">
                                            <span>Shipping:</span>
                                            <span>${(shippingOptions.find(opt => opt.level === selectedShippingLevel)?.cost || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xl font-bold text-white mt-2">
                                            <span>Total Price (AUD):</span>
                                            <span>${currentTotalDisplayPrice.toFixed(2)}</span>
                                        </div>
                                        {quoteDetails?.expires_at && (
                                            <p className="text-center text-xs text-slate-500 mt-2">
                                                Quote valid until: {new Date(quoteDetails.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default CheckoutModal;