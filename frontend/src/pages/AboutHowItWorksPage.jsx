// frontend/src/pages/AboutHowItWorksPage.jsx
import React from 'react';
import { motion } from 'framer-motion';
import PageHeader from '../components/PageHeader';
import { useNavigate } from 'react-router-dom';

const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    visible: (delay = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, delay },
    }),
};

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
                    <h2 className="text-3xl font-bold font-serif text-amber-400 mb-4">
                        Our Vision: The Inkwell AI Story
                    </h2>
                    <div className="space-y-4 text-slate-300 text-lg">
                        <p>
                            Inkwell AI was born from a simple yet profound idea: everyone has a story to tell. In a world brimming with technology, we saw an opportunity to bridge the gap between imagination and the printed page.
                        </p>
                        <p>
                            Using state-of-the-art AI, our platform transforms your simple prompts into rich, narrative-driven stories and stunning illustrations. But we don't stop there. We believe in the magic of a physical book—the feel of the paper, the weight in your hands, a tangible keepsake of your creativity.
                        </p>
                        <p>
                            Whether you're an aspiring author, a parent creating a bedtime story for your child, or simply a creative soul, Inkwell AI is your partner in creation. Join us, and let's write the next chapter, together.
                        </p>
                    </div>
                </motion.section>

                <motion.section
                    className="mt-10 bg-slate-800/50 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-slate-700 space-y-6"
                    variants={fadeUp}
                    custom={0.4}
                    initial="hidden"
                    animate="visible"
                >
                    <h2 className="text-3xl font-bold font-serif text-amber-400 mb-4">
                        Your Story, Step-by-Step
                    </h2>
                    <div className="space-y-6 text-slate-300 text-lg">
                        <p>
                            Creating a personalized book with Inkwell AI is a magical journey, designed to be simple and intuitive. Here's how you bring your unique stories to life:
                        </p>
                        <ol className="list-decimal list-inside space-y-4 pl-4">
                            <li>
                                <strong className="text-white">Choose Your Creation Type:</strong>
                                Start by selecting whether you want a 'Text-Based Book' (a novel or novella) or a 'Picture Book' (an illustrated story with a timeline).
                            </li>
                            <li>
                                <strong className="text-white">Provide Your Details:</strong>
                                Tell our AI who the book is for, the main character's name, their interests, and a preferred genre. These details are the seeds of your story.
                            </li>
                            <li>
                                <strong className="text-white">AI Generation (The Magic Happens!):</strong>
                                <ul className="list-disc list-inside ml-4 text-slate-400 mt-2">
                                    <li>For Text-Based Books, our powerful AI will craft your first chapter. You then guide it to generate subsequent chapters, watching your story unfold.</li>
                                    <li>For Picture Books, you can generate stunning AI-powered illustrations based on your descriptions or upload your own cherished photos.</li>
                                </ul>
                            </li>
                            <li>
                                <strong className="text-white">Personalize & Refine:</strong>
                                In the editor, you have full control.
                                <ul className="list-disc list-inside ml-4 text-slate-400 mt-2">
                                    <li>For Novels: Review each chapter, then click 'Continue Story' to prompt the AI for the next part. Our system remembers the plot to ensure coherence.</li>
                                    <li>For Picture Books: Add descriptions, dates, and even overlay text directly onto your images. You can add or delete pages as needed.</li>
                                </ul>
                            </li>
                            <li>
                                <strong className="text-white">Finalize & Purchase:</strong>
                                Once your masterpiece is complete, simply proceed to checkout. We'll handle the printing and delivery of your unique physical book, a keepsake bound forever.
                            </li>
                        </ol>
                    </div>
                </motion.section>

                <motion.section
                    className="mt-10 bg-slate-800/50 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-slate-700 space-y-6"
                    variants={fadeUp}
                    custom={0.6}
                    initial="hidden"
                    animate="visible"
                >
                    <h2 className="text-3xl font-bold font-serif text-amber-400 mb-4">
                        Behind the Scenes: How Our AI Stays Coherent
                    </h2>
                    <div className="space-y-4 text-slate-300 text-lg">
                        <p>
                            A key concern with AI-generated multi-chapter stories is maintaining narrative coherence. At Inkwell AI, we've implemented a sophisticated "memory" system:
                        </p>
                        <ul className="list-disc list-inside space-y-2 pl-4">
                            <li><strong className="text-white">Iterative Prompting:</strong> When generating subsequent chapters, our backend feeds the AI a summary of all the *previous chapters* generated so far.</li>
                            <li><strong className="text-white">Contextual Understanding:</strong> This allows the AI to remember plot points and character traits, ensuring the new chapter builds logically on what came before.</li>
                            <li><strong className="text-white">Controlled Conclusion:</strong> For the final chapter, we explicitly instruct the AI to provide a satisfying ending, ensuring your story feels complete.</li>
                        </ul>
                    </div>
                </motion.section>

                <motion.section
                    className="mt-10 bg-slate-800/50 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-slate-700 text-center space-y-4"
                    variants={fadeUp}
                    custom={0.8}
                    initial="hidden"
                    animate="visible"
                >
                    <h2 className="text-3xl font-bold font-serif text-white">Ready to create your story?</h2>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/')}
                        className="mt-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-300 shadow-lg"
                    >
                        Start Creating Now
                    </motion.button>
                </motion.section>
            </div>
        </div>
    );
}

export default AboutHowItWorksPage;