import React, { useState } from 'react';
import apiClient from '../services/apiClient';
import { LoadingSpinner } from './common';
import { PhotoIcon } from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

function ImageEditor({ bookId, currentEvent, onImageUpdate, timeline }) {
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('watercolor');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    // FIX: Restore the overlayText state
    const [overlayText, setOverlayText] = useState(currentEvent?.overlay_text || '');

    // When the page (currentEvent) changes, update the overlay text input
    React.useEffect(() => {
        setOverlayText(currentEvent?.overlay_text || '');
    }, [currentEvent]);

    const handleGenerateImage = async () => {
        if (!prompt) {
            toast.error("Please enter a prompt for the image.");
            return;
        }
        setIsLoading(true);
        const toastId = toast.loading('Generating your image...');
        try {
            const response = await apiClient.post(`/picture-books/${bookId}/events/${currentEvent.page_number}/generate-image`, {
                prompt,
                style
            });
            onImageUpdate(timeline.indexOf(currentEvent), 'image_url_preview', response.data.previewUrl);
            onImageUpdate(timeline.indexOf(currentEvent), 'image_url_print', response.data.printUrl);
            toast.success('Image generated successfully!', { id: toastId });
        } catch (error) {
            console.error('Error generating image:', error);
            toast.error(error.response?.data?.message || 'Failed to generate image.', { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file && file.size > 2 * 1024 * 1024) { // 2MB limit
            toast.error("File size cannot exceed 2MB.");
            setSelectedFile(null);
            return;
        }
        setSelectedFile(file);
    };

    const handleUploadImage = async () => {
        if (!selectedFile) {
            toast.error("Please choose a file to upload.");
            return;
        }
        setIsUploading(true);
        const toastId = toast.loading('Uploading your image...');
        const formData = new FormData();
        formData.append('image', selectedFile);
        try {
            const response = await apiClient.post(`/events/${currentEvent.id}/upload-image`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            onImageUpdate(timeline.indexOf(currentEvent), 'uploaded_image_url', response.data.imageUrl);
            toast.success('Image uploaded successfully!', { id: toastId });
            setSelectedFile(null); // Clear file input
        } catch (error) {
            console.error('Error uploading image:', error);
            toast.error(error.response?.data?.message || 'Failed to upload image.', { id: toastId });
        } finally {
            setIsUploading(false);
        }
    };

    const imageUrl = currentEvent?.image_url_preview || currentEvent?.uploaded_image_url || currentEvent?.image_url;

    return (
        <motion.div
            key={currentEvent?.page_number}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-slate-700"
        >
            <div className="aspect-square w-full rounded-lg bg-slate-700/50 mb-6 flex items-center justify-center overflow-hidden">
                {imageUrl ? (
                    <img src={imageUrl} alt={`Page ${currentEvent.page_number}`} className="w-full h-full object-contain" />
                ) : (
                    <div className="text-center text-slate-500">
                        <PhotoIcon className="h-24 w-24 mx-auto" />
                        <p>No image yet.</p>
                    </div>
                )}
            </div>

            {/* --- RESTORED OVERLAY TEXT INPUT --- */}
            <div className="mb-6">
                <label htmlFor="overlayText" className="block text-sm font-medium text-slate-300 mb-2">Overlay Text (Optional)</label>
                <input
                    id="overlayText"
                    type="text"
                    placeholder="e.g., Once upon a time..."
                    value={overlayText}
                    onChange={(e) => {
                        setOverlayText(e.target.value);
                        onImageUpdate(timeline.indexOf(currentEvent), 'overlay_text', e.target.value);
                    }}
                    className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>
            {/* --- END OF RESTORED CODE --- */}

            <div>
                <h4 className="text-lg font-semibold text-gray-200 mb-2">Generate AI Image:</h4>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., A brave knight facing a wise old dragon..."
                    className="w-full p-2 border border-slate-600 rounded-md bg-slate-700 text-white min-h-[80px]"
                />
                <div className="flex items-center gap-4 mt-2">
                    <select
                        value={style}
                        onChange={(e) => setStyle(e.target.value)}
                        className="flex-grow p-2 border border-slate-600 rounded-md bg-slate-700 text-white"
                    >
                        <option value="watercolor">Watercolor</option>
                        <option value="fantasy">Fantasy</option>
                        <option value="photo">Photo</option>
                        <option value="anime">Anime</option>
                    </select>
                    <button onClick={handleGenerateImage} disabled={isLoading} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-500 transition-colors disabled:bg-slate-500">
                        {isLoading ? <LoadingSpinner /> : 'Generate Image'}
                    </button>
                </div>
            </div>

            <div className="my-6 border-t border-slate-700"></div>

            <div>
                <h4 className="text-lg font-semibold text-gray-200 mb-2">Upload Your Own Image:</h4>
                <div className="flex items-center gap-4">
                    <input
                        type="file"
                        onChange={handleFileSelect}
                        accept="image/png, image/jpeg"
                        className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-600 file:text-white hover:file:bg-slate-500"
                    />
                    <button onClick={handleUploadImage} disabled={isUploading || !selectedFile} className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-500 transition-colors disabled:bg-slate-500">
                        {isUploading ? <LoadingSpinner /> : 'Upload Image'}
                    </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">Max file size: 2MB.</p>
            </div>
        </motion.div>
    );
}

export default ImageEditor;