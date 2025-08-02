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

const ROBOTO_REGULAR_PATH = path.join(__dirname, '../fonts/Roboto-Regular.ttf');
const ROBOTO_BOLD_PATH = path.join(__dirname, '../fonts/Roboto-Bold.ttf');

// --- MODIFIED: Updated to handle the new trim sizes from lulu.service.js ---
const getProductDimensions = (luluConfigId) => {
    const productConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === luluConfigId);
    if (!productConfig) {
        throw new Error(`Product configuration with ID ${luluConfigId} not found.`);
    }

    let widthMm, heightMm, layout;

    switch (productConfig.trimSize) {
        // New Novella Size
        case '5.25x8.25':
            widthMm = 133.35;
            heightMm = 209.55;
            layout = 'portrait';
            break;
        // New A4 Novel Size
        case '8.52x11.94':
            widthMm = 216.41;
            heightMm = 303.28;
            layout = 'portrait';
            break;
        // New Royal Hardcover Size
        case '6.39x9.46':
            widthMm = 162.31;
            heightMm = 240.28;
            layout = 'portrait';
            break;
        // Picture Book Size (assuming it's unchanged)
        case '8.27x11.69':
            widthMm = 209.55;
            heightMm = 296.9;
            layout = 'portrait';
            break;
        default:
            // This was the error source. It will no longer be triggered for our main products.
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

export const generateCoverPdf = async (book, productConfig, coverDimensions) => {
    console.log(`🚀 Starting dynamic cover generation for SKU: ${productConfig.luluSku}`);

    let widthMm = coverDimensions.width;
    let heightMm = coverDimensions.height;
    let widthPoints = mmToPoints(widthMm);
    let heightPoints = mmToPoints(heightMm);
    
    console.log(`Original dimensions from Lulu (pts): Width=${widthPoints.toFixed(2)}, Height=${heightPoints.toFixed(2)}`);

    if (heightPoints > widthPoints) {
        console.warn(`⚠️ Height > Width detected. Swapping dimensions to enforce landscape orientation.`);
        [widthPoints, heightPoints] = [heightPoints, widthPoints];
        console.warn(`   Corrected dimensions (pts): Width=${widthPoints.toFixed(2)}, Height=${heightPoints.toFixed(2)}`);
    }

    const doc = new PDFDocument({
        size: [widthPoints, heightPoints],
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });
    
    if (book.cover_image_url) {
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
            doc.rect(0, 0, widthPoints, heightPoints).fill('red');
            doc.fontSize(24).fillColor('#FFFFFF').font(ROBOTO_BOLD_PATH)
                .text(`Error: Could not load cover image.`, 50, 50, { width: widthPoints - 100 });
        }
    } else {
        console.warn("⚠️ No `cover_image_url` found. Generating a placeholder text-based cover.");
        
        doc.rect(0, 0, widthPoints, heightPoints).fill('#313131');
        
        const safetyMarginPoints = 0.25 * 72;
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