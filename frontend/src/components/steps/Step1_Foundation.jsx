import React from 'react';
import { motion } from 'framer-motion';
import { LoadingSpinner } from '../common';

export const Step1_Foundation = ({
    book,
    values = {},
    handleChange = () => {},
    onSubmit,
    onClose,
    isLoading,
    loadingText,
    error
}) => {
    const motionProps = {
        initial: { opacity: 0, x: -20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 20 },
        transition: { duration: 0.3 }
    };

    const initialCharacterDescription = book?.story_bible?.character?.description || '';
    const initialCharacterName = book?.story_bible?.character?.name || '';
    const initialCoreConcept = book?.story_bible?.coreConcept || '';
    const initialTherapeuticGoal = book?.story_bible?.therapeuticGoal || '';
    const initialTone = book?.story_bible?.tone || '';
    const initialArtStyle = book?.story_bible?.art?.style || 'digital-art';

    return (
        <motion.div {...motionProps} className="p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Book Foundation</h2>
            <p className="text-slate-400 mb-6">
                Start by defining the core elements of your story. This helps the AI generate a consistent world for your characters.
            </p>

            <div className="space-y-6">
                <div>
                    <label htmlFor="coreConcept" className="block text-sm font-medium text-slate-300">Core Story Concept</label>
                    <textarea
                        id="coreConcept"
                        name="coreConcept"
                        rows="3"
                        value={values.coreConcept || initialCoreConcept}
                        onChange={handleChange}
                        className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="e.g., A little rabbit overcomes their fear of the dark."
                    />
                </div>

                <div>
                    <label htmlFor="characterName" className="block text-sm font-medium text-slate-300">Main Character Name</label>
                    <input
                        type="text"
                        id="characterName"
                        name="characterName"
                        value={values.characterName || initialCharacterName}
                        onChange={handleChange}
                        className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="e.g., Leo"
                    />
                </div>

                <div>
                    <label htmlFor="characterDescription" className="block text-sm font-medium text-slate-300">Main Character Description</label>
                    <textarea
                        id="characterDescription"
                        name="characterDescription"
                        rows="3"
                        value={values.characterDescription || initialCharacterDescription}
                        onChange={handleChange}
                        className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="e.g., a fluffy rabbit with big, expressive blue eyes, wearing a red jacket."
                    />
                </div>

                <div>
                    <label htmlFor="tone" className="block text-sm font-medium text-slate-300">Tone of the Story</label>
                    <select
                        id="tone"
                        name="tone"
                        value={values.tone || initialTone}
                        onChange={handleChange}
                        className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="">Select a tone</option>
                        <option value="joyful and whimsical">Joyful and whimsical</option>
                        <option value="calm and gentle">Calm and gentle</option>
                        <option value="adventurous and exciting">Adventurous and exciting</option>
                        <option value="magical and mysterious">Magical and mysterious</option>
                    </select>
                </div>

                <div>
                    <label htmlFor="artStyle" className="block text-sm font-medium text-slate-300">Art Style</label>
                    <select
                        id="artStyle"
                        name="artStyle"
                        value={values.artStyle || initialArtStyle}
                        onChange={handleChange}
                        // FIX: Corrected the typo in the background color class below
                        className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="digital-art">Digital Art</option>
                        <option value="line-art">Line Art</option>
                        <option value="comic-book">Comic Book</option>
                        <option value="fantasy-art">Fantasy Art</option>
                        <option value="anime">Anime</option>
                        <option value="photographic">Photographic</option>
                        <option value="cinematic">Cinematic</option>
                    </select>
                </div>

                <div>
                    <label htmlFor="therapeuticGoal" className="block text-sm font-medium text-slate-300">Therapeutic Goal (Optional)</label>
                    <input
                        type="text"
                        id="therapeuticGoal"
                        name="therapeuticGoal"
                        value={values.therapeuticGoal || initialTherapeuticGoal}
                        onChange={handleChange}
                        className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="e.g., Helps with feelings of anxiety."
                    />
                </div>
            </div>
            {error && <div className="mt-4"><Alert type="error" message={error} /></div>}
            <div className="p-8 pt-6 border-t border-slate-700 flex justify-between items-center mt-auto">
                <button type="button" onClick={onClose} className="text-slate-400 hover:text-white transition px-4 py-2" disabled={isLoading}>
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onSubmit}
                    className="inline-flex justify-center px-6 py-2 font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    disabled={isLoading}
                >
                    {isLoading ? <LoadingSpinner text={loadingText} /> : 'Save & Continue'}
                </button>
            </div>
        </motion.div>
    );
};