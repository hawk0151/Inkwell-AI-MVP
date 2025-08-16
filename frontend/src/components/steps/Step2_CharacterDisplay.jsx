import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../services/apiClient.js';
import { Alert, LoadingSpinner } from '../common.jsx';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { ModalStep } from '../common/ModalStep.jsx';

export const Step2_Character = ({ bookId, onBack, onComplete, characterInfo }) => {
    const [characterImages, setCharacterImages] = useState([]);
    const [selectedImage, setSelectedImage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const effectRan = useRef(false);

    useEffect(() => {
        if (effectRan.current) return;

        const generateCharacters = async () => {
            setError(null);
            setIsLoading(true);
            try {
                const response = await apiClient.post(
                    `/picture-books/${bookId}/generate-character-references`,
                    characterInfo
                );
                setCharacterImages(response.data.referenceImageUrls);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to generate images.');
            } finally {
                setIsLoading(false);
            }
        };

        if (characterInfo?.description) {
            generateCharacters();
        }

        effectRan.current = true;
    }, [bookId, characterInfo]);

    const handleConfirm = () => {
        if (selectedImage) onComplete(selectedImage);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <ModalStep title="Select Your Main Character" description="Choose one of these styles. This will lock in the character's appearance.">
                {error && <Alert type="error" message={error} />}
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <LoadingSpinner text="Generating character options..." />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-4">
                        {characterImages.map((imgUrl, index) => (
                            <div key={`${imgUrl}-${index}`} className="relative cursor-pointer group aspect-square" onClick={() => setSelectedImage(imgUrl)}>
                                <img
                                    src={imgUrl}
                                    alt="Character Reference"
                                    className={`w-full h-full object-cover rounded-lg border-4 transition ${selectedImage === imgUrl ? 'border-indigo-500' : 'border-transparent'}`}
                                />
                                {selectedImage === imgUrl && (
                                    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center rounded-lg">
                                        <CheckCircleIcon className="h-16 w-16 text-white" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </ModalStep>

            <div className="p-8 pt-6 border-t border-slate-700 flex justify-between items-center mt-auto">
                <button type="button" onClick={onBack} className="text-slate-400 hover:text-white transition px-4 py-2" disabled={isLoading}>Back</button>
                <button
                    type="button"
                    onClick={handleConfirm}
                    className="inline-flex justify-center px-4 py-2 font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    disabled={!selectedImage || isLoading}
                >
                    {isLoading ? <LoadingSpinner /> : 'Confirm and Continue'}
                </button>
            </div>
        </div>
    );
};
