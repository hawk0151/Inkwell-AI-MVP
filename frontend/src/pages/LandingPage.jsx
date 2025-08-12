import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView, useMotionValue, useTransform, animate, useAnimation } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import Testimonials from '../components/Testimonials';
import PageHeader from '../components/PageHeader';
import CreationCard from '../components/CreationCard';
import { Alert, LoadingSpinner } from '../components/common';
import { 
    HandRaisedIcon, PencilSquareIcon, SparklesIcon, BookOpenIcon, StarIcon, 
    BeakerIcon
} from '@heroicons/react/24/outline';

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (delay = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.7, ease: [0.2, 0.65, 0.3, 0.9], delay },
    }),
};

// --- VISUAL COMPONENTS - FINAL VERSION ---

const VisualStep1 = () => {
    const svgVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.3, delayChildren: 0.2 } }
    };
    const pathVariants = {
        hidden: { pathLength: 0 },
        visible: { pathLength: 1, transition: { duration: 1, ease: "easeInOut" } }
    };
    const textAppearVariant = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.5, delay: 1 } }
    };
    const lineTextVariant = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.5, delay: 1.2 } }
    };
    const mountainIconVariants = {
        hidden: { pathLength: 0, opacity: 0 },
        visible: { pathLength: 1, opacity: 1, transition: { duration: 1, delay: 0.5 } }
    };
    const sunIconVariants = {
        hidden: { opacity: 0, scale: 0 },
        visible: { opacity: 1, scale: 1, transition: { duration: 0.5, delay: 1 } }
    };


    return (
        <motion.svg width="100%" height="100%" viewBox="0 0 400 250" variants={svgVariants} initial="hidden" animate="visible">
            <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor: 'rgba(56, 189, 248, 0.5)', stopOpacity: 1}} />
                    <stop offset="100%" style={{stopColor: 'rgba(99, 102, 241, 0.5)', stopOpacity: 1}} />
                </linearGradient>
                <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor: 'rgba(52, 211, 153, 0.5)', stopOpacity: 1}} />
                    <stop offset="100%" style={{stopColor: 'rgba(45, 212, 191, 0.5)', stopOpacity: 1}} />
                </linearGradient>
            </defs>
            {/* Novel Blueprint */}
            <g>
                <motion.rect x="50" y="40" width="120" height="170" rx="5" stroke="#38bdf8" strokeWidth="2" fill="url(#grad1)" variants={pathVariants} />
                <motion.text x="110" y="30" textAnchor="middle" fill="#38bdf8" fontSize="14" fontWeight="bold" variants={textAppearVariant}>Novel</motion.text>
                {[...Array(5)].map((_, i) => {
                    const yPos = 60 + i * 25;
                    return (
                        <g key={i}>
                            <motion.path d={`M 65 ${yPos} h 90`} stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.5" variants={pathVariants} />
                            <motion.text x="67" y={yPos - 2} fill="#38bdf8" fontSize="6px" variants={lineTextVariant}>
                                your magic here...and here...
                            </motion.text>
                        </g>
                    );
                })}
            </g>
            {/* Picture Book Blueprint */}
            <g>
                <motion.rect x="230" y="40" width="120" height="170" rx="5" stroke="#34d399" strokeWidth="2" fill="url(#grad2)" variants={pathVariants} />
                <motion.text x="290" y="30" textAnchor="middle" fill="#34d399" fontSize="14" fontWeight="bold" variants={textAppearVariant}>Picture Book</motion.text>
                <g transform="translate(245, 65)">
                    <motion.circle cx="30" cy="30" r="10" fill="#34d399" variants={sunIconVariants}/>
                    <motion.path 
                        d="M 10 90 Q 30 50, 50 90 T 90 90"
                        stroke="#34d399" strokeWidth="2" fill="none"
                        variants={mountainIconVariants}
                    />
                </g>
                <motion.path d="M 245 165 h 90" stroke="#34d399" strokeWidth="1" strokeOpacity="0.5" variants={pathVariants} />
            </g>
        </motion.svg>
    );
};

