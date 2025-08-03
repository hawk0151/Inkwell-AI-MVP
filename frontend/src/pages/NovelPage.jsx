// frontend/src/pages/NovelPage.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import { LoadingSpinner, Alert, MagicWandIcon } from '../components/common.jsx';

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

// --- NEW SUB-COMPONENT: ShippingAddressForm ---
const ShippingAddressForm = ({ isOpen, onClose, onSubmit, isLoading }) => {
    const [address, setAddress] = useState({
        name: '',
        street1: '',
        city: '',
        state_code: '',
        postcode: '',
        country_code: 'US', // Default country
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

    const inputClasses = "w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-green-500";
    const buttonClasses = "bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 disabled:bg-green-300 transition";

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" // Darker overlay, more blur
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: -20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        className="bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 w-full max-w-md p-8" // Larger border radius, stronger shadow
                        onClick={(e) => e.stopPropagation()} // Prevent closing modal when clicking inside
                    >
                        <h2 className="text-3xl font-bold text-white mb-4">Enter Shipping Address</h2>
                        <p className="text-slate-300 mb-6 text-base">We need your address to calculate the final price including shipping.</p>
                        <form onSubmit={handleSubmit} className="space-y-5"> {/* Increased space-y */}
                            <input name="name" value={address.name} onChange={handleChange} placeholder="Full Name" required className={inputClasses} />
                            <input name="street1" value={address.street1} onChange={handleChange} placeholder="Street Address" required className={inputClasses} />
                            <div className="flex space-x-4">
                                <input name="city" value={address.city} onChange={handleChange} placeholder="City" required className={inputClasses} />
                                <input name="postcode" value={address.postcode} onChange={handleChange} placeholder="Postal Code" required className={`w-1/2 ${inputClasses}`} />
                            </div>
                            <div className="flex space-x-4">
                                <input name="state_code" value={address.state_code} onChange={handleChange} placeholder="State/Province (Optional)" className={`w-1/2 ${inputClasses}`} />
                                <select name="country_code" value={address.country_code} onChange={handleChange} required className={`w-1/2 ${inputClasses}`}>
                                    {allowedCountries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="pt-6 flex items-center justify-end space-x-4">
                                <button type="button" onClick={onClose} className="text-slate-400 hover:text-white transition text-lg">Cancel</button>
                                <button type="submit" disabled={isLoading} className={`${buttonClasses} text-lg`}>
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
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [error, setError] = useState(null);
    const [isStoryComplete, setIsStoryComplete] = useState(false);

    // --- NEW: State for shipping modal ---
    const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);

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
        setIsShippingModalOpen(true);
    };

    const handleShippingSubmit = async (shippingAddress) => {
        setIsCheckingOut(true);
        setError(null);
        try {
            const response = await apiClient.post(`/text-books/${bookId}/checkout`, { shippingAddress });
            window.location.href = response.data.url;
        } catch (err) {
            console.error('handleShippingSubmit: Could not proceed to checkout:', err);
            const detailedError = err.response?.data?.detailedError;
            console.error('DETAILED ERROR FROM BACKEND:', detailedError);
            setError(detailedError || err.response?.data?.message || 'Could not proceed to checkout.');
            setIsCheckingOut(false);
            setIsShippingModalOpen(false);
        }
    };

    // Main render logic based on component state
    if (error) {
        return <Alert type="error" message={error} />; // Using type prop for consistent alert styling
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
                <ShippingAddressForm
                    isOpen={isShippingModalOpen}
                    onClose={() => setIsShippingModalOpen(false)}
                    onSubmit={handleShippingSubmit}
                    isLoading={isCheckingOut}
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
                                            disabled={isCheckingOut}
                                            className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg 
                                                       hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed 
                                                       transition-transform transform hover:scale-105 shadow-lg text-lg"
                                        >
                                            {isCheckingOut ? 'Processing...' : 'Finalize & Purchase'}
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