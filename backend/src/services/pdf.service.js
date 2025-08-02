// backend/src/services/pdf.service.js

import PDFDocument from 'pdfkit';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname } from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { LULU_PRODUCT_CONFIGURATIONS } from './lulu.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const workerPath = path.resolve(__dirname, '../../node_modules/pdfjs-dist/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

const mmToPoints = (mm) => mm * (72 / 25.4);

// Define paths to the new font files
const ROBOTO_REGULAR_PATH = path.join(__dirname, '../fonts/Roboto-Regular.ttf');
const ROBOTO_BOLD_PATH = path.join(__dirname, '../fonts/Roboto-Bold.ttf');


const getProductDimensions = (luluConfigId) => {
    const productConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === luluConfigId);
    if (!productConfig) {
        throw new Error(`Product configuration with ID ${luluConfigId} not found.`);
    }

    let widthMm, heightMm, layout;

    switch (productConfig.trimSize) {
        case '5.75x8.75': // Novella interior
            widthMm = 146.05;
            heightMm = 222.25;
            layout = 'portrait';
            break;
        case '8.27x11.69': // A4 Novel interior
            widthMm = 209.55;
            heightMm = 296.9;
            layout = 'portrait';
            break;
        case '6.14x9.21': // Royal Hardcover interior
            widthMm = 156;
            heightMm = 234;
            layout = 'portrait';
            break;
        default:
            throw new Error(`Unknown trim size ${productConfig.trimSize} for interior PDF dimensions.`);
    }

    const widthPoints = mmToPoints(widthMm);
    const heightPoints = mmToPoints(heightMm);
    return { width: widthPoints, height: heightPoints, layout: layout };
};

async function getImageBuffer(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary');
}

export async function getPdfPageCount(pdfFilePath) {
    try {
        const pdfData = new Uint8Array(await fs.readFile(pdfFilePath));
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        const pdfDocument = await loadingTask.promise;
        return pdfDocument.numPages;
    } catch (error) {
        console.error(`Error reading PDF page count from ${pdfFilePath}:`, error);
        throw new Error(`Failed to get PDF page count from ${pdfFilePath}.`);
    }
}

async function streamToBuffer(doc) {
    return new Promise((resolve, reject) => {
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);
    });
}

/**
 * Generates a dynamic, correctly oriented wraparound cover PDF.
 * This function is now resilient: it uses the book's cover image if available,
 * otherwise it creates a placeholder text-based cover to prevent crashes.
 */
export const generateCoverPdf = async (book, productConfig, coverDimensions) => {
    console.log(`🚀 Starting dynamic cover generation for SKU: ${productConfig.luluSku}`);

    // --- START: DYNAMIC & ROBUST COVER GENERATION LOGIC ---

    // 1. Convert Lulu's dimensions to points and enforce landscape orientation.
    let widthMm = coverDimensions.width;
    let heightMm = coverDimensions.height;
    let widthPoints = mmToPoints(widthMm);
    let heightPoints = mmToPoints(heightMm);
    
    console.log(`Original dimensions from Lulu (pts): Width=${widthPoints.toFixed(2)}, Height=${heightPoints.toFixed(2)}`);

    if (heightPoints > widthPoints) {
        console.warn(`⚠️ Height > Width detected. Swapping dimensions to enforce landscape orientation.`);
        [widthPoints, heightPoints] = [heightPoints, widthPoints]; // Swap the values
        console.warn(`   Corrected dimensions (pts): Width=${widthPoints.toFixed(2)}, Height=${heightPoints.toFixed(2)}`);
    }

    // 2. Create the PDF document with the corrected, precise dimensions.
    const doc = new PDFDocument({
        size: [widthPoints, heightPoints],
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });
    
    // 3. **CRITICAL FIX**: Check for cover image and provide a fallback.
    if (book.cover_image_url) {
        // If a cover image URL exists, use it.
        try {
            console.log(`Fetching cover image from: ${book.cover_image_url}`);
            const imageBuffer = await getImageBuffer(book.cover_image_url);
            doc.image(imageBuffer, 0, 0, {
                width: widthPoints,
                height: heightPoints,
            });
            console.log("✅ Successfully embedded cover image.");
        } catch (error) {
            console.error("❌ Failed to fetch or embed cover image.", error);
            // If image fetch fails, draw an error message on the PDF.
            doc.rect(0, 0, widthPoints, heightPoints).fill('red');
            doc.fontSize(24).fillColor('#FFFFFF').font(ROBOTO_BOLD_PATH)
                .text(`Error: Could not load cover image.`, 50, 50, { width: widthPoints - 100 });
        }
    } else {
        // **FALLBACK**: If no cover image URL, generate a simple text-based placeholder cover.
        // This prevents the checkout from ever crashing at this step.
        console.warn("⚠️ No `cover_image_url` found. Generating a placeholder text-based cover.");
        
        // Use the previous placeholder style
        doc.rect(0, 0, widthPoints, heightPoints).fill('#313131'); // Dark grey background
        
        const safetyMarginPoints = 0.25 * 72; // 0.25 inch margin
        const contentAreaWidth = widthPoints - (2 * safetyMarginPoints);

        doc.fontSize(48).fillColor('#FFFFFF').font(ROBOTO_BOLD_PATH)
           .text(book.title, safetyMarginPoints, heightPoints / 4, {
               align: 'center',
               width: contentAreaWidth
           });
        
        doc.moveDown(1);

        doc.fontSize(24).fillColor('#CCCCCC').font(ROBOTO_REGULAR_PATH)
           .text('Inkwell AI', {
               align: 'center',
               width: contentAreaWidth
           });
        console.log("✅ Placeholder cover generated successfully.");
    }

    // --- END: DYNAMIC LOGIC ---

    const tempPdfsDir = path.resolve(process.cwd(), 'tmp', 'pdfs');
    await fs.mkdir(tempPdfsDir, { recursive: true });
    const tempFilePath = path.join(tempPdfsDir, `cover_${Date.now()}_${book.id}.pdf`);
    
    doc.end();

    const pdfBuffer = await streamToBuffer(doc);
    await fs.writeFile(tempFilePath, pdfBuffer);
    
    console.log(`✅ Cover PDF saved successfully to: ${tempFilePath}`);
    return tempFilePath;
};

