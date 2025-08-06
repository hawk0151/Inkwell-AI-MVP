import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner, Alert } from '../components/common.jsx';
import CheckoutModal from '../components/CheckoutModal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PromptForm from '../components/PromptForm.jsx';

// --- Sub-component: Chapter ---
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
                        <div className="prose prose-lg lg:prose-xl max-w-none text-slate-300 prose-p:text-slate-300 prose-p:mb-5 pt-4 pb-8 px-4 font-light leading-relaxed">
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

// --- Sub-component: FauxReview ---
const FauxReview = ({ quote, author, avatar }) => (
    <div className="bg-slate-800/60 backdrop-blur-md p-7 rounded-2xl shadow-xl border border-slate-700 hover:border-indigo-600/50 transition-colors duration-200">
        <p className="text-slate-300 italic text-xl leading-relaxed mb-4">"{quote}"</p>
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
                            id: bookData.lulu_product_id, name: bookData.title || 'Unknown Product', type: 'textBook', price: 0,
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
            setError('Internal error: Book format not selected. Please try again from selection page.');
            setIsActionLoading(false);
            return;
        }
        
        const { title, ...promptDetails } = formData;
        
        const aiGenerationParams = {
            // --- THIS IS THE FIX ---
            maxPageCount: selectedProductForNew.defaultPageCount,
            wordsPerPage: selectedProductForNew.defaultWordsPerPage,
            totalChapters: selectedProductForNew.totalChapters,
        };
        
        const bookData = { title, promptDetails: { ...promptDetails, ...aiGenerationParams }, luluProductId: selectedProductForNew.id };

        try {
            const response = await apiClient.post('/text-books', bookData);
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            navigate(`/novel/${response.data.bookId}`, { replace: true });
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
            setChapters((prev) => {
                const updatedChapters = [...prev, newChapterData];
                setIsStoryComplete(updatedChapters.length >= (bookDetails?.total_chapters || 1));
                return updatedChapters;
            });
            setOpenChapter(newChapterData.chapter_number);
        } catch (err) {
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
            throw err;
        }
    };

    if (error) { return <Alert type="error" message={error} onClose={() => setError(null)} />; }
    if (isLoadingPage || isLoadingBookOptions) { return <LoadingSpinner text="Getting your book ready..." />; }

    return (
        <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
            {(paramBookId === 'new' || !paramBookId) && selectedProductForNew && !bookDetails ? (
                <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                    <PageHeader 
                        title={`Create Your ${selectedProductForNew?.name || 'Novel'}`}
                        subtitle="Fill in the details below to begin the magic."
                    />
                    <PromptForm isLoading={isActionLoading} onSubmit={handleCreateBook} />
                </div>
            ) : bookId && bookDetails ? (
                <>
                    <CheckoutModal isOpen={isCheckoutModalOpen} onClose={() => setCheckoutModalOpen(false)} onSubmit={submitFinalCheckout} bookId={bookId} bookType="textBook" book={bookDetails} />
                    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                        <PageHeader 
                            title={bookDetails?.title}
                            subtitle="Your personalized story"
                        />
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="bg-slate-800/50 backdrop-blur-md p-8 md:p-14 rounded-2xl shadow-2xl border border-slate-700"
                        >
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
                                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleGenerateNextChapter} disabled={isActionLoading} className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-indigo-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition-all duration-300 shadow-lg text-lg">
                                        {isActionLoading ? 'Writing...' : `Continue Story (${chapters.length}/${bookDetails.total_chapters || 1})`}
                                    </motion.button>
                                ) : (
                                    <div>
                                        <p className="text-2xl text-green-400 font-bold mb-5">Your story is complete! Ready to bring it to life?</p>
                                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleFinalizeAndPurchase} disabled={isActionLoading} className="bg-teal-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-teal-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition-all duration-300 shadow-lg text-lg">
                                            {isActionLoading ? 'Preparing...' : 'Finalize & Purchase'}
                                        </motion.button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                        <div className="mt-20 max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                            <FauxReview quote="A heartwarming tale my whole family enjoyed. The personalized details made it truly special!" author="Jane D." avatar="/avatars/jane.jpg" />
                            <FauxReview quote="This book truly captured my son's imagination. He loves being the main character!" author="Mike S." avatar="/avatars/mike.jpg" />
                            <FauxReview quote="Incredible story, perfect for kids who love adventure! A unique gift idea." author="Sarah P." avatar="/avatars/sarah.jpg" />
                        </div>
                    </div>
                </>
            ) : (
                <div className="min-h-screen flex flex-col items-center justify-center text-center">
                    <Alert type="info" message="To create a new novel, please select a book format first." />
                    <button onClick={() => navigate('/select-novel')} className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-transform transform hover:scale-105">
                        Back to Selection
                    </button>
                </div>
            )}
        </div>
    );
}

export default NovelPage;