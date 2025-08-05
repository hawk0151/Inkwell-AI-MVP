// frontend/src/components/CreationCard.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { PencilSquareIcon, PhotoIcon } from '@heroicons/react/24/solid';

const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' }
    }
};

const CreationCard = ({ title, description, onClick }) => {
    const IconComponent = title === "Picture Book" ? PhotoIcon : PencilSquareIcon;

    return (
        <motion.div
            variants={cardVariants}
            whileHover={{ y: -8, scale: 1.03, boxShadow: "0px 15px 30px rgba(0, 0, 0, 0.3)" }}
            whileTap={{ scale: 0.98 }}
            className="group relative cursor-pointer flex flex-col items-center text-center p-8 bg-slate-800 
                       rounded-2xl shadow-xl border border-slate-700 transition-all duration-300 hover:border-indigo-500/50"
            onClick={onClick}
        >
            <div className="absolute top-0 left-0 w-full h-full bg-indigo-500 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-300 blur-2xl"></div>
            
            <div className="relative text-indigo-400 mb-6 transition-transform duration-300 group-hover:scale-110">
                <IconComponent className="h-20 w-20" />
            </div>
            <h3 className="relative text-3xl font-bold text-white mb-3 font-serif">{title}</h3>
            <p className="relative font-sans text-slate-400 mt-2 flex-grow text-lg">{description}</p>
            <div className="relative mt-8 w-full md:w-auto px-8 py-3 bg-indigo-600 text-white font-bold 
                        rounded-lg transition-colors duration-300 group-hover:bg-indigo-500 shadow-lg">
                Begin
            </div>
        </motion.div>
    );
};

export default CreationCard;