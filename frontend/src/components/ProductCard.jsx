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

const ProductDescription = ({ product }) => {
    const doubleSidedPrint = <span className="text-slate-500 text-sm italic block mt-1">Printed double-sided</span>;

    switch (product.id) {
        case 'NOVBOOK_BW_5.25x8.25':
            return (
                <>
                    Approx. {product.defaultPageCount} pages <br />
                    <strong className="text-slate-300">Pocket Book Size</strong>
                    {doubleSidedPrint}
                </>
            );
        case 'A4NOVEL_PB_8.52x11.94':
            return (
                <>
                    <strong className="text-slate-300">Approx. 40 pages</strong> <br />
                    <span className="text-slate-300">Nearly 2x the story content of the Novella on larger pages.</span>
                    {doubleSidedPrint}
                </>
            );
        case 'ROYAL_HARDCOVER_6.39x9.46':
            return (
                <>
                    {/* TEXT CHANGE: Updated page count */}
                    Approx. 60-70 pages <br /> 
                    <strong className="text-slate-300">Hardcover Collector's Edition</strong>
                    {doubleSidedPrint}
                </>
            );
        default:
            return (
                <>
                    Approx. {product.defaultPageCount} pages <br />
                    {doubleSidedPrint}
                </>
            );
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

// UPDATE: Component now accepts onHover, isHovered, and isDefaultSelected props
const ProductCard = ({ product, onSelect, onHover, isHovered, isDefaultSelected }) => {
    const IconComponent = getProductIcon(product.id);
    const isBestSeller = product.id === 'A4NOVEL_PB_8.52x11.94';

    // UPDATE: New logic for applying outline styles
    const outlineClass = isHovered
        ? 'border-blue-300 shadow-xl shadow-blue-500/50' // Hovered state: glowing border
        : isDefaultSelected
        ? 'border-blue-300' // Default selected state: solid border
        : 'border-slate-700'; // No selection: standard border

    return (
        <motion.div
            variants={cardVariants}
            whileHover={{ y: -8, scale: 1.03, boxShadow: "0px 15px 30px rgba(0, 0, 0, 0.3)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(product)}
            onMouseEnter={onHover} // UPDATE: Added onMouseEnter handler
            className={`bg-slate-800 border-2 ${outlineClass} p-8 rounded-xl cursor-pointer 
                         flex flex-col items-center text-center overflow-hidden relative transition-all duration-300`}
        >
            {isBestSeller && (
                <div className="absolute top-0 right-0 overflow-hidden w-24 h-24 z-20">
                    <div className="absolute top-4 -right-8 w-40 bg-blue-600 text-white text-xs font-bold py-1
                                    transform rotate-45 shadow-lg">
                        <span className="inline-block whitespace-nowrap animate-marquee">
                            ⭐ BEST SELLER &nbsp;&nbsp;&nbsp; ⭐ BEST SELLER &nbsp;&nbsp;&nbsp; ⭐ BEST SELLER &nbsp;&nbsp;&nbsp;
                        </span>
                    </div>
                </div>
            )}
            
            <div className="text-blue-400 mb-5">
                <IconComponent className="h-20 w-20" /> 
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
                {product.name}
            </h3>
            <p className="text-base text-slate-400 mb-4 font-normal flex-grow">
                <ProductDescription product={product} />
            </p>
            <p className="text-5xl font-bold text-blue-400 my-4">
                ${product.price}
            </p>
            <div className={`text-white font-bold py-3 px-8 rounded-lg mt-4 transition-transform duration-200 shadow-lg
                             bg-blue-600 group-hover:bg-blue-500`}>
                Start Writing
            </div>
        </motion.div>
    );
};

export default ProductCard;