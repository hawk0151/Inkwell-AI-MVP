// frontend/src/pages/NovelPage.jsx

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import { LoadingSpinner, Alert, MagicWandIcon } from '../components/common.jsx';

// --- Sub-components (unchanged) ---
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

const fetchBookOptions = async () => {
  const { data } = await apiClient.get('/products/book-options');
  return data;
};

function NovelPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { bookId: paramBookId } = useParams();

  // This ensures bookId is null for new books, which is correct.
  const [bookId, setBookId] = useState(paramBookId && paramBookId !== 'new' ? paramBookId : null);
  const [bookDetails, setBookDetails] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [openChapter, setOpenChapter] = useState(null);

  const [isLoadingPage, setIsLoadingPage] = useState(true); // Keep true initially
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState(null);
  const [isStoryComplete, setIsStoryComplete] = useState(false);

  const { data: allBookOptions, isLoading: isLoadingBookOptions, isError: isErrorBookOptions } = useQuery({
    queryKey: ['allBookOptions'],
    queryFn: fetchBookOptions,
    staleTime: Infinity,
    enabled: true,
  });

  const [selectedProductForNew, setSelectedProductForNew] = useState(null);

  useEffect(() => {
    // If book options are still loading, wait.
    if (isLoadingBookOptions) return;

    // Case 1: Loading an existing book
    if (paramBookId && paramBookId !== 'new') {
      // Only fetch if bookDetails haven't been loaded yet for this ID
      if (!bookDetails || bookDetails.id !== paramBookId) {
        setIsLoadingPage(true); // Indicate loading for existing book
        apiClient
          .get(`/text-books/${paramBookId}`)
          .then((detailsRes) => {
            const bookData = detailsRes.data.book;
            const fetchedChapters = detailsRes.data.chapters;
            setBookDetails(bookData);
            setChapters(fetchedChapters);
            setIsStoryComplete(fetchedChapters.length >= (bookData.total_chapters || 1));

            if (fetchedChapters.length > 0) {
              setOpenChapter(fetchedChapters[fetchedChapters.length - 1].chapter_number);
            }

            const product = allBookOptions?.find((p) => p.id === bookData.luluProductId);
            if (product) {
              setSelectedProductForNew(product); // Set for display purposes if needed later
            } else {
              setSelectedProductForNew({
                id: bookData.luluProductId,
                name: bookData.productName || 'Unknown Product',
                type: bookData.type || 'textBook',
                price: bookData.price || 0,
                defaultPageCount: bookData.prompt_details?.pageCount || 66,
                wordsPerPage: bookData.prompt_details?.wordsPerPage || 250,
                totalChapters: bookData.total_chapters || 6,
              });
            }
            setBookId(paramBookId);
            setIsLoadingPage(false);
          })
          .catch((err) => {
            console.error('Error loading existing project:', err);
            setError(err.response?.data?.message || 'Could not load your project.');
            setIsLoadingPage(false);
          });
      } else if (bookDetails && isLoadingPage) { // If bookDetails already loaded, just ensure loading is off
        setIsLoadingPage(false);
      }
    }
    // Case 2: New book creation flow (paramBookId is 'new')
    else if (paramBookId === 'new') {
      // Ensure we are NOT showing prompt form if bookDetails are already set (means book was created)
      if (bookDetails) {
        setIsLoadingPage(false);
        return;
      }

      // If we have selectedProductId from location.state and book options are available,
      // AND selectedProductForNew is not yet set.
      if (location.state?.selectedProductId && allBookOptions && !selectedProductForNew) {
        const product = allBookOptions.find((p) => p.id === location.state.selectedProductId);
        if (product) {
          setSelectedProductForNew(product);
          setIsLoadingPage(false); // Ready to show prompt form
        } else {
          setError('Invalid book format selected. Please go back and choose a format.');
          setIsLoadingPage(false);
        }
      }
      // If no selectedProductId in state (e.g., direct /novel/new access), show error.
      else if (!location.state?.selectedProductId && !selectedProductForNew) {
        setError('To create a new novel, please select a book format first.');
        setIsLoadingPage(false);
      }
      // If selectedProductForNew is already set from a previous render, and bookDetails are null,
      // ensure isLoadingPage is false to display the prompt form.
      else if (selectedProductForNew && !bookDetails && isLoadingPage) {
        setIsLoadingPage(false);
      }
    }
    // Fallback: If paramBookId is not 'new' and not an existing ID, show error or redirect
    else if (!paramBookId && !bookId && !location.state?.selectedProductId) {
      setError('To create a new novel, please select a book format first.');
      setIsLoadingPage(false);
    }
    // Final catch-all to turn off loading if data is ready but isLoadingPage is still true.
    else if ((bookId && bookDetails || selectedProductForNew && paramBookId === 'new' && !bookDetails) && isLoadingPage) {
      setIsLoadingPage(false);
    }
  }, [
    paramBookId,
    allBookOptions,
    isLoadingBookOptions,
    location.state?.selectedProductId,
    bookId,
    bookDetails,
    selectedProductForNew,
    isLoadingPage,
  ]);

  const handleCreateBook = async (formData) => {
    setIsActionLoading(true);
    setError(null);
    const { title, ...restOfPromptDetails } = formData;

    if (!selectedProductForNew || !selectedProductForNew.id) {
      setError('Internal error: Book format not selected during creation.');
      setIsActionLoading(false);
      return;
    }

    const aiGenerationParams = {
      pageCount: selectedProductForNew.defaultPageCount,
      wordsPerPage: selectedProductForNew.defaultWordsPerPage,
      totalChapters: selectedProductForNew.totalChapters,
    };

    const promptDetails = { ...restOfPromptDetails, ...aiGenerationParams };
    const bookData = { title, promptDetails, luluProductId: selectedProductForNew.id };

    try {
      const response = await apiClient.post('/text-books', bookData);
      queryClient.invalidateQueries({ queryKey: ['projects'] });

      setBookId(response.data.bookId);
      setBookDetails(
        response.data.bookDetails || {
          title: bookData.title,
          luluProductId: bookData.luluProductId,
          prompt_details: promptDetails,
          total_chapters: aiGenerationParams.totalChapters, // Ensure total_chapters is set from config
        }
      );
      setChapters([{ chapter_number: 1, content: response.data.firstChapter }]);
      setOpenChapter(1);
      setIsStoryComplete(1 >= aiGenerationParams.totalChapters); // Check if story is complete after 1st chapter

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
      setChapters((prev) => [...prev, newChapterData]);
      setOpenChapter(newChapterData.chapter_number);
      setIsStoryComplete(chapters.length + 1 >= (bookDetails?.total_chapters || 1));
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

  // Primary rendering logic
  if (error) return <Alert title="Error">{error}</Alert>;
  if (isErrorBookOptions) return <Alert title="Error">Could not load book options.</Alert>;
  if (isLoadingPage || isLoadingBookOptions) return <LoadingSpinner text="Getting your book ready..." />;


  // Show PromptForm if on /novel/new and have selectedProductForNew but no bookDetails yet
  if (paramBookId === 'new' && selectedProductForNew && !bookDetails) {
    return <PromptForm isLoading={isActionLoading} onSubmit={handleCreateBook} productName={selectedProductForNew?.name || 'Novel'} />;
  }

  // If bookId exists (either existing or newly created) and bookDetails are loaded
  if (bookId && bookDetails) {
    const totalChaptersToDisplay = bookDetails.total_chapters || selectedProductForNew?.totalChapters || 1;

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

        {/* Example reviews or additional content */}
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
    );
  }

  // Fallback if no condition met (should be rare with good state management)
  return null;
}

export default NovelPage;