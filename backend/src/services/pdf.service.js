import PDFDocument from 'pdfkit';
// in src/services/pdf.service.js
import { PDFDocument as PDFLibDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { findProductConfiguration } from './lulu.service.js';
// --- Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROBOTO_REGULAR_PATH = path.join(__dirname, '../fonts/Roboto-Regular.ttf');
const ROBOTO_BOLD_PATH = path.join(__dirname, '../fonts/Roboto-Bold.ttf');

// --- Helper Functions ---
const inchesToPoints = (inches) => inches * 72;
const mmToPoints = (mm) => mm * (72 / 25.4);

// UNCHANGED: This function remains the same.
const getProductDimensions = (luluConfigId) => {
    const productConfig = findProductConfiguration(luluConfigId);
    if (!productConfig) {
        throw new Error(`Product configuration with ID ${luluConfigId} not found.`);
    }

    let trimWidthIn, trimHeightIn, layout;
    const safeMarginIn = 0.5;

    switch (productConfig.trimSize) {
        case '5.25x8.25':
            trimWidthIn = 5.25; trimHeightIn = 8.25; layout = 'portrait'; break;
        case '8.52x11.94':
            trimWidthIn = 8.52; trimHeightIn = 11.94; layout = 'portrait'; break;
        case '6.39x9.46':
            trimWidthIn = 6.39; trimHeightIn = 9.46; layout = 'portrait'; break;
        case '11.94x8.52':
            trimWidthIn = 11.94; trimHeightIn = 8.52; layout = 'landscape'; break;
        case '8.75x8.75':
            trimWidthIn = 8.75; trimHeightIn = 8.75; layout = 'portrait'; break;
        default:
            console.error(`[PDF Service] Unknown trim size ${productConfig.trimSize}. Falling back to 5.25x8.25.`);
            trimWidthIn = 5.25; trimHeightIn = 8.25; layout = 'portrait';
    }

    const pageWidthPts = inchesToPoints(trimWidthIn);
    const pageHeightPts = inchesToPoints(trimHeightIn);
    const safeMarginPts = inchesToPoints(safeMarginIn);

    console.log(`[PDF Service: Dimensions for ${productConfig.id}] Layout: ${layout}, Trim Size(pts): W=${pageWidthPts.toFixed(2)}, H=${pageHeightPts.toFixed(2)}`);

    return {
        pageWidth: pageWidthPts,
        pageHeight: pageHeightPts,
        layout: layout,
        margins: {
            top: safeMarginPts,
            bottom: safeMarginPts,
            left: safeMarginPts,
            right: safeMarginPts
        }
    };
};
const addWatermarkToPdf = async (filePath) => {
    try {
        const pdfBytes = await fs.promises.readFile(filePath);
        // Use the renamed PDFLibDocument to load the file
        const pdfDoc = await PDFLibDocument.load(pdfBytes); 
        const helveticaFont = await pdfDoc.embedFont('Helvetica-Bold');

        const pages = pdfDoc.getPages();
        for (const page of pages) {
            const { width, height } = page.getSize();
            page.drawText('PREVIEW - INKWELL.NET.AU', {
                x: width / 2,
                y: height / 2,
                font: helveticaFont,
                size: 80,
                color: rgb(0.2, 0.8, 0.9),
                opacity: 0.65,
                rotate: degrees(-45),
            });
        }

        const modifiedPdfBytes = await pdfDoc.save();
        await fs.promises.writeFile(filePath, modifiedPdfBytes);
        console.log(`[PDF Service] Watermark added to ${filePath}`);
    } catch (error) {
        console.error(`[PDF Service] Failed to add watermark:`, error);
        throw new Error('Could not apply watermark to the PDF.');
    }
};

// UNCHANGED: This function remains the same.
async function getImageBuffer(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary');
}

// UNCHANGED: This function remains the same.
async function streamToBuffer(doc) {
    return new Promise((resolve, reject) => {
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);
    });
}


// --- MODIFIED FUNCTION #1 ---
// This function is now simplified to always return the correct, fixed page count for picture books.
export const calculatePictureBookPageCount = (events, productConfig) => {
    console.log(`[PDF Service] Picture book page count is fixed at 24.`);
    return 24;
};


// --- UNCHANGED FUNCTIONS FOR NOVELS AND COVERS ---
// All other functions (generateCoverPdf, generateTextbookCoverPdf, etc.) are left untouched.

