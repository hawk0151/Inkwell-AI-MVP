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
    
    // Note: The logic for initial values is now handled in the parent StoryBibleModal.jsx
    // This component now just receives the fully formed `values` prop.

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
                        value={values.coreConcept || ''}
                        onChange={handleChange}
                        className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="e.g., A little rabbit overcomes their fear of the dark."
                    />
                </div>

                {/* --- START OF REPLACEMENT --- */}
                {/* The Character Name and Description fields are replaced with a structured form. */}
                <div className="p-4 border border-slate-700 rounded-lg space-y-4 bg-slate-900/50">
                    <h3 className="text-lg font-semibold text-white">Main Character Details</h3>

                    <div>
                        <label htmlFor="character.name" className="block text-sm font-medium text-slate-300">Character Name</label>
                        <input
                            type="text"
                            id="character.name"
                            name="character.name"
                            value={values.character?.name || ''}
                            onChange={handleChange}
                            className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white px-3 py-2"
                            placeholder="e.g., Charlie"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="character.age" className="block text-sm font-medium text-slate-300">Age Range</label>
                            <select
                                id="character.age"
                                name="character.age"
                                value={values.character?.age || 'toddler'}
                                onChange={handleChange}
                                className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white px-3 py-2"
                            >
                                <option value="toddler">Toddler (2-4 years)</option>
                                <option value="young-child">Young Child (5-8 years)</option>
                                <option value="child">Child (9-12 years)</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="character.gender" className="block text-sm font-medium text-slate-300">Gender</label>
                            <select
                                id="character.gender"
                                name="character.gender"
                                value={values.character?.gender || 'male'}
                                onChange={handleChange}
                                className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white px-3 py-2"
                            >
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="character.ethnicity" className="block text-sm font-medium text-slate-300">Appearance / Ethnicity</label>
                            <input
                                type="text"
                                id="character.ethnicity"
                                name="character.ethnicity"
                                value={values.character?.ethnicity || ''}
                                onChange={handleChange}
                                placeholder="e.g., African American, East Asian"
                                className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white px-3 py-2"
                            />
                        </div>
                        <div>
                            <label htmlFor="character.hair" className="block text-sm font-medium text-slate-300">Hair</label>
                            <input
                                type="text"
                                id="character.hair"
                                name="character.hair"
                                value={values.character?.hair || ''}
                                onChange={handleChange}
                                placeholder="e.g., with red hair, with curly blonde hair"
                                className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white px-3 py-2"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="character.clothing" className="block text-sm font-medium text-slate-300">Clothing</label>
                        <input
                            type="text"
                            id="character.clothing"
                            name="character.clothing"
                            value={values.character?.clothing || ''}
                            onChange={handleChange}
                            placeholder="e.g., wearing a blue t-shirt and jeans"
                            className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white px-3 py-2"
                        />
                    </div>
                    <div>
                        <label htmlFor="character.extras" className="block text-sm font-medium text-slate-300">Distinctive Features (Optional)</label>
                        <input
                            type="text"
                            id="character.extras"
                            name="character.extras"
                            value={values.character?.extras || ''}
                            onChange={handleChange}
                            placeholder="e.g., with freckles, wearing glasses"
                            className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md shadow-sm text-white px-3 py-2"
                        />
                    </div>
                </div>
                {/* --- END OF REPLACEMENT --- */}

                <div>
                    <label htmlFor="tone" className="block text-sm font-medium text-slate-300">Tone of the Story</label>
                    <select
                        id="tone"
                        name="tone"
                        value={values.tone || ''}
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
                        value={values.artStyle || 'digital-art'}
                        onChange={handleChange}
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
                        value={values.therapeuticGoal || ''}
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