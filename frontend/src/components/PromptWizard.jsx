// frontend/src/components/PromptWizard.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Helper Icon Components ---
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;

const ToggleSwitch = ({ enabled, onClick }) => (
    <div onClick={onClick} className={`w-12 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${enabled ? 'bg-green-500 justify-end' : 'bg-slate-600 justify-start'}`}>
        <motion.div layout className="w-5 h-5 bg-white rounded-full shadow-md" />
    </div>
);

const StepIndicator = ({ current, total }) => (
    <div className="w-full mb-8">
        <p className="text-sm text-slate-400 text-center mb-2">Step {current} of {total}</p>
        <div className="bg-slate-700 rounded-full h-2 w-full">
            <motion.div
                className="bg-green-500 h-2 rounded-full"
                animate={{ width: `${((current - 1) / (total - 1)) * 100}%` }}
                transition={{ ease: "easeInOut", duration: 0.5 }}
            />
        </div>
    </div>
);

const RequiredLabel = ({ children }) => (
    <label className="block text-slate-300 mb-2">{children} <span className="text-red-500">*</span></label>
);

// --- Main Wizard Component ---
const PromptWizard = ({ isLoading, onSubmit }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        bookTitle: '',
        ageGroup: '',
        mainCharacter: { name: '', gender: 'Unspecified', appearance: '', trait: '' },
        includeSidekick: false,
        sidekick: { name: '', type: 'Pet', trait: '' },
        setting: { location: '' },
        inclusion: { friends: [] },
        interests: '',
        moral: '',
        insideJoke: '',
        genre: '',
        subGenre: '',
        tone: '',
    });

    const handleNext = () => (step < 5 ? setStep(step + 1) : onSubmit(formData));
    const handleBack = () => setStep(step - 1);

    const handleFormData = (section, field, value) => {
        if (section) {
            setFormData(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
        } else {
            setFormData(prev => ({ ...prev, [field]: value }));
        }
    };
    
    const handleAddCharacter = () => {
        if (formData.inclusion.friends.length < 3) {
            setFormData(prev => ({ ...prev, inclusion: { friends: [...prev.inclusion.friends, { id: Date.now(), name: '', relationship: '' }] } }));
        }
    };
    
    const handleRemoveCharacter = (id) => {
        setFormData(prev => ({ ...prev, inclusion: { friends: prev.inclusion.friends.filter(c => c.id !== id) } }));
    };
    
    const handleCharacterChange = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            inclusion: {
                ...prev.inclusion,
                friends: prev.inclusion.friends.map(c => c.id === id ? { ...c, [field]: value } : c)
            }
        }));
    };

    const isStepComplete = () => {
        switch (step) {
            case 1: return formData.bookTitle.trim() !== '' && formData.ageGroup !== '';
            case 2: return formData.mainCharacter.name.trim() !== '';
            case 3: return true; // All fields are optional
            case 4: return formData.genre !== '' && formData.tone !== '';
            case 5: return formData.interests.trim() !== '';
            default: return false;
        }
    };

    const inputClasses = "w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg";
    const buttonGroupOption = (value, selectedValue, onClick) => `px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${selectedValue === value ? 'bg-green-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`;

    return (
        <div className="bg-slate-800/50 backdrop-blur-md p-8 md:p-14 rounded-2xl shadow-2xl border border-slate-700 w-full">
            <StepIndicator current={step} total={5} />
            <AnimatePresence mode="wait">
                <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                    {step === 1 && (
                        <div>
                            <h2 className="text-3xl font-bold text-center mb-6">Let's start your story</h2>
                            <div className="space-y-6">
                                <div>
                                    <RequiredLabel>Your Book's Title</RequiredLabel>
                                    <input type="text" placeholder="e.g., The Adventures of Captain Claw" value={formData.bookTitle} onChange={e => handleFormData(null, 'bookTitle', e.target.value)} className={inputClasses} />
                                </div>
                                <div>
                                    <RequiredLabel>Who is this book for?</RequiredLabel>
                                    <div className="flex flex-wrap gap-3">{['Children', 'Teen', 'Young Adult', 'Adult'].map(age => <button key={age} onClick={() => handleFormData(null, 'ageGroup', age)} className={buttonGroupOption(age, formData.ageGroup)}>{age}</button>)}</div>
                                </div>
                            </div>
                        </div>
                    )}
                    {step === 2 && (
                         <div>
                            <h2 className="text-3xl font-bold text-center mb-6">Create the main character</h2>
                            <div className="space-y-6">
                                <div>
                                    <RequiredLabel>Character's Name</RequiredLabel>
                                    <input type="text" placeholder="e.g., Alex" value={formData.mainCharacter.name} onChange={e => handleFormData('mainCharacter', 'name', e.target.value)} className={inputClasses} />
                                </div>
                                <div>
                                    <label className="block text-slate-300 mb-2">Gender</label>
                                    <div className="flex gap-3">{['Male', 'Female', 'Unspecified'].map(g => <button key={g} onClick={() => handleFormData('mainCharacter', 'gender', g)} className={buttonGroupOption(g, formData.mainCharacter.gender)}>{g}</button>)}</div>
                                </div>
                                <textarea placeholder="Appearance (optional)" value={formData.mainCharacter.appearance} onChange={e => handleFormData('mainCharacter', 'appearance', e.target.value)} className={inputClasses} rows="2"></textarea>
                                <textarea placeholder="Personality Trait (optional, e.g., brave, curious)" value={formData.mainCharacter.trait} onChange={e => handleFormData('mainCharacter', 'trait', e.target.value)} className={inputClasses} rows="2"></textarea>
                            </div>
                        </div>
                    )}
                     {step === 3 && (
                        <div>
                            <h2 className="text-3xl font-bold text-center mb-6">Build their world</h2>
                            <div className="space-y-6">
                                <input type="text" placeholder="Story Setting (optional, e.g., a futuristic city)" value={formData.setting.location} onChange={e => handleFormData('setting', 'location', e.target.value)} className={inputClasses} />
                                <div className="flex items-center justify-between bg-slate-700/50 p-4 rounded-lg">
                                    <label className="text-slate-200 text-lg">Include a sidekick or pet?</label>
                                    <ToggleSwitch enabled={formData.includeSidekick} onClick={() => handleFormData(null, 'includeSidekick', !formData.includeSidekick)} />
                                </div>
                                <AnimatePresence>
                                {formData.includeSidekick && (
                                    <motion.div initial={{opacity: 0, height: 0}} animate={{opacity: 1, height: 'auto'}} exit={{opacity: 0, height: 0}} className="space-y-4 pt-2 border-t border-slate-700">
                                        <input type="text" placeholder="Sidekick/Pet's Name" value={formData.sidekick.name} onChange={e => handleFormData('sidekick', 'name', e.target.value)} className={inputClasses} />
                                        <input type="text" placeholder="Type (e.g., robot, talking dog)" value={formData.sidekick.type} onChange={e => handleFormData('sidekick', 'type', e.target.value)} className={inputClasses} />
                                        <input type="text" placeholder="Trait (e.g., clumsy, wise)" value={formData.sidekick.trait} onChange={e => handleFormData('sidekick', 'trait', e.target.value)} className={inputClasses} />
                                    </motion.div>
                                )}
                                </AnimatePresence>
                                <div>
                                    <label className="block text-slate-300 mb-2">Friends & Family (optional, up to 3)</label>
                                    <div className="space-y-3">
                                        {formData.inclusion.friends.map((char) => (
                                            <div key={char.id} className="flex items-center gap-2">
                                                <UserIcon />
                                                {/* FIXED: Removed w-full from these two inputs */}
                                                <input type="text" placeholder="Name" value={char.name} onChange={e => handleCharacterChange(char.id, 'name', e.target.value)} className="p-2 bg-slate-600 border border-slate-500 rounded-lg flex-1" />
                                                <input type="text" placeholder="Relation (e.g., best friend)" value={char.relationship} onChange={e => handleCharacterChange(char.id, 'relationship', e.target.value)} className="p-2 bg-slate-600 border border-slate-500 rounded-lg flex-1" />
                                                <button onClick={() => handleRemoveCharacter(char.id)} className="p-2 text-slate-400 hover:text-red-500"><TrashIcon /></button>
                                            </div>
                                        ))}
                                    </div>
                                    {formData.inclusion.friends.length < 3 && <button onClick={handleAddCharacter} className="text-green-400 hover:text-green-300 mt-3">+ Add another character</button>}
                                </div>
                            </div>
                        </div>
                    )}
                    {step === 4 && (
                        <div>
                            <h2 className="text-3xl font-bold text-center mb-6">Choose the Genre & Tone</h2>
                            <div className="space-y-8">
                                <div>
                                    <RequiredLabel>Genre</RequiredLabel>
                                    <div className="flex flex-wrap gap-3">{['Adventure', 'Fantasy', 'Sci-Fi', 'Mystery', 'Fairy Tale'].map(g => <button key={g} onClick={() => handleFormData(null, 'genre', g)} className={buttonGroupOption(g, formData.genre)}>{g}</button>)}</div>
                                </div>
                                 <div>
                                    <label className="block text-slate-300 mb-2">Sub-Genre (optional)</label>
                                    <input type="text" placeholder="e.g., Swashbuckling Pirate, Space Opera" value={formData.subGenre} onChange={e => handleFormData(null, 'subGenre', e.target.value)} className={inputClasses} />
                                </div>
                                <div>
                                    <RequiredLabel>Tone of the story</RequiredLabel>
                                    <div className="flex flex-wrap gap-3">{['Whimsical', 'Serious', 'Humorous', 'Inspiring'].map(t => <button key={t} onClick={() => handleFormData(null, 'tone', t)} className={buttonGroupOption(t, formData.tone)}>{t}</button>)}</div>
                                </div>
                            </div>
                        </div>
                    )}
                     {step === 5 && (
                        <div>
                            <h2 className="text-3xl font-bold text-center mb-6">Add the final details</h2>
                            <div className="space-y-6">
                                <div>
                                    <RequiredLabel>What does the character love?</RequiredLabel>
                                    <input type="text" placeholder="e.g., sailing, classic cars, star-gazing" value={formData.interests} onChange={e => handleFormData(null, 'interests', e.target.value)} className={inputClasses} />
                                </div>
                                <textarea placeholder="Inside joke or special memory (optional)" value={formData.insideJoke} onChange={e => handleFormData(null, 'insideJoke', e.target.value)} className={inputClasses} rows="3"></textarea>
                                <div>
                                    <label className="block text-slate-300 mb-2">Moral of the Story (optional)</label>
                                    <div className="flex flex-wrap gap-3">{['Friendship', 'Courage', 'Kindness', 'Perseverance'].map(moral => <button key={moral} onClick={() => handleFormData(null, 'moral', moral)} className={buttonGroupOption(moral, formData.moral)}>{moral}</button>)}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

            <div className="mt-8 pt-6 border-t border-slate-700 flex justify-between items-center">
                <button onClick={handleBack} className={`text-slate-400 hover:text-white transition ${step === 1 ? 'opacity-0 cursor-default' : 'opacity-100'}`} disabled={step === 1}>Back</button>
                <button onClick={handleNext} disabled={!isStepComplete() || isLoading} className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 transition-all duration-300 shadow-lg disabled:bg-slate-500 disabled:cursor-not-allowed">
                    {isLoading ? 'Creating...' : (step === 5 ? 'Create Book' : 'Next')}
                </button>
            </div>
        </div>
    );
};

export default PromptWizard;