export const generateCoverPdf = async (book, productConfig, coverDimensions) => {
    console.log(`[PDF Service: Cover] Starting cover generation for SKU: ${productConfig.luluSku}`);
    
    const widthPoints = coverDimensions.width;
    const heightPoints = coverDimensions.height;
    
    console.log(`[PDF Service: Cover] Generating cover with exact dimensions from Lulu API: W=${widthPoints.toFixed(4)}pts, H=${heightPoints.toFixed(4)}pts`);

    const doc = new PDFDocument({
        size: [widthPoints, heightPoints],
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });
    
    const bleedMm = productConfig.bleedMm || 3.175;
    const safeMarginMm = productConfig.safeMarginMm || 6.35;
    const totalSafeOffsetPoints = (bleedMm + safeMarginMm) * (72 / 25.4);
    
    const safeZoneX = totalSafeOffsetPoints;
    const safeZoneY = totalSafeOffsetPoints;
    const safeZoneWidth = widthPoints - (2 * totalSafeOffsetPoints);
    const safeZoneHeight = heightPoints - (2 * totalSafeOffsetPoints);

    if (book.user_cover_image_url) {
        try {
            const imageBuffer = await getImageBuffer(book.user_cover_image_url);
            doc.image(imageBuffer, 0, 0, { width: widthPoints, height: heightPoints });
        } catch (error) {
            console.error("[PDF Service: Cover] Failed to embed cover image.", error);
            doc.rect(0, 0, widthPoints, heightPoints).fill('red');
            doc.fontSize(24).fillColor('#FFFFFF').font(ROBOTO_BOLD_PATH)
               .text(`Error: Could not load cover image.`, safeZoneX, safeZoneY + safeZoneHeight / 3, { width: safeZoneWidth, align: 'center' });
        }
    } else {
        doc.rect(0, 0, widthPoints, heightPoints).fill('#313131');
        doc.fontSize(48).fillColor('#FFFFFF').font(ROBOTO_BOLD_PATH)
           .text(book.title, safeZoneX, safeZoneY + (safeZoneHeight / 4), { align: 'center', width: safeZoneWidth });
        doc.moveDown(1);
        doc.fontSize(24).fillColor('#CCCCCC').font(ROBOTO_REGULAR_PATH)
           .text('Inkwell AI', { align: 'center', width: safeZoneWidth, x: safeZoneX });
    }

    const tempPdfsDir = path.resolve(process.cwd(), 'tmp', 'pdfs');
    await fs.promises.mkdir(tempPdfsDir, { recursive: true });
    const tempFilePath = path.join(tempPdfsDir, `cover_${Date.now()}_${book.id}.pdf`);
    
    doc.end();
    const pdfBuffer = await streamToBuffer(doc);
    await fs.promises.writeFile(tempFilePath, pdfBuffer);
    
    return { path: tempFilePath };
};