const VisualStep2 = () => {
    const textContainer = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.8, delayChildren: 0.3 } }
    };
    const textLine = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
    };
    const keyword = {
        hidden: { opacity: 0, scale: 0.5 },
        visible: { opacity: 1, scale: 1, transition: { duration: 0.5, type: 'spring', stiffness: 150 } }
    };
    const ringVariants = {
        hidden: { pathLength: 0, opacity: 0 },
        visible: { pathLength: 1, opacity: 0.5, transition: { duration: 0.4, ease: 'circOut' } }
    };
    
    const AnimatedKeyword = ({ children }) => (
        <motion.span className="text-teal-400 font-bold inline-block relative" variants={keyword}>
            <motion.svg className="absolute -inset-2 w-full h-full overflow-visible" style={{top: "-0.5rem", left: "-0.5rem", width:"calc(100% + 1rem)", height:"calc(100% + 1rem)"}}>
                <motion.ellipse cx="50%" cy="50%" rx="50%" ry="50%" stroke="#4fd1c5" strokeWidth="1.5" fill="none" variants={ringVariants} />
            </motion.svg>
            <span className="relative">{children}</span>
        </motion.span>
    );

    return (
        <motion.div className="w-full h-full p-8 flex items-center justify-center" variants={textContainer} initial="hidden" animate="visible">
            <p className="text-xl md:text-2xl text-slate-300 leading-relaxed font-serif">
                <motion.span variants={textLine}>A story about a </motion.span>
                <AnimatedKeyword>brave knight</AnimatedKeyword>
                <motion.span variants={textLine}> named </motion.span>
                <AnimatedKeyword>Arthur</AnimatedKeyword>
                <motion.span variants={textLine}> who lives in a </motion.span>
                <AnimatedKeyword>magical castle</AnimatedKeyword>
                <motion.span variants={textLine}>.</motion.span>
            </p>
        </motion.div>
    );
};

const VisualStep3 = () => {
    const fadeIn = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.8 } }
    };

    const sunPulse = {
        scale: [1, 1.2, 1],
        opacity: [0.8, 1, 0.8],
        transition: { 
            duration: 3, 
            repeat: Infinity, 
            ease: 'easeInOut' 
        }
    };

    const planets = [
      { name: 'Mercury', radius: 45, color: '#E5E5E5', size: 3, animationClass: 'animate-orbit-1' },
      { name: 'Venus', radius: 65, color: '#F8C28E', size: 5, animationClass: 'animate-orbit-2' },
      { name: 'Earth', radius: 90, color: '#8cb1de', size: 5, animationClass: 'animate-orbit-3' },
      { name: 'Mars', radius: 115, color: '#d86c4a', size: 4, animationClass: 'animate-orbit-4' },
    ];

    return (
        <div className="w-full h-full flex items-center justify-center">
            <motion.svg 
                width="250" 
                height="250" 
                viewBox="0 0 300 300"
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.3, delay: 0.5 } } }}
            >
                {/* Rings */}
                {planets.map(p => (
                  <motion.circle 
                      key={p.name} 
                      cx="150" 
                      cy="150" 
                      r={p.radius} 
                      stroke="#a3a3a3" 
                      strokeWidth="0.5" 
                      strokeDasharray="4 4" 
                      fill="none" 
                      variants={fadeIn} 
                  />
                ))}

                {/* Sun */}
<motion.circle cx="150" cy="150" r="12" fill="#fde047" initial={{ opacity: 0, scale: 0.5 }} animate={sunPulse} />                
                {/* Planet group */}
                <g transform="translate(150, 150)">
                    {planets.map(planet => (
                        <motion.g
                            key={planet.name}
                            className={planet.animationClass} // This applies the CSS animation
                            variants={fadeIn}
                        >
                            <circle r={planet.size} fill={planet.color} transform={`translate(${planet.radius}, 0)`} />
                        </motion.g>
                    ))}
                </g>
            </motion.svg>
        </div>
    );
};


