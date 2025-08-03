// backend/src/services/pdf.service.js

// CHANGES:
// - Redesigned PDF generation into a two-pass system.
// - generateAndSaveTextBookPdf and generateAndSavePictureBookPdf now only generate content, returning true content page count.
// - Introduced finalizePdfPageCount helper which loads PDF, pads it, ensures even page count, and returns final page count.
// - CRITICAL FIX: Ensure pdf-lib's addPage() uses consistent dimensions from the original PDF's first page to resolve 'printable_normalization' warning.
// - CRITICAL FIX: Added robust validation of page dimensions within finalizePdfPageCount to prevent NaN errors when adding pages to PDF-Lib document.
// - DIAGNOSTIC/WORKAROUND: Now passes page dimensions as a [width, height] array to pdfDoc.addPage() to bypass potential object interpretation issues causing NaN error.
// - STABILITY/LULU COMPATIBILITY FIXES:
//   - getProductDimensions now calculates and returns bleed-inclusive page dimensions (widthWithBleed, heightWithBleed).
//   - generateAndSavePictureBookPdf and generateAndSaveTextBookPdf now initialize PDFDocument with bleed-inclusive dimensions.
//   - Images intended for full-bleed are placed at (0,0) and sized to fill the entire bleed-inclusive page.
//   - Text elements are positioned explicitly within the calculated 'safe area' (bleed + safeMargin from edge).
//   - Page numbering in picture books is added within the safe area.
// - NEW: Integrated `story_text` functionality for picture books:
//   - Replaced `event.description` handling with `event.story_text`.
//   - `story_text` is placed in a dedicated region within safe margins.
//   - `story_text` font style (regular/bold) is dynamic based on `event.is_bold_story_text`.
//   - Implemented text truncation with ellipsis if `story_text` exceeds allocated space.

import PDFDocument from 'pdfkit'; // For creating PDFs
import { PDFDocument as PDFLibDocument, rgb } from 'pdf-lib'; // For reading/modifying PDFs
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { LULU_PRODUCT_CONFIGURATIONS } from './lulu.service.js'; // Now includes bleedMm and safeMarginMm

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mmToPoints = (mm) => mm * (72 / 25.4);
const pointsToMm = (pt) => pt * (25.4 / 72); // Helper for debugging

const ROBOTO_REGULAR_PATH = path.join(__dirname, '../fonts/Roboto-Regular.ttf');
const ROBOTO_BOLD_PATH = path.join(__dirname, '../fonts/Roboto-Bold.ttf');

