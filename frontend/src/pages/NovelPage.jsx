// frontend/src/pages/NovelPage.jsx

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import { LoadingSpinner, Alert, MagicWandIcon } from '../components/common.jsx';

// --- Sub-components (Chapter, PromptForm, FauxReview, fetchBookOptions) remain the same ---

// Helper function to fetch book options (same as in NovelSelectionPage)
const fetchBookOptions = async () => {
    const { data } = await apiClient.get('/products/book-options');
    return data;
};

// --- Main Component ---
function NovelPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { bookId: paramBookId } = useParams();

    const [bookId, setBookId] = useState(paramBookId || null);
    const [bookDetails, setBookDetails] = useState(null);
    const [chapters, setChapters] = useState([]);
    
    const [openChapter, setOpenChapter] = useState(null);

    const [isLoadingPage, setIsLoadingPage] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [error, setError] = useState(null);
    const [isStoryComplete, setIsStoryComplete] = useState(false); 

    const { data: allBookOptions, isLoading: isLoadingBookOptions, isError: isErrorBookOptions } = useQuery({
        queryKey: ['allBookOptions'],
        queryFn: fetchBookOptions,
        staleTime: Infinity,
        enabled: true, // Always fetch product options
    });

    const [selectedProductForNew, setSelectedProductForNew] = useState(null);
    
    useEffect(() => {
        // console.log("DEBUG NovelPage useEffect: Starting useEffect. isLoadingBookOptions:", isLoadingBookOptions, " paramBookId:", paramBookId, " location.state:", location.state, " allBookOptions:", allBookOptions, " bookId:", bookId, " selectedProductForNew:", selectedProductForNew);
        
        // Prevent running if product options are still loading, unless we already have book details
        if (isLoadingBookOptions && !bookDetails) return;

        // Flow for existing book (e.g., from My Projects or direct URL)
        if (paramBookId && !bookDetails) { // Only fetch if we have a paramId and haven't loaded details yet
            setIsLoadingPage(true);
            apiClient.get(`/text-books/${paramBookId}`)
                .then(detailsRes => {
                    const bookData = detailsRes.data.book;
                    const fetchedChapters = detailsRes.data.chapters;
                    setBookDetails(bookData);
                    setChapters(fetchedChapters);
                    // Ensure total_chapters is used from bookData, not the external product config
                    setIsStoryComplete(fetchedChapters.length >= (bookData.total_chapters || 1)); 
                    
                    // --- ADDED DEBUG LOGS ---
                    console.log("DEBUG NovelPage useEffect (Existing Book): bookData fetched:", bookData);
                    console.log("DEBUG NovelPage useEffect (Existing Book): total_chapters from bookData:", bookData?.total_chapters);
                    // --- END ADDED DEBUG LOGS ---

                    if (fetchedChapters.length > 0) {
                        setOpenChapter(fetchedChapters[fetchedChapters.length - 1].chapter_number);
                    }
                    
                    // Even for existing books, try to set selectedProductForNew for consistent productName display
                    const product = allBookOptions?.find((p) => p.id === bookData.luluProductId);
                    if (product) {
                        setSelectedProductForNew(product);
                        // console.log("DEBUG NovelPage useEffect (Existing Book): Product found in allBookOptions:", product);
                    } else {
                        // Fallback for old books or if product metadata not found
                        console.warn("Could not find product metadata for existing book. Using stored details as fallback.");
                        setSelectedProductForNew({
                            id: bookData.luluProductId,
                            name: bookData.productName || 'Unknown Product',
                            type: bookData.type || 'textBook',
                            price: bookData.price || 0,
                            // These AI params should come from bookData.prompt_details for existing books
                            defaultPageCount: bookData.prompt_details?.pageCount || 66,
                            defaultWordsPerPage: bookData.prompt_details?.wordsPerPage || 250,
                            totalChapters: bookData.total_chapters || 6 // Use total_chapters from DB
                        });
                    }
                    setBookId(paramBookId); // Ensure bookId state is set
                    setIsLoadingPage(false);
                })
                .catch(err => {
                    console.error("Error loading existing project:", err);
                    setError(err.response?.data?.message || "Could not load your project.");
                    setIsLoadingPage(false);
                });
        } 
        // Flow for creating a new book (via selection page) - ensure it runs only once to set selectedProductForNew
        else if (location.state?.selectedProductId && !bookId && !selectedProductForNew) {
            // console.log("DEBUG NovelPage useEffect (New Book Flow): selectedProductId from location.state:", location.state.selectedProductId);
            const product = allBookOptions?.find((p) => p.id === location.state.selectedProductId);
            if (product) {
                setSelectedProductForNew(product);
                setIsLoadingPage(false); // Done with initial loading for new book form
            } else {
                setError("Invalid book format selected. Please go back and choose a format.");
                setIsLoadingPage(false);
            }
        } 
        // Initial load for /novel/new without state or param (user directly typed URL)
        else if (!paramBookId && !location.state?.selectedProductId && !selectedProductForNew && isLoadingPage) {
            setError("To create a new novel, please select a book format first.");
            setIsLoadingPage(false);
        } else if (!paramBookId && selectedProductForNew && isLoadingPage) {
            // If we are in new book flow and product is set, but isLoadingPage is still true,
            // set it to false to allow the form to render.
            setIsLoadingPage(false);
        }
    }, [paramBookId, allBookOptions, isLoadingBookOptions, location.state?.selectedProductId, bookId, bookDetails, selectedProductForNew]); // Added bookDetails and selectedProductForNew to dependencies


    const handleCreateBook = async (formData) => {
        setIsActionLoading(true);
        setError(null);
        const { title, ...restOfPromptDetails } = formData;
        
        if (!selectedProductForNew || !selectedProductForNew.id) {
            setError("Internal error: Book format not selected during creation. Please try again from selection page.");
            setIsActionLoading(false);
            return;
        }

        const pageCount = selectedProductForNew.defaultPageCount;
        const wordsPerPage = selectedProductForNew.defaultWordsPerPage;
        const totalChapters = selectedProductForNew.totalChapters; // This comes from backend product config

        if (typeof pageCount === 'undefined' || typeof wordsPerPage === 'undefined' || typeof totalChapters === 'undefined') {
            const missing = [];
            if (typeof pageCount === 'undefined') missing.push('pageCount');
            if (typeof wordsPerPage === 'undefined') missing.push('wordsPerPage');
            if (typeof totalChapters === 'undefined') missing.push('totalChapters');
            const errorMessage = `Missing AI generation parameters for selected product: ${missing.join(', ')}. Please check backend LULU_PRODUCT_CONFIGURATIONS.`;
            console.error("ERROR:", errorMessage, selectedProductForNew);
            setError(errorMessage);
            setIsActionLoading(false);
            return;
        }
        
        const aiGenerationParams = {
            pageCount: pageCount,
            wordsPerPage: wordsPerPage,
            totalChapters: totalChapters
        };

        const promptDetails = { ...restOfPromptDetails, ...aiGenerationParams };

        const bookData = { title, promptDetails, luluProductId: selectedProductForNew.id };

        console.log("DEBUG handleCreateBook: selectedProductForNew:", selectedProductForNew);
        console.log("DEBUG handleCreateBook: AI params formed:", aiGenerationParams);
        console.log("DEBUG handleCreateBook: Full promptDetails being sent:", promptDetails);
        console.log("DEBUG handleCreateBook: Full bookData being sent to backend:", bookData);

        try {
            const response = await apiClient.post('/text-books', bookData);
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            
            // --- FIX FOR CHAPTER 0/10 ISSUE & PROMPT FORM BYPASS ---
            setBookId(response.data.bookId); 
            // The bookDetails from response.data.bookDetails should now contain total_chapters
            setBookDetails(response.data.bookDetails || { 
                title: bookData.title, 
                luluProductId: bookData.luluProductId,
                prompt_details: promptDetails, // Store promptDetails in bookDetails for future use
                total_chapters: totalChapters // Ensure this is set correctly
            }); 
            setChapters([{ chapter_number: 1, content: response.data.firstChapter }]); 
            setOpenChapter(1); 
            setIsStoryComplete(1 >= totalChapters); // Update completion status for the very first chapter
            // --- END FIX ---

            navigate(`/novel/${response.data.bookId}`, {
                replace: true,
            });
        } catch (err) {
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
            setChapters((prev) => [...prev, newChapterData]);
            
            setOpenChapter(newChapterData.chapter_number);

            // Use the updated chapters length and bookDetails total_chapters for accuracy
            setIsStoryComplete((chapters.length + 1) >= (bookDetails?.total_chapters || 1)); 

            if (response.data.isStoryComplete) {
                   console.log("Story generation complete!");
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to generate the next chapter.');
        } finally {
            setIsActionLoading(false);
        }
    };
    
    const handleToggleChapter = (chapterNumber) => {
        setOpenChapter(openChapter === chapterNumber ? null : chapterNumber);
    };

    const handleFinalizeAndPurchase = async () => {
        setIsCheckingOut(true);
        setError(null);
        try {
            const response = await apiClient.post(`/text-books/${bookId}/checkout`);
            window.location.href = response.data.url;
        } catch (err) {
            setError(err.response?.data?.message || 'Could not proceed to checkout.');
            setIsCheckingOut(false);
        }
    };

    // --- Conditional Rendering Logic for Loading & Errors ---
    if (isLoadingPage || isLoadingBookOptions) {
        return <LoadingSpinner text="Getting your book ready..." />;
    }
    
    if (error) {
        return (
            <Alert title="Error">{error}</Alert>
        );
    }
    
    if (isErrorBookOptions) {
        return <Alert title="Error">Could not load book options.</Alert>;
    }

    // New Book Creation Flow: Show PromptForm
    // This condition means: we are on /novel/new (no bookId in URL)
    // AND a product has been successfully selected (selectedProductForNew is populated)
    if (!bookId && selectedProductForNew) { 
        return (
            <PromptForm
                isLoading={isActionLoading}
                onSubmit={handleCreateBook}
                productName={selectedProductForNew?.name || 'Novel'}
            />
        );
    }
    
    // Existing Book or Newly Created Book Flow: Show Book Content
    // This condition means: we have a bookId (either from URL or set after creation)
    // AND we have successfully loaded its details (bookDetails)
    if (bookId && bookDetails) {
        // Use bookDetails.total_chapters as the source of truth for total chapters
        const totalChaptersToDisplay = bookDetails.total_chapters || selectedProductForNew?.totalChapters || 1;
        const productNameToDisplay = selectedProductForNew?.name || bookDetails.productName || 'Novel';

        return (
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

                    {isActionLoading && <div className="mt-8"><LoadingSpinner text={`Generating Chapter ${chapters.length + 1}...`} /></div>}

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

                <div className="mt-20">
                    <h3 className="text-2xl font-bold font-serif text-center text-slate-300 mb-8">
                        Loved by Creators Everywhere
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <FauxReview
                            quote="I created a story for my daughter's birthday and she was absolutely thrilled. Seeing her name in a real book was magical!"
                            author="Sarah J."
                            avatar="https://randomuser.me/api/portraits/women/44.jpg"
                        />
                        <FauxReview
                            quote="The AI is surprisingly creative. It took my simple ideas and wove them into a compelling narrative that I couldn't have written myself."
                            author="Mark T."
                            avatar="https://randomuser.me/api/portraits/men/32.jpg"
                        />
                        <FauxReview
                            quote="From a simple prompt to a beautiful hardcover book delivered to my door. The process was seamless. Highly recommended!"
                            author="Emily R."
                            avatar="https://randomuser.me/api/portraits/women/65.jpg"
                        />
                    </div>
                </div>
            </div>
        );
    }

    // Fallback for cases where neither a new book flow nor an existing book is recognized
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