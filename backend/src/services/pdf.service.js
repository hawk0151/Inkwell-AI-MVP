// backend/src/services/pdf.service.js

// CHANGES:
// - Modified generateAndSavePictureBookPdf to pad with blank pages if finalPageCount is below productConfig.minPageCount.
// - Added specific logging for page count padding.
// - Enhanced console logs with more contextual information during PDF generation.

import PDFDocument from 'pdfkit';
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

export const generateAndSaveTextBookPdf = async (book, productConfig) => {
    const { width, height, layout } = getProductDimensions(productConfig.id);
    const doc = new PDFDocument({
        autoFirstPage: false, // We control page creation manually
        size: [width, height],
        layout: layout,
        margins: { top: 72, bottom: 72, left: 72, right: 72 } // 1 inch margins
    });
    
    const tempPdfsDir = path.resolve(process.cwd(), 'tmp', 'pdfs');
    await fs.mkdir(tempPdfsDir, { recursive: true });
    const tempFilePath = path.join(tempPdfsDir, `interior_textbook_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.pdf`);

    let pageCount = 0;

    // --- Title Page ---
    doc.addPage();
    pageCount++;
    console.log(`[PDF Service: Textbook] Added Title Page. Current pageCount: ${pageCount}`);

    doc.fontSize(28).font(ROBOTO_BOLD_PATH).text(book.title, { align: 'center' }); 
    doc.moveDown(4);
    doc.fontSize(16).font(ROBOTO_REGULAR_PATH).text('A Story by Inkwell AI', { align: 'center' }); 

    // --- Chapter Pages ---
    for (const chapter of book.chapters) {
        // Add a new page for each chapter to ensure clear separation and correct counting.
        // PDFKit will add more pages automatically if the content overflows.
        doc.addPage(); 
        pageCount++;
        console.log(`[PDF Service: Textbook] Starting Chapter ${chapter.chapter_number}. Current pageCount: ${pageCount}`);

        doc.fontSize(18).font(ROBOTO_BOLD_PATH).text(`Chapter ${chapter.chapter_number}`, { align: 'center' }); 
        doc.moveDown(2);

        // --- MODIFIED: Added options for text rendering to ensure proper flow ---
        doc.fontSize(12).font(ROBOTO_REGULAR_PATH).text(chapter.content, { 
            align: 'justify',
            // Set continued: true for the last segment of text to allow PDFKit to automatically
            // flow text onto new pages as needed. This is key for long content.
            // However, for entire chapter content, PDFKit usually handles this by default.
            // Explicitly setting columnGap and height might be needed for more complex layouts,
            // but for simple flowing text, default behavior is usually sufficient if text is long.
            // Let's ensure no hidden properties prevent new pages.
            // Example: width property if too restrictive could prevent flow.
            width: doc.page.width - doc.page.margins.left - doc.page.margins.right, // Ensure text uses full content width
            height: doc.page.height - doc.y - doc.page.margins.bottom, // Ensure it fills remaining vertical space
            // Adding a listener to count pages automatically when PDFKit adds them
            // This is the most robust way to get page count for flowing text.
            // Unfortunately, pdfkit doesn't expose a simple way to count *new* pages added by text() overflow.
            // The `doc.addPage()` before each chapter is the explicit page addition.
            // For overflow, the `pageCount` must be derived *after* doc.end() or by tracking `doc.page.count`.
        }); 
        
        // After adding chapter content, if PDFKit automatically added pages,
        // doc.page.count will be greater than the last recorded pageCount.
        // We need to capture these new pages.
        while (doc.page.count > pageCount) {
            pageCount++;
            console.log(`[PDF Service: Textbook] Auto-added page for overflow. Current pageCount: ${pageCount}`);
        }
    }
    
    // --- Ensure Even Page Count for Printing ---
    // This logic is crucial for physical printing requirements.
    if (pageCount % 2 !== 0) {
        console.log("[PDF Service: Textbook] DEBUG: Page count is odd, adding a final blank page.");
        doc.addPage();
        pageCount++;
    }
    console.log(`[PDF Service: Textbook] Final pageCount before saving: ${pageCount}`);
    
    doc.end(); // Finalize the PDF document

    const pdfBuffer = await streamToBuffer(doc);
    await fs.writeFile(tempFilePath, pdfBuffer);

    console.log(`[PDF Service: Textbook] PDF generated with final page count: ${pageCount}`);
    return { path: tempFilePath, pageCount: pageCount };
};

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
    const tempFilePath = path.join(tempPdfsDir, `interior_picturebook_${Date.now()}_${book.id}.pdf`);

    let pageCount = 0;

    // Title Page (often the first internal page, distinct from the external cover)
    doc.addPage();
    pageCount++;
    console.log(`[PDF Service: Picture Book] Added Title Page. Current pageCount: ${pageCount}`);

    // If an interior cover image URL is provided (e.g., for inside cover illustration)
    if (book.cover_image_url) { // Assuming book.cover_image_url might be used for interior title page also
        try {
            console.log(`[PDF Service: Picture Book] Attempting to load interior title page image from: ${book.cover_image_url}`);
            const coverImageBuffer = await getImageBuffer(book.cover_image_url);
            doc.image(coverImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height, fit: [doc.page.width, doc.page.height], valign: 'center', align: 'center' });
            console.log(`[PDF Service: Picture Book] Successfully embedded interior title page image.`);
        } catch (imgErr) {
            console.error(`[PDF Service: Picture Book] Failed to load interior title page image from ${book.cover_image_url}:`, imgErr);
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
        pageCount++;
        console.log(`[PDF Service: Picture Book] Adding event page for event ID ${event.id}. Current pageCount: ${pageCount}`);
        const imageUrl = event.uploaded_image_url || event.image_url;
        const margin = doc.page.margins.left;
        const contentWidth = doc.page.width - 2 * margin;
        const contentHeight = doc.page.height - 2 * margin; // Full usable area for content

        if (imageUrl) {
            try {
                console.log(`[PDF Service: Picture Book] Fetching event image from: ${imageUrl}`);
                const imageBuffer = await getImageBuffer(imageUrl);
                // Fit image within ~70% of page height, centered horizontally and vertically in top 70% area
                const imageFitHeight = contentHeight * 0.7; 
                doc.image(imageBuffer, margin, margin, { 
                    fit: [contentWidth, imageFitHeight], 
                    align: 'center', 
                    valign: 'center' 
                });
                console.log(`[PDF Service: Picture Book] Successfully embedded event image from ${imageUrl}.`);
            } catch (imgErr) {
                console.error(`[PDF Service: Picture Book] Failed to load event image from ${imageUrl}:`, imgErr);
                doc.rect(margin, margin, contentWidth, contentHeight * 0.7).fill('#CCCCCC'); // Placeholder for failed image
                doc.fontSize(12).fillColor('#333333').text('Image Load Failed', { align: 'center', valign: 'center', width: contentWidth, height: contentHeight * 0.7 });
            }
        }
        
        // Overlay text / description
        if (event.description || event.overlay_text) {
            const textToRender = event.overlay_text || event.description;
            const textY = doc.y; // Current Y position after image, or top margin if no image
            // If image was added, text should appear below it.
            // If no image, text should appear from normal flow, but let's constrain its position.
            const textMarginTop = imageUrl ? (margin + contentHeight * 0.7 + 10) : margin; // 10pt buffer below image

            // Ensure text does not exceed bottom margin, set max height for text area
            const maxTextHeight = doc.page.height - doc.page.margins.bottom - textMarginTop;

            doc.fontSize(14).font(ROBOTO_REGULAR_PATH).fillColor('#000000').text( 
                textToRender,
                margin,
                textMarginTop,
                { 
                    align: 'justify', 
                    width: contentWidth,
                    height: maxTextHeight, // Limit height to prevent overflow into margin
                    ellipsis: true // Add ellipsis if text is too long
                }
            );
        }
        // No auto page count needed for picture books as content is fixed per page
    }

    // --- Handle Page Count for Printing & Minimums ---
    // If the generated page count is less than the product's minimum, add blank pages.
    if (pageCount < productConfig.minPageCount) {
        const pagesToAdd = productConfig.minPageCount - pageCount;
        console.warn(`[PDF Service: Picture Book] ⚠️ Generated page count (${pageCount}) is below product minimum (${productConfig.minPageCount}). Adding ${pagesToAdd} blank pages.`);
        for (let i = 0; i < pagesToAdd; i++) {
            doc.addPage();
            pageCount++;
        }
    }

    // Ensure even page count for printing (after padding for minimums)
    if (pageCount % 2 !== 0) {
        console.log("[PDF Service: Picture Book] DEBUG: Page count is odd, adding a final blank page for printing.");
        doc.addPage();
        pageCount++;
    }

    console.log(`[PDF Service: Picture Book] Final pageCount before saving: ${pageCount}`);

    doc.end();

    const pdfBuffer = await streamToBuffer(doc);
    await fs.writeFile(tempFilePath, pdfBuffer);

    console.log(`[PDF Service: Picture Book] PDF generated with final page count: ${pageCount}`);
    return { path: tempFilePath, pageCount: pageCount };
};