const getProductDimensions = (luluConfigId) => {
    const productConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === luluConfigId);
    if (!productConfig) {
        throw new Error(`Product configuration with ID ${luluConfigId} not found.`);
    }

    let trimWidthMm, trimHeightMm, layout;
    switch (productConfig.trimSize) {
        case '5.25x8.25':
            trimWidthMm = 133.35; trimHeightMm = 209.55; layout = 'portrait'; break;
        case '8.52x11.94':
            trimWidthMm = 216.41; trimHeightMm = 303.28; layout = 'portrait'; break;
        case '6.39x9.46':
            trimWidthMm = 162.31; trimHeightMm = 240.28; layout = 'portrait'; break;
        case '8.27x11.69': // A4 Premium Picture Book
            trimWidthMm = 209.55; trimHeightMm = 296.9; layout = 'portrait'; break;
        default:
            console.error(`[PDF Service: getProductDimensions] Unknown trim size ${productConfig.trimSize}. Falling back to A4 standard dimensions.`);
            trimWidthMm = 210; // A4 width in mm (default fallback)
            trimHeightMm = 297; // A4 height in mm (default fallback)
            layout = 'portrait';
    }

    const bleed = productConfig.bleedMm; // Bleed amount on one side (e.g., 3.175mm)
    const safeMargin = productConfig.safeMarginMm; // Safe margin from trim edge (e.g., 6.35mm)

    // Calculate dimensions including bleed on all 4 sides
    const pageWidthWithBleedMm = trimWidthMm + (2 * bleed);
    const pageHeightWithBleedMm = trimHeightMm + (2 * bleed);

    const trimWidthPoints = mmToPoints(trimWidthMm);
    const trimHeightPoints = mmToPoints(trimHeightMm);
    const pageWidthWithBleedPoints = mmToPoints(pageWidthWithBleedMm);
    const pageHeightWithBleedPoints = pageHeightWithBleedMm > pageWidthWithBleedMm && layout === 'portrait' ? mmToPoints(pageHeightWithBleedMm) : mmToPoints(pageHeightWithBleedMm); // Corrected this for landscape covers
    const bleedPoints = mmToPoints(bleed);
    const safeMarginPoints = mmToPoints(safeMargin);

    // Calculate effective content area (safe zone)
    const contentX = bleedPoints + safeMarginPoints;
    const contentY = bleedPoints + safeMarginPoints;
    const contentWidth = pageWidthWithBleedPoints - (2 * contentX); // (pageWidthWithBleed - 2 * (bleed + safeMargin))
    const contentHeight = pageHeightWithBleedPoints - (2 * contentY); // (pageHeightWithBleed - 2 * (bleed + safeMargin))


    console.log(`[PDF Service: Product Dimensions for ${productConfig.id}]`);
    console.log(`  Trim Size (mm): ${trimWidthMm.toFixed(2)} x ${trimHeightMm.toFixed(2)}`);
    console.log(`  Bleed (mm): ${bleed.toFixed(3)} (per side)`);
    console.log(`  Safe Margin (mm): ${safeMargin.toFixed(3)} (from trim edge)`);
    console.log(`  Page Size with Bleed (mm): ${pageWidthWithBleedMm.toFixed(2)} x ${pageHeightWithBleedMm.toFixed(2)}`);
    console.log(`  Page Size with Bleed (pts): ${pageWidthWithBleedPoints.toFixed(2)} x ${pageHeightWithBleedPoints.toFixed(2)}`);
    console.log(`  Content/Safe Zone Start (pts from (0,0)): X=${contentX.toFixed(2)}, Y=${contentY.toFixed(2)}`);
    console.log(`  Content/Safe Zone Dimensions (pts): W=${contentWidth.toFixed(2)}, H=${contentHeight.toFixed(2)}`);


    return {
        trimWidth: trimWidthPoints,
        trimHeight: trimHeightPoints,
        pageWidthWithBleed: pageWidthWithBleedPoints,
        pageHeightWithBleed: pageHeightWithBleedPoints,
        bleedPoints: bleedPoints,
        safeMarginPoints: safeMarginPoints,
        contentX: contentX,
        contentY: contentY,
        contentWidth: contentWidth,
        contentHeight: contentHeight,
        layout: layout
    };
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
    
    console.log(`[PDF Service: Cover] Original dimensions from Lulu API (mm): Width=${widthMm.toFixed(2)}, Height=${heightMm.toFixed(2)}`);
    console.log(`[PDF Service: Cover] Converted dimensions from Lulu API (pts): Width=${widthPoints.toFixed(2)}, Height=${heightPoints.toFixed(2)}`);

    // Ensure cover is landscape if the dimensions suggest it (Lulu often provides cover as one landscape sheet)
    if (heightPoints > widthPoints) {
        console.warn(`[PDF Service: Cover] ⚠️ Height > Width detected. Swapping dimensions to enforce landscape orientation for cover PDF. This is often the case for print-ready covers.`);
        [widthPoints, heightPoints] = [heightPoints, widthPoints]; // Swap
        console.warn(`[PDF Service: Cover] Corrected dimensions (pts): Width=${widthPoints.toFixed(2)}, Height=${heightPoints.toFixed(2)}`);
    }

    const doc = new PDFDocument({
        size: [widthPoints, heightPoints], // Lulu API cover dimensions should include bleed and spine
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });
    
    // Define the safe area relative to the full cover dimensions
    const coverBleed = productConfig.bleedMm; // Assuming the same bleed as interiors for consistency in visual guide
    const coverSafeMargin = productConfig.safeMarginMm; // Assuming same safe margin from trim
    
    // Calculate safe zone coordinates (from the edge of the *entire* PDF, i.e., including bleed)
    const totalSafeOffsetPoints = mmToPoints(coverBleed + coverSafeMargin);
    const safeZoneX = totalSafeOffsetPoints;
    const safeZoneY = totalSafeOffsetPoints;
    const safeZoneWidth = widthPoints - (2 * totalSafeOffsetPoints);
    const safeZoneHeight = heightPoints - (2 * totalSafeOffsetPoints);

    if (book.cover_image_url) {
        try {
            console.log(`[PDF Service: Cover] Fetching cover image from: ${book.cover_image_url}`);
            const imageBuffer = await getImageBuffer(book.cover_image_url);
            // Place image to fill the entire document, including the bleed area
            doc.image(imageBuffer, 0, 0, {
                width: widthPoints,
                height: heightPoints,
            });
            console.log("[PDF Service: Cover] ✅ Successfully embedded cover image (full bleed assumed).");
        } catch (error) {
            console.error("[PDF Service: Cover] ❌ Failed to fetch or embed cover image.", error);
            // Fallback: Red background and error text within safe zone
            doc.rect(0, 0, widthPoints, heightPoints).fill('red');
            doc.fontSize(24).fillColor('#FFFFFF').font(ROBOTO_BOLD_PATH)
                .text(`Error: Could not load cover image.`, safeZoneX, safeZoneY + safeZoneHeight / 3, { 
                    width: safeZoneWidth, 
                    align: 'center' 
                });
        }
    } else {
        console.warn("[PDF Service: Cover] ⚠️ No `cover_image_url` found. Generating a placeholder text-based cover.");
        
        doc.rect(0, 0, widthPoints, heightPoints).fill('#313131'); // Fill whole page with dark grey
        
        // Place text within the calculated safe zone
        doc.fontSize(48).fillColor('#FFFFFF').font(ROBOTO_BOLD_PATH)
           .text(book.title, safeZoneX, safeZoneY + (safeZoneHeight / 4), { // Adjusted Y to be relative to safeZone
               align: 'center',
               width: safeZoneWidth
           });
        
        doc.moveDown(1);

        doc.fontSize(24).fillColor('#CCCCCC').font(ROBOTO_REGULAR_PATH)
           .text('Inkwell AI', {
               align: 'center',
               width: safeZoneWidth,
               x: safeZoneX // Ensure text starts at safeZoneX
           });
        console.log("[PDF Service: Cover] ✅ Placeholder cover generated successfully (text in safe zone).");
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
    // Get dimensions including bleed for PDF creation
    const { pageWidthWithBleed, pageHeightWithBleed, bleedPoints, safeMarginPoints, contentX, contentY, contentWidth, contentHeight, layout } = getProductDimensions(productConfig.id);
    
    const doc = new PDFDocument({
        autoFirstPage: false,
        size: [pageWidthWithBleed, pageHeightWithBleed], // Use dimensions including bleed
        layout: layout,
        margins: { top: 0, bottom: 0, left: 0, right: 0 } // Margins set to 0 as we control content positioning
    });
    
    const tempPdfsDir = path.resolve(process.cwd(), 'tmp', 'pdfs');
    await fs.mkdir(tempPdfsDir, { recursive: true });
    const tempFilePath = path.join(tempPdfsDir, `interior_textbook_content_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.pdf`);

    // --- Title Page ---
    doc.addPage();
    console.log(`[PDF Service: Textbook - Content] Added Title Page. Current PDFKit page: ${doc.page.count || 0}`);

    // Position content within the safe area
    doc.fontSize(28).font(ROBOTO_BOLD_PATH)
       .text(book.title, contentX, contentY, { align: 'center', width: contentWidth }); 
    doc.moveDown(4);
    doc.fontSize(16).font(ROBOTO_REGULAR_PATH)
       .text('A Story by Inkwell AI', contentX, doc.y, { align: 'center', width: contentWidth }); 

    // --- Chapter Pages ---
    for (const [index, chapter] of book.chapters.entries()) {
        if (index > 0) { 
            doc.addPage(); // Start new chapter on a new page
        }
        console.log(`[PDF Service: Textbook - Content] Adding Chapter ${chapter.chapter_number}. Current PDFKit page: ${doc.page.count || 0}`);

        // Chapter title
        doc.fontSize(18).font(ROBOTO_BOLD_PATH)
           .text(`Chapter ${chapter.chapter_number}`, contentX, contentY, { align: 'center', width: contentWidth }); 
        doc.moveDown(2);

        // Chapter content
        doc.fontSize(12).font(ROBOTO_REGULAR_PATH)
           .text(chapter.content, contentX, doc.y, { 
               align: 'justify',
               width: contentWidth,
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

// Helper to truncate text to fit a given height
function truncateText(doc, text, maxWidth, maxHeight, fontPath, fontSize) {
    doc.font(fontPath).fontSize(fontSize);
    let currentText = text;
    while (currentText.length > 0 && doc.heightOfString(currentText, { width: maxWidth }) > maxHeight) {
        currentText = currentText.split(' ').slice(0, -1).join(' '); // Remove last word
        if (currentText.length > 0) {
            currentText = currentText.trim(); // Trim any trailing spaces
            if (!currentText.endsWith('...')) { // Only add ellipsis if not already there
                currentText += '...';
            }
        }
    }
    return currentText;
}


// First Pass: Generates the content PDF (no padding/evenness yet)
export const generateAndSavePictureBookPdf = async (book, events, productConfig) => {
    // Get dimensions including bleed for PDF creation and safe zone for text
    const { pageWidthWithBleed, pageHeightWithBleed, bleedPoints, safeMarginPoints, contentX, contentY, contentWidth, contentHeight, layout } = getProductDimensions(productConfig.id);

    const doc = new PDFDocument({
        size: [pageWidthWithBleed, pageHeightWithBleed], // Use dimensions including bleed
        layout: layout,
        autoFirstPage: false,
        margins: { top: 0, bottom: 0, left: 0, right: 0 } // Margins set to 0 as we control content positioning
    });

    const tempPdfsDir = path.resolve(process.cwd(), 'tmp', 'pdfs');
    await fs.mkdir(tempPdfsDir, { recursive: true });
    const tempFilePath = path.join(tempPdfsDir, `interior_picturebook_content_${Date.now()}_${book.id}.pdf`);

    // --- Interior Title Page ---
    doc.addPage();
    console.log(`[PDF Service: Picture Book - Content] Added Interior Title Page. Current PDFKit page: ${doc.page.count || 0}`);

    if (book.cover_image_url) {
        try {
            console.log(`[PDF Service: Picture Book - Content] Attempting to load interior title page image from: ${book.cover_image_url}`);
            const coverImageBuffer = await getImageBuffer(book.cover_image_url);
            // Place image to fill the entire document, including the bleed area
            doc.image(coverImageBuffer, 0, 0, { 
                width: pageWidthWithBleed, 
                height: pageHeightWithBleed,
                fit: [pageWidthWithBleed, pageHeightWithBleed], 
                valign: 'center', 
                align: 'center' 
            });
            console.log(`[PDF Service: Picture Book - Content] Successfully embedded interior title page image (full bleed assumed).`);
        } catch (imgErr) {
            console.error(`[PDF Service: Picture Book - Content] Failed to load interior title page image from ${book.cover_image_url}:`, imgErr);
            // Fallback: Gray background with book title centered in safe zone
            doc.rect(0, 0, pageWidthWithBleed, pageHeightWithBleed).fill('#313131');
            doc.fontSize(40).font(ROBOTO_BOLD_PATH)
               .fillColor('#FFFFFF').text(book.title, contentX, contentY + contentHeight / 3, { // Center vertically in safe zone
                   align: 'center', 
                   width: contentWidth 
               }); 
        }
    } else {
        // Fallback: Gray background with book title centered in safe zone
        doc.rect(0, 0, pageWidthWithBleed, pageHeightWithBleed).fill('#313131');
        doc.fontSize(40).font(ROBOTO_BOLD_PATH)
           .fillColor('#FFFFFF').text(book.title, contentX, contentY + contentHeight / 3, { 
               align: 'center', 
               width: contentWidth 
           }); 
        doc.moveDown(2);
        doc.fontSize(18).font(ROBOTO_REGULAR_PATH)
           .fillColor('#CCCCCC').text('A Personalized Story from Inkwell AI', contentX, doc.y, { 
               align: 'center', 
               width: contentWidth 
           }); 
    }

    // Event pages
    for (const [idx, event] of events.entries()) {
        doc.addPage();
        console.log(`[PDF Service: Picture Book - Content] Adding event page ${idx + 1} for event ID ${event.id}. Current PDFKit page: ${doc.page.count || 0}`);
        
        const imageUrl = event.uploaded_image_url || event.image_url;
        const storyText = event.story_text || ''; // NEW: Get story_text
        const isBoldStoryText = event.is_bold_story_text || false; // NEW: Get bold preference

        // Background color for page
        doc.rect(0, 0, pageWidthWithBleed, pageHeightWithBleed).fill('#FFFFFF'); // White background for content pages

        // Image area: Full bleed
        if (imageUrl) {
            try {
                console.log(`[PDF Service: Picture Book - Content] Fetching event image from: ${imageUrl}`);
                const imageBuffer = await getImageBuffer(imageUrl);
                // Place image to fill the entire document, including the bleed area
                doc.image(imageBuffer, 0, 0, { 
                    width: pageWidthWithBleed, 
                    height: pageHeightWithBleed,
                    fit: [pageWidthWithBleed, pageHeightWithBleed],
                    valign: 'center', 
                    align: 'center'
                });
                console.log(`[PDF Service: Picture Book - Content] Successfully embedded event image from ${imageUrl} (full bleed assumed).`);
            } catch (imgErr) {
                console.error(`[PDF Service: Picture Book - Content] Failed to load event image from ${imageUrl}:`, imgErr);
                // Fallback: Gray placeholder for failed image load
                doc.rect(0, 0, pageWidthWithBleed, pageHeightWithBleed).fill('#CCCCCC');
                doc.fontSize(24).fillColor('#333333').font(ROBOTO_BOLD_PATH)
                   .text('Image Not Available', contentX, contentY + contentHeight / 2 - 20, { 
                       align: 'center', 
                       width: contentWidth 
                   });
            }
        }
        
        // Define areas for overlay_text and story_text within the safe zone
        const overlayTextHeightFraction = 0.15; // Top 15% of safe height for overlay
        const storyTextHeightFraction = 0.25; // Bottom 25% of safe height for story text
        const verticalPaddingBetweenTextAreas = 10; // Padding in points

        // Overlay Text: Placed in a safe zone over the image
        if (event.overlay_text) {
            const overlayTextY = contentY + (contentHeight * 0.75 - doc.heightOfString(event.overlay_text, { width: contentWidth, lineGap: 0, align: 'center' }) / 2); // Vertically center in bottom 25% of image, adjusted for text height
            
            doc.save(); // Save current state to restore after text background if needed
            // Optional: Draw a semi-transparent background for overlay text for readability
            // doc.rect(contentX, contentY + contentHeight * (1 - overlayTextHeightFraction), contentWidth, contentHeight * overlayTextHeightFraction).fillOpacity(0.7).fill(rgb(0, 0, 0)); 
            // doc.fillOpacity(1); // Reset fill opacity

            doc.fontSize(22).font(ROBOTO_BOLD_PATH).fillColor('#FFFFFF') // White, bold text for overlay
               .text(
                   event.overlay_text,
                   contentX, // X position is safe zone start
                   overlayTextY, 
                   { 
                       align: 'center', 
                       width: contentWidth,
                       height: contentHeight * overlayTextHeightFraction,
                       lineGap: 0,
                       valign: 'center' // Vertically center within the given height
                   }
               );
            doc.restore(); // Restore state if background was drawn
        }

        // Story Text: Placed in a dedicated safe zone at the bottom of the page
        if (storyText) { // Check for story_text
            const storyTextY = pageHeightWithBleed - bleedPoints - safeMarginPoints - (contentHeight * storyTextHeightFraction); // Position story text block from bottom of safe area
            const storyTextFont = isBoldStoryText ? ROBOTO_BOLD_PATH : ROBOTO_REGULAR_PATH;
            const storyTextFontSize = 14; // Default font size for story text

            // Calculate exact height needed for text
            const textHeightNeeded = doc.font(storyTextFont).fontSize(storyTextFontSize).heightOfString(storyText, { width: contentWidth });
            
            let finalStoryText = storyText;
            if (textHeightNeeded > (contentHeight * storyTextHeightFraction)) {
                console.warn(`[PDF Service] Story text on page ${idx + 1} is too long (${textHeightNeeded.toFixed(2)} pts) for allocated space (${(contentHeight * storyTextHeightFraction).toFixed(2)} pts). Truncating...`);
                finalStoryText = truncateText(doc, storyText, contentWidth, contentHeight * storyTextHeightFraction, storyTextFont, storyTextFontSize);
            }

            doc.fontSize(storyTextFontSize).font(storyTextFont).fillColor('#000000') // Black text for story
               .text( 
                   finalStoryText,
                   contentX, // X position is safe zone start
                   storyTextY + (contentHeight * storyTextHeightFraction - doc.heightOfString(finalStoryText, {width: contentWidth, lineGap: 0, align: 'justify'})) / 2, // Vertically center within its allocated height
                   { 
                       align: 'justify', 
                       width: contentWidth,
                       height: contentHeight * storyTextHeightFraction,
                       lineGap: 0,
                       valign: 'center'
                   }
               );
        }

        // Page Number (within safe margin at bottom)
        const pageNumberX = contentX;
        const pageNumberY = pageHeightWithBleed - bleedPoints - safeMarginPoints - 18; // 18 points from bottom of safe margin
        doc.fontSize(10).font(ROBOTO_REGULAR_PATH).fillColor('#000000')
           .text(`${idx + 1}`, pageNumberX, pageNumberY, { align: 'center', width: contentWidth });
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
            console.log(`[PDF Service: Finalize] DEBUG: Got dimensions from first page: W=${contentPageWidth.toFixed(2)}, H=${contentPageHeight.toFixed(2)}`);
        } else {
            // Fallback if the content PDF is unexpectedly empty (shouldn't happen with content pages)
            console.warn(`[PDF Service: Finalize] Content PDF is empty or first page missing. Falling back to product dimensions for padding pages.`);
            const { pageWidthWithBleed, pageHeightWithBleed } = getProductDimensions(productConfig.id); // Get product's default dimensions in points
            contentPageWidth = pageWidthWithBleed;
            contentPageHeight = pageHeightWithBleed;
            console.log(`[PDF Service: Finalize] DEBUG: Falling back to product dimensions: W=${contentPageWidth.toFixed(2)}, H=${contentPageHeight.toFixed(2)}`);
        }

        // Ensure dimensions are valid numbers
        if (isNaN(contentPageWidth) || isNaN(contentPageHeight) || contentPageWidth <= 0 || contentPageHeight <= 0) {
            console.error(`[PDF Service: Finalize] Critical Error: Content page dimensions are invalid (Width: ${contentPageWidth}, Height: ${contentPageHeight}). Falling back to A4 default for padding to prevent crash.`);
            contentPageWidth = mmToPoints(210 + (2 * productConfig.bleedMm)); // A4 width in points + bleed
            contentPageHeight = mmToPoints(297 + (2 * productConfig.bleedMm)); // A4 height in points + bleed
            console.log(`[PDF Service: Finalize] DEBUG: Hardcoding A4 fallback with bleed: W=${contentPageWidth.toFixed(2)}, H=${contentPageHeight.toFixed(2)}`);
        }
        
        // --- FIX: Pass page dimensions as an array [width, height] to pdfDoc.addPage() ---
        const consistentPageSizeArray = [contentPageWidth, contentPageHeight];


        // --- Defensive Padding for Minimum Page Count ---
        if (finalPageCount === null || finalPageCount === 0) { // Also handle 0 pages
            console.warn(`[PDF Service: Finalize] Received null/zero content page count. Falling back to product's defaultPageCount (${productConfig.defaultPageCount}) for padding decisions.`);
            finalPageCount = productConfig.defaultPageCount; // Use default if content count unknown
        }
        
        const pagesToAddForMin = Math.max(0, productConfig.minPageCount - finalPageCount);
        if (pagesToAddForMin > 0) {
            console.warn(`[PDF Service: Finalize] ⚠️ Current page count (${finalPageCount}) is below product minimum (${productConfig.minPageCount}). Adding ${pagesToAddForMin} blank pages.`);
            for (let i = 0; i < pagesToAddForMin; i++) {
                pdfDoc.addPage(consistentPageSizeArray); // Add page with explicit consistent size (as array)
            }
            finalPageCount = pdfDoc.getPageCount(); // Update count after adding pages
        }

        // --- Ensure Even Page Count for Printing (Lulu typically requires even) ---
        if (finalPageCount % 2 !== 0) {
            console.log(`[PDF Service: Finalize] DEBUG: Current page count (${finalPageCount}) is odd. Adding a final blank page for printing to make it even.`);
            pdfDoc.addPage(consistentPageSizeArray); // Add blank page with explicit consistent size (as array)
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