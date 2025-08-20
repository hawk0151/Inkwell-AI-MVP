import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import ImageEditor from '../components/ImageEditor.jsx';
import { LoadingSpinner, Alert } from '../components/common.jsx';
import CheckoutModal from '../components/CheckoutModal.jsx';
import { StoryBibleModal } from '../components/StoryBibleModal.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftIcon, EyeIcon, PhotoIcon, SparklesIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage.js';

// Cover components remain unchanged
const CoverPreview = ({ coverImageUrl, title, author }) => (
    <div className="w-full aspect-[2/1] rounded-lg shadow-2xl flex bg-slate-800 border border-slate-700 overflow-hidden mb-8">
        <div className="w-1/2 h-full bg-slate-700">
            {coverImageUrl ? (
                <img src={coverImageUrl} alt="Book cover" className="w-full h-full object-cover" />
            ) : (
                <div className="w-1/2 h-full flex flex-col items-center justify-center text-slate-500 p-4">
                    <PhotoIcon className="w-16 h-16" />
                    <p className="text-sm mt-2 text-center">Your cropped image will appear here</p>
                </div>
            )}
        </div>
        <div className="w-1/2 h-full flex flex-col justify-center items-center p-8 text-white text-center">
            <h1 className="text-4xl font-serif font-bold mb-4 break-words">{title || 'Your Title'}</h1>
            <h2 className="text-xl text-slate-300">{author || 'By Author'}</h2>
        </div>
    </div>
);
const CoverCropper = ({ image, onCropComplete, onCancel, crop, zoom, setCrop, setZoom, onConfirm, isConfirmingCrop }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90">
        <div className="relative w-full max-w-2xl h-[500px] bg-slate-900 rounded-lg p-6">
            <div className="relative w-full h-[400px]">
                <Cropper
                    image={image}
                    crop={crop}
                    zoom={zoom}
                    aspect={1 / 2}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                    cropShape="rect"
                    showGrid={true}
                    classes={{ containerClassName: 'bg-slate-800 rounded-lg', mediaClassName: 'object-contain' }}
                />
            </div>
            <div className="flex items-center justify-between mt-4">
                <input
                    type="range"
                    value={zoom}
                    min={1} max={3} step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-2/3 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <button onClick={onCancel} className="px-4 py-2 text-slate-300 hover:text-white transition" disabled={isConfirmingCrop}>Cancel</button>
                <button onClick={onConfirm} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition disabled:bg-slate-500" disabled={isConfirmingCrop}>
                    {isConfirmingCrop ? <LoadingSpinner text="Cropping..." /> : 'Confirm Crop'}
                </button>
            </div>
        </div>
    </div>
);
const CoverUploader = ({ bookId, onUploadSuccess }) => {
    const fileInputRef = useRef(null);
    const [isCropping, setIsCropping] = useState(false);
    const [imageToCrop, setImageToCrop] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [isConfirmingCrop, setIsConfirmingCrop] = useState(false);
    const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => { setCroppedAreaPixels(croppedAreaPixels); }, []);
    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        if (file.size > 9 * 1024 * 1024) {
            toast.error(`File size cannot exceed 9MB.`);
            return;
        }
        const fileUrl = URL.createObjectURL(file);
        setImageToCrop(fileUrl);
        setIsCropping(true);
    };
    const onConfirmCrop = async () => {
        if (!imageToCrop || !croppedAreaPixels) return;
        setIsConfirmingCrop(true);
        try {
            const croppedImageBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
            const formData = new FormData();
            formData.append('image', croppedImageBlob);
            await apiClient.post(`/picture-books/${bookId}/cover`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success('Cover uploaded successfully!');
            onUploadSuccess();
            setIsCropping(false);
            setImageToCrop(null);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to upload cover.');
        } finally {
            setIsConfirmingCrop(false);
        }
    };
    return (
        <div className="flex flex-col items-center gap-4">
            {isCropping && ( <CoverCropper image={imageToCrop} onCropComplete={onCropComplete} onCancel={() => setIsCropping(false)} crop={crop} zoom={zoom} setCrop={setCrop} setZoom={setZoom} onConfirm={onConfirmCrop} isConfirmingCrop={isConfirmingCrop} /> )}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg" className="hidden" />
            <button onClick={() => fileInputRef.current.click()} className="bg-slate-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-500 transition-colors text-sm w-full">Choose Cover Image...</button>
        </div>
    );
};

