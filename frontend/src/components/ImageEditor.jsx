import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner, Alert } from './common';

function ImageEditor({ currentEvent, onImageUpdate }) {
    const { token } = useAuth();
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('Watercolor');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    
    // Manage the URL of the image currently displayed by ImageEditor
    // This state is initialized from props and then updated by useEffect and handlers.
    const [displayedImageUrl, setDisplayedImageUrl] = useState(
        currentEvent.uploaded_image_url || currentEvent.image_url
    );

    // REFINED useEffect: Sync displayedImageUrl and reset prompt/file whenever the page context changes
    useEffect(() => {
        // Always sync the displayed image URL with the currentEvent props
        setDisplayedImageUrl(currentEvent.uploaded_image_url || currentEvent.image_url);
        
        // When the page number changes, it indicates we're looking at a different page.
        // In this case, we should reset the prompt and selectedFile for a fresh start on the new page.
        // This ensures the input fields don't carry over data from previous pages or image generations.
        setPrompt(''); // Always clear prompt on page change
        setSelectedFile(null); // Always clear selected file on page change
        setError(null); // Clear any old errors
        setIsGenerating(false); // Reset loading states
        setIsUploading(false); // Reset loading states

    }, [currentEvent.page_number, currentEvent.uploaded_image_url, currentEvent.image_url]); // Key: depend on page_number and image URLs for a full re-sync

    const artStyles = ['Watercolor', 'Cartoon', 'Photorealistic', 'Fantasy', 'Vintage'];

    const handleGenerate = async () => {
        if (!prompt) {
            setError("Please enter a prompt for the image.");
            return;
        }
        setIsGenerating(true);
        setError(null);
        setSelectedFile(null); // Clear selected file if generating AI image
        
        // Temporarily clear displayed image locally to show spinner, and clear parent's image URLs
        setDisplayedImageUrl(null); // This makes the spinner appear
        onImageUpdate(currentEvent.page_number - 1, 'uploaded_image_url', null); // Clear parent's uploaded URL
        onImageUpdate(currentEvent.page_number - 1, 'image_url', null); // Clear parent's AI image URL
        
        try {
            const response = await apiClient.post('/images/generate', { prompt, style });
            const newImageUrl = response.data.imageUrl;
            
            // Update parent state with AI image. Parent will then re-render this component with new props.
            onImageUpdate(currentEvent.page_number - 1, 'image_url', newImageUrl);
            onImageUpdate(currentEvent.page_number - 1, 'image_style', style);
            
            // The useEffect will now reliably pick up the change to currentEvent.image_url and update displayedImageUrl.
        } catch (err) {
            setError("Failed to generate image. Please try again.");
            console.error(err);
            // On failure, revert displayed image to whatever it was before trying to generate
            setDisplayedImageUrl(currentEvent.uploaded_image_url || currentEvent.image_url); 
        } finally {
            setIsGenerating(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            setError(null);
            // Display a preview of the selected file immediately
            const reader = new FileReader();
            reader.onloadend = () => {
                setDisplayedImageUrl(reader.result); // Set local state to file preview
            };
            reader.readAsDataURL(file);

            // Also clear the AI-generated image from the parent state when a file is selected for upload
            onImageUpdate(currentEvent.page_number - 1, 'image_url', null);
            onImageUpdate(currentEvent.page_number - 1, 'image_style', null);
        } else {
            setSelectedFile(null);
            // If no file selected (e.g., user cancels file picker), revert displayed image
            setDisplayedImageUrl(currentEvent.uploaded_image_url || currentEvent.image_url); 
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setError("Please select a file to upload.");
            return;
        }
        setIsUploading(true);
        setError(null);
        
        // Clear previous AI image URL and style in parent, and set local display to null for spinner
        onImageUpdate(currentEvent.page_number - 1, 'image_url', null);
        onImageUpdate(currentEvent.page_number - 1, 'image_style', null);
        setDisplayedImageUrl(null); // Show spinner

        const formData = new FormData();
        formData.append('image', selectedFile);

        try {
            const response = await apiClient.post('/images/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            const newImageUrl = response.data.imageUrl;

            onImageUpdate(currentEvent.page_number - 1, 'uploaded_image_url', newImageUrl); // Update parent state
            // setDisplayedImageUrl(newImageUrl); // REMOVED - useEffect will handle this.
            setSelectedFile(null); // Clear selected file after upload
        } catch (err) {
            setError("Failed to upload image. Please try again.");
            console.error(err);
            setDisplayedImageUrl(currentEvent.uploaded_image_url || currentEvent.image_url); // Revert on failure
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-slate-800 p-6 rounded-lg shadow-xl space-y-6 text-white border border-slate-700">
            {error && <Alert title="Error">{error}</Alert>}

            {/* Image display area */}
            <div className="relative w-full h-80 bg-slate-700 rounded-md overflow-hidden flex items-center justify-center">
                {displayedImageUrl ? (
                    <>
                        <img
                            src={displayedImageUrl}
                            alt={`Page ${currentEvent.page_number}`}
                            className="w-full h-full object-cover object-center"
                        />
                        <textarea
                            value={currentEvent.overlay_text || ''}
                            onChange={(e) => onImageUpdate(currentEvent.page_number - 1, 'overlay_text', e.target.value)}
                            placeholder="Type story text or a caption here (e.g., 'Leo bravely faced the dragon.')"
                            className="absolute inset-x-4 bottom-4 p-3 bg-black bg-opacity-75 text-white text-lg rounded-lg leading-tight resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 transition placeholder-gray-300 font-bold text-center"
                            rows={3}
                            style={{
                                textShadow: '0px 0px 6px rgba(0,0,0,0.9), 0px 0px 2px rgba(0,0,0,0.5)',
                            }}
                        />
                    </>
                ) : (
                    <div className="text-slate-400 flex flex-col items-center">
                        {isGenerating || isUploading ? <LoadingSpinner text={isGenerating ? "Generating art..." : "Uploading image..."} /> : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <p className="text-sm">No image yet. Use the options below to add one.</p>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Image Generation Controls */}
            <div className="space-y-4">
                <h4 className="font-semibold text-lg text-white">Generate AI Image:</h4>
                <div>
                    <label htmlFor="image-prompt" className="block text-sm font-medium text-slate-300 mb-1">Image Description</label>
                    <textarea
                        id="image-prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., A brave knight facing a wise old dragon in a mystical forest"
                        className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md h-24 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-white placeholder-slate-400"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                        Describe the visual content you want AI to generate for this page. Be specific!
                    </p>
                </div>
                <div>
                    <label htmlFor="art-style" className="block text-sm font-medium text-slate-300 mb-1">Art Style</label>
                    <select
                        id="art-style"
                        value={style}
                        onChange={(e) => setStyle(e.target.value)}
                        className="mt-1 block w-full p-2 bg-slate-700 border border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-white"
                    >
                        {artStyles.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">
                        Choose an artistic style for your AI-generated image.
                    </p>
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || isUploading}
                    className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition shadow-md"
                >
                    {isGenerating ? 'Creating...' : 'Generate Image'}
                </button>
            </div>

            {/* Image Upload Controls */}
            <div className="space-y-4 border-t border-slate-700 pt-6 mt-6">
                <h4 className="font-semibold text-lg text-white">Upload Your Own Image:</h4>
                <div>
                    <label htmlFor="image-upload" className="block text-sm font-medium text-slate-300 mb-1">Select Image File</label>
                    <input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="mt-1 block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-700 file:text-white hover:file:bg-violet-600 cursor-pointer"
                    />
                    {selectedFile && <p className="text-sm text-slate-400 mt-1">Selected: {selectedFile.name}</p>}
                    <p className="text-xs text-slate-400 mt-1">
                        Upload a JPG, PNG, or GIF image. Max file size: 5MB.
                    </p>
                </div>
                <button
                    onClick={handleUpload}
                    disabled={isGenerating || isUploading || !selectedFile}
                    className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-green-300 transition shadow-md"
                >
                    {isUploading ? 'Uploading...' : 'Upload Image'}
                </button>
            </div>
        </div>
    );
}

export default ImageEditor;