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
 * This function removes previous hardcoding and uses the live dimensions from the Lulu API.
 * It also fetches the book's cover image and embeds it.
 */
export const generateCoverPdf = async (book, productConfig, coverDimensions) => {
    console.log(`🚀 Starting dynamic cover generation for SKU: ${productConfig.luluSku}`);

    // --- START: DYNAMIC & ROBUST COVER GENERATION LOGIC ---

    // 1. Get raw dimensions in millimeters from the Lulu API response.
    let widthMm = coverDimensions.width;
    let heightMm = coverDimensions.height;
    
    // 2. Convert dimensions to PDF points.
    let widthPoints = mmToPoints(widthMm);
    let heightPoints = mmToPoints(heightMm);
    
    console.log(`Original dimensions from Lulu (pts): Width=${widthPoints.toFixed(2)}, Height=${heightPoints.toFixed(2)}`);

    // 3. **CRITICAL FIX**: Ensure landscape orientation for wraparound cover.
    // A wraparound cover's width must be greater than its height. If Lulu returns swapped values, we correct them.
    if (heightPoints > widthPoints) {
        console.warn(`⚠️ Height > Width detected. Swapping dimensions to enforce landscape orientation.`);
        [widthPoints, heightPoints] = [heightPoints, widthPoints]; // Swap the values
        console.warn(`   Corrected dimensions (pts): Width=${widthPoints.toFixed(2)}, Height=${heightPoints.toFixed(2)}`);
    }

    // 4. Create the PDF document with the corrected, precise dimensions.
    // Note: We do not set 'layout' and instead let the `size` array define the orientation.
    const doc = new PDFDocument({
        size: [widthPoints, heightPoints],
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });
    
    // 5. Fetch the actual cover image for the book.
    if (!book.cover_image_url) {
        throw new Error("Cannot generate cover PDF: `book.cover_image_url` is missing.");
    }

    try {
        console.log(`Fetching cover image from: ${book.cover_image_url}`);
        const imageBuffer = await getImageBuffer(book.cover_image_url);
        // Embed the image to fill the entire cover dimensions.
        doc.image(imageBuffer, 0, 0, {
            width: widthPoints,
            height: heightPoints,
        });
        console.log("✅ Successfully embedded cover image.");
    } catch (error) {
        console.error("❌ Failed to fetch or embed cover image.", error);
        // Create a fallback visual error message on the PDF itself for easier debugging.
        doc.rect(0, 0, widthPoints, heightPoints).fill('red');
        doc.fontSize(24).fillColor('#FFFFFF').font(ROBOTO_BOLD_PATH)
            .text(`Error: Could not load cover image from URL.`, 50, 50, { width: widthPoints - 100 });
    }

    // --- END: DYNAMIC LOGIC ---

    // Save the generated PDF to a temporary file, maintaining the existing pattern.
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

    // Using custom font files for explicit embedding
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
            // Fallback text using custom font
            doc.fontSize(40).font(ROBOTO_BOLD_PATH).text(book.title, { align: 'center' }); 
        }
    } else {
        // Using custom font
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
            // Using custom font
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