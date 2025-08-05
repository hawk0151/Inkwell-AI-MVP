// frontend/src/components/ImageEditor.jsx
import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import { LoadingSpinner, Alert } from './common';

function ImageEditor({ currentEvent, onImageUpdate }) {
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('Watercolor');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [displayedImageUrl, setDisplayedImageUrl] = useState(null);

    useEffect(() => {
        setPrompt(''); 
        setSelectedFile(null); 
        setError(null); 
        const currentImage = currentEvent.uploaded_image_url || currentEvent.image_url;
        setDisplayedImageUrl(currentImage); 
    }, [currentEvent.page_number, currentEvent.uploaded_image_url, currentEvent.image_url]);

    const artStyles = ['Watercolor', 'Cartoon', 'Photorealistic', 'Fantasy', 'Vintage'];

    const handleGenerate = async () => {
        if (!prompt) {
            setError("Please enter a prompt for the image.");
            return;
        }
        setIsGenerating(true);
        setError(null);
        setSelectedFile(null);
        setDisplayedImageUrl(null);
        
        try {
            const response = await apiClient.post('/images/generate', { prompt, style });
            const newImageUrl = response.data.imageUrl;
            onImageUpdate(currentEvent.page_number - 1, 'image_url', newImageUrl);
            onImageUpdate(currentEvent.page_number - 1, 'image_style', style);
            setDisplayedImageUrl(newImageUrl); 
        } catch (err) {
            setError("Failed to generate image. Please try again.");
            setDisplayedImageUrl(currentEvent.uploaded_image_url || currentEvent.image_url); 
        } finally {
            setIsGenerating(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) {
            setSelectedFile(null);
            return;
        }

        // --- WORKAROUND CHANGE: Add client-side file size validation ---
        const MAX_FILE_SIZE_MB = 2;
        const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

        if (file.size > MAX_FILE_SIZE_BYTES) {
            setError(`File size cannot exceed ${MAX_FILE_SIZE_MB}MB. Please choose a smaller file.`);
            e.target.value = null; // Clear the file input
            return;
        }

        setSelectedFile(file);
        setError(null);
        const reader = new FileReader();
        reader.onloadend = () => {
            setDisplayedImageUrl(reader.result); 
        };
        reader.readAsDataURL(file);

        onImageUpdate(currentEvent.page_number - 1, 'image_url', null);
        onImageUpdate(currentEvent.page_number - 1, 'image_style', null);
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setError("Please select a file to upload.");
            return;
        }
        setIsUploading(true);
        setError(null);
        setDisplayedImageUrl(null);

        const formData = new FormData();
        formData.append('image', selectedFile);

        try {
            const response = await apiClient.post('/images/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const newImageUrl = response.data.imageUrl;
            onImageUpdate(currentEvent.page_number - 1, 'uploaded_image_url', newImageUrl);
            setDisplayedImageUrl(newImageUrl);
            setSelectedFile(null);
        } catch (err) {
            // Check if the server sent a specific error message (like file size)
            const errorMessage = err.response?.data?.message || "Failed to upload image. Please try again.";
            setError(errorMessage);
            setDisplayedImageUrl(currentEvent.uploaded_image_url || currentEvent.image_url); 
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-slate-800 p-6 rounded-lg shadow-xl space-y-6 text-white border border-slate-700">
            {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

            <div className="relative w-full h-80 bg-slate-700 rounded-md overflow-hidden flex items-center justify-center">
                {displayedImageUrl ? (
                    <img src={displayedImageUrl} alt={`Page ${currentEvent.page_number}`} className="w-full h-full object-cover"/>
                ) : (
                    <div className="text-slate-400">
                        {isGenerating || isUploading ? <LoadingSpinner text={isGenerating ? "Generating art..." : "Uploading image..."} /> : <p>No image yet.</p>}
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <h4 className="font-semibold text-lg">Generate AI Image:</h4>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., A brave knight facing a wise old dragon..."
                    className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md h-24"
                />
                <select value={style} onChange={(e) => setStyle(e.target.value)} className="mt-1 block w-full p-2 bg-slate-700 border border-slate-600 rounded-md">
                    {artStyles.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={handleGenerate} disabled={isGenerating || isUploading} className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
                    {isGenerating ? 'Creating...' : 'Generate Image'}
                </button>
            </div>

            <div className="space-y-4 border-t border-slate-700 pt-6 mt-6">
                <h4 className="font-semibold text-lg">Upload Your Own Image:</h4>
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="mt-1 block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-violet-700 file:text-white hover:file:bg-violet-600"
                />
                {/* --- WORKAROUND CHANGE: Updated help text --- */}
                <p className="text-xs text-slate-400 mt-1">
                    Max file size: 2MB.
                </p>
                <button onClick={handleUpload} disabled={isGenerating || isUploading || !selectedFile} className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-green-300">
                    {isUploading ? 'Uploading...' : 'Upload Image'}
                </button>
            </div>
        </div>
    );
}

export default ImageEditor;