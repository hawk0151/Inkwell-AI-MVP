// backend/src/services/pdf.service.js

// CHANGES:
// - Redesigned PDF generation into a two-pass system.
// - generateAndSaveTextBookPdf and generateAndSavePictureBookPdf now only generate content, returning true content page count.
// - Introduced finalizePdfPageCount helper which loads PDF, pads it, ensures even page count, and returns final page count.
// - CRITICAL FIX: Ensure pdf-lib's addPage() uses consistent dimensions from the original PDF's first page to resolve 'printable_normalization' warning.
// - CRITICAL FIX: Added robust validation of page dimensions within finalizePdfPageCount to prevent NaN errors when adding pages to PDF-Lib document.
// - NEW DIAGNOSTIC: Added granular logging for page dimensions within finalizePdfPageCount to pinpoint NaN origin.

import PDFDocument from 'pdfkit'; // For creating PDFs
import { PDFDocument as PDFLibDocument } from 'pdf-lib'; // For reading/modifying PDFs
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { LULU_PRODUCT_CONFIGURATIONS } from './lulu.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mmToPoints = (mm) => mm * (72 / 25.4);

const ROBOTO_REGULAR_PATH = path.join(__dirname, '../fonts/Roboto-Regular.ttf');
const ROBOTO_BOLD_PATH = path.join(__dirname, '../fonts/Roboto-Bold.ttf');

const getProductDimensions = (luluConfigId) => {
    const productConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === luluConfigId);
    if (!productConfig) {
        throw new Error(`Product configuration with ID ${luluConfigId} not found.`);
    }
    let widthMm, heightMm, layout;
    switch (productConfig.trimSize) {
        case '5.25x8.25':
            widthMm = 133.35; heightMm = 209.55; layout = 'portrait'; break;
        case '8.52x11.94':
            widthMm = 216.41; heightMm = 303.28; layout = 'portrait'; break;
        case '6.39x9.46':
            widthMm = 162.31; heightMm = 240.28; layout = 'portrait'; break;
        case '8.27x11.69':
            widthMm = 209.55; heightMm = 296.9; layout = 'portrait'; break;
        default:
            // Ensure widthMm and heightMm are defined even if trimSize is unknown, for robust error handling downstream
            console.error(`[PDF Service: getProductDimensions] Unknown trim size ${productConfig.trimSize}. Falling back to standard dimensions.`);
            widthMm = 210; // A4 width in mm (default fallback)
            heightMm = 297; // A4 height in mm (default fallback)
            layout = 'portrait';
            // It's still better to throw here if this is a hard requirement for product validity.
            // For now, allow fallback to prevent crash, but this product config itself is likely invalid for Lulu.
            // throw new Error(`Unknown trim size ${productConfig.trimSize} for interior PDF dimensions.`);
    }
    const widthPoints = mmToPoints(widthMm);
    const heightPoints = mmToPoints(heightMm);
    return { width: widthPoints, height: heightPoints, layout: layout };
};

async function getImageBuffer(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary');
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
    console.log(`[PDF Service: Cover] 🚀 Starting dynamic cover generation for SKU: ${productConfig.luluSku}`);

    let widthMm = coverDimensions.width;
    let heightMm = coverDimensions.height;
    let widthPoints = mmToPoints(widthMm);
    let heightPoints = mmToPoints(heightMm);
    
    console.log(`[PDF Service: Cover] Original dimensions from Lulu (pts): Width=${widthPoints.toFixed(2)}, Height=${heightPoints.toFixed(2)}`);

    if (heightPoints > widthPoints) {
        console.warn(`[PDF Service: Cover] ⚠️ Height > Width detected. Swapping dimensions to enforce landscape orientation.`);
        [widthPoints, heightPoints] = [heightPoints, widthPoints];
        console.warn(`[PDF Service: Cover] Corrected dimensions (pts): Width=${widthPoints.toFixed(2)}, Height=${heightPoints.toFixed(2)}`);
    }

    const doc = new PDFDocument({
        size: [widthPoints, heightPoints],
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });
    
    if (book.cover_image_url) {
        try {
            console.log(`[PDF Service: Cover] Fetching cover image from: ${book.cover_image_url}`);
            const imageBuffer = await getImageBuffer(book.cover_image_url);
            doc.image(imageBuffer, 0, 0, {
                width: widthPoints,
                height: heightPoints,
            });
            console.log("[PDF Service: Cover] ✅ Successfully embedded cover image.");
        } catch (error) {
            console.error("[PDF Service: Cover] ❌ Failed to fetch or embed cover image.", error);
            doc.rect(0, 0, widthPoints, heightPoints).fill('red');
            doc.fontSize(24).fillColor('#FFFFFF').font(ROBOTO_BOLD_PATH)
                .text(`Error: Could not load cover image.`, 50, 50, { width: widthPoints - 100 });
        }
    } else {
        console.warn("[PDF Service: Cover] ⚠️ No `cover_image_url` found. Generating a placeholder text-based cover.");
        
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
        console.log("[PDF Service: Cover] ✅ Placeholder cover generated successfully.");
    }

    const tempPdfsDir = path.resolve(process.cwd(), 'tmp', 'pdfs');
    await fs.mkdir(tempPdfsDir, { recursive: true });
    const tempFilePath = path.join(tempPdfsDir, `cover_${Date.now()}_${book.id}.pdf`);
    
    doc.end();

    const pdfBuffer = await streamToBuffer(doc);
    await fs.writeFile(tempFilePath, pdfBuffer);
    
    console.log(`[PDF Service: Cover] ✅ Cover PDF saved successfully to: ${tempFilePath}`);
    return tempFilePath;
};

