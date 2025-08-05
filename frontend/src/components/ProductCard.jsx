// frontend/src/components/ProductCard.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { BookOpenIcon, DocumentTextIcon, BookmarkSquareIcon } from '@heroicons/react/24/solid';

const getProductIcon = (productId) => {
    switch (productId) {
        case 'NOVBOOK_BW_5.25x8.25': return DocumentTextIcon;
        case 'A4NOVEL_PB_8.52x11.94': return BookOpenIcon;
        case 'ROYAL_HARDCOVER_6.39x9.46': return BookmarkSquareIcon;
        default: return BookOpenIcon;
    }
};

const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: {
            duration: 0.5,
            ease: 'easeOut'
        }
    }
};

const ProductCard = ({ product, onSelect }) => {
    const IconComponent = getProductIcon(product.id);

    return (
        <motion.div
            variants={cardVariants}
            whileHover={{ y: -8, scale: 1.03, boxShadow: "0px 15px 30px rgba(0, 0, 0, 0.3)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(product)}
            className="bg-slate-800 border border-slate-700 p-8 rounded-xl cursor-pointer 
                       flex flex-col items-center text-center overflow-hidden"
        >
            {/* Icon color changed to text-blue-400 */}
            <div className="text-blue-400 mb-5">
                <IconComponent className="h-20 w-20" /> 
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
                {product.name}
            </h3>
            <p className="text-base text-slate-400 mb-4 font-normal flex-grow">
                Approx. {product.defaultPageCount} pages
            </p>
            {/* Price color changed to text-blue-400 */}
            <p className="text-5xl font-bold text-blue-400 my-4">
                ${product.price}
            </p>
            {/* Button color changed to bg-blue-600 */}
            <div className="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg mt-4 transition-transform duration-200 group-hover:bg-blue-500 shadow-lg">
                Select
            </div>
        </motion.div>
    );
};

export default ProductCard;