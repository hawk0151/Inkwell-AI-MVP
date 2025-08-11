import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner, Alert } from '../components/common.jsx';
import CheckoutModal from '../components/CheckoutModal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PromptWizard from '../components/PromptWizard.jsx';
import { ChevronDownIcon, PhotoIcon, TrashIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage.js'; 
import BackCoverBlurbEditor from '../components/BackCoverBlurbEditor.jsx'; 

// New component for the image cropping interface with loading state
const CoverCropper = ({ image, onCropComplete, onCancel, crop, zoom, setCrop, setZoom, onConfirm, isConfirmingCrop }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90">
        <div className="relative w-full max-w-2xl h-[500px] bg-slate-900 rounded-lg p-6">
            <div className="relative w-full h-[400px]">
                <Cropper
                    image={image}
                    crop={crop}
                    zoom={zoom}
                    aspect={5.25 / 8.25} // Set aspect ratio for the book's front cover
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                    cropShape="rect"
                    showGrid={true}
                    classes={{
                        containerClassName: 'bg-slate-800 rounded-lg',
                        mediaClassName: 'object-contain'
                    }}
                />
            </div>
            <div className="flex items-center justify-between mt-4">
                <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-2/3 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <button onClick={onCancel} className="px-4 py-2 text-slate-300 hover:text-white transition" disabled={isConfirmingCrop}>
                    Cancel
                </button>
                <button onClick={onConfirm} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition disabled:bg-slate-500 disabled:cursor-not-allowed" disabled={isConfirmingCrop}>
                    {isConfirmingCrop ? <LoadingSpinner text="Cropping..." /> : 'Confirm Crop'}
                </button>
            </div>
        </div>
    </div>
);

// MODIFIED: CoverUploader component
const CoverUploader = ({ bookId, currentCoverUrl }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);
    const queryClient = useQueryClient();

    const [isCropping, setIsCropping] = useState(false);
    const [imageToCrop, setImageToCrop] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [isConfirmingCrop, setIsConfirmingCrop] = useState(false);

    const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const uploadMutation = useMutation({
        mutationFn: async (fileData) => {
            const formData = new FormData();
            formData.append('image', fileData);
            return apiClient.post(`/text-books/${bookId}/cover`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        },
        onSuccess: () => {
            toast.success('Cover uploaded successfully!');
            queryClient.invalidateQueries({ queryKey: ['bookDetails', bookId] });
            setSelectedFile(null);
            setPreviewUrl(null);
            setIsCropping(false);
            setCroppedAreaPixels(null);
            setImageToCrop(null);
            setIsConfirmingCrop(false);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to upload cover.');
            setIsConfirmingCrop(false); 
        },
    });

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const MAX_SIZE_MB = 9;
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            setError(`File size cannot exceed ${MAX_SIZE_MB}MB.`);
            return;
        }

        setError('');
        const fileUrl = URL.createObjectURL(file);
        setImageToCrop(fileUrl);
        setIsCropping(true);
    };

    const onConfirmCrop = async () => {
        if (!imageToCrop || !croppedAreaPixels) {
            toast.error("An unexpected error occurred. Please try again.");
            return;
        }
        setIsConfirmingCrop(true);
        try {
            uploadMutation.mutate(await getCroppedImg(imageToCrop, croppedAreaPixels));
        } catch (e) {
            console.error('Error cropping image:', e);
            toast.error('Failed to crop image. Please try again.');
            setIsConfirmingCrop(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Are you sure you want to delete the custom cover? This action cannot be undone.")) {
            return;
        }
        
        try {
            await apiClient.delete(`/text-books/${bookId}/cover`);
            queryClient.invalidateQueries({ queryKey: ['bookDetails', bookId] });
            toast.success("Custom cover deleted successfully.");
        } catch (err) {
            console.error("Error deleting cover:", err);
            toast.error(err.response?.data?.message || "Failed to delete cover.");
        }
    };


    return (
        <div className="flex flex-col items-center gap-4">
            {isCropping && (
                <CoverCropper
                    image={imageToCrop}
                    onCropComplete={onCropComplete}
                    onCancel={() => setIsCropping(false)}
                    crop={crop}
                    zoom={zoom}
                    setCrop={setCrop}
                    setZoom={setZoom}
                    onConfirm={onConfirmCrop}
                    isConfirmingCrop={isConfirmingCrop} 
                />
            )}
            <div className="relative w-48 h-64 rounded-md border-2 border-dashed border-slate-500 flex items-center justify-center bg-slate-800 overflow-hidden">
                {currentCoverUrl ? (
                    <img src={currentCoverUrl} alt="Current book cover" className="w-full h-full object-cover" />
                ) : (
                    <div className="text-center text-slate-500 p-4">
                        <PhotoIcon className="w-12 h-12 mx-auto" />
                        <p className="text-sm mt-2">Upload a Cover</p>
                    </div>
                )}
                {currentCoverUrl && (
                    <button onClick={handleDelete} className="absolute top-2 right-2 p-1 bg-red-600 rounded-full text-white hover:bg-red-500 transition-colors">
                        <TrashIcon className="w-5 h-5" />
                    </button>
                )}
            </div>
            
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png, image/jpeg"
                className="hidden"
            />

            {!currentCoverUrl && !isCropping && (
                <button
                    onClick={() => fileInputRef.current.click()}
                    className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-500 transition-colors w-48"
                >
                    Choose Image
                </button>
            )}
            
            {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        </div>
    );
};

// Chapter component remains unchanged
const Chapter = ({ chapter, isOpen, onToggle, onRegenerate, isLoading, guidance, onGuidanceChange, isLatest }) => {
    const handleRegenerateClick = (e) => {
        e.stopPropagation();
        onRegenerate(chapter.chapter_number, guidance);
    };

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
                        
                        {isLatest && (
                            <div className="px-4 pb-8 pt-4 border-t border-slate-700 flex flex-col items-center">
                                <div className="w-full">
                                    <label htmlFor={`guidance-${chapter.chapter_number}`} className="block text-sm font-medium text-slate-400 mb-2">
                                        Guide your story:
                                    </label>
                                    <textarea
                                        id={`guidance-${chapter.chapter_number}`}
                                        rows="3"
                                        value={guidance}
                                        onChange={(e) => onGuidanceChange(chapter.chapter_number, e.target.value)}
                                        placeholder="e.g., 'Make the main character find a mysterious key.' (Optional)"
                                        className="w-full p-2 bg-slate-700/50 text-slate-100 rounded-md border border-slate-600 focus:ring focus:ring-amber-500 focus:border-amber-500"
                                        disabled={isLoading}
                                    />
                                </div>
                                <button
                                    onClick={handleRegenerateClick}
                                    disabled={isLoading}
                                    className="mt-4 bg-amber-500 text-slate-900 font-bold py-2 px-6 rounded-lg hover:bg-amber-400 disabled:bg-slate-500 disabled:cursor-not-allowed transition-all duration-300"
                                >
                                    {isLoading ? 'Regenerating...' : 'Regenerate Chapter'}
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// fetchBookOptions remains unchanged
const fetchBookOptions = async () => {
    const { data } = await apiClient.get('/products/book-options');
    return data;
};

function NovelPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { bookId: paramBookId } = useParams();
    
    const [openChapter, setOpenChapter] = useState(null);
    const [guidanceInputs, setGuidanceInputs] = useState({});
    const [isPolling, setIsPolling] = useState(false);
    
    const previousChapterCount = useRef(0);

    const { data: bookQueryData, isLoading: isLoadingBookDetails, error: bookQueryError, refetch } = useQuery({
        queryKey: ['bookDetails', paramBookId],
        queryFn: async () => {
            if (!paramBookId || paramBookId === 'new') return null;
            const res = await apiClient.get(`/text-books/${paramBookId}`);
            return res.data;
        },
        enabled: !!paramBookId && paramBookId !== 'new',
    });

    const { data: allBookOptions, isLoading: isLoadingBookOptions } = useQuery({
        queryKey: ['allBookOptions'], queryFn: fetchBookOptions, staleTime: Infinity
    });
    const [selectedProductForNew, setSelectedProductForNew] = useState(null);

    const bookDetails = bookQueryData?.book;
    
    const chapters = bookQueryData?.chapters ? bookQueryData.chapters.filter((chapter, index, self) =>
        index === self.findIndex((c) => (
            c.chapter_number === chapter.chapter_number
        ))
    ) : [];

    const createBookMutation = useMutation({
        mutationFn: (bookData) => apiClient.post('/text-books', bookData),
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: ['allProjects'] });
            navigate(`/novel/${response.data.bookId}`, { 
                replace: true, 
                state: { isNewBook: true } 
            });
        },
        onError: (err) => {
            console.error('Failed to create book:', err);
            toast.error(err.response?.data?.message || 'Failed to create the book.');
        },
    });

    const generateNextChapterMutation = useMutation({
        mutationKey: ['generateNextChapterMutation', paramBookId],
        mutationFn: (bookId) => apiClient.post(`/text-books/${bookId}/generate-next-chapter`),
        onSuccess: () => {
            toast.success('A new chapter is being written...');
            setIsPolling(true);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to submit next chapter generation job.');
            setIsPolling(false);
        },
    });

    const regenerateChapterMutation = useMutation({
        mutationKey: ['regenerateChapterMutation', paramBookId],
        mutationFn: ({ bookId, chapterNumber, guidance }) => apiClient.post(`/text-books/${bookId}/chapters/${chapterNumber}/regenerate`, { guidance }),
        onSuccess: () => {
            toast.success('Regenerating chapter...');
            setIsPolling(true);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to submit chapter regeneration job.');
            setIsPolling(false);
        },
    });
    
    useEffect(() => {
        if (location.state?.isNewBook) {
            toast.success('Your first chapter is being created!');
            setIsPolling(true);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate, location.pathname]);

    useEffect(() => {
        if (!isPolling) return;
        const interval = setInterval(() => {
            console.log('Polling for new chapter data...');
            refetch();
        }, 5000);
        return () => clearInterval(interval);
    }, [isPolling, refetch]);
    
    useEffect(() => {
        if (isPolling && chapters.length > previousChapterCount.current) {
            console.log('New chapter detected. Stopping poll.');
            setIsPolling(false);
            toast.success('Your new chapter has arrived!');
        }
        
        previousChapterCount.current = chapters.length;
    }, [chapters, isPolling]);

    const previewPdfMutation = useMutation({
        mutationFn: (bookId) => apiClient.get(`/text-books/${bookId}/preview`),
        onSuccess: (response) => {
            window.open(response.data.previewUrl, '_blank');
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to generate PDF preview.');
        },
    });
    
    useEffect(() => {
        const isNewBookFlow = !paramBookId || paramBookId === 'new';
        if (isNewBookFlow) {
            if (isLoadingBookOptions) return;
            if (location.state?.selectedProductId) {
                const product = allBookOptions.find((p) => p.id === location.state.selectedProductId);
                if (product) {
                    setSelectedProductForNew(product);
                }
            }
        }
    }, [paramBookId, allBookOptions, isLoadingBookOptions, location.state]);

    const handleGuidanceChange = (chapterNumber, text) => {
        setGuidanceInputs(prev => ({
            ...prev,
            [chapterNumber]: text
        }));
    };

    const handleCreateBook = async (formData) => {
        if (!selectedProductForNew || !selectedProductForNew.id) {
            toast.error('Book format not selected.');
            return;
        }
        const bookData = {
            promptData: formData,
            luluProductId: selectedProductForNew.id
        };
        createBookMutation.mutate(bookData);
    };

    const handleGenerateNextChapter = () => {
        if (bookDetails && !isPolling && !generateNextChapterMutation.isPending) {
            generateNextChapterMutation.mutate(bookDetails.id);
        }
    };
    
    const handleRegenerateChapter = (chapterNumber, guidance) => {
        if (bookDetails && !isPolling && !regenerateChapterMutation.isPending) {
            regenerateChapterMutation.mutate({ bookId: bookDetails.id, chapterNumber, guidance });
        }
    };

    const handleToggleChapter = (chapterNumber) => {
        setOpenChapter(openChapter === chapterNumber ? null : chapterNumber);
    };

    const handlePreviewPdf = () => {
        if (bookDetails) {
            previewPdfMutation.mutate(bookDetails.id);
        }
    };

    const [isCheckoutModalOpen, setCheckoutModalOpen] = useState(false);
    const submitFinalCheckout = async (shippingAddress, selectedShippingLevel, quoteToken) => {
        try {
            const response = await apiClient.post(`/text-books/${paramBookId}/checkout`, {
                shippingAddress,
                selectedShippingLevel,
                quoteToken,
            });
            window.location.href = response.data.url;
        } catch (err) {
            console.error('submitFinalCheckout error:', err);
            throw err;
        }
    };

    const isCreatingBook = createBookMutation.isPending;
    const isAnyMutationPending = generateNextChapterMutation.isPending || regenerateChapterMutation.isPending;
    const isLoadingPage = isLoadingBookDetails || isLoadingBookOptions || isCreatingBook;
    
    const chaptersCount = chapters.length;
    const totalChapters = bookDetails?.total_chapters || 1;
    const isComplete = chaptersCount > 0 && chaptersCount >= totalChapters;
    
    if (isLoadingPage) {
        return <LoadingSpinner text="Loading your masterpiece..." />;
    }

    if (bookQueryError) {
        return (
            <div className="flex flex-col items-center justify-center text-center py-10">
                <Alert type="error" message={bookQueryError.response?.data?.message || 'Could not load project.'} />
                <button onClick={() => navigate('/my-projects')} className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg">
                    Back to Projects
                </button>
            </div>
        );
    }

    if ((!paramBookId || paramBookId === 'new') && selectedProductForNew) {
        return (
            <div className="min-h-screen bg-slate-900 text-white">
                <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                    <PageHeader 
                        title={`Create Your ${selectedProductForNew?.name || 'Novel'}`}
                        subtitle="Fill in the details below to begin the magic."
                    />
                    <PromptWizard isLoading={isCreatingBook} onSubmit={handleCreateBook} />
                </div>
            </div>
        );
    }
    
    if (bookDetails) {
        // MODIFICATION: The entire return statement is restructured into the Workspace + Sidebar layout.
        return (
            <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
                <CheckoutModal isOpen={isCheckoutModalOpen} onClose={() => setCheckoutModalOpen(false)} onSubmit={submitFinalCheckout} bookId={paramBookId} bookType="textBook" book={bookDetails} />
                
                {/* MODIFICATION: Container is wider (max-w-7xl) to accommodate two columns */}
                <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                    <PageHeader title={bookDetails.title} subtitle="Your personalized story" />

                    {/* MODIFICATION: Flex container for the two-column layout */}
                    <div className="flex flex-col lg:flex-row gap-8 mt-8">

                        {/* --- Main Workspace (Left Column) --- */}
                        <div className="lg:w-2/3 w-full">
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className="bg-slate-800/50 backdrop-blur-md p-6 md:p-8 rounded-2xl shadow-2xl border border-slate-700"
                            >
                                <div className="space-y-3">
                                    {chapters.map((chapter, index) => {
                                        const isLatest = index === chapters.length - 1;
                                        return (
                                            <Chapter 
                                                key={chapter.chapter_number} 
                                                chapter={chapter}
                                                isLatest={isLatest} 
                                                isOpen={openChapter === chapter.chapter_number} 
                                                onToggle={() => handleToggleChapter(chapter.chapter_number)} 
                                                onRegenerate={handleRegenerateChapter}
                                                isLoading={isPolling || isAnyMutationPending}
                                                guidance={guidanceInputs[chapter.chapter_number] || ''}
                                                onGuidanceChange={handleGuidanceChange}
                                            />
                                        );
                                    })}
                                </div>
                                
                                {isPolling && (
                                    <div className="mt-10 flex justify-center items-center flex-col text-center">
                                        <LoadingSpinner text={`Writing Chapter ${chaptersCount + 1}...`} />
                                        <p className="text-slate-400 mt-2">This may take a minute. The page will update automatically.</p>
                                    </div>
                                )}
                                
                                <div className="mt-14 border-t border-dashed border-slate-600 pt-10 text-center">
                                    {!isComplete && !isPolling && (
                                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleGenerateNextChapter} disabled={isAnyMutationPending} className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-indigo-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition-all duration-300 shadow-lg text-lg">
                                            {isAnyMutationPending ? 'Submitting...' : `Continue Story (${chaptersCount}/${totalChapters})`}
                                        </motion.button>
                                    )}
                                </div>
                            </motion.div>
                        </div>

                        {/* --- Book Settings Sidebar (Right Column) --- */}
                        <div className="lg:w-1/3 w-full lg:sticky lg:top-8 h-fit">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: 0.3 }}
                                className="bg-slate-800/50 backdrop-blur-md p-6 md:p-8 rounded-2xl shadow-2xl border border-slate-700"
                            >
                                <h3 className="text-2xl font-bold text-white mb-6 text-center">Book Settings</h3>
                                
                                {isComplete && (
                                    <p className="text-xl font-semibold text-green-400 mb-8 text-center">
                                        Your story is complete! Ready to bring it to life?
                                    </p>
                                )}

                                {/* MODIFICATION: The finalization tools are now stacked vertically in this sidebar */}
                                <div className="flex flex-col gap-10">

                                    {/* Custom Cover */}
                                    <div className="flex flex-col items-center border-b border-slate-700 pb-8">
                                        <h4 className="text-lg font-semibold text-gray-200 mb-2">Custom Cover</h4>
                                        <p className="text-sm text-gray-400 mb-5 text-center max-w-[220px]">
                                            Upload an image for the front cover.
                                        </p>
                                        <CoverUploader
                                            bookId={bookDetails.id}
                                            currentCoverUrl={bookDetails.user_cover_image_url}
                                        />
                                    </div>

                                    {/* Back Cover Blurb */}
                                    <div className="flex flex-col items-center border-b border-slate-700 pb-8">
                                        <h4 className="text-lg font-semibold text-gray-200 mb-2">Back Cover Blurb</h4>
                                        <p className="text-sm text-gray-400 mb-5 text-center max-w-[220px]">
                                            Add a short blurb for the back cover.
                                        </p>
                                        <BackCoverBlurbEditor
                                            bookId={bookDetails.id}
                                            initialBlurb={bookDetails.back_cover_blurb || ''}
                                        />
                                    </div>

                                    {/* Finalize Your Book */}
                                    <div className="flex flex-col items-center justify-center gap-4">
                                        <h4 className="text-lg font-semibold text-gray-200 mb-2">Finalize Your Book</h4>
                                        <p className="text-gray-400 text-center mb-4 max-w-[260px]">
                                            Preview your book and proceed to purchase when you're ready.
                                        </p>
                                        <div className="flex flex-col gap-4 w-full justify-center">
                                            <motion.button
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={handlePreviewPdf}
                                                disabled={previewPdfMutation.isPending}
                                                className="w-full bg-sky-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-sky-500 disabled:bg-gray-600 disabled:cursor-not-allowed shadow-lg text-md"
                                            >
                                                {previewPdfMutation.isPending ? 'Generating...' : 'Preview PDF'}
                                            </motion.button>
                                            <motion.button
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => setCheckoutModalOpen(true)}
                                                disabled={previewPdfMutation.isPending}
                                                className="w-full bg-teal-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-teal-500 disabled:bg-gray-600 disabled:cursor-not-allowed shadow-lg text-md"
                                            >
                                                Finalize & Purchase
                                            </motion.button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex flex-col items-center justify-center text-center py-10">
            <Alert type="info" message="Project not found or is still being created." />
            <button onClick={() => navigate('/my-projects')} className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg">
                Back to Projects
            </button>
        </div>
    );
}

export default NovelPage;