export const generateAndSaveTextBookPdf = async (book, productConfig, addFinalBlankPage = false) => {
    const { width, height, layout } = getProductDimensions(productConfig.id);
    const doc = new PDFDocument({
        size: [width, height],
        layout: layout,
        margins: { top: 72, bottom: 72, left: 72, right: 72 }
    });
    
    const tempPdfsDir = path.resolve(process.cwd(), 'tmp', 'pdfs');
    await fs.mkdir(tempPdfsDir, { recursive: true });
    const tempFilePath = path.join(tempPdfsDir, `interior_textbook_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.pdf`);

    doc.fontSize(28).font(ROBOTO_BOLD_PATH).text(book.title, { align: 'center' }); 
    doc.moveDown(4);
    doc.fontSize(16).font(ROBOTO_REGULAR_PATH).text('A Story by Inkwell AI', { align: 'center' }); 

    for (const chapter of book.chapters) {
        doc.addPage();
        doc.fontSize(18).font(ROBOTO_BOLD_PATH).text(`Chapter ${chapter.chapter_number}`, { align: 'center' }); 
        doc.moveDown(2);
        doc.fontSize(12).font(ROBOTO_REGULAR_PATH).text(chapter.content, { align: 'justify' }); 
    }
    
    if (addFinalBlankPage) {
        console.log("DEBUG: Adding a final blank page to make page count even.");
        doc.addPage();
    }
    doc.end();

    const pdfBuffer = await streamToBuffer(doc);
    await fs.writeFile(tempFilePath, pdfBuffer);

    return tempFilePath;
};

export const generateAndSavePictureBookPdf = async (book, events, productConfig, addFinalBlankPage = false) => {
    const { width, height, layout } = getProductDimensions(productConfig.id);
    const doc = new PDFDocument({
        size: [width, height],
        layout: layout,
        autoFirstPage: false,
        margins: { top: 36, bottom: 36, left: 36, right: 36 }
    });

    const tempPdfsDir = path.resolve(process.cwd(), 'tmp', 'pdfs');
    await fs.mkdir(tempPdfsDir, { recursive: true });
    const tempFilePath = path.join(tempPdfsDir, `interior_picturebook_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.pdf`);

    doc.addPage();
    if (book.cover_image_url) {
        try {
            const coverImageBuffer = await getImageBuffer(book.cover_image_url);
            doc.image(coverImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });
        } catch (imgErr) {
            console.error(`Failed to load cover image for interior from ${book.cover_image_url}`, imgErr);
            doc.fontSize(40).font(ROBOTO_BOLD_PATH).text(book.title, { align: 'center' }); 
        }
    } else {
        doc.fontSize(40).font(ROBOTO_BOLD_PATH).text(book.title, { align: 'center' }); 
        doc.moveDown(2);
        doc.fontSize(18).font(ROBOTO_REGULAR_PATH).text('A Personalized Story from Inkwell AI', { align: 'center' }); 
    }

    for (const event of events) {
        doc.addPage();
        const imageUrl = event.uploaded_image_url || event.image_url;
        if (imageUrl) {
            try {
                const imageBuffer = await getImageBuffer(imageUrl);
                doc.image(imageBuffer, { fit: [doc.page.width - 72, doc.page.height - 150], align: 'center', valign: 'top' });
            } catch (imgErr) {
                console.error(`Failed to load image from ${imageUrl}`, imgErr);
            }
        }
        if (event.overlay_text) {
            doc.fontSize(24).font(ROBOTO_BOLD_PATH).text( 
                event.overlay_text,
                doc.page.margins.left,
                doc.page.height - doc.page.margins.bottom - 100,
                { align: 'center', width: doc.page.width - doc.page.margins.left * 2 }
            );
        }
    }

    if (addFinalBlankPage) {
        console.log("DEBUG: Adding a final blank page to make page count even.");
        doc.addPage();
    }
    doc.end();

    const pdfBuffer = await streamToBuffer(doc);
    await fs.writeFile(tempFilePath, pdfBuffer);

    return tempFilePath;
};