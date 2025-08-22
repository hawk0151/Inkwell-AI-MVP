import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../services/apiClient';
import { Step1_Foundation } from './steps/Step1_Foundation';
import { Step2_Character } from './steps/Step2_CharacterDisplay';
import { Step2_Approval } from './steps/Step2_Approval';
import { Step3_StoryPlan } from './steps/Step3_StoryPlan';

export const StoryBibleModal = ({ isOpen, onClose, book }) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [storyBible, setStoryBible] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [loadingText, setLoadingText] = useState('');
    const [selectedCharacterUrl, setSelectedCharacterUrl] = useState(null);
    
    // --- CHANGE 1: The state for Step 1 now holds a structured character object ---
    const [foundationValues, setFoundationValues] = useState({
        coreConcept: '',
        therapeuticGoal: '',
        tone: '',
        artStyle: 'digital-art',
        character: {
            name: '',
            age: 'toddler',
            gender: 'male',
            ethnicity: '',
            hair: '',
            clothing: '',
            extras: ''
        }
    });

    const isInitialized = useRef(false);

    useEffect(() => {
        if (isOpen && !isInitialized.current) {
            setCurrentStep(1);
            setError(null);
            setSelectedCharacterUrl(null);
            
            // --- CHANGE 2: The initialization logic now populates our new structured state ---
            const initialCharacter = {
                name: book?.story_bible?.character?.name || '',
                age: book?.story_bible?.character?.description?.age || 'toddler',
                gender: book?.story_bible?.character?.description?.gender || 'male',
                ethnicity: book?.story_bible?.character?.description?.ethnicity || '',
                hair: book?.story_bible?.character?.description?.hair || '',
                clothing: book?.story_bible?.character?.description?.clothing || '',
                extras: book?.story_bible?.character?.description?.extras || ''
            };

            const initialFoundation = {
                coreConcept: book?.story_bible?.coreConcept || '',
                therapeuticGoal: book?.story_bible?.therapeuticGoal || '',
                tone: book?.story_bible?.tone || '',
                artStyle: book?.story_bible?.art?.style || 'digital-art',
                character: initialCharacter
            };
            
            setFoundationValues(initialFoundation);
            
            // This syncs the main storyBible state used in later steps
            setStoryBible({
                ...initialFoundation,
                art: { style: initialFoundation.artStyle },
                character: { name: initialFoundation.character.name, description: initialFoundation.character }
            });

            isInitialized.current = true;
        } else if (!isOpen) {
            isInitialized.current = false;
        }
    }, [isOpen, book]);

    // --- CHANGE 3: The change handler now supports nested state objects ---
    const handleFoundationChange = (e) => {
        const { name, value } = e.target;
        
        setFoundationValues(prev => {
            const keys = name.split('.');
            if (keys.length > 1) {
                // Handle nested properties like "character.name"
                return {
                    ...prev,
                    [keys[0]]: {
                        ...prev[keys[0]],
                        [keys[1]]: value
                    }
                };
            }
            // Handle top-level properties like "coreConcept"
            return { ...prev, [name]: value };
        });
    };

    const handleSaveFoundation = async () => {
        setError(null);
        setIsLoading(true);
        setLoadingText('Saving your vision...');
        try {
            // --- CHANGE 4: Assemble the data from our new state shape ---
            const formData = {
                coreConcept: foundationValues.coreConcept,
                therapeuticGoal: foundationValues.therapeuticGoal,
                tone: foundationValues.tone,
                art: { style: foundationValues.artStyle },
                // The character's 'description' is now the structured object itself
                character: {
                    name: foundationValues.character.name,
                    description: foundationValues.character,
                },
            };
            await apiClient.post(`/picture-books/${book.id}/story-bible`, formData);
            setStoryBible(prev => ({ ...prev, ...formData }));
            setCurrentStep(2);
        } catch (err) {
            setError(err.response?.data?.message || 'An error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCharacterSelect = (imageUrl) => {
        setSelectedCharacterUrl(imageUrl);
        setCurrentStep(3);
    };

    const handleSaveCharacter = async () => {
        if (!selectedCharacterUrl) {
            setError("No character image was selected.");
            return;
        }
        setError(null);
        setIsLoading(true);
        setLoadingText('Locking in character...');
        try {
            const payload = { characterReference: { url: selectedCharacterUrl } };
            await apiClient.post(`/picture-books/${book.id}/select-character-reference`, payload);
            setStoryBible(prev => ({ ...prev, characterReference: { url: selectedCharacterUrl } }));
            setCurrentStep(4);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save selection.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinalizeAndGenerate = async (finalPlan) => {
        setError(null);
        setIsLoading(true);
        setLoadingText('Saving your final story plan...');
        try {
            const finalStoryBible = { ...storyBible, storyPlan: finalPlan };
            await apiClient.post(`/picture-books/${book.id}/story-bible`, finalStoryBible);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'An error occurred during finalization.');
            setIsLoading(false);
        }
    };

    const modalVariants = {
        hidden: { opacity: 0, scale: 0.9 },
        visible: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.9 },
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <motion.div
                        className="bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
                        variants={modalVariants} initial="hidden" animate="visible" exit="exit"
                    >
                        <div className="flex flex-col h-full">
                            {currentStep === 1 && (
                                <Step1_Foundation
                                    book={book}
                                    values={foundationValues}
                                    handleChange={handleFoundationChange}
                                    onSubmit={handleSaveFoundation}
                                    onClose={onClose}
                                    isLoading={isLoading}
                                    loadingText={loadingText}
                                    error={error}
                                />
                            )}
                            {currentStep === 2 && (
                               <Step2_Character
                                    bookId={book.id}
                                    onBack={() => setCurrentStep(1)}
                                    onComplete={handleCharacterSelect}
                                    // --- CHANGE 5: Pass the structured character details to the next step ---
                                    characterDetails={storyBible.character.description}
                                    artStyle={storyBible.art.style}
                               />
                            )}
                            {currentStep === 3 && (
                                <Step2_Approval
                                    selectedImageUrl={selectedCharacterUrl}
                                    onBack={() => setCurrentStep(2)}
                                    onConfirm={handleSaveCharacter}
                                    isLoading={isLoading}
                                    loadingText={loadingText}
                                />
                            )}
                            {currentStep === 4 && (
                                <Step3_StoryPlan
                                    bookId={book.id}
                                    onBack={() => setCurrentStep(3)}
                                    onFinalize={handleFinalizeAndGenerate}
                                />
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};