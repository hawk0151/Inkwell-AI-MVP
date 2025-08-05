// frontend/src/components/PageHeader.jsx
import React from 'react';
import { motion } from 'framer-motion';

const PageHeader = ({ title, subtitle }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
      className="text-center py-16 md:py-20"
    >
      <h1 className="font-serif text-5xl md:text-7xl font-bold text-white leading-tight tracking-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="font-sans text-xl md:text-2xl text-slate-400 mt-6 max-w-3xl mx-auto">
          {subtitle}
        </p>
      )}
    </motion.div>
  );
};

export default PageHeader;