const VisualStep4 = () => {
    const starPositions = [
        { x: 75, y: 40 },
        { x: 75, y: 170 },
        { x: 120, y: 105 },
        { x: 30, y: 105 },
        { x: 85, y: 140 },
    ];
    const constellationPath = `M ${starPositions[0].x} ${starPositions[0].y} L ${starPositions[1].x} ${starPositions[1].y} M ${starPositions[2].x} ${starPositions[2].y} L ${starPositions[3].x} ${starPositions[3].y}`;
    const containerVariants = {
        hidden: {},
        visible: { transition: { staggerChildren: 0.5 } }
    };
    const pathVariants = {
        hidden: { pathLength: 0 },
        visible: { pathLength: 1, transition: { duration: 1.5, ease: 'easeInOut' } }
    };
    const starVariants = {
        hidden: { opacity: 0, scale: 0 },
        visible: (i) => ({
            opacity: 1, scale: 1,
            transition: { delay: 1 + i * 0.2, type: 'spring', stiffness: 200 }
        })
    };
    const baseText = "A tale of bravery and wonder...";
    const count = useMotionValue(0);
    const rounded = useTransform(count, (latest) => Math.round(latest));
    const displayText = useTransform(rounded, (latest) => baseText.slice(0, latest));
    useEffect(() => {
        const controls = animate(count, baseText.length, {
            type: "tween", duration: 2, ease: "easeInOut", repeat: Infinity, repeatType: "reverse", repeatDelay: 1,
        });
        return controls.stop;
    }, [count]);

    return (
        <div className="w-full h-full flex p-4 gap-4">
            <motion.div 
                className="w-1/2 h-full bg-slate-900 rounded-md flex items-center justify-center border border-slate-700 relative overflow-hidden"
                variants={containerVariants} initial="hidden" animate="visible"
            >
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 150 200">
                    <motion.path d={constellationPath} stroke="#a3a3a3" strokeWidth="0.5" strokeDasharray="2 3" fill="none" variants={pathVariants}/>
                    {starPositions.map((pos, i) => (
                        <motion.circle 
                            key={i}
                            cx={pos.x}
                            cy={pos.y}
                            r="3"
                            fill="#fde047"
                            custom={i}
                            variants={starVariants}
                            animate={{
                                scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7],
                                transition: { delay: 1.5, duration: 2 + Math.random() * 2, repeat: Infinity }
                            }}
                        />
                    ))}
                </svg>
            </motion.div>
            <div className="w-1/2 h-full flex flex-col">
                <h4 className="font-bold text-white mb-2">Back Cover Blurb</h4>
                <div className="w-full h-full bg-slate-700 rounded-md p-2 border border-slate-600 text-slate-200">
                    <motion.span>{displayText}</motion.span>
                </div>
            </div>
        </div>
    );
};

const StickyVisualMockup = ({ activeStep }) => {
    const visuals = { 1: <VisualStep1 />, 2: <VisualStep2 />, 3: <VisualStep3 />, 4: <VisualStep4 /> };
    return (
        <div className="w-full h-96 rounded-2xl border border-slate-700 bg-slate-800/50 p-4 flex items-center justify-center">
            <div className="w-full h-full rounded-lg relative overflow-hidden bg-slate-900/30">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeStep}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className="absolute inset-0"
                    >
                        {visuals[activeStep]}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

const StepContent = ({ step, title, description, onInView }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { margin: "-50% 0px -50% 0px" });

    useEffect(() => {
        if (isInView) { onInView(step); }
    }, [isInView, onInView, step]);

    return (
        <motion.div ref={ref} className="min-h-[100vh] flex flex-col justify-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.8 }} variants={{ visible: { transition: { staggerChildren: 0.2 } } }}>
                <motion.span className="text-teal-400 font-bold font-mono" variants={fadeUp}> Step {step} </motion.span>
                <motion.h3 className="text-3xl md:text-4xl font-bold font-serif text-white mt-2" variants={fadeUp}> {title} </motion.h3>
                <motion.p className="text-slate-300 text-lg mt-4" variants={fadeUp}>{description}</motion.p>
            </motion.div>
        </motion.div>
    );
};


function LandingPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [localError, setLocalError] = useState(null);
    const [activeStep, setActiveStep] = useState(1);

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
    // This is the new animation variant for the 'Life' word
    const headlineWordLife = {
        hidden: { opacity: 0, scale: 0.8 },
        visible: {
            opacity: 1, 
            scale: 1, 
            transition: { duration: 1.0, delay: 1.4, ease: [0.2, 0.65, 0.3, 0.9] }
        },
    };

    const headlineContainer = { 
        visible: { transition: { staggerChildren: 0.1 } } 
    };
    const headlineWord = {
        hidden: { opacity: 0, y: 25, rotateX: -90, transformOrigin: 'bottom' },
        visible: {
            opacity: 1, y: 0, rotateX: 0,
            transition: { duration: 0.6, ease: [0.2, 0.65, 0.3, 0.9] }
        },
    };
    
    const howItWorksSteps = [
        { id: 1, title: "Choose Your Format", description: "Start by selecting either a 'Text-Based Book' for a novel-style story or a 'Picture Book' for an illustrated tale." },
        { id: 2, title: "Provide Your Details", description: "Tell our AI who the book is for, the main character, their interests, and a genre. These details are the seeds of your story." },
        { id: 3, title: "AI Generation", description: "Our powerful AI will craft your story, generating new chapters for novels or creating stunning illustrations for picture books." },
        { id: 4, title: "Personalize & Refine", description: "In the editor, you have full control. Refine chapters, adjust AI images, upload your own cover, and add a personal blurb for the back—all for free, to ensure your story is exactly how you envisioned it." },
    ];

    return (
        <div className="bg-slate-900 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] text-white">
            
            <div className="min-h-screen text-center p-4 pt-48 pb-24">
                <div className="flex flex-col items-center">
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
                        <motion.span variants={headlineWordLife} className="inline-block text-teal-400">Life.</motion.span>
                    </motion.h1>
                    <motion.p 
                        className="mt-6 max-w-2xl mx-auto text-lg md:text-xl text-slate-300"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 1.0 }}
                    >
                        Our state-of-the-art AI transforms your ideas into rich, narrative-driven stories and stunningly illustrated picture books.
                    </motion.p>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 1.2 }}
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
            
            <div className="max-w-6xl mx-auto py-24 px-4">
                <h2 className="text-4xl md:text-5xl font-bold font-serif text-center mb-16 text-teal-400">
                    How It Works
                </h2>
                <div className="hidden md:flex flex-row gap-16 items-start">
                    <div className="w-1/2 sticky top-24">
                        <StickyVisualMockup activeStep={activeStep} />
                    </div>
                    <div className="w-1/2">
                        {howItWorksSteps.map(step => (
                            <StepContent
                                key={step.id}
                                step={step.id}
                                title={step.title}
                                description={step.description}
                                onInView={setActiveStep}
                            />
                        ))}
                    </div>
                </div>
                <div className="md:hidden space-y-8">
                     {howItWorksSteps.map((step, index) => (
                         <div key={step.id} className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                             <div className="h-64 mb-4">
                                 {React.createElement([VisualStep1, VisualStep2, VisualStep3, VisualStep4][index])}
                             </div>
                             <span className="text-teal-400 font-bold font-mono">Step {step.id}</span>
                             <h3 className="text-2xl font-bold font-serif text-white mt-2">{step.title}</h3>
                             <p className="text-slate-300 mt-2">{step.description}</p>
                         </div>
                     ))}
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