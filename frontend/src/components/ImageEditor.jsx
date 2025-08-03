import React, { useState, useEffect } from 'react'; // Import useEffect
import apiClient from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner, Alert } from './common';

function ImageEditor({ currentEvent, onImageUpdate }) {
    const { token } = useAuth(); // Assuming token is used for auth headers
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('Watercolor');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    
    // NEW STATE: Manage the URL of the image currently displayed by ImageEditor
    const [displayedImageUrl, setDisplayedImageUrl] = useState(
        currentEvent.uploaded_image_url || currentEvent.image_url
    );

    // NEW useEffect: Sync displayedImageUrl with changes in currentEvent or image URLs
    useEffect(() => {
        setDisplayedImageUrl(currentEvent.uploaded_image_url || currentEvent.image_url);
        // Reset prompt and selected file when the page changes
        if (prompt !== '' && currentEvent.image_url === null && currentEvent.uploaded_image_url === null) {
            setPrompt(''); // Clear prompt if new page and no image
        }
        setSelectedFile(null); // Clear selected file when navigating pages
    }, [currentEvent, currentEvent.uploaded_image_url, currentEvent.image_url]); // Depend on currentEvent and its image URLs

    const artStyles = ['Watercolor', 'Cartoon', 'Photorealistic', 'Fantasy', 'Vintage'];

    const handleGenerate = async () => {
        if (!prompt) {
            setError("Please enter a prompt for the image.");
            return;
        }
        setIsGenerating(true);
        setError(null);
        setSelectedFile(null); // Clear selected file if generating AI image
        
        // Temporarily clear displayed image, show spinner
        setDisplayedImageUrl(null); 
        onImageUpdate(currentEvent.page_number - 1, 'uploaded_image_url', null); // Clear uploaded URL
        onImageUpdate(currentEvent.page_number - 1, 'image_url', null); // Clear AI image URL (important for re-generation)

        try {
            const response = await apiClient.post('/images/generate', { prompt, style });
            const newImageUrl = response.data.imageUrl;
            
            onImageUpdate(currentEvent.page_number - 1, 'image_url', newImageUrl); // Update parent state with AI image
            onImageUpdate(currentEvent.page_number - 1, 'image_style', style); // Update parent state with style
            
            setDisplayedImageUrl(newImageUrl); // Update local state for immediate display
        } catch (err) {
            setError("Failed to generate image. Please try again.");
            console.error(err);
            // If generation fails, restore previous image if any or keep cleared
            setDisplayedImageUrl(currentEvent.uploaded_image_url || currentEvent.image_url); // Revert on failure
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
        } else {
            setSelectedFile(null);
            setDisplayedImageUrl(currentEvent.uploaded_image_url || currentEvent.image_url); // Revert to current event image if no file selected
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setError("Please select a file to upload.");
            return;
        }
        setIsUploading(true);
        setError(null);
        
        // Clear previous AI image URL, just in case
        onImageUpdate(currentEvent.page_number - 1, 'image_url', null);
        onImageUpdate(currentEvent.page_number - 1, 'image_style', null);
        // onImageUpdate(currentEvent.page_number - 1, 'uploaded_image_url', null); // Removed, handled by handleFileChange preview
        
        const formData = new FormData();
        formData.append('image', selectedFile);

        try {
            const response = await apiClient.post('/images/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            const newImageUrl = response.data.imageUrl;

            onImageUpdate(currentEvent.page_number - 1, 'uploaded_image_url', newImageUrl); // Update parent state with uploaded image
            
            setDisplayedImageUrl(newImageUrl); // Update local state for immediate display
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
                {displayedImageUrl ? ( // Use local displayedImageUrl state
                    <>
                        <img
                            src={displayedImageUrl}
                            alt={`Page ${currentEvent.page_number}`}
                            className="w-full h-full object-cover object-center"
                        />
                        {/* Contextual UI Hint: Specific placeholder and styling for overlay text */}
                        <textarea
                            value={currentEvent.overlay_text || ''}
                            onChange={(e) => onImageUpdate(currentEvent.page_number - 1, 'overlay_text', e.target.value)}
                            // Refined placeholder for clarity
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