// First Pass: Generates the content PDF (no padding/evenness yet)
export const generateAndSaveTextBookPdf = async (book, productConfig) => {
    const { width, height, layout } = getProductDimensions(productConfig.id);
    const doc = new PDFDocument({
        autoFirstPage: false,
        size: [width, height],
        layout: layout,
        margins: { top: 72, bottom: 72, left: 72, right: 72 } // 1 inch margins
    });
    
    const tempPdfsDir = path.resolve(process.cwd(), 'tmp', 'pdfs');
    await fs.mkdir(tempPdfsDir, { recursive: true });
    const tempFilePath = path.join(tempPdfsDir, `interior_textbook_content_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.pdf`);

    // --- Title Page ---
    doc.addPage();
    console.log(`[PDF Service: Textbook - Content] Added Title Page. Current PDFKit page: ${doc.page.count || 0}`);

    doc.fontSize(28).font(ROBOTO_BOLD_PATH).text(book.title, { align: 'center' }); 
    doc.moveDown(4);
    doc.fontSize(16).font(ROBOTO_REGULAR_PATH).text('A Story by Inkwell AI', { align: 'center' }); 

    // --- Chapter Pages ---
    for (const [index, chapter] of book.chapters.entries()) {
        if (index > 0) { 
            doc.moveDown(4); 
        }
        console.log(`[PDF Service: Textbook - Content] Adding Chapter ${chapter.chapter_number}. Current PDFKit page: ${doc.page.count || 0}`);

        doc.fontSize(18).font(ROBOTO_BOLD_PATH).text(`Chapter ${chapter.chapter_number}`, { align: 'center' }); 
        doc.moveDown(2);

        doc.fontSize(12).font(ROBOTO_REGULAR_PATH).text(chapter.content, { 
            align: 'justify',
            width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        }); 
    }
    
    console.log(`[PDF Service: Textbook - Content] Final PDFKit page count before saving: ${doc.page.count || 0}`); 
    
    doc.end(); // Finalize the PDF document for content generation

    const pdfBuffer = await streamToBuffer(doc);
    await fs.writeFile(tempFilePath, pdfBuffer);

    let trueContentPageCount = null;
    try {
        const existingPdfBytes = await fs.readFile(tempFilePath);
        const pdfDoc = await PDFLibDocument.load(existingPdfBytes);
        trueContentPageCount = pdfDoc.getPageCount();
        console.log(`[PDF Service: Textbook - Content] ✅ True content page count from pdf-lib: ${trueContentPageCount}`);
    } catch (error) {
        console.error(`[PDF Service: Textbook - Content] ❌ Failed to get true content page count from PDF-Lib for ${tempFilePath}:`, error);
        console.warn(`[PDF Service: Textbook - Content] Returning pageCount: null due to pdf-lib error. Downstream must handle this.`);
        trueContentPageCount = null; 
    }

    console.log(`[PDF Service: Textbook - Content] Returning { path: ${tempFilePath}, pageCount: ${trueContentPageCount} }`);
    return { path: tempFilePath, pageCount: trueContentPageCount };
};

