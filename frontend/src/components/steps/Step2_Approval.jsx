import React from 'react';
import { ModalStep } from '../common/ModalStep.jsx';
import { LoadingSpinner } from '../common.jsx';

export const Step2_Approval = ({ selectedImageUrl, onBack, onConfirm, isLoading, loadingText }) => {
    if (!selectedImageUrl) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-slate-400">No image selected. Please go back.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <ModalStep title="Confirm Your Character" description="This will lock in your character's appearance for the rest of the story.">
                <div className="px-8 flex justify-center items-center">
                    <img
                        src={selectedImageUrl}
                        alt="Selected character reference"
                        className="rounded-lg shadow-2xl max-h-[50vh] object-contain border-4 border-slate-700"
                    />
                </div>
            </ModalStep>

            <div className="p-8 pt-6 border-t border-slate-700 flex justify-between items-center mt-auto">
                <button type="button" onClick={onBack} className="text-slate-400 hover:text-white transition px-4 py-2" disabled={isLoading}>
                    Back to Selection
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    className="inline-flex justify-center px-6 py-2 font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    disabled={isLoading}
                >
                    {isLoading ? <LoadingSpinner text={loadingText} /> : 'Confirm & Create Story Plan'}
                </button>
            </div>
        </div>
    );
};
