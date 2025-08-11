import PDFDocument from 'pdfkit';
import { PDFDocument as PDFLibDocument } from 'pdf-lib';
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

// --- Unchanged Functions (Kept for completeness) ---

export const calculatePictureBookPageCount = (events, productConfig) => {
    let pageCount = 1 + 1 + events.length + 2;
    const pagesToAddForMin = Math.max(0, productConfig.minPageCount - pageCount);
    if (pagesToAddForMin > 0) pageCount += pagesToAddForMin;
    if (pageCount % 2 !== 0) pageCount += 1;
    console.log(`[PDF Service] Calculated page count: ${pageCount} for ${events.length} events.`);
    return pageCount;
};

// **THE FIX IS HERE**
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

    // Using the correct variable name: book.user_cover_image_url
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
        // This is the fallback default cover
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

export const generateAndSaveTextBookPdf = async (book, productConfig) => {
    const dims = getProductDimensions(productConfig.id);
    const isBlackAndWhite = productConfig.luluSku.includes('BW');
    const fillColor = isBlackAndWhite ? 'black' : 'black';

    const doc = new PDFDocument({
        size: [dims.pageWidth, dims.pageHeight],
        layout: dims.layout,
        margins: dims.margins
    });

    doc.fontSize(28).font(ROBOTO_BOLD_PATH).fillColor(fillColor)
       .text(book.title, { align: 'center' });
    doc.moveDown(4);
    doc.fontSize(16).font(ROBOTO_REGULAR_PATH).fillColor(fillColor)
       .text('A Story by Inkwell AI', { align: 'center' });

    for (const [index, chapter] of book.chapters.entries()) {
        doc.addPage();
        doc.fontSize(18).font(ROBOTO_BOLD_PATH).fillColor(fillColor)
           .text(`Chapter ${index + 1}`, { align: 'center' });
        doc.moveDown(2);
        doc.fontSize(12).font(ROBOTO_REGULAR_PATH).fillColor(fillColor)
           .text(chapter.content, { align: 'justify' });
    }

    const tempPdfsDir = path.resolve(process.cwd(), 'tmp', 'pdfs');
    await fs.promises.mkdir(tempPdfsDir, { recursive: true });
    const tempFilePath = path.join(tempPdfsDir, `interior_textbook_content_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.pdf`);

    doc.end();
    const pdfBuffer = await streamToBuffer(doc);
    await fs.promises.writeFile(tempFilePath, pdfBuffer);

    const existingPdfBytes = await fs.promises.readFile(tempFilePath);
    const pdfDoc = await PDFLibDocument.load(existingPdfBytes);
    
    let actualContentPageCount = pdfDoc.getPageCount();
    console.log(`[PDF Service] TRUE page count after content: ${actualContentPageCount}`);

    const minPages = productConfig.minPageCount || 32;
    if (actualContentPageCount < minPages) {
        const pagesToAdd = minPages - actualContentPageCount;
        console.log(`[PDF Service] Below minimum. Adding ${pagesToAdd} blank pages.`);
        const consistentPageSize = pdfDoc.getPages()[0]?.getSize() || { width: dims.pageWidth, height: dims.pageHeight };
        for (let i = 0; i < pagesToAdd; i++) {
            pdfDoc.addPage([consistentPageSize.width, consistentPageSize.height]);
        }
    }

    let finalPageCount = pdfDoc.getPageCount();
    if (finalPageCount % 2 !== 0) {
        console.log(`[PDF Service] Page count is odd. Adding one more blank page.`);
        const consistentPageSize = pdfDoc.getPages()[0]?.getSize() || { width: dims.pageWidth, height: dims.pageHeight };
        pdfDoc.addPage([consistentPageSize.width, consistentPageSize.height]);
    }

    finalPageCount = pdfDoc.getPageCount();
    console.log(`[PDF Service] Final compliant page count: ${finalPageCount}`);

    const finalPdfBytes = await pdfDoc.save();
    await fs.promises.writeFile(tempFilePath, finalPdfBytes);
    
    return { path: tempFilePath, pageCount: finalPageCount };
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

export const generateAndSavePictureBookPdf = async (book, productConfig) => {
    return new Promise(async (resolve, reject) => {
        try {
            const dims = getProductDimensions(productConfig.id);

            const doc = new PDFDocument({
                size: [dims.pageWidth, dims.pageHeight],
                layout: dims.layout,
                margins: { top: 0, left: 0, right: 0, bottom: 0 },
                autoFirstPage: false
            });

            const tempDir = path.resolve(os.tmpdir(), 'inkwell-ai');
            await fs.promises.mkdir(tempDir, { recursive: true });
            const tempFilePath = path.join(tempDir, `picturebook-print-${Date.now()}.pdf`);
            const writeStream = fs.createWriteStream(tempFilePath);
            doc.pipe(writeStream);

            doc.addPage();
            doc.font(ROBOTO_BOLD_PATH).fontSize(28).fillColor('black')
               .text(book.title, 0, dims.pageHeight / 2 - 50, { align: 'center', width: dims.pageWidth });

            doc.addPage();
            doc.font(ROBOTO_REGULAR_PATH).fontSize(8).fillColor('grey')
               .text(`Copyright © ${new Date().getFullYear()}. All Rights Reserved.`, 0, dims.pageHeight - 50, { align: 'center', width: dims.pageWidth });
            
            if (book.timeline && book.timeline.length > 0) {
                for (const event of book.timeline) {
                    doc.addPage();
                    const imageUrl = event.image_url_print || event.uploaded_image_url;

                    if (imageUrl) {
                        try {
                            const imageBuffer = await getImageBuffer(imageUrl);
                            
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
                            console.error("[PDF Service] Failed to embed image:", error.message);
                            doc.rect(0, 0, dims.pageWidth, dims.pageHeight).fill('red');
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

            let currentPages = doc.bufferedPageRange().count;
            console.log(`[PDF Service] TRUE page count after content: ${currentPages}`);

            const minPages = productConfig.minPageCount || 24;
            let finalPageCount = currentPages;

            if (finalPageCount < minPages) {
                finalPageCount = minPages;
            }

            if (finalPageCount % 2 !== 0) {
                finalPageCount++;
            }

            const blankPagesToAdd = finalPageCount - currentPages;
            if (blankPagesToAdd > 0) {
                console.log(`[PDF Service] Adding ${blankPagesToAdd} blank pages.`);
                for (let i = 0; i < blankPagesToAdd; i++) {
                    doc.addPage();
                }
            }
            console.log(`[PDF Service] Final compliant page count: ${finalPageCount}`);
            
            doc.end();

            writeStream.on('finish', () => {
                resolve({ path: tempFilePath, pageCount: finalPageCount });
            });

            writeStream.on('error', (err) => {
                console.error("[PDF Service] Write stream error:", err);
                reject(err);
            });

        } catch (error) {
            console.error("[PDF Service] Document generation error:", error.stack);
            reject(error);
        }
    });
};