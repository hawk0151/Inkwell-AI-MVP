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
    const [foundationValues, setFoundationValues] = useState({});

    const isInitialized = useRef(false);

    useEffect(() => {
        if (isOpen && !isInitialized.current) {
            setCurrentStep(1);
            setError(null);
            setSelectedCharacterUrl(null);

            const defaultShape = {
                coreConcept: '',
                character: { name: '', description: '' },
                art: { style: 'watercolor' },
                tone: '',
                therapeuticGoal: '',
                storyPlan: [],
            };

            const initialStoryBible = {
                ...defaultShape,
                ...(book?.story_bible || {}),
                character: { ...defaultShape.character, ...(book?.story_bible?.character || {}) },
                art: { ...defaultShape.art, ...(book?.story_bible?.art || {}) },
            };
            setStoryBible(initialStoryBible);

            setFoundationValues({
                coreConcept: initialStoryBible.coreConcept,
                characterName: initialStoryBible.character.name,
                characterDescription: initialStoryBible.character.description,
                tone: initialStoryBible.tone,
                artStyle: initialStoryBible.art.style,
                therapeuticGoal: initialStoryBible.therapeuticGoal
            });

            isInitialized.current = true;
        } else if (!isOpen) {
            isInitialized.current = false;
        }
    }, [isOpen, book]);

    const handleFoundationChange = (e) => {
        const { name, value } = e.target;
        setFoundationValues(prevValues => ({
            ...prevValues,
            [name]: value
        }));
    };

    const handleSaveFoundation = async () => {
        setError(null);
        setIsLoading(true);
        setLoadingText('Saving your vision...');
        try {
            const formData = {
                coreConcept: foundationValues.coreConcept,
                character: {
                    name: foundationValues.characterName,
                    description: foundationValues.characterDescription,
                },
                art: { style: foundationValues.artStyle },
                tone: foundationValues.tone,
                therapeuticGoal: foundationValues.therapeuticGoal,
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
                                    characterInfo={{
                                        description: storyBible.character.description,
                                        artStyle: storyBible.art.style,
                                    }}
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