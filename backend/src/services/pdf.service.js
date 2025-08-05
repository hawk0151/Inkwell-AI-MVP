// backend/src/services/pdf.service.js

import PDFDocument from 'pdfkit';
import { PDFDocument as PDFLibDocument } from 'pdf-lib';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { findProductConfiguration } from './lulu.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mmToPoints = (mm) => mm * (72 / 25.4);

const ROBOTO_REGULAR_PATH = path.join(__dirname, '../fonts/Roboto-Regular.ttf');
const ROBOTO_BOLD_PATH = path.join(__dirname, '../fonts/Roboto-Bold.ttf');

const getProductDimensions = (luluConfigId) => {
    const productConfig = findProductConfiguration(luluConfigId);
    if (!productConfig) {
        throw new Error(`Product configuration with ID ${luluConfigId} not found.`);
    }

    let pageWidthMm, pageHeightMm, layout;

    switch (productConfig.trimSize) {
        case '5.25x8.25':
            pageWidthMm = 133.35; pageHeightMm = 209.55; layout = 'portrait'; break;
        case '8.52x11.94':
            pageWidthMm = 216.41; pageHeightMm = 303.28; layout = 'portrait'; break;
        case '6.39x9.46':
            pageWidthMm = 162.31; pageHeightMm = 240.28; layout = 'portrait'; break;
        case '11.94x8.52':
             pageWidthMm = 303.28; pageHeightMm = 216.41; layout = 'landscape'; break;
        default:
            console.error(`[PDF Service] Unknown trim size ${productConfig.trimSize}. Falling back to A4 portrait.`);
            pageWidthMm = 210; pageHeightMm = 297; layout = 'portrait';
    }

    const pageWidthWithBleedPoints = mmToPoints(pageWidthMm);
    const pageHeightWithBleedPoints = mmToPoints(pageHeightMm);
    const bleedPoints = mmToPoints(productConfig.bleedMm);
    const safeMarginPoints = mmToPoints(productConfig.safeMarginMm);
    const contentX = bleedPoints + safeMarginPoints;
    const contentY = bleedPoints + safeMarginPoints;
    const contentWidth = pageWidthWithBleedPoints - (2 * contentX);
    const contentHeight = pageHeightWithBleedPoints - (2 * contentY);
    
    console.log(`[PDF Service: Dimensions for ${productConfig.id}] Layout: ${layout}, Size(pts): W=${pageWidthWithBleedPoints.toFixed(2)}, H=${pageHeightWithBleedPoints.toFixed(2)}`);

    return {
        pageWidthWithBleed: pageWidthWithBleedPoints,
        pageHeightWithBleed: pageHeightWithBleedPoints,
        bleedPoints: bleedPoints,
        safeMarginPoints: safeMarginPoints,
        contentX: contentX,
        contentY: contentY,
        contentWidth: contentWidth,
        contentHeight: contentHeight, // This was already correct
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
    console.log(`[PDF Service: Cover] Starting cover generation for SKU: ${productConfig.luluSku}`);
    let widthMm = coverDimensions.width;
    let heightMm = coverDimensions.height;
    let widthPoints = mmToPoints(widthMm);
    let heightPoints = mmToPoints(heightMm);
    
    if (heightPoints > widthPoints) {
        [widthPoints, heightPoints] = [heightPoints, widthPoints];
    }

    const doc = new PDFDocument({
        size: [widthPoints, heightPoints],
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });
    
    const totalSafeOffsetPoints = mmToPoints(productConfig.bleedMm + productConfig.safeMarginMm);
    const safeZoneX = totalSafeOffsetPoints;
    const safeZoneY = totalSafeOffsetPoints;
    const safeZoneWidth = widthPoints - (2 * totalSafeOffsetPoints);
    const safeZoneHeight = heightPoints - (2 * totalSafeOffsetPoints);

    if (book.cover_image_url) {
        try {
            const imageBuffer = await getImageBuffer(book.cover_image_url);
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
    await fs.mkdir(tempPdfsDir, { recursive: true });
    const tempFilePath = path.join(tempPdfsDir, `cover_${Date.now()}_${book.id}.pdf`);
    
    doc.end();
    const pdfBuffer = await streamToBuffer(doc);
    await fs.writeFile(tempFilePath, pdfBuffer);
    
    return tempFilePath;
};

export const generateAndSaveTextBookPdf = async (book, productConfig) => {
    const { pageWidthWithBleed, pageHeightWithBleed, contentX, contentY, contentWidth, layout } = getProductDimensions(productConfig.id);
    
    const doc = new PDFDocument({
        autoFirstPage: false,
        size: [pageWidthWithBleed, pageHeightWithBleed],
        layout: layout,
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });
    
    const tempPdfsDir = path.resolve(process.cwd(), 'tmp', 'pdfs');
    await fs.mkdir(tempPdfsDir, { recursive: true });
    const tempFilePath = path.join(tempPdfsDir, `interior_textbook_content_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.pdf`);

    doc.addPage();
    doc.fontSize(28).font(ROBOTO_BOLD_PATH).text(book.title, contentX, contentY, { align: 'center', width: contentWidth }); 
    doc.moveDown(4);
    doc.fontSize(16).font(ROBOTO_REGULAR_PATH).text('A Story by Inkwell AI', contentX, doc.y, { align: 'center', width: contentWidth }); 

    for (const [index, chapter] of book.chapters.entries()) {
        if (index > 0) { doc.addPage(); }
        doc.fontSize(18).font(ROBOTO_BOLD_PATH).text(`Chapter ${chapter.chapter_number}`, contentX, contentY, { align: 'center', width: contentWidth }); 
        doc.moveDown(2);
        doc.fontSize(12).font(ROBOTO_REGULAR_PATH).text(chapter.content, contentX, doc.y, { align: 'justify', width: contentWidth }); 
    }
    
    doc.end();
    const pdfBuffer = await streamToBuffer(doc);
    await fs.writeFile(tempFilePath, pdfBuffer);

    let trueContentPageCount = null;
    try {
        const existingPdfBytes = await fs.readFile(tempFilePath);
        const pdfDoc = await PDFLibDocument.load(existingPdfBytes);
        trueContentPageCount = pdfDoc.getPageCount();
    } catch (error) {
        console.error(`[PDF Service] Failed to get true page count for ${tempFilePath}:`, error);
        trueContentPageCount = null; 
    }
    return { path: tempFilePath, pageCount: trueContentPageCount };
};

function truncateText(doc, text, maxWidth, maxHeight, fontPath, fontSize) {
    doc.font(fontPath).fontSize(fontSize);
    let currentText = text;
    while (currentText.length > 0 && doc.heightOfString(currentText, { width: maxWidth }) > maxHeight) {
        currentText = currentText.split(' ').slice(0, -1).join(' ');
        if (currentText.length > 0) {
            currentText = currentText.trim();
            if (!currentText.endsWith('...')) {
                currentText += '...';
            }
        }
    }
    return currentText;
}

export const generateAndSavePictureBookPdf = async (book, events, productConfig) => {
    // THIS IS THE LINE WITH THE FIX. `contentHeight` is now included.
    const { pageWidthWithBleed, pageHeightWithBleed, contentX, contentY, contentWidth, contentHeight, layout } = getProductDimensions(productConfig.id);

    const doc = new PDFDocument({
        size: [pageWidthWithBleed, pageHeightWithBleed],
        layout: layout,
        autoFirstPage: false,
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });

    const tempPdfsDir = path.resolve(process.cwd(), 'tmp', 'pdfs');
    await fs.mkdir(tempPdfsDir, { recursive: true });
    const tempFilePath = path.join(tempPdfsDir, `interior_picturebook_content_${Date.now()}_${book.id}.pdf`);

    doc.addPage(); // Page 1: Title
    doc.rect(0, 0, pageWidthWithBleed, pageHeightWithBleed).fill('#FFFFFF');
    doc.font(ROBOTO_BOLD_PATH).fontSize(28).fillColor('black').text(book.title, contentX, contentY + (contentHeight / 3), { width: contentWidth, align: 'center' });
    doc.moveDown(1);
    doc.font(ROBOTO_REGULAR_PATH).fontSize(16).fillColor('black').text('by Inkwell AI', { width: contentWidth, align: 'center' });

    doc.addPage(); // Page 2: Blank

    for (const event of events) {
        doc.addPage();
        const imageUrl = event.uploaded_image_url || event.image_url;
        const storyText = event.story_text || '';
        const isBoldStoryText = event.is_bold_story_text || false;

        doc.rect(0, 0, pageWidthWithBleed, pageHeightWithBleed).fill('#FFFFFF');

        if (imageUrl) {
            try {
                const imageBuffer = await getImageBuffer(imageUrl);
                doc.image(imageBuffer, 0, 0, { width: pageWidthWithBleed, height: pageHeightWithBleed, fit: [pageWidthWithBleed, pageHeightWithBleed], valign: 'center', align: 'center' });
            } catch (imgErr) {
                console.error(`[PDF Service] Failed to load event image from ${imageUrl}:`, imgErr);
                doc.rect(0, 0, pageWidthWithBleed, pageHeightWithBleed).fill('#CCCCCC');
                doc.fontSize(24).fillColor('#333333').font(ROBOTO_BOLD_PATH).text('Image Not Available', contentX, contentY + contentHeight / 2 - 20, { align: 'center', width: contentWidth });
            }
        }
        
        if (storyText) {
            const storyTextFont = isBoldStoryText ? ROBOTO_BOLD_PATH : ROBOTO_REGULAR_PATH;
            const storyTextFontSize = 14;
            const storyBoxHeight = 100;
            const storyBoxWidth = contentWidth; 
            const storyBoxX = contentX;
            const storyBoxY = pageHeightWithBleed - contentY - storyBoxHeight;

            doc.save();
            doc.rect(storyBoxX, storyBoxY, storyBoxWidth, storyBoxHeight).fillOpacity(0.7).fill('white');
            doc.restore();

            const truncatedText = truncateText(doc, storyText, storyBoxWidth - 20, storyBoxHeight - 20, storyTextFont, storyTextFontSize);

            doc.font(storyTextFont).fontSize(storyTextFontSize).fillColor('#000000')
               .text(truncatedText, storyBoxX + 10, storyBoxY + 10, { width: storyBoxWidth - 20, height: storyBoxHeight - 20, align: 'center', valign: 'center' });
        }
    }

    doc.addPage(); // Page 23: Blank
    doc.addPage(); // Page 24: Blank

    doc.end();
    const pdfBuffer = await streamToBuffer(doc);
    await fs.writeFile(tempFilePath, pdfBuffer);

    let trueContentPageCount = null;
    try {
        const existingPdfBytes = await fs.readFile(tempFilePath);
        const pdfDoc = await PDFLibDocument.load(existingPdfBytes);
        trueContentPageCount = pdfDoc.getPageCount();
    } catch (error) {
        console.error(`[PDF Service] Failed to get page count for ${tempFilePath}:`, error);
        trueContentPageCount = null;
    }
    return { path: tempFilePath, pageCount: trueContentPageCount };
};

export const finalizePdfPageCount = async (filePath, productConfig, currentContentPageCount) => {
    let finalPageCount = currentContentPageCount;

    try {
        const existingPdfBytes = await fs.readFile(filePath);
        const pdfDoc = await PDFLibDocument.load(existingPdfBytes);
        let contentPageWidth, contentPageHeight;
        const firstContentPage = pdfDoc.getPages()[0]; 

        if (firstContentPage) {
            const size = firstContentPage.getSize();
            contentPageWidth = size.width;
            contentPageHeight = size.height;
        } else {
            const { pageWidthWithBleed, pageHeightWithBleed } = getProductDimensions(productConfig.id);
            contentPageWidth = pageWidthWithBleed;
            contentPageHeight = pageHeightWithBleed;
        }

        if (isNaN(contentPageWidth) || isNaN(contentPageHeight) || contentPageWidth <= 0 || contentPageHeight <= 0) {
            contentPageWidth = mmToPoints(210 + (2 * productConfig.bleedMm));
            contentPageHeight = mmToPoints(297 + (2 * productConfig.bleedMm));
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
        await fs.writeFile(filePath, finalPdfBytes);
        
        return finalPageCount;

    } catch (error) {
        console.error(`[PDF Service: Finalize] Failed to finalize PDF for ${filePath}:`, error);
        return null;
    }
};