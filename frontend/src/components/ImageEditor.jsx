import React, { useState, useEffect } from 'react';
import { LoadingSpinner } from './common';
import { PhotoIcon, SparklesIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/solid';
import * as HeroIcons from '@heroicons/react/24/solid'; // import all icons

// Version-safe Wand icon with robust fallback
const WandIconSafe =
  HeroIcons.WandIcon ||
  HeroIcons.WandMagicSparklesIcon ||
  HeroIcons.MagicWandIcon ||
  (() => <div className="h-5 w-5 bg-red-500 inline-block" />); // dummy fallback

import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import apiClient from '../services/apiClient';

function ImageEditor({ bookId, currentEvent, onImageUpdate, timeline, onGenerate, isGenerating }) {
    
    const [prompt, setPrompt] = useState(currentEvent?.image_prompt || '');
    const [previousPrompt, setPreviousPrompt] = useState(null);
    const [overlayText, setOverlayText] = useState(currentEvent?.overlay_text || '');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isImproving, setIsImproving] = useState(false);

    useEffect(() => {
        setPrompt(currentEvent?.image_prompt || '');
        setOverlayText(currentEvent?.overlay_text || '');
        setPreviousPrompt(null);
    }, [currentEvent]);

    const handleGenerateClick = () => {
        if (!currentEvent?.page_number) {
            toast.error("Invalid page selected.");
            return;
        }
        if (!prompt) {
            toast.error("Please write an Image Description before generating.");
            return;
        }
        onGenerate(currentEvent.page_number, prompt);
    };

    const handleImprovePrompt = async () => {
        if (!prompt) {
            toast.error("Please write a description before trying to improve it.");
            return;
        }
        
        setPreviousPrompt(prompt);
        
        setIsImproving(true);
        const toastId = toast.loading('AI is refining your description...');
        try {
            const response = await apiClient.post('/picture-books/improve-prompt', { prompt });
            const improvedPrompt = response.data.improvedPrompt;
            
            setPrompt(improvedPrompt);
            onImageUpdate(timeline.indexOf(currentEvent), 'image_prompt', improvedPrompt);
            
            toast.success('Description improved!', { id: toastId });
        } catch (error) {
            setPreviousPrompt(null);
            toast.error(error.response?.data?.message || 'Failed to improve description.', { id: toastId });
        } finally {
            setIsImproving(false);
        }
    };

    const handleUndo = () => {
        if (previousPrompt) {
            setPrompt(previousPrompt);
            onImageUpdate(timeline.indexOf(currentEvent), 'image_prompt', previousPrompt);
            setPreviousPrompt(null);
            toast.success('Reverted to previous description.');
        }
    };

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file && file.size > 2 * 1024 * 1024) {
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
        
        try {
            const formData = new FormData();
            formData.append('image', selectedFile);

            const response = await apiClient.post(`/picture-books/events/${currentEvent.id}/upload-image`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            onImageUpdate(timeline.indexOf(currentEvent), 'uploaded_image_url', response.data.imageUrl);
            toast.success('Image uploaded successfully!', { id: toastId });
            setSelectedFile(null);
        } catch (error) {
            console.error('Error uploading image:', error);
            toast.error(error.response?.data?.message || 'Failed to upload image.', { id: toastId });
        } finally {
            setIsUploading(false);
        }
    };
    
    const imageUrl = currentEvent?.image_url || currentEvent?.uploaded_image_url;

    return (
        <motion.div
            key={currentEvent?.id || currentEvent?.page_number}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-slate-700"
        >
            <div className="aspect-square w-full rounded-lg bg-slate-700/50 mb-6 flex items-center justify-center overflow-hidden relative">
                {imageUrl ? (
                    <img src={imageUrl} alt={`Page ${currentEvent.page_number}`} className="w-full h-full object-contain" />
                ) : (
                    <div className="text-center text-slate-500">
                        <PhotoIcon className="h-24 w-24 mx-auto" />
                        <p>Generate an image or upload your own.</p>
                    </div>
                )}
                {isGenerating && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                        <LoadingSpinner text="Creating your masterpiece..."/>
                    </div>
                )}
            </div>
            
            <div className="space-y-6">
                <div>
                    <label htmlFor="storyText" className="block text-sm font-medium text-slate-300 mb-2">Story Text for Page {currentEvent?.page_number}</label>
                    <textarea
                        id="storyText"
                        readOnly
                        value={currentEvent?.story_text || ''}
                        className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 min-h-[100px] cursor-not-allowed"
                    />
                </div>

                <div>
                    <label htmlFor="imagePrompt" className="block text-sm font-medium text-slate-300 mb-2">Image Description (Editable)</label>
                    <textarea
                        id="imagePrompt"
                        value={prompt}
                        onChange={(e) => {
                           setPrompt(e.target.value);
                           onImageUpdate(timeline.indexOf(currentEvent), 'image_prompt', e.target.value);
                        }}
                        placeholder="A description of the scene to be generated..."
                        className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white min-h-[100px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                     <div className="flex items-center gap-2 mt-2">
                        <button
                            onClick={handleImprovePrompt}
                            disabled={isImproving || isGenerating}
                            className="flex-grow flex items-center justify-center gap-2 bg-sky-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-sky-500 transition-colors disabled:bg-slate-500 disabled:cursor-not-allowed text-sm"
                        >
                            {isImproving ? <LoadingSpinner text="Improving..." /> : <><WandIconSafe className="h-5 w-5" /> Improve Description</>}
                        </button>
                        <AnimatePresence>
                        {previousPrompt && (
                            <motion.button
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto', padding: '0.5rem 1rem' }}
                                exit={{ opacity: 0, width: 0, padding: '0.5rem 0' }}
                                transition={{ duration: 0.2 }}
                                onClick={handleUndo}
                                className="flex-shrink-0 flex items-center justify-center gap-2 bg-slate-600 text-white font-bold rounded-lg hover:bg-slate-500 transition-colors text-sm"
                            >
                                <ArrowUturnLeftIcon className="h-5 w-5" />
                                Undo
                            </motion.button>
                        )}
                        </AnimatePresence>
                    </div>
                </div>

                <button 
                    onClick={handleGenerateClick} 
                    disabled={isGenerating || isImproving} 
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-500 transition-colors disabled:bg-slate-500 disabled:cursor-not-allowed text-lg"
                >
                    {isGenerating ? <LoadingSpinner /> : <><SparklesIcon className="h-6 w-6" /> Generate Image</>}
                </button>

                <div className="my-6 border-t border-slate-700"></div>

                <div>
                    <h4 className="text-lg font-semibold text-gray-200 mb-2">Or Upload Your Own Image:</h4>
                    <div className="flex items-center gap-4">
                        <input
                            type="file"
                            onChange={handleFileSelect}
                            accept="image/png, image/jpeg"
                            className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-600 file:text-white hover:file:bg-slate-500"
                        />
                        <button onClick={handleUploadImage} disabled={isUploading || !selectedFile} className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-500 transition-colors disabled:bg-slate-500">
                            {isUploading ? <LoadingSpinner /> : 'Upload'}
                        </button>
                    </div>
                     <p className="text-xs text-slate-500 mt-1">Max file size: 2MB.</p>
                </div>
            </div>
        </motion.div>
    );
}

export default ImageEditor;
