import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MagicWandIcon } from './common.jsx';

const PromptForm = ({ isLoading, onSubmit }) => {
    // NEW: Consolidated state for all form details
    const [details, setDetails] = useState({
        title: '',
        recipientName: '',
        characterDetails: {
            name: '',
            gender: 'unspecified',
            appearance: '',
            trait: '',
        },
        sidekick: null, // Starts as null, will be an object if checked
        setting: {
            location: '',
            vacationSpot: '',
        },
        inclusion: {
            friends: [],
        },
        interests: '',
        genre: 'Adventure',
        subgenre: '',
        tone: 'Whimsical',
        moral: '',
        insideJoke: '',
        outputOptions: {
            includeIllustrations: false,
        },
    });
    const [showSidekickForm, setShowSidekickForm] = useState(false);
    const [showFriendForm, setShowFriendForm] = useState(false);
    
    const genres = ['Adventure', 'Fantasy', 'Sci-Fi', 'Mystery', 'Fairy Tale', 'Comedy'];
    const subgenres = {
        Adventure: ['Swashbuckling Pirate Adventure', 'Intergalactic Space Adventure', 'Jungle Expedition'],
        Fantasy: ['Epic High Fantasy', 'Urban Fantasy', 'Fable'],
        'Sci-Fi': ['Cyberpunk', 'Space Opera', 'Dystopian'],
        Mystery: ['Classic Whodunnit', 'Noir', 'Supernatural'],
        'Fairy Tale': ['Classic Folk Tale', 'Modern Retelling'],
        Comedy: ['Slapstick', 'Satire', 'Black Comedy']
    };
    const tones = ['Whimsical', 'Serious', 'Humorous', 'Inspiring'];
    const morals = ['Friendship', 'Courage', 'Kindness', 'Perseverance'];
    const petTypes = ['Dog', 'Cat', 'Hamster', 'Dragon', 'Robot', 'Owl'];
    const petTraits = ['Loyal', 'Mischievous', 'Sleepy', 'Brave', 'Witty'];

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        if (name.startsWith('characterDetails.')) {
            const field = name.split('.')[1];
            setDetails(prev => ({ 
                ...prev, 
                characterDetails: { ...prev.characterDetails, [field]: value } 
            }));
        } else if (name.startsWith('sidekick.')) {
            const field = name.split('.')[1];
            setDetails(prev => ({
                ...prev,
                sidekick: { ...prev.sidekick, [field]: value }
            }));
        } else if (name.startsWith('setting.')) {
            const field = name.split('.')[1];
            setDetails(prev => ({
                ...prev,
                setting: { ...prev.setting, [field]: value }
            }));
        } else if (name.startsWith('outputOptions.')) {
            const field = name.split('.')[1];
            setDetails(prev => ({
                ...prev,
                outputOptions: { ...prev.outputOptions, [field]: checked }
            }));
        } else {
            setDetails((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        }
    };

    const handleAddFriend = () => {
        const newFriends = [...details.inclusion.friends, { name: '', relationship: '' }];
        setDetails(prev => ({
            ...prev,
            inclusion: { ...prev.inclusion, friends: newFriends }
        }));
    };

    const handleFriendChange = (index, e) => {
        const { name, value } = e.target;
        const newFriends = details.inclusion.friends.map((friend, i) =>
            i === index ? { ...friend, [name]: value } : friend
        );
        setDetails(prev => ({
            ...prev,
            inclusion: { ...prev.inclusion, friends: newFriends }
        }));
    };

    const handleRemoveFriend = (index) => {
        const newFriends = details.inclusion.friends.filter((_, i) => i !== index);
        setDetails(prev => ({
            ...prev,
            inclusion: { ...prev.inclusion, friends: newFriends }
        }));
    };

    const toggleSidekick = (e) => {
        const isChecked = e.target.checked;
        setShowSidekickForm(isChecked);
        setDetails(prev => ({
            ...prev,
            sidekick: isChecked ? { name: '', type: 'Dog', trait: 'Loyal' } : null
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isLoading) return;

        // Create a clean copy of the details to send to the backend
        const cleanedDetails = {
            ...details,
            // Filter out empty friends
            inclusion: {
                friends: details.inclusion.friends.filter(f => f.name.trim() !== ''),
            },
            // Ensure sidekick is an object if the form was shown
            sidekick: showSidekickForm ? details.sidekick : null,
        };

        onSubmit(cleanedDetails);
    };

    const inputClasses = "w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500";
    const labelClasses = "block text-sm font-medium text-slate-300 mb-2";
    
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-slate-800/50 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-slate-700"
        >
            <form onSubmit={handleSubmit} className="w-full space-y-6">
                {/* Core Fields */}
                <div>
                    <label htmlFor="title" className={labelClasses}>Book Title</label>
                    <input type="text" id="title" name="title" value={details.title} onChange={handleChange} placeholder="e.g., The Adventures of Captain Alistair" className={inputClasses} required />
                </div>
                <div>
                    <label htmlFor="recipientName" className={labelClasses}>Who is this book for?</label>
                    <input type="text" id="recipientName" name="recipientName" value={details.recipientName} onChange={handleChange} placeholder="e.g., My Dad" className={inputClasses} required />
                </div>

                {/* Main Character Details */}
                <div className="border-t border-slate-600 pt-6">
                    <h3 className="text-xl font-bold text-amber-400 mb-4">Main Character Details</h3>
                    <div>
                        <label htmlFor="characterName" className={labelClasses}>Main character's name?</label>
                        <input type="text" id="characterName" name="characterDetails.name" value={details.characterDetails.name} onChange={handleChange} placeholder="e.g., Captain Alistair" className={inputClasses} required />
                    </div>
                    <div className="mt-4">
                        <label htmlFor="characterGender" className={labelClasses}>Character Gender</label>
                        <select id="characterGender" name="characterDetails.gender" value={details.characterDetails.gender} onChange={handleChange} className={inputClasses}>
                            <option value="unspecified">Unspecified</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                        </select>
                    </div>
                    <div className="mt-4">
                        <label htmlFor="characterAppearance" className={labelClasses}>Appearance (optional)</label>
                        <input type="text" id="characterAppearance" name="characterDetails.appearance" value={details.characterDetails.appearance} onChange={handleChange} placeholder="e.g., short blonde hair, blue eyes" className={inputClasses} />
                    </div>
                    <div className="mt-4">
                        <label htmlFor="characterTrait" className={labelClasses}>Personality Trait (optional)</label>
                        <input type="text" id="characterTrait" name="characterDetails.trait" value={details.characterDetails.trait} onChange={handleChange} placeholder="e.g., Brave and Witty" className={inputClasses} />
                    </div>
                </div>

                {/* Sidekick/Companion Section */}
                <div className="border-t border-slate-600 pt-6">
                    <div className="flex items-center mb-4">
                        <input id="includeSidekick" type="checkbox" checked={showSidekickForm} onChange={toggleSidekick} className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-slate-600 rounded" />
                        <label htmlFor="includeSidekick" className="ml-3 text-lg font-medium text-slate-300">Include a sidekick or pet?</label>
                    </div>
                    {showSidekickForm && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4 pl-8 border-l-2 border-indigo-500">
                            <div>
                                <label htmlFor="sidekickName" className={labelClasses}>Sidekick's Name</label>
                                <input type="text" id="sidekickName" name="sidekick.name" value={details.sidekick?.name || ''} onChange={handleChange} placeholder="e.g., Pixel" className={inputClasses} />
                            </div>
                            <div>
                                <label htmlFor="sidekickType" className={labelClasses}>Type of Sidekick</label>
                                <select id="sidekickType" name="sidekick.type" value={details.sidekick?.type || 'Dog'} onChange={handleChange} className={inputClasses}>
                                    {petTypes.map((t) => (<option key={t} value={t}>{t}</option>))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="sidekickTrait" className={labelClasses}>Sidekick's Trait</label>
                                <select id="sidekickTrait" name="sidekick.trait" value={details.sidekick?.trait || 'Loyal'} onChange={handleChange} className={inputClasses}>
                                    {petTraits.map((t) => (<option key={t} value={t}>{t}</option>))}
                                </select>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Setting/Location Details */}
                <div className="border-t border-slate-600 pt-6">
                    <h3 className="text-xl font-bold text-amber-400 mb-4">Story Setting (optional)</h3>
                    <div>
                        <label htmlFor="settingLocation" className={labelClasses}>Specific Location</label>
                        <input type="text" id="settingLocation" name="setting.location" value={details.setting.location} onChange={handleChange} placeholder="e.g., Paris, France" className={inputClasses} />
                    </div>
                    <div className="mt-4">
                        <label htmlFor="dreamVacationSpot" className={labelClasses}>Dream Vacation Spot</label>
                        <input type="text" id="dreamVacationSpot" name="setting.vacationSpot" value={details.setting.vacationSpot} onChange={handleChange} placeholder="e.g., The Swiss Alps" className={inputClasses} />
                    </div>
                </div>
        
                {/* Inclusion of Friends/Family */}
                <div className="border-t border-slate-600 pt-6">
                    <h3 className="text-xl font-bold text-amber-400 mb-4">Friends & Family (optional)</h3>
                    <p className="text-sm text-slate-400 mb-4">You can add up to 3 friends or family members to be in the story.</p>
                    {details.inclusion.friends.map((friend, index) => (
                        <motion.div key={index} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex space-x-2 mb-4 items-end">
                            <div className="flex-grow">
                                <label className={labelClasses}>Friend's Name</label>
                                <input type="text" name="name" value={friend.name} onChange={(e) => handleFriendChange(index, e)} placeholder="e.g., Alex" className={inputClasses} />
                            </div>
                            <div className="flex-grow">
                                <label className={labelClasses}>Relationship</label>
                                <input type="text" name="relationship" value={friend.relationship} onChange={(e) => handleFriendChange(index, e)} placeholder="e.g., Sibling" className={inputClasses} />
                            </div>
                            <button type="button" onClick={() => handleRemoveFriend(index)} className="p-3 bg-red-600 rounded-lg text-white hover:bg-red-500 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                        </motion.div>
                    ))}
                    {details.inclusion.friends.length < 3 && (
                        <button type="button" onClick={handleAddFriend} className="mt-4 text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                            + Add another character
                        </button>
                    )}
                </div>

                {/* Hobbies/Interests and Interactive Elements */}
                <div className="border-t border-slate-600 pt-6">
                    <h3 className="text-xl font-bold text-amber-400 mb-4">Story Content</h3>
                    <div>
                        <label htmlFor="interests" className={labelClasses}>What do they love? (e.g., sailing, classic cars)</label>
                        <textarea id="interests" name="interests" value={details.interests} onChange={handleChange} placeholder="Separate interests with commas" className={`${inputClasses} h-28`} required />
                    </div>
                    <div className="mt-4">
                        <label htmlFor="moral" className={labelClasses}>Moral of the Story (optional)</label>
                        <select id="moral" name="moral" value={details.moral} onChange={handleChange} className={inputClasses}>
                            <option value="">Choose a theme...</option>
                            {morals.map((m) => (<option key={m} value={m}>{m}</option>))}
                        </select>
                    </div>
                    <div className="mt-4">
                        <label htmlFor="insideJoke" className={labelClasses}>Inside Joke or memory (optional)</label>
                        <input type="text" id="insideJoke" name="insideJoke" value={details.insideJoke} onChange={handleChange} placeholder="e.g., The time we got lost finding the best ice cream shop" className={inputClasses} />
                    </div>
                </div>

                {/* Genre and Tone Customization */}
                <div className="border-t border-slate-600 pt-6">
                    <h3 className="text-xl font-bold text-amber-400 mb-4">Genre & Tone</h3>
                    <div>
                        <label htmlFor="genre" className={labelClasses}>Choose a genre</label>
                        <select id="genre" name="genre" value={details.genre} onChange={handleChange} className={inputClasses} required>
                            {genres.map((g) => (<option key={g} value={g}>{g}</option>))}
                        </select>
                    </div>
                    {details.genre && subgenres[details.genre] && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.3 }} className="mt-4">
                            <label htmlFor="subgenre" className={labelClasses}>Choose a sub-genre</label>
                            <select id="subgenre" name="subgenre" value={details.subgenre} onChange={handleChange} className={inputClasses}>
                                <option value="">None</option>
                                {subgenres[details.genre].map((sg) => (<option key={sg} value={sg}>{sg}</option>))}
                            </select>
                        </motion.div>
                    )}
                    <div className="mt-4">
                        <label htmlFor="tone" className={labelClasses}>Tone of the story</label>
                        <select id="tone" name="tone" value={details.tone} onChange={handleChange} className={inputClasses}>
                            {tones.map((t) => (<option key={t} value={t}>{t}</option>))}
                        </select>
                    </div>
                </div>
                
                <div className="pt-4">
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="submit" 
                        disabled={isLoading} 
                        className="w-full flex items-center justify-center bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition-all duration-300 shadow-lg text-lg"
                    >
                        <MagicWandIcon className="h-6 w-6 mr-3" />
                        {isLoading ? 'Crafting your first chapter...' : 'Create My Book'}
                    </motion.button>
                </div>
            </form>
        </motion.div>
    );
};

export default PromptForm;