export const generateTextbookCoverPdf = async (book, productConfig, coverDimensions) => {
    console.log(`[PDF Service: Textbook Cover] Starting cover generation for SKU: ${productConfig.luluSku}`);
    console.log(`[PDF Service: Textbook Cover] Checking for custom cover. URL found:`, book.user_cover_image_url);

    const widthPoints = coverDimensions.width;
    const heightPoints = coverDimensions.height;
    const trimWidthPts = getProductDimensions(productConfig.id).pageWidth;

    console.log(`[PDF Service: Textbook Cover] Generating with dimensions: W=${widthPoints.toFixed(4)}pts, H=${heightPoints.toFixed(4)}pts`);

    const doc = new PDFDocument({
        size: [widthPoints, heightPoints],
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });
    
    const frontCoverWidthPts = trimWidthPts;
    const backCoverWidthPts = trimWidthPts;
    const spineWidthPts = widthPoints - frontCoverWidthPts - backCoverWidthPts;

    const solidColor = '#313131';
    doc.rect(0, 0, widthPoints, heightPoints).fill(solidColor);

    const bleedMm = productConfig.bleedMm || 3.175;
    const totalBleedPts = mmToPoints(bleedMm);

    const frontCoverAreaX = backCoverWidthPts + spineWidthPts;
    const frontCoverAreaWidth = frontCoverWidthPts;
    
    if (book.user_cover_image_url) {
        try {
            const imageBuffer = await getImageBuffer(book.user_cover_image_url);
            doc.image(imageBuffer, frontCoverAreaX, 0, { 
                width: frontCoverAreaWidth, 
                height: heightPoints 
            });
        } catch (error) {
            console.error("[PDF Service: Textbook Cover] Failed to embed user-uploaded cover image.", error);
            doc.rect(frontCoverAreaX, 0, frontCoverAreaWidth, heightPoints).fill('red');
            doc.fontSize(24).fillColor('#FFFFFF').font(ROBOTO_BOLD_PATH)
               .text(`Error: Could not load custom cover.`, frontCoverAreaX, heightPoints / 3, { 
                   width: frontCoverAreaWidth, 
                   align: 'center' 
               });
        }
    } else {
        doc.fontSize(48).fillColor('#FFFFFF').font(ROBOTO_BOLD_PATH)
           .text(book.title, frontCoverAreaX + totalBleedPts, heightPoints / 4, { 
               align: 'center', 
               width: frontCoverAreaWidth - (2 * totalBleedPts) 
           });
        doc.moveDown(1);
        doc.fontSize(24).fillColor('#CCCCCC').font(ROBOTO_REGULAR_PATH)
           .text('Inkwell AI', { 
               align: 'center', 
               width: frontCoverAreaWidth - (2 * totalBleedPts), 
               x: frontCoverAreaX + totalBleedPts 
           });
    }

    const backCoverAreaX = 0;
    const backCoverAreaWidth = backCoverWidthPts;
    const inkwellUrl = 'Inkwell.net.au';

    if (book.back_cover_blurb) {
        const blurbMargin = 50;
        const blurbWidth = backCoverAreaWidth - (2 * blurbMargin);
        
        doc.fontSize(12).fillColor('#CCCCCC').font(ROBOTO_REGULAR_PATH)
           .text(book.back_cover_blurb, backCoverAreaX + blurbMargin, heightPoints * 0.25, {
               width: blurbWidth,
               align: 'justify'
           });
    }

    doc.fontSize(10).fillColor('#888888').font(ROBOTO_REGULAR_PATH)
       .text(inkwellUrl, backCoverAreaX, heightPoints - 30, {
           width: backCoverAreaWidth,
           align: 'center'
       });

    const spineText = book.title.toUpperCase();
    const spineTextX = backCoverWidthPts + spineWidthPts / 2;
    const spineTextY = heightPoints / 2;
    
    doc.save();
    doc.rotate(-90, { origin: [spineTextX, spineTextY] });
    doc.fontSize(12).fillColor('#FFFFFF').font(ROBOTO_BOLD_PATH)
       .text(spineText, spineTextX - (spineWidthPts / 2), spineTextY + (heightPoints / 2.5), { 
           width: heightPoints, 
           align: 'center' 
       });
    doc.restore();

    const tempPdfsDir = path.resolve(process.cwd(), 'tmp', 'pdfs');
    await fs.promises.mkdir(tempPdfsDir, { recursive: true });
    const tempFilePath = path.join(tempPdfsDir, `cover_textbook_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.pdf`);
    
    doc.end();
    const pdfBuffer = await streamToBuffer(doc);
    await fs.promises.writeFile(tempFilePath, pdfBuffer);
    
    return { path: tempFilePath };
};

