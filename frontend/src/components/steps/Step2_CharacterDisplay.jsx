import React, { useState, useEffect, useRef } from 'react'; // 1. Import useRef
import { motion } from 'framer-motion';
import apiClient from '../../services/apiClient';
import { LoadingSpinner, Alert } from '../common';
import { ArrowLeftIcon } from '@heroicons/react/24/solid';

export const Step2_Character = ({ bookId, onBack, onComplete, characterDetails, artStyle }) => {
    const [images, setImages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // 2. Create a ref to track if the effect has already run
    const effectRan = useRef(false);

    useEffect(() => {
        // 3. Add a check to ensure this logic only runs ONCE
        if (effectRan.current === false) {
            const fetchCharacterReferences = async () => {
                if (!characterDetails || !artStyle) {
                    setError("Character details or art style is missing. Please go back.");
                    setIsLoading(false);
                    return;
                }

                setIsLoading(true);
                setError(null);
                
                try {
                    console.log("Step2_Character: Sending data to backend:", { characterDetails, artStyle });
                    
                    const response = await apiClient.post(
                        `/picture-books/${bookId}/generate-character-references`,
                        {
                            characterDetails,
                            artStyle
                        }
                    );
                    
                    setImages(response.data.referenceImageUrls || []);
                    if (!response.data.referenceImageUrls || response.data.referenceImageUrls.length === 0) {
                         setError("The AI failed to generate character images. Please try adjusting the description and try again.");
                    }

                } catch (err) {
                    console.error("Failed to generate character references:", err);
                    const errorMessage = err.response?.data?.message || 'A network error occurred while generating character images.';
                    setError(errorMessage);
                } finally {
                    setIsLoading(false);
                }
            };

            fetchCharacterReferences();

            // 4. Set the ref to true after the first run
            return () => {
                effectRan.current = true;
            };
        }
    }, [bookId, characterDetails, artStyle]); // Dependencies remain the same

    const motionProps = {
        initial: { opacity: 0, x: -20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 20 },
        transition: { duration: 0.3 }
    };

    const renderContent = () => {
        if (isLoading) {
            return <LoadingSpinner text="Our AI illustrator is drawing your character... This can take a minute." />;
        }
        if (error) {
            return <Alert type="error" message={error} />;
        }
        return (
            <div className="grid grid-cols-2 gap-6">
                {images.map((url, index) => (
                    <motion.div
                        key={index}
                        className="rounded-lg overflow-hidden border-2 border-transparent hover:border-indigo-500 transition-all duration-300 cursor-pointer"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onComplete(url)}
                    >
                        <img src={url} alt={`Character Reference ${index + 1}`} className="w-full h-full object-cover" />
                    </motion.div>
                ))}
            </div>
        );
    };

    return (
        <motion.div {...motionProps} className="p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Select Your Main Character</h2>
            <p className="text-slate-400 mb-6">
                Choose one of these styles. This will lock in the character's appearance for the rest of the book.
            </p>

            <div className="min-h-[400px] flex items-center justify-center bg-slate-900/50 rounded-lg p-4">
                {renderContent()}
            </div>
            
            <div className="pt-6 border-t border-slate-700 flex justify-between items-center mt-8">
                <button 
                    type="button" 
                    onClick={onBack} 
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition px-4 py-2"
                    disabled={isLoading}
                >
                    <ArrowLeftIcon className="h-5 w-5" />
                    Back
                </button>
            </div>
        </motion.div>
    );
};