// First Pass: Generates the content PDF (no padding/evenness yet)
export const generateAndSavePictureBookPdf = async (book, events, productConfig) => {
    const { width, height, layout } = getProductDimensions(productConfig.id);
    const doc = new PDFDocument({
        size: [width, height],
        layout: layout,
        autoFirstPage: false,
        margins: { top: 36, bottom: 36, left: 36, right: 36 } // Half inch margins
    });

    const tempPdfsDir = path.resolve(process.cwd(), 'tmp', 'pdfs');
    await fs.mkdir(tempPdfsDir, { recursive: true });
    const tempFilePath = path.join(tempPdfsDir, `interior_picturebook_content_${Date.now()}_${book.id}.pdf`);

    // Title Page (often the first internal page, distinct from the external cover)
    doc.addPage();
    console.log(`[PDF Service: Picture Book - Content] Added Title Page. Current PDFKit page: ${doc.page.count || 0}`);

    if (book.cover_image_url) {
        try {
            console.log(`[PDF Service: Picture Book - Content] Attempting to load interior title page image from: ${book.cover_image_url}`);
            const coverImageBuffer = await getImageBuffer(book.cover_image_url);
            doc.image(coverImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height, fit: [doc.page.width, doc.page.height], valign: 'center', align: 'center' });
            console.log(`[PDF Service: Picture Book - Content] Successfully embedded interior title page image.`);
        } catch (imgErr) {
            console.error(`[PDF Service: Picture Book - Content] Failed to load interior title page image from ${book.cover_image_url}:`, imgErr);
            doc.fontSize(40).font(ROBOTO_BOLD_PATH).text(book.title, { align: 'center' }); 
        }
    } else {
        doc.fontSize(40).font(ROBOTO_BOLD_PATH).text(book.title, { align: 'center' }); 
        doc.moveDown(2);
        doc.fontSize(18).font(ROBOTO_REGULAR_PATH).text('A Personalized Story from Inkwell AI', { align: 'center' }); 
    }

    // Event pages
    for (const event of events) {
        doc.addPage();
        console.log(`[PDF Service: Picture Book - Content] Adding event page for event ID ${event.id}. Current PDFKit page: ${doc.page.count || 0}`);
        const imageUrl = event.uploaded_image_url || event.image_url;
        const margin = doc.page.margins.left;
        const contentWidth = doc.page.width - 2 * margin;
        const contentHeight = doc.page.height - 2 * margin;

        if (imageUrl) {
            try {
                console.log(`[PDF Service: Picture Book - Content] Fetching event image from: ${imageUrl}`);
                const imageBuffer = await getImageBuffer(imageUrl);
                const imageFitHeight = contentHeight * 0.7; 
                doc.image(imageBuffer, margin, margin, { 
                    fit: [contentWidth, imageFitHeight], 
                    align: 'center', 
                    valign: 'center' 
                });
                console.log(`[PDF Service: Picture Book - Content] Successfully embedded event image from ${imageUrl}.`);
            } catch (imgErr) {
                console.error(`[PDF Service: Picture Book - Content] Failed to load event image from ${imageUrl}:`, imgErr);
                doc.rect(margin, margin, contentWidth, contentHeight * 0.7).fill('#CCCCCC');
                doc.fontSize(12).fillColor('#333333').text('Image Load Failed', { align: 'center', valign: 'center', width: contentWidth, height: contentHeight * 0.7 });
            }
        }
        
        if (event.description || event.overlay_text) {
            const textToRender = event.overlay_text || event.description;
            const textMarginTop = imageUrl ? (margin + contentHeight * 0.7 + 10) : margin;

            doc.fontSize(14).font(ROBOTO_REGULAR_PATH).fillColor('#000000').text( 
                textToRender,
                margin,
                textMarginTop,
                { 
                    align: 'justify', 
                    width: contentWidth,
                }
            );
        }
    }
    
    console.log(`[PDF Service: Picture Book - Content] Final PDFKit page count before saving: ${doc.page.count || 0}`); 

    doc.end();

    const pdfBuffer = await streamToBuffer(doc);
    await fs.writeFile(tempFilePath, pdfBuffer);

    let trueContentPageCount = null;
    try {
        const existingPdfBytes = await fs.readFile(tempFilePath);
        const pdfDoc = await PDFLibDocument.load(existingPdfBytes);
        trueContentPageCount = pdfDoc.getPageCount();
        console.log(`[PDF Service: Picture Book - Content] ✅ True content page count from pdf-lib: ${trueContentPageCount}`);
    } catch (error) {
        console.error(`[PDF Service: Picture Book - Content] ❌ Failed to get true content page count from PDF-Lib for ${tempFilePath}:`, error);
        console.warn(`[PDF Service: Picture Book - Content] Returning pageCount: null due to pdf-lib error. Downstream must handle this.`);
        trueContentPageCount = null;
    }

    console.log(`[PDF Service: Picture Book - Content] Returning { path: ${tempFilePath}, pageCount: ${trueContentPageCount} }`);
    return { path: tempFilePath, pageCount: trueContentPageCount };
};

