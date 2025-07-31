import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { useQueryClient, useQuery } from '@tanstack/react-query';
// MODIFIED: Import motion and AnimatePresence for animations
import { motion, AnimatePresence } from 'framer-motion';

import { LoadingSpinner, Alert, MagicWandIcon } from '../components/common.jsx';

// --- Sub-components ---

// NEW: A dedicated component for the collapsible chapter UI
const Chapter = ({ chapter, isOpen, onToggle }) => {
    // Simple chevron icon for the dropdown indicator
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
                {/* Use the existing heading style from the prose class for consistency */}
                <h2 className="text-2xl md:text-3xl font-serif text-amber-500 m-0 p-0">Chapter {chapter.chapter_number}</h2>
                <ChevronDownIcon className={`w-6 h-6 text-slate-400 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1, transition: { height: { duration: 0.4, ease: 'easeInOut' }, opacity: { duration: 0.25, delay: 0.15 } } }}
                        exit={{ height: 0, opacity: 0, transition: { height: { duration: 0.4, ease: 'easeInOut' }, opacity: { duration: 0.25 } } }}
                        className="overflow-hidden"
                    >
                        {/* Re-use the prose class for styling the chapter content */}
                        <div className="prose prose-lg lg:prose-xl max-w-none text-slate-300 prose-p:text-slate-300 pt-2 pb-6 px-2">
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


const PromptForm = ({ isLoading, onSubmit, productName }) => {
    const [details, setDetails] = useState({
        title: '',
        recipientName: '',
        characterName: '',
        interests: '',
        genre: 'Adventure',
    });

    const genres = ['Adventure', 'Fantasy', 'Sci-Fi', 'Mystery', 'Fairy Tale', 'Comedy'];

    const handleChange = (e) =>
        setDetails((prev) => ({ ...prev, [e.target.name]: e.target.value }));

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
                <p className="text-lg text-slate-400 mt-2">
                    Fill in the details below to begin the magic.
                </p>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-slate-700">
                <form onSubmit={handleSubmit} className="w-full space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Book Title</label>
                        <input
                            type="text"
                            name="title"
                            value={details.title}
                            onChange={handleChange}
                            placeholder="e.g., The Adventures of Captain Alistair"
                            className="w-full p-3 text-base bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition text-white"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Who is this book for?</label>
                        <input
                            type="text"
                            name="recipientName"
                            value={details.recipientName}
                            onChange={handleChange}
                            placeholder="e.g., My Dad"
                            className="w-full p-3 text-base bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition text-white"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Main character's name?</label>
                        <input
                            type="text"
                            name="characterName"
                            value={details.characterName}
                            onChange={handleChange}
                            placeholder="e.g., Captain Alistair"
                            className="w-full p-3 text-base bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition text-white"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">What do they love?</label>
                        <textarea
                            name="interests"
                            value={details.interests}
                            onChange={handleChange}
                            placeholder="e.g., Sailing, classic cars, and the color yellow"
                            className="w-full h-24 p-3 text-base bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition text-white"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Choose a genre</label>
                        <select
                            name="genre"
                            value={details.genre}
                            onChange={handleChange}
                            className="w-full p-3 text-base bg-slate-700 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition text-white"
                        >
                            {genres.map((g) => (
                                <option key={g} value={g}>
                                    {g}
                                </option>
                            ))}
                        </select>
                    </div>
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

const FauxReview = ({ quote, author, avatar }) => (
    <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-slate-700">
        <p className="text-slate-300 italic">"{quote}"</p>
        <div className="flex items-center mt-4">
            <img src={avatar} alt={author} className="w-10 h-10 rounded-full mr-3" />
            <span className="font-semibold text-white">{author}</span>
        </div>
    </div>
);

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
    
    // MODIFIED: State to track which chapter is currently expanded
    const [openChapter, setOpenChapter] = useState(null);

    const [isLoadingPage, setIsLoadingPage] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [error, setError] = useState(null);

    const { data: allBookOptions, isLoading: isLoadingBookOptions, isError: isErrorBookOptions } = useQuery({
        queryKey: ['allBookOptions'],
        queryFn: fetchBookOptions,
        staleTime: Infinity,
    });

    const [selectedProductForNew, setSelectedProductForNew] = useState(null);
    
    useEffect(() => {
        if (isLoadingBookOptions) return;

        if (paramBookId) {
            setIsLoadingPage(true);
            apiClient.get(`/text-books/${paramBookId}`)
                .then(detailsRes => {
                    const bookData = detailsRes.data.book;
                    const fetchedChapters = detailsRes.data.chapters;
                    setBookDetails(bookData);
                    setChapters(fetchedChapters);
                    
                    // MODIFIED: Open the latest chapter by default when the book loads
                    if (fetchedChapters.length > 0) {
                        setOpenChapter(fetchedChapters[fetchedChapters.length - 1].chapter_number);
                    }
                    
                    const product = allBookOptions?.find((p) => p.id === bookData.luluProductId);
                    setSelectedProductForNew(product);
                    setBookId(paramBookId);
                    setIsLoadingPage(false);
                })
                .catch(err => {
                    console.error("Error loading existing project:", err);
                    setError("Could not load your project.");
                    setIsLoadingPage(false);
                });
        } else if (location.state?.selectedProductId && !bookId) {
            const product = allBookOptions?.find((p) => p.id === location.state.selectedProductId);
            if (product) {
                setSelectedProductForNew(product);
                setIsLoadingPage(false);
            } else {
                setError("Invalid book format selected. Please go back and choose a format.");
                setIsLoadingPage(false);
            }
        } else {
            setError("To create a new novel, please select a book format first.");
            setIsLoadingPage(false);
        }
    }, [paramBookId, allBookOptions, isLoadingBookOptions, location.state?.selectedProductId]);

    const handleCreateBook = async (formData) => {
        setIsActionLoading(true);
        setError(null);
        const { title, ...promptDetails } = formData;
        
        if (!selectedProductForNew || !selectedProductForNew.id) {
            setError("Internal error: Book format not selected during creation.");
            setIsActionLoading(false);
            return;
        }

        const bookData = { title, promptDetails, luluProductId: selectedProductForNew.id };

        try {
            const response = await apiClient.post('/text-books', bookData);
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            
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
            
            // MODIFIED: Automatically open the new chapter after it's generated
            setOpenChapter(newChapterData.chapter_number);

            if (response.data.isStoryComplete) {
                 console.log("Story generation complete!");
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to generate the next chapter.');
        } finally {
            setIsActionLoading(false);
        }
    };
    
    // NEW: Handler function to open/close chapters
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
    if (isLoadingPage || isLoadingBookOptions) return <LoadingSpinner text="Getting your book ready..." />;
    
    if (error) return <Alert title="Error">{error}</Alert>;
    
    if (isErrorBookOptions) return <Alert title="Error">Could not load book options.</Alert>;

    if (!bookId && !selectedProductForNew) {
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
    
    if (bookId && !bookDetails) {
        return <LoadingSpinner text="Loading book details..." />;
    }

    const currentProduct = bookId ? selectedProductForNew : selectedProductForNew;
    const productName = currentProduct?.name || bookDetails?.productName || 'Novel';
    const totalChapters = bookDetails?.totalChapters || currentProduct?.totalChapters || 1;
    const isStoryComplete = chapters.length >= totalChapters;


    // --- Render PromptForm for New Books, or Story Content for Existing Books ---
    if (!bookId) {
        if (!selectedProductForNew) {
            return <Alert title="Error">Missing book format. Please go back to selection.</Alert>;
        }
        return <PromptForm isLoading={isActionLoading} onSubmit={handleCreateBook} productName={productName} />;
    }

    // If bookId exists (existing book) and bookDetails loaded, render story content
    return (
        <div className="fade-in">
            <div className="bg-slate-800/50 p-8 md:p-12 rounded-2xl shadow-2xl border border-slate-700">
                <div className="text-center mb-10">
                    <h1 className="text-4xl md:text-5xl font-bold font-serif text-white">{bookDetails?.title}</h1>
                    <p className="text-lg text-slate-400 mt-2">Your personalized story</p>
                </div>

                {/* MODIFIED: Replaced the static list with the new collapsible Chapter components */}
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
                            {isActionLoading ? 'Writing...' : `Continue Story (${chapters.length}/${totalChapters})`}
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

export default NovelPage;