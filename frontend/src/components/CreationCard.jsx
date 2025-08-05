// frontend/src/components/CreationCard.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { BookText, Image } from 'lucide-react'; // Using lucide-react for consistent icons

const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { duration: 0.6, ease: 'easeOut' }
    }
};

// Define color schemes based on type
const typeThemes = {
    textBook: {
        iconColor: "text-blue-400",
        borderColor: "border-slate-700 hover:border-blue-500/50",
        buttonBg: "bg-blue-600 group-hover:bg-blue-500",
        hoverOverlay: "bg-blue-500",
        IconComponent: BookText // Lucide icon for text book
    },
    pictureBook: {
        iconColor: "text-indigo-400",
        borderColor: "border-slate-700 hover:border-indigo-500/50",
        buttonBg: "bg-indigo-600 group-hover:bg-indigo-500",
        hoverOverlay: "bg-indigo-500",
        IconComponent: Image // Lucide icon for picture book
    }
};

const CreationCard = ({ title, description, onClick, type }) => {
    const theme = typeThemes[type] || typeThemes.textBook; // Default to textBook if type is not recognized
    const Icon = theme.IconComponent;

    return (
        <motion.div
            variants={cardVariants}
            whileHover={{ y: -8, scale: 1.03, boxShadow: "0px 15px 30px rgba(0, 0, 0, 0.3)" }}
            whileTap={{ scale: 0.98 }}
            className={`group relative cursor-pointer flex flex-col items-center text-center p-8 bg-slate-800 
                        rounded-2xl shadow-xl ${theme.borderColor} transition-all duration-300`}
            onClick={onClick}
        >
            {/* Subtle visual cue/overlay on hover */}
            <div className={`absolute top-0 left-0 w-full h-full ${theme.hoverOverlay} rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-300 blur-2xl`}></div>
            
            {/* Icon */}
            <div className={`relative ${theme.iconColor} mb-6 transition-transform duration-300 group-hover:scale-110`}>
                <Icon className="h-20 w-20" />
            </div>
            
            {/* Title & Description */}
            <h3 className="relative text-3xl font-bold text-white mb-3 font-serif">{title}</h3>
            <p className="relative font-sans text-slate-400 mt-2 flex-grow text-lg">{description}</p>
            
            {/* Call to Action Button */}
            <div className={`relative mt-8 w-full md:w-auto px-8 py-3 text-white font-bold 
                         rounded-lg transition-colors duration-300 shadow-lg ${theme.buttonBg}`}>
                Begin
            </div>
        </motion.div>
    );
};

export default CreationCard;