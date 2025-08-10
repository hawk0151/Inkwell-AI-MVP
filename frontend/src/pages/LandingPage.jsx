import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import Testimonials from '../components/Testimonials';
import PageHeader from '../components/PageHeader';
import CreationCard from '../components/CreationCard';
import { Alert, LoadingSpinner } from '../components/common';
import { HandRaisedIcon, PencilSquareIcon, SparklesIcon, BookOpenIcon, StarIcon, BeakerIcon } from '@heroicons/react/24/outline';

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (delay = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.7, ease: [0.2, 0.65, 0.3, 0.9], delay },
    }),
};

const HowItWorksCard = ({ icon: Icon, title, description, delay }) => (
    <motion.div 
        className="bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl border border-slate-700 hover:border-indigo-500 transition-colors duration-300 shadow-2xl h-full"
        variants={fadeUp}
        custom={delay}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.5 }}
    >
        <div className="flex items-center space-x-4 mb-4">
            <div className="bg-teal-600/20 p-3 rounded-full">
                <Icon className="h-6 w-6 text-teal-400" /> 
            </div>
            <h3 className="text-xl font-bold font-serif text-white">{title}</h3>
        </div>
        <p className="text-slate-300 text-base">{description}</p>
    </motion.div>
);

const HowItWorksStepperNode = ({ icon: Icon, title, description, isLast = false }) => (
    <div className="flex">
        <div className="flex flex-col items-center mr-4">
            <div>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-teal-600/20 border-2 border-teal-500">
                    <Icon className="w-6 h-6 text-teal-300" />
                </div>
            </div>
            {!isLast && <div className="w-px h-full bg-slate-700" />}
        </div>
        <div className="pb-8 pt-1">
            <p className="mb-1 text-xl font-bold font-serif text-white">{title}</p>
            <p className="text-slate-300">{description}</p>
        </div>
    </div>
);

function LandingPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [localError, setLocalError] = useState(null);

    const createPictureBookMutation = useMutation({
        mutationFn: async (title) => {
            const response = await apiClient.post('/picture-books', { title });
            return response.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['allProjects'] });
            navigate(`/picture-book/${data.bookId}`);
        },
        onError: (error) => {
            setLocalError(`Failed to create picture book: ${error.response?.data?.message || error.message}`);
        },
    });

    const handlePictureBookCreation = () => {
        const title = window.prompt("What is the title of your new picture book?");
        if (title && title.trim() !== '') {
            createPictureBookMutation.mutate(title.trim());
        } else if (title !== null) {
            setLocalError("Picture book title cannot be empty.");
        }
    };

    const headlineText = "Bring Your Story to";
    const headlineContainer = { visible: { transition: { staggerChildren: 0.3 } } };
    const headlineWord = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring', damping: 15, stiffness: 50 } },
    };

    return (
        <div className="bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] text-white">
            
            <div className="min-h-screen text-center p-4 pt-48 pb-24">
                <div>
                    <motion.h1 
                        className="text-5xl sm:text-7xl lg:text-8xl font-extrabold font-serif bg-clip-text text-transparent bg-gradient-to-r from-slate-200 to-blue-300 leading-snug lg:leading-normal"
                        variants={headlineContainer}
                        initial="hidden"
                        animate="visible"
                    >
                        {headlineText.split(" ").map((word, index) => (
                            <motion.span key={index} variants={headlineWord} className="inline-block">
                                {word}&nbsp;
                            </motion.span>
                        ))}
                        <motion.span variants={headlineWord} className="inline-block text-teal-400">Life.</motion.span>
                    </motion.h1>
                    <motion.p 
                        className="mt-6 max-w-2xl mx-auto text-lg md:text-xl text-slate-300"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 2.0 }}
                    >
                        Our state-of-the-art AI transforms your ideas into rich, narrative-driven stories and stunningly illustrated picture books.
                    </motion.p>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 2.2 }}
                    >
                        <button
                            onClick={() => document.getElementById('creation-section').scrollIntoView({ behavior: 'smooth' })}
                            className="mt-10 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-10 rounded-lg transition-colors duration-300 shadow-lg text-lg"
                        >
                            Start Creating Now
                        </button>
                        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-8 mt-12 text-slate-400">
                            <div className="flex items-center gap-2"><BeakerIcon className="h-5 w-5 text-teal-400"/> AI-Powered Co-Author</div>
                            <div className="flex items-center gap-2"><BookOpenIcon className="h-5 w-5 text-teal-400"/> Beautiful Printed Keepsakes</div>
                            <div className="flex items-center gap-2"><StarIcon className="h-5 w-5 text-teal-400"/> Uniquely Personal</div>
                        </div>
                    </motion.div>
                </div>
            </div>
            
            <div className="max-w-4xl mx-auto pt-24 pb-12 px-4">
<h2 className="text-4xl md:text-5xl font-bold font-serif text-center mb-16 text-teal-400 sticky top-0 py-4 bg-transparent backdrop-blur-sm z-10">                    How It Works
                 </h2>
                 <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-8">
                    <HowItWorksCard icon={PencilSquareIcon} title="1. Choose Your Format" description="Start by selecting either a 'Text-Based Book' for a novel-style story or a 'Picture Book' for an illustrated tale." delay={0.1} />
                    <HowItWorksCard icon={HandRaisedIcon} title="2. Provide Your Details" description="Tell our AI who the book is for, the main character, their interests, and a genre. These details are the seeds of your story." delay={0.2} />
                    <HowItWorksCard icon={SparklesIcon} title="3. AI Generation" description="Our powerful AI will craft your story, generating new chapters for novels or creating stunning illustrations for picture books." delay={0.3} />
                    <HowItWorksCard icon={BookOpenIcon} title="4. Personalize & Refine" description="In the editor, you have full control to refine chapters, adjust images, and ensure your story is exactly how you envisioned it." delay={0.4} />
                 </div>
                 <div className="md:hidden">
                    <HowItWorksStepperNode icon={PencilSquareIcon} title="1. Choose Your Format" description="Select a text or picture book." />
                    <HowItWorksStepperNode icon={HandRaisedIcon} title="2. Provide Your Details" description="Tell our AI about your story." />
                    <HowItWorksStepperNode icon={SparklesIcon} title="3. AI Generation" description="Watch as our AI crafts your creation." />
                    <HowItWorksStepperNode icon={BookOpenIcon} title="4. Personalize & Refine" description="You have full control to perfect every detail." isLast={true} />
                 </div>
            </div>

            <div id="creation-section" className="pt-12 pb-24">
                <PageHeader 
                  title="Choose Your Creation"
                  subtitle="Select a format to begin your personalized story."
                />
                
                {localError && <Alert type="error" message={localError} onClose={() => setLocalError(null)} />}

                <motion.div 
                    className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 max-w-5xl mx-auto mt-8 px-4"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.3 }}
                    variants={{ visible: { transition: { staggerChildren: 0.2 } } }}
                >
                    <CreationCard
                        title="Text-Based Book"
                        description="Create a novel or storybook with our AI author, chapter by chapter."
                        onClick={() => navigate('/select-novel')}
                        type="textBook"
                    />
                    <CreationCard
                        title="Picture Book"
                        description="Design a beautiful, illustrated story page by page with AI art."
                        onClick={handlePictureBookCreation}
                        type="pictureBook"
                    />
                </motion.div>
                 {createPictureBookMutation.isPending && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                        <LoadingSpinner text="Preparing your new picture book..." />
                    </div>
                )}
            </div>

            <Testimonials />
        </div>
    );
}

export default LandingPage;