// NEW HELPER: Second Pass - Finalizes PDF page count (padding and evenness) using pdf-lib
export const finalizePdfPageCount = async (filePath, productConfig, currentContentPageCount) => {
    let finalPdfBytes;
    let finalPageCount = currentContentPageCount; // Start with the count from the first pass

    try {
        const existingPdfBytes = await fs.readFile(filePath);
        const pdfDoc = await PDFLibDocument.load(existingPdfBytes);

        // Get the dimensions of the first page of the *content* PDF to ensure consistency
        let contentPageWidth, contentPageHeight;
        const firstContentPage = pdfDoc.getPages()[0]; 

        console.log(`[PDF Service: Finalize] DEBUG: Initial pdfDoc pages count: ${pdfDoc.getPages().length}`);
        console.log(`[PDF Service: Finalize] DEBUG: First content page object:`, firstContentPage);


        if (firstContentPage) {
            const size = firstContentPage.getSize();
            contentPageWidth = size.width;
            contentPageHeight = size.height;
            console.log(`[PDF Service: Finalize] DEBUG: Got dimensions from first page: W=${contentPageWidth}, H=${contentPageHeight}`);
        } else {
            // Fallback if the content PDF is unexpectedly empty (shouldn't happen with content pages)
            console.warn(`[PDF Service: Finalize] Content PDF is empty or first page missing. Falling back to product dimensions for padding pages.`);
            const { width, height } = getProductDimensions(productConfig.id); // Get product's default dimensions in points
            contentPageWidth = width;
            contentPageHeight = height;
            console.log(`[PDF Service: Finalize] DEBUG: Falling back to product dimensions: W=${contentPageWidth}, H=${contentPageHeight}`);
        }

        // Ensure dimensions are valid numbers
        if (isNaN(contentPageWidth) || isNaN(contentPageHeight)) {
             console.error(`[PDF Service: Finalize] Critical Error: Content page dimensions are NaN (Width: ${contentPageWidth}, Height: ${contentPageHeight}) even after initial attempts. Falling back to A4 default for padding to prevent crash.`);
             contentPageWidth = mmToPoints(210); // A4 width in points
             contentPageHeight = mmToPoints(297); // A4 height in points
             console.log(`[PDF Service: Finalize] DEBUG: Hardcoding A4 fallback: W=${contentPageWidth}, H=${contentPageHeight}`);
        }
        const consistentPageSize = { width: contentPageWidth, height: contentPageHeight };


        // --- Defensive Padding for Minimum Page Count ---
        if (finalPageCount === null) {
            console.warn(`[PDF Service: Finalize] Received null content page count. Falling back to product's defaultPageCount (${productConfig.defaultPageCount}) for padding decisions.`);
            finalPageCount = productConfig.defaultPageCount; // Use default if content count unknown
        }
        
        const pagesToAddForMin = Math.max(0, productConfig.minPageCount - finalPageCount);
        if (pagesToAddForMin > 0) {
            console.warn(`[PDF Service: Finalize] ⚠️ Current page count (${finalPageCount}) is below product minimum (${productConfig.minPageCount}). Adding ${pagesToAddForMin} blank pages.`);
            for (let i = 0; i < pagesToAddForMin; i++) {
                pdfDoc.addPage(consistentPageSize); // Add page with explicit consistent size
            }
            finalPageCount = pdfDoc.getPageCount(); // Update count after adding pages
        }

        // --- Ensure Even Page Count for Printing ---
        if (finalPageCount % 2 !== 0) {
            console.log(`[PDF Service: Finalize] DEBUG: Current page count (${finalPageCount}) is odd. Adding a final blank page for printing.`);
            pdfDoc.addPage(consistentPageSize); // Add blank page with explicit consistent size
            finalPageCount = pdfDoc.getPageCount(); // Update count after adding page
        }

        finalPdfBytes = await pdfDoc.save();
        await fs.writeFile(filePath, finalPdfBytes); // Overwrite the original file with the modified one
        
        console.log(`[PDF Service: Finalize] ✅ PDF finalized. Final true page count: ${finalPageCount}`);
        return finalPageCount;

    } catch (error) {
        console.error(`[PDF Service: Finalize] ❌ Failed to finalize PDF page count for ${filePath}:`, error);
        console.warn(`[PDF Service: Finalize] Returning null final page count due to error.`);
        return null; // Return null if finalization fails
    }
};