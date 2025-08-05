import React from 'react';
import { motion } from 'framer-motion';

const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' }
    }
};

const CreationCard = ({ title, description, icon, onClick }) => (
    <motion.div
        variants={cardVariants}
        whileHover={{ y: -8, scale: 1.03, boxShadow: "0px 15px 30px rgba(0, 0, 0, 0.3)" }}
        whileTap={{ scale: 0.98 }}
        className="group cursor-pointer flex flex-col items-center text-center p-8 bg-slate-800 
                   rounded-xl shadow-xl border border-slate-700 transition-shadow duration-300 hover:shadow-2xl"
        onClick={onClick}
    >
        <div className="text-7xl mb-6 transition-transform duration-300 group-hover:scale-110">
            {icon}
        </div>
        <h3 className="text-3xl font-bold text-white mb-3">{title}</h3>
        <p className="text-slate-400 mt-2 flex-grow text-lg">{description}</p>
        <div className="mt-8 w-full md:w-auto px-8 py-3 bg-indigo-600 text-white font-bold 
                        rounded-lg transition-colors duration-300 group-hover:bg-indigo-500 shadow-lg">
            Begin
        </div>
    </motion.div>
);

export default CreationCard;