export const generateAndSaveTextBookPdf = async (book, productConfig, isPreview = false) => {
    try {
        const dims = getProductDimensions(productConfig.id);
        const doc = new PDFDocument({
            size: [dims.pageWidth, dims.pageHeight],
            layout: dims.layout,
            margins: dims.margins
        });

        const tempPdfsDir = path.resolve(process.cwd(), 'tmp', 'pdfs');
        await fs.promises.mkdir(tempPdfsDir, { recursive: true });
        const tempFilePath = path.join(tempPdfsDir, `interior_textbook_${Date.now()}.pdf`);

        const streamToBuffer = (docStream) => {
            return new Promise((resolve, reject) => {
                const buffers = [];
                docStream.on('data', (chunk) => buffers.push(chunk));
                docStream.on('end', () => resolve(Buffer.concat(buffers)));
                docStream.on('error', (err) => reject(err));
            });
        };
        
        // PDF Generation Logic
        doc.fontSize(28).font(ROBOTO_BOLD_PATH).text(book.title, { align: 'center' });
        doc.moveDown(4);
        doc.fontSize(16).font(ROBOTO_REGULAR_PATH).text('A Story by Inkwell AI', { align: 'center' });
        for (const [index, chapter] of book.chapters.entries()) {
            doc.addPage();
            doc.fontSize(18).font(ROBOTO_BOLD_PATH).text(`Chapter ${index + 1}`, { align: 'center' });
            doc.moveDown(2);
            doc.fontSize(12).font(ROBOTO_REGULAR_PATH).text(chapter.content, { align: 'justify' });
        }
        doc.end();
        // End of Generation Logic

        const pdfBuffer = await streamToBuffer(doc);
        await fs.promises.writeFile(tempFilePath, pdfBuffer);

        // Page Count & Watermark Logic
        const pdfDoc = await PDFLibDocument.load(pdfBuffer);
        let finalPageCount = pdfDoc.getPageCount();
        const minPages = productConfig.minPageCount || 32;
        if (finalPageCount < minPages) {
            const pagesToAdd = minPages - finalPageCount;
            const pageSize = pdfDoc.getPages()[0]?.getSize();
            for (let i = 0; i < pagesToAdd; i++) {
                pdfDoc.addPage([pageSize.width, pageSize.height]);
            }
        }
        finalPageCount = pdfDoc.getPageCount();
        if (finalPageCount % 2 !== 0) {
            const pageSize = pdfDoc.getPages()[0]?.getSize();
            pdfDoc.addPage([pageSize.width, pageSize.height]);
        }
        finalPageCount = pdfDoc.getPageCount();

        if (isPreview) {
            const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const pages = pdfDoc.getPages();
            for (const page of pages) {
                const { width, height } = page.getSize();
                page.drawText('PREVIEW', {
                    x: width / 2 - 150,
                    y: height / 2 - 50,
                    font,
                size: 80,
                color: rgb(0.2, 0.8, 0.9),
                opacity: 0.25,
                rotate: degrees(-45),
                    // --- FIX: Use the degrees() function for rotation ---
                });
            }
        }
        // End of Page Count & Watermark Logic

        const finalPdfBytes = await pdfDoc.save();
        await fs.promises.writeFile(tempFilePath, finalPdfBytes);
        
        return { path: tempFilePath, pageCount: finalPageCount };

    } catch (error) {
        console.error("Error during textbook PDF generation:", error);
        throw error;
    }
};
export const finalizePdfPageCount = async (filePath, productConfig, currentContentPageCount) => {
    let finalPageCount = currentContentPageCount;
    try {
        const existingPdfBytes = await fs.promises.readFile(filePath);
        const pdfDoc = await PDFLibDocument.load(existingPdfBytes);
        let contentPageWidth, contentPageHeight;
        const firstContentPage = pdfDoc.getPages()[0]; 

        if (firstContentPage) {
            const size = firstContentPage.getSize();
            contentPageWidth = size.width;
            contentPageHeight = size.height;
        } else {
            const { pageWidth, pageHeight } = getProductDimensions(productConfig.id);
            contentPageWidth = pageWidth;
            contentPageHeight = pageHeight;
        }

        if (isNaN(contentPageWidth) || isNaN(contentPageHeight) || contentPageWidth <= 0 || contentPageHeight <= 0) {
            const { pageWidth, pageHeight } = getProductDimensions(productConfig.id);
            contentPageWidth = pageWidth;
            contentPageHeight = pageHeight;
        }
        
        const consistentPageSizeArray = [contentPageWidth, contentPageHeight];

        if (finalPageCount === null || finalPageCount === 0) {
            finalPageCount = productConfig.defaultPageCount;
        }
        
        const pagesToAddForMin = Math.max(0, productConfig.minPageCount - finalPageCount);
        if (pagesToAddForMin > 0) {
            for (let i = 0; i < pagesToAddForMin; i++) {
                pdfDoc.addPage(consistentPageSizeArray);
            }
            finalPageCount = pdfDoc.getPageCount();
        }

        if (finalPageCount % 2 !== 0) {
            pdfDoc.addPage(consistentPageSizeArray);
            finalPageCount = pdfDoc.getPageCount();
        }

        const finalPdfBytes = await pdfDoc.save();
        await fs.promises.writeFile(filePath, finalPdfBytes);
        
        return finalPageCount;
    } catch (error) {
        console.error(`[PDF Service: Finalize] Failed to finalize PDF for ${filePath}:`, error);
        return null;
    }
};
export const generateAndSavePictureBookPdf = async (book, productConfig, isPreview = false) => {
    try {
        const dims = getProductDimensions(productConfig.id);
        const authorName = book.story_bible?.author || 'An Inkwell Author';

        const doc = new PDFDocument({
            size: [dims.pageWidth, dims.pageHeight],
            layout: dims.layout,
            margins: { top: 0, left: 0, right: 0, bottom: 0 },
            autoFirstPage: false
        });

        const tempDir = path.resolve(os.tmpdir(), 'inkwell-ai');
        await fs.promises.mkdir(tempDir, { recursive: true });
        const tempFilePath = path.join(tempDir, `picturebook-print-${Date.now()}.pdf`);
        
        const pdfBuffer = await new Promise(async (resolve, reject) => {
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            doc.addPage(); // Page 1: Blank Page

            // Page 2: Title Page
            doc.addPage();
            doc.font(ROBOTO_BOLD_PATH).fontSize(32).fillColor('black')
               .text(book.title, { align: 'center', width: dims.pageWidth, y: dims.pageHeight / 3 });
            doc.moveDown(1);
            doc.font(ROBOTO_REGULAR_PATH).fontSize(18).fillColor('black')
               .text(`By ${authorName}`, { align: 'center', width: dims.pageWidth });
            doc.font(ROBOTO_REGULAR_PATH).fontSize(10).fillColor('grey')
               .text('Made with inkwell.net.au', { align: 'center', width: dims.pageWidth, y: dims.pageHeight - 50 });
            
 // Pages 3-22: Story Content
            if (book.timeline && book.timeline.length > 0) {
                for (const event of book.timeline) {
                    doc.addPage();
                    const imageUrl = event.image_url_print || event.uploaded_image_url || event.image_url;

                    // --- ADD THIS LOG ---
                    console.log(`[DEBUG] Processing page ${event.page_number}. Image URL: ${imageUrl}`);

                    if (imageUrl) {
                        try {
                            // --- ADD THIS LOG ---
                            console.log('[DEBUG] Image URL found. Attempting to fetch buffer...');

                            const imageBuffer = await getImageBuffer(imageUrl);

                            // --- ADD THIS LOG ---
                            console.log('[DEBUG] Successfully fetched image buffer. Size:', imageBuffer.length, 'bytes');
                            
                            const image = doc.openImage(imageBuffer);
                            const pageAspect = dims.pageWidth / dims.pageHeight;
                            const imageAspect = image.width / image.height;
                            
                            let newWidth, newHeight, x, y;
                            if (pageAspect > imageAspect) {
                                newWidth = dims.pageWidth;
                                newHeight = dims.pageWidth / imageAspect;
                                x = 0;
                                y = (dims.pageHeight - newHeight) / 2;
                            } else {
                                newHeight = dims.pageHeight;
                                newWidth = dims.pageHeight * imageAspect;
                                y = 0;
                                x = (dims.pageWidth - newWidth) / 2;
                            }
                            doc.image(imageBuffer, x, y, { width: newWidth, height: newHeight });
                        } catch (error) {
                            // --- MODIFY THIS LOG ---
                            console.error("[PDF Service] Failed to embed image:", error.message);
                            console.error("[DEBUG] Full error object:", error); // Get more details
                        }
                    }

                    if (event.story_text) {
                        const boxWidth = dims.pageWidth * 0.8;
                        const boxHeight = dims.pageHeight * 0.25;
                        const boxX = (dims.pageWidth - boxWidth) / 2;
                        const boxY = dims.pageHeight - boxHeight - (dims.pageHeight * 0.05);

                        doc.save();
                        doc.rect(boxX, boxY, boxWidth, boxHeight).fillOpacity(0.7).fill('#FFFFFF');
                        doc.restore();

                        doc.fillColor('#000000')
                           .font(event.is_bold_story_text ? ROBOTO_BOLD_PATH : ROBOTO_REGULAR_PATH)
                           .fontSize(14)
                           .text(event.story_text, boxX + 20, boxY + 20, {
                               width: boxWidth - 40,
                               align: 'center'
                           });
                    }
                }
            }

            // Page 23: 'The End' Page
            doc.addPage();
            doc.font(ROBOTO_BOLD_PATH).fontSize(18).fillColor('black')
               .text(book.title, { align: 'center', width: dims.pageWidth, y: dims.pageHeight / 4 });
            doc.font(ROBOTO_BOLD_PATH).fontSize(48).fillColor('black')
               .text('The End', { align: 'center', width: dims.pageWidth, y: dims.pageHeight / 2 - 50 });
            doc.font(ROBOTO_REGULAR_PATH).fontSize(14).fillColor('black')
               .text(authorName, { align: 'center', width: dims.pageWidth, y: dims.pageHeight / 2 + 20 });
            doc.font(ROBOTO_REGULAR_PATH).fontSize(10).fillColor('grey')
               .text('inkwell.net.au', { align: 'center', width: dims.pageWidth, y: dims.pageHeight - 50 });

            // Page 24: Branded Blank Page
            doc.addPage();
            doc.font(ROBOTO_REGULAR_PATH).fontSize(10).fillColor('grey')
               .text('inkwell.net.au', { align: 'center', width: dims.pageWidth, y: dims.pageHeight - 50 });
            
            doc.end();
        });

        await fs.promises.writeFile(tempFilePath, pdfBuffer);

        if (isPreview) {
            await addWatermarkToPdf(tempFilePath);
        }

        console.log(`[PDF Service] Final compliant page count: 24`);
        return { path: tempFilePath, pageCount: 24 };

    } catch (error) {
        console.error("[PDF Service] Document generation error:", error.stack);
        throw error;
    }
};