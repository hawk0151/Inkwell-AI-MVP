import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import { LoadingSpinner, Alert, MagicWandIcon } from '../components/common.jsx';

// --- Sub-component: Chapter (Accordion for displaying story chapters) ---
const Chapter = ({ chapter, isOpen, onToggle }) => {
  const ChevronDownIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );

  return (
    <div className="border-b border-slate-700 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex justify-between items-center text-left py-4 px-2 hover:bg-slate-700/50 rounded-lg transition-colors duration-200"
      >
        <h2 className="text-2xl md:text-3xl font-serif text-amber-500 m-0 p-0">Chapter {chapter.chapter_number}</h2>
        <ChevronDownIcon className={`w-6 h-6 text-slate-400 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
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
            <div className="prose prose-lg lg:prose-xl max-w-none text-slate-300 prose-p:text-slate-300 pt-2 pb-6 px-2">
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

  return (
    <div className="fade-in max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold font-serif text-white">
          Create Your <span className="text-amber-500">{productName}</span>
        </h1>
        <p className="text-lg text-slate-400 mt-2">Fill in the details below to begin the magic.</p>
      </div>
      <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-slate-700">
        <form onSubmit={handleSubmit} className="w-full space-y-6">
          {/* Book Title Input */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-slate-300 mb-1">Book Title</label>
            <input
              type="text"
              id="title"
              name="title"
              value={details.title}
              onChange={handleChange}
              placeholder="e.g., The Adventures of Captain Alistair"
              className="w-full p-3 text-base bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition text-white"
              required
            />
          </div>

          {/* Recipient Name Input */}
          <div>
            <label htmlFor="recipientName" className="block text-sm font-medium text-slate-300 mb-1">Who is this book for?</label>
            <input
              type="text"
              id="recipientName"
              name="recipientName"
              value={details.recipientName}
              onChange={handleChange}
              placeholder="e.g., My Dad"
              className="w-full p-3 text-base bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition text-white"
              required
            />
          </div>

          {/* Main Character Name Input */}
          <div>
            <label htmlFor="characterName" className="block text-sm font-medium text-slate-300 mb-1">Main character's name?</label>
            <input
              type="text"
              id="characterName"
              name="characterName"
              value={details.characterName}
              onChange={handleChange}
              placeholder="e.g., Captain Alistair"
              className="w-full p-3 text-base bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition text-white"
              required
            />
          </div>

          {/* Interests Textarea */}
          <div>
            <label htmlFor="interests" className="block text-sm font-medium text-slate-300 mb-1">What do they love?</label>
            <textarea
              id="interests"
              name="interests"
              value={details.interests}
              onChange={handleChange}
              placeholder="e.g., Sailing, classic cars, and the color yellow"
              className="w-full h-24 p-3 text-base bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition text-white"
              required
            />
          </div>

          {/* Genre Select */}
          <div>
            <label htmlFor="genre" className="block text-sm font-medium text-slate-300 mb-1">Choose a genre</label>
            <select
              id="genre"
              name="genre"
              value={details.genre}
              onChange={handleChange}
              className="w-full p-3 text-base bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition text-white"
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
            className="w-full flex items-center justify-center bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 transition-transform transform hover:scale-105 shadow-lg"
          >
            <MagicWandIcon />
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
                            <input name="street1" value={address.street1} onChange={handleChange} placeholder="Street Address" required className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white" />
                            <div className="flex space-x-4">
                                <input name="city" value={address.city} onChange={handleChange} placeholder="City" required className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white" />
                                <input name="postcode" value={address.postcode} onChange={handleChange} placeholder="Postal Code" required className="w-1/2 p-3 bg-slate-700 border border-slate-600 rounded-lg text-white" />
                            </div>
                            <div className="flex space-x-4">
                                <input name="state_code" value={address.state_code} onChange={handleChange} placeholder="State/Province" className="w-1/2 p-3 bg-slate-700 border border-slate-600 rounded-lg text-white" />
                                <select name="country_code" value={address.country_code} onChange={handleChange} required className="w-1/2 p-3 bg-slate-700 border border-slate-600 rounded-lg text-white">
                                    {allowedCountries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                </select>
                            </div>
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

// --- Sub-component: FauxReview ---
const FauxReview = ({ quote, author, avatar }) => (
  <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-slate-700">
    <p className="text-slate-300 italic">"{quote}"</p>
    <div className="flex items-center mt-4">
      <img src={avatar} alt={author} className="w-10 h-10 rounded-full mr-3" />
      <span className="font-semibold text-white">{author}</span>
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
        console.log("NovelPage useEffect triggered. Current state for debug:", {
            paramBookId, bookId, bookDetails: !!bookDetails, chaptersLength: chapters.length, isLoadingPage, isLoadingBookOptions, isErrorBookOptions, error: !!error, selectedProductForNew: !!selectedProductForNew, locationStateSelectedProductId: location.state?.selectedProductId, allBookOptions: !!allBookOptions,
        });
        setError(null);
        if (paramBookId && paramBookId !== 'new') {
            console.log("NovelPage useEffect: Handling existing book load.");
            if (!bookDetails || (bookDetails.id && bookDetails.id !== paramBookId)) {
                setIsLoadingPage(true);
                apiClient.get(`/text-books/${paramBookId}`)
                    .then((res) => {
                        console.log("NovelPage useEffect: Fetched existing book details successfully.");
                        const bookData = res.data.book;
                        const fetchedChapters = res.data.chapters || [];
                        setBookDetails(bookData);
                        setChapters(fetchedChapters);
                        setBookId(paramBookId);
                        setIsStoryComplete(fetchedChapters.length >= (bookData.total_chapters || 1));
                        setOpenChapter(fetchedChapters.length > 0 ? fetchedChapters[fetchedChapters.length - 1].chapter_number : null);
                        const product = allBookOptions?.find((p) => p.id === bookData.luluProductId);
                        if (product) {
                            setSelectedProductForNew(product);
                        } else {
                            console.warn("NovelPage useEffect: Could not find product metadata for existing book. Using stored details as fallback.");
                            setSelectedProductForNew({
                                id: bookData.luluProductId,
                                name: bookData.productName || 'Unknown Product',
                                type: bookData.type || 'textBook',
                                price: bookData.price || 0,
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
                console.log("NovelPage useEffect: Book details already loaded for this ID. Setting isLoadingPage false.");
                setIsLoadingPage(false);
            }
        }
        else if (paramBookId === 'new' || !paramBookId) {
            console.log("NovelPage useEffect: Handling new book creation flow.");
            if (bookDetails) {
                console.log("NovelPage useEffect: Book details already set for new flow. Setting isLoadingPage false and returning.");
                setIsLoadingPage(false);
                return;
            }
            if (allBookOptions && location.state?.selectedProductId && !selectedProductForNew) {
                console.log("NovelPage useEffect: Selected product ID found in state and allBookOptions loaded. Attempting to set selectedProductForNew.");
                const product = allBookOptions.find((p) => p.id === location.state.selectedProductId);
                if (product) {
                    setSelectedProductForNew(product);
                    setIsLoadingPage(false);
                    console.log("NovelPage useEffect: Selected product found. Prompt form ready. isLoadingPage set to false.");
                } else {
                    console.error("NovelPage useEffect: Invalid product ID from location.state. Setting error.");
                    setError('Invalid book format selected. Please go back and choose a format.');
                    setIsLoadingPage(false);
                }
            }
            else if (selectedProductForNew && isLoadingPage) {
                console.log("NovelPage useEffect: selectedProductForNew is already set. Prompt form ready. Setting isLoadingPage false.");
                setIsLoadingPage(false);
            }
            else if (!selectedProductForNew && !location.state?.selectedProductId && !isLoadingBookOptions && isLoadingPage) {
                console.log("NovelPage useEffect: No selected product. Setting error to prompt user to select format.");
                setError('To create a new novel, please select a book format first.');
                setIsLoadingPage(false);
            }
        }
        else if (isLoadingPage) {
            console.log("NovelPage useEffect: Final fallback: Setting isLoadingPage to false as no specific loading task remains.");
            setIsLoadingPage(false);
        }
    }, [
        paramBookId, allBookOptions, isLoadingBookOptions, location.state?.selectedProductId, bookDetails, selectedProductForNew, isLoadingPage, error
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
        console.log("DEBUG handleCreateBook: selectedProductForNew:", selectedProductForNew);
        console.log("DEBUG handleCreateBook: AI params formed:", aiGenerationParams);
        console.log("DEBUG handleCreateBook: Full promptDetails being sent:", promptDetails);
        console.log("DEBUG handleCreateBook: Full bookData being sent to backend:", bookData);
        try {
            const response = await apiClient.post('/text-books', bookData);
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            console.log('DEBUG: Create book response from backend:', response.data);
            setBookId(response.data.bookId);
            setBookDetails(
                response.data.bookDetails || {
                    title: bookData.title,
                    luluProductId: bookData.luluProductId,
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
            // --- MODIFIED FOR DEBUGGING ---
            // Look for the new detailedError field from the backend and display it.
            const detailedError = err.response?.data?.detailedError;
            console.error('DETAILED ERROR FROM BACKEND:', detailedError);
            setError(detailedError || err.response?.data?.message || 'Could not proceed to checkout.');
            // --- END MODIFICATION ---
            setIsCheckingOut(false);
            setIsShippingModalOpen(false);
        }
    };

    console.log("NovelPage render: Final rendering state decision:", {
        error: !!error, isErrorBookOptions, isLoadingPage, isLoadingBookOptions, paramBookId, selectedProductForNew: !!selectedProductForNew, bookDetails: !!bookDetails
    });

    if (error) {
        console.log("NovelPage render: Condition: 'error' is true. Returning Alert.");
        return <Alert title="Error">{error}</Alert>;
    }
    if (isErrorBookOptions) {
        console.log("NovelPage render: Condition: 'isErrorBookOptions' is true. Returning Alert.");
        return <Alert title="Error">Could not load book options.</Alert>;
    }
    if (isLoadingPage || isLoadingBookOptions) {
        console.log("NovelPage render: Condition: 'isLoadingPage' or 'isLoadingBookOptions' is true. Returning LoadingSpinner.");
        return <LoadingSpinner text="Getting your book ready..." />;
    }
    if ((paramBookId === 'new' || !paramBookId) && selectedProductForNew && !bookDetails) {
        console.log("NovelPage render: Condition: New book flow, prompt form ready. Returning PromptForm.");
        return <PromptForm isLoading={isActionLoading} onSubmit={handleCreateBook} productName={selectedProductForNew?.name || 'Novel'} />;
    }

    if (bookId && bookDetails) {
        console.log("NovelPage render: Condition: Book data loaded. Returning Book Content.");
        const totalChaptersToDisplay = bookDetails.total_chapters || selectedProductForNew?.totalChapters || 1;

        return (
            <>
                {/* --- Render the shipping modal here --- */}
                <ShippingAddressForm
                    isOpen={isShippingModalOpen}
                    onClose={() => setIsShippingModalOpen(false)}
                    onSubmit={handleShippingSubmit}
                    isLoading={isCheckingOut}
                />
                <div className="fade-in">
                    <div className="bg-slate-800/50 p-8 md:p-12 rounded-2xl shadow-2xl border border-slate-700">
                        <div className="text-center mb-10">
                            <h1 className="text-4xl md:text-5xl font-bold font-serif text-white">{bookDetails?.title}</h1>
                            <p className="text-lg text-slate-400 mt-2">Your personalized story</p>
                        </div>
                        <div className="space-y-2">
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
                            <div className="mt-8">
                                <LoadingSpinner text={`Generating Chapter ${chapters.length + 1}...`} />
                            </div>
                        )}
                        <div className="mt-12 border-t-2 border-dashed border-slate-700 pt-8 text-center">
                            {!isStoryComplete ? (
                                <button
                                    onClick={handleGenerateNextChapter}
                                    disabled={isActionLoading}
                                    className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 transition"
                                >
                                    {isActionLoading ? 'Writing...' : `Continue Story (${chapters.length}/${totalChaptersToDisplay})`}
                                </button>
                            ) : (
                                <div>
                                    <p className="text-xl text-green-400 font-semibold mb-4">Your story is complete!</p>
                                    <button
                                        onClick={handleFinalizeAndPurchase}
                                        disabled={isCheckingOut}
                                        className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 disabled:bg-green-300 transition"
                                    >
                                        {isCheckingOut ? 'Processing...' : 'Finalize & Purchase'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="mt-20 max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FauxReview
                            quote="A heartwarming tale my whole family enjoyed."
                            author="Jane D."
                            avatar="/avatars/jane.jpg"
                        />
                        <FauxReview
                            quote="This book truly captured my son's imagination."
                            author="Mike S."
                            avatar="/avatars/mike.jpg"
                        />
                        <FauxReview
                            quote="Incredible story, perfect for kids who love adventure!"
                            author="Sarah P."
                            avatar="/avatars/sarah.jpg"
                        />
                    </div>
                </div>
            </>
        );
    }
    console.log("NovelPage render: Hitting final 'return Alert' condition: No valid flow detected.");
    return (
        <div className="text-center py-10">
            <Alert title="Error">To create a new novel, please select a book format first.</Alert>
            <button
                onClick={() => navigate('/select-novel')}
                className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-lg"
            >
                Back to Selection
            </button>
        </div>
    );
}

export default NovelPage;