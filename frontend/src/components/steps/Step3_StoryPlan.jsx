import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient.js';
import { Alert, LoadingSpinner } from '../common.jsx';
import { BookOpenIcon } from '@heroicons/react/24/solid';
import { ModalStep } from '../common/ModalStep.jsx';

// --- CHANGE 1: Receive isLoading and loadingText props ---
export const Step3_StoryPlan = ({ bookId, onBack, onFinalize, isLoading: isFinalizing, loadingText }) => {
    const [storyPlan, setStoryPlan] = useState([]);
    const [isLoadingPlan, setIsLoadingPlan] = useState(false); // Renamed to avoid conflict
    const [error, setError] = useState(null);

    useEffect(() => {
        const generateStoryPlan = async () => {
            setIsLoadingPlan(true);
            setError(null);
            try {
                const response = await apiClient.post(`/picture-books/${bookId}/generate-story-plan`);
                setStoryPlan(response.data.storyPlan);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to generate story plan.');
            } finally {
                setIsLoadingPlan(false);
            }
        };
        generateStoryPlan();
    }, [bookId]);

    const handleStoryPlanChange = (index, field, value) => {
        const updatedPlan = [...storyPlan];
        updatedPlan[index][field] = value;
        setStoryPlan(updatedPlan);
    };

    const handleFinalize = () => {
        onFinalize(storyPlan);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <ModalStep title="Review and Edit Your Story" description="Here is your 20-page story plan. You can edit the text before the final images are created.">
                {error && <Alert type="error" message={error} />}
                {isLoadingPlan ? (
                    <div className="flex items-center justify-center h-full">
                        <LoadingSpinner text="Writing your 20-page story plan..." />
                    </div>
                ) : (
                    <div className="space-y-4 px-4">
                        {storyPlan.map((page, index) => (
                            <div key={page.page_number} className="p-4 bg-slate-700/50 border border-slate-600 rounded-lg">
                                <h4 className="font-bold text-white">Page {page.page_number}</h4>
                                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-semibold text-slate-300 flex items-center mb-1">
                                            <BookOpenIcon className="w-4 h-4 mr-1"/>Story Text
                                        </label>
                                        <textarea
                                            value={page.storyText}
                                            onChange={(e) => handleStoryPlanChange(index, 'storyText', e.target.value)}
                                            className="w-full p-2 bg-slate-600 border border-slate-500 rounded-md text-white text-sm"
                                            rows="4"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-slate-400 mb-1">Image Description (for AI)</label>
                                        <textarea
                                            value={page.imagePrompt}
                                            onChange={(e) => handleStoryPlanChange(index, 'imagePrompt', e.target.value)}
                                            className="w-full p-2 bg-slate-600 border border-slate-500 rounded-md text-xs text-slate-300"
                                            rows="4"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ModalStep>

            <div className="p-8 pt-6 border-t border-slate-700 flex justify-between items-center mt-auto">
                <button type="button" onClick={onBack} className="text-slate-400 hover:text-white transition px-4 py-2" disabled={isFinalizing}>Back</button>
                {/* --- CHANGE 2: Update the button to use the new isFinalizing prop --- */}
                <button
                    type="button"
                    onClick={handleFinalize}
                    className="inline-flex justify-center px-6 py-2 font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50"
                    disabled={storyPlan.length === 0 || isFinalizing}
                >
                    {isFinalizing ? <LoadingSpinner text={loadingText || 'Finalizing...'} /> : 'Finalize & Create My Book'}
                </button>
            </div>
        </div>
    );
};