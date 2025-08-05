// frontend/src/pages/AboutHowItWorksPage.jsx
import React from 'react';
import { motion } from 'framer-motion';
import PageHeader from '../components/PageHeader';
import { useNavigate } from 'react-router-dom';
import { HandRaisedIcon, PencilSquareIcon, SparklesIcon, BookOpenIcon, TruckIcon } from '@heroicons/react/24/outline'; // These icons are good

const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    visible: (delay = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, delay },
    }),
};

const HowItWorksCard = ({ icon: Icon, title, description, delay }) => (
    <motion.div 
        className="bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl border border-slate-700 hover:border-indigo-500 transition-colors duration-300 shadow-2xl"
        variants={fadeUp}
        custom={delay}
        initial="hidden"
        animate="visible"
    >
        <div className="flex items-center space-x-4 mb-4">
            {/* Icon color changed to accent teal */}
            <div className="bg-teal-600/20 p-3 rounded-full">
                <Icon className="h-6 w-6 text-teal-400" /> 
            </div>
            <h3 className="text-xl font-bold font-serif text-white">{title}</h3>
        </div>
        <p className="text-slate-300 text-base">{description}</p>
    </motion.div>
);

function AboutHowItWorksPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
            <div className="max-w-4xl mx-auto py-12 px-4">
                <PageHeader
                    title="Our Story & How It Works"
                    subtitle="Bridging imagination, technology, and the printed page."
                />

                <motion.section
                    className="mt-10 bg-slate-800/50 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-slate-700 space-y-6"
                    variants={fadeUp}
                    custom={0.2}
                    initial="hidden"
                    animate="visible"
                >
                    {/* Heading color changed to accent teal */}
                    <h2 className="text-3xl font-bold font-serif text-teal-400 mb-4">
                        Our Vision: The Inkwell AI Story
                    </h2>
                    <div className="space-y-4 text-slate-300 text-lg">
                        <p>
                            Inkwell AI was born from a simple yet profound idea: everyone has a story to tell. In a world brimming with technology, we saw an opportunity to bridge the gap between imagination and the printed page.
                        </p>
                        <p>
                            Using <strong className="text-teal-300">state-of-the-art AI</strong>, our platform transforms your simple prompts into rich, narrative-driven stories and stunning illustrations. But we don't stop there. We believe in the magic of a physical book—the feel of the paper, the weight in your hands, a <strong className="text-teal-300">tangible keepsake</strong> of your creativity.
                        </p>
                        <p>
                            Whether you're an aspiring author, a parent creating a bedtime story for your child, or simply a creative soul, Inkwell AI is your partner in creation. Join us, and let's write the next chapter, together.
                        </p>
                    </div>
                </motion.section>

                <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <HowItWorksCard
                        icon={PencilSquareIcon}
                        title="Choose Your Creation Type"
                        description="Start by selecting either a 'Text-Based Book' (a novel) or a 'Picture Book' (an illustrated story with a timeline)."
                        delay={0.3}
                    />
                    <HowItWorksCard
                        icon={HandRaisedIcon}
                        title="Provide Your Details"
                        description="Tell our AI who the book is for, the main character's name, their interests, and a preferred genre. These details are the seeds of your story."
                        delay={0.4}
                    />
                    <HowItWorksCard
                        icon={SparklesIcon}
                        title="AI Generation"
                        description="Our powerful AI will craft your story. You can generate new chapters for novels or create stunning illustrations for your picture books."
                        delay={0.5}
                    />
                    <HowItWorksCard
                        icon={BookOpenIcon}
                        title="Personalize & Refine"
                        description="In the editor, you have full control to refine chapters, adjust images, and ensure your story is exactly how you envisioned it."
                        delay={0.6}
                    />
                    <HowItWorksCard
                        icon={TruckIcon}
                        title="Finalize & Purchase"
                        description="Once your masterpiece is complete, simply proceed to checkout. We'll handle the professional printing and delivery of your unique physical book."
                        delay={0.7}
                    />
                </div>

                <motion.section
                    className="mt-10 bg-slate-800/50 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-slate-700 text-center space-y-4"
                    variants={fadeUp}
                    custom={0.8}
                    initial="hidden"
                    animate="visible"
                >
                    {/* Heading color changed to accent teal */}
                    <h2 className="text-3xl font-bold font-serif text-teal-400">Ready to create your story?</h2>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/')}
                        // CTA button color changed to vibrant teal
                        className="mt-6 bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-300 shadow-lg"
                    >
                        Start Creating Now
                    </motion.button>
                </motion.section>
            </div>
        </div>
    );
}

export default AboutHowItWorksPage;