const useDebouncedEffect = (callback, delay, deps) => {
    const isSavingRef = useRef(false);
    const callbackRef = useRef(callback);
    useEffect(() => { callbackRef.current = callback; }, [callback]);
    useEffect(() => {
        const handler = setTimeout(() => {
            if (deps.every(dep => dep !== undefined) && !isSavingRef.current) {
                isSavingRef.current = true;
                callbackRef.current().finally(() => {
                    isSavingRef.current = false;
                });
            }
        }, delay);
        return () => clearTimeout(handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [delay, ...deps]);
};

const REQUIRED_CONTENT_PAGES = 20;

function PictureBookPage() {
    const { bookId } = useParams();
    const navigate = useNavigate();
    const [book, setBook] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [isCheckoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    
    const [isStoryBibleOpen, setIsStoryBibleOpen] = useState(false);
    const hasAutoOpenedBible = useRef(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const fetchBook = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data } = await apiClient.get(`/picture-books/${bookId}`);
            setBook(data.book);
            
            const fetchedTimeline = data.timeline.length > 0
                ? data.timeline.map(event => ({ ...event, id: event.id || Date.now() + Math.random() }))
                : [{ 
                    id: Date.now(), 
                    page_number: 1, 
                    story_text: '', 
                    image_prompt: '', 
                    image_url: null, 
                    uploaded_image_url: null 
                  }];

            setTimeline(fetchedTimeline);
            setTitle(data.book.title || '');
            setAuthor(data.book.author || '');
            setError(null);
        } catch (err) {
            setError('Failed to load your picture book project.');
        } finally {
            setIsLoading(false);
        }
    }, [bookId]);

    useEffect(() => { fetchBook(); }, [fetchBook]);
    
    useEffect(() => {
        if (book && book.book_status === 'draft' && !hasAutoOpenedBible.current) {
            setIsStoryBibleOpen(true);
            hasAutoOpenedBible.current = true;
        }
    }, [book]);
    
    useDebouncedEffect(() => {
        if (!book || (title === book.title && author === book.author)) return Promise.resolve();
        const saveDetails = async () => {
            try {
                const payload = { 
                    ...(book?.story_bible || {}), 
                    title: title, 
                    author: author 
                };
                await apiClient.post(`/picture-books/${bookId}/story-bible`, payload);
                setBook(prevBook => ({
                    ...prevBook,
                    title: title,
                    author: author,
                    story_bible: payload
                }));
            } catch (err) {
                toast.error("Failed to save title/author.");
            }
        };
        return saveDetails();
    }, 1500, [bookId, title, author, book]);

    const handleFieldChange = (pageIndex, field, value) => {
        setTimeline(prevTimeline => {
            const newTimeline = [...prevTimeline];
            const updatedEvent = { ...(newTimeline[pageIndex] || {}) };
            if (!updatedEvent.page_number) updatedEvent.page_number = pageIndex + 1;
            if (field === 'image_url' && value !== null) updatedEvent['uploaded_image_url'] = null;
            else if (field === 'uploaded_image_url' && value !== null) updatedEvent['image_url'] = null;
            updatedEvent[field] = value;
            newTimeline[pageIndex] = updatedEvent;
            return newTimeline;
        });
    };

    const saveAllTimelineEvents = useCallback(async (currentTimeline) => {
        setIsSaving(true);
        setSaveError(null);
        try {
            await apiClient.post(`/picture-books/${bookId}/events`, { events: currentTimeline });
        } catch (err) {
            setSaveError("Failed to save progress. Please try again.");
            throw err;
        } finally {
            setIsSaving(false);
        }
    }, [bookId]);

    useDebouncedEffect(() => {
        if (!isLoading && timeline.length > 0) {
            return saveAllTimelineEvents(timeline);
        }
        return Promise.resolve();
    }, 2000, [timeline, saveAllTimelineEvents, isLoading]);

    const addPage = () => {
        if (timeline.length >= REQUIRED_CONTENT_PAGES) {
            setError(`You have reached the maximum of ${REQUIRED_CONTENT_PAGES} pages.`);
            return;
        }
        const newPageNumber = timeline.length + 1;
        setTimeline(prevTimeline => [
            ...prevTimeline,
            { id: Date.now(), page_number: newPageNumber, story_text: '', event_date: '', image_url: null, uploaded_image_url: null, overlay_text: '', is_bold_story_text: false }
        ]);
        setCurrentPage(newPageNumber);
    };
    
    const handleDeletePage = () => {
        if (timeline.length <= 1) {
             if (timeline.length === 1 && window.confirm(`Are you sure you want to delete the last page? This will clear the editor.`)) {
                 setTimeline([]);
                 setCurrentPage(1);
             } else {
                 setError("You cannot delete the last page.");
             }
             return;
        }
        if (window.confirm(`Are you sure you want to delete Page ${currentPage}? This action cannot be undone.`)) {
            setTimeline(prevTimeline => {
                const newTimeline = prevTimeline.filter((_, index) => (index + 1) !== currentPage);
                if (currentPage >= prevTimeline.length && currentPage > 1) {
                    setCurrentPage(prev => prev - 1);
                }
                return newTimeline;
            });
        }
    };

    const handleFinalizeAndPurchase = async () => {
        if (timeline.length !== REQUIRED_CONTENT_PAGES) {
            setError(`Your book must have exactly ${REQUIRED_CONTENT_PAGES} pages.`);
            return;
        }
        setIsFinalizing(true);
        const toastId = toast.loading('Step 1/2: Saving final changes...');
        try {
            await saveAllTimelineEvents(timeline);
            toast.loading('Step 2/2: Preparing print images...', { id: toastId });
            await apiClient.post(`/picture-books/${bookId}/prepare-for-print`);
            toast.success('Your book is ready for checkout!', { id: toastId, duration: 4000 });
            setCheckoutModalOpen(true);
        } catch (err) {
            toast.error('Could not prepare your book. Please try again.', { id: toastId });
        } finally {
            setIsFinalizing(false);
        }
    };

    const submitFinalCheckout = async (shippingAddress, selectedShippingLevel, quoteToken) => {
        try {
            const response = await apiClient.post(`/picture-books/${bookId}/checkout`, {
                shippingAddress, selectedShippingLevel, quoteToken,
            });
            window.location.href = response.data.url;
        } catch (err) {
            console.error('Checkout failed:', err);
            throw err;
        }
    };

    const handleModalClose = () => {
        setIsStoryBibleOpen(false);
        fetchBook(); 
    };

    const handleGenerateSinglePage = async (pageNumber, currentPrompt) => {
        setIsGenerating(true);
        const toastId = toast.loading(`Generating image for page ${pageNumber}...`);
        try {
            const response = await apiClient.post(`/picture-books/${bookId}/pages/${pageNumber}/generate`, {
                prompt: currentPrompt
            });
            
            setTimeline(prevTimeline => {
                return prevTimeline.map(event => {
                    if (event.page_number === pageNumber) {
                        return { ...event, image_url: response.data.imageUrl };
                    }
                    return event;
                });
            });

            toast.success(`Image for page ${pageNumber} generated successfully!`, { id: toastId });
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to generate image.';
            toast.error(errorMessage, { id: toastId });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const pagesWithoutImages = timeline.filter(p => p.image_prompt && !p.image_url && !p.uploaded_image_url).length;
    const meetsPageRequirement = timeline.length === REQUIRED_CONTENT_PAGES;

    if (isLoading) return <LoadingSpinner text="Loading your project..." />;
    if (error) return <Alert type="error" message={error} onClose={() => setError(null)} />;
    
    const currentEvent = timeline[currentPage - 1] || {};

    return (
        <>
            <CheckoutModal isOpen={isCheckoutModalOpen} onClose={() => setCheckoutModalOpen(false)} onSubmit={submitFinalCheckout} bookId={bookId} bookType="pictureBook" book={book} />
            
            <StoryBibleModal 
                isOpen={isStoryBibleOpen} 
                onClose={handleModalClose} 
                book={book} 
            />
            
            <div className="min-h-screen bg-slate-900 text-white">
                <div className="max-w-7xl mx-auto py-8 px-4">
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex justify-between items-center mb-8">
                        <Link to="/my-projects" className="flex items-center gap-2 text-slate-300 hover:text-white">
                            <ArrowLeftIcon className="h-5 w-5" /> Back to My Projects
                        </Link>
                        <div className="text-center">
                            <h1 className="text-2xl font-serif font-bold">{title || 'Picture Book Editor'}</h1>
                            {(isSaving) && <div className="text-xs text-blue-400 animate-pulse">Saving...</div>}
                        </div>
                        <button onClick={() => navigate(`/picture-book/${bookId}/preview`)} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 font-semibold py-2 px-4 rounded-lg">
                            <EyeIcon className="h-5 w-5" /> Preview
                        </button>
                    </motion.div>

                    <div className="flex-grow flex flex-col lg:flex-row gap-8">
                        <div className="lg:w-2/3 w-full lg:order-1 order-2">
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                                <CoverPreview coverImageUrl={book?.user_cover_image_url} title={title} author={author} />
                            </motion.div>
                            
                            <ImageEditor 
                                bookId={bookId} 
                                currentEvent={currentEvent} 
                                onImageUpdate={handleFieldChange} 
                                onSave={saveAllTimelineEvents} 
                                timeline={timeline}
                                onGenerate={handleGenerateSinglePage}
                                isGenerating={isGenerating}
                            />
                        </div>

                        <div className="lg:w-1/3 w-full lg:sticky lg:top-8 h-fit lg:order-2 order-1">
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="bg-slate-800/50 p-6 rounded-2xl shadow-lg border border-slate-700">
                                <h3 className="text-2xl font-bold text-center border-b border-slate-700 pb-4 mb-6">Book Settings</h3>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="bookTitle" className="block text-sm font-medium text-slate-300 mb-2">Book Title</label>
                                        <input id="bookTitle" type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                        <label htmlFor="authorName" className="block text-sm font-medium text-slate-300 mb-2">Author Name</label>
                                        <input id="authorName" type="text" value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                    </div>
                                </div>
                                
                                <div className="border-t border-slate-700 pt-6 mt-6">
                                    <h4 className="text-lg font-semibold text-gray-200 mb-4 text-center">Custom Cover</h4>
                                    <CoverUploader bookId={bookId} onUploadSuccess={fetchBook} />
                                </div>

                                <div className="mt-6 pt-6 border-t border-slate-700">
                                    <h4 className="text-lg font-semibold text-gray-200 mb-4 text-center">Page Controls</h4>
                                    
                                    <div className="flex justify-between items-center">
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1 || timeline.length === 0} className="px-4 py-2 bg-slate-700 text-white rounded-md disabled:opacity-50 hover:bg-slate-600 transition">Previous</button>
                                        <span className="text-slate-300">Page {currentPage} / {timeline.length}</span>
                                        <button onClick={() => setCurrentPage(p => Math.min(timeline.length, p + 1))} disabled={currentPage === timeline.length || timeline.length === 0} className="px-4 py-2 bg-slate-700 text-white rounded-md disabled:opacity-50 hover:bg-slate-600 transition">Next</button>
                                    </div>
                                    <div className="flex flex-col space-y-2 mt-4">
                                        <button onClick={addPage} disabled={timeline.length >= REQUIRED_CONTENT_PAGES} className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition shadow-md disabled:bg-slate-500 disabled:cursor-not-allowed">Add New Page</button>
                                        <button onClick={handleDeletePage} disabled={timeline.length === 0} className="w-full px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:bg-red-800 disabled:text-slate-400 transition shadow-md">Delete Current Page</button>
                                    </div>
                                </div>
                                
                                {/* FIX: New section for the relocated button */}
                                <div className="mt-6 pt-6 border-t border-slate-700">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleFinalizeAndPurchase}
                                        disabled={!meetsPageRequirement || isSaving || isFinalizing}
                                        className="w-full bg-teal-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-400 transition-all shadow-lg text-lg"
                                    >
                                        {isFinalizing ? <LoadingSpinner text="Finalizing..." /> : 'Finalize & Purchase'}
                                    </motion.button>
                                    {!meetsPageRequirement && (
                                        <p className="text-sm text-red-400 mt-2 text-center">A book must have exactly {REQUIRED_CONTENT_PAGES} pages. ({timeline.length}/{REQUIRED_CONTENT_PAGES})</p>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default PictureBookPage;