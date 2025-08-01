// backend/src/services/pdf.service.js

import PDFDocument from 'pdfkit';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname } from 'path';

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

import { LULU_PRODUCT_CONFIGURATIONS, getCoverDimensionsFromApi } from './lulu.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const workerPath = path.resolve(__dirname, '../../node_modules/pdfjs-dist/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
console.log("PDF.js Worker Source (as URL):", pdfjsLib.GlobalWorkerOptions.workerSrc);

const mmToPoints = (mm) => mm * (72 / 25.4);

const getProductDimensions = (luluConfigId) => {
    const productConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === luluConfigId);
    if (!productConfig) {
        throw new Error(`Product configuration with ID ${luluConfigId} not found in LULU_PRODUCT_CONFIGURATIONS.`);
    }

    let widthMm, heightMm, layout;

    switch (productConfig.trimSize) {
        case '5.5x8.5': // Novella
            // FIXED: Dimensions updated to match the 5.25 x 8.25 inch product SKU.
            widthMm = 133.35; // This is 5.25 inches
            heightMm = 209.55; // This is 8.25 inches
            layout = 'portrait';
            break;
        case '8.27x11.69':
            widthMm = 209.55;
            heightMm = 296.9;
            layout = 'portrait';
            break;
        case '6.14x9.21':
            widthMm = 156;
            heightMm = 234;
            layout = 'portrait';
            break;
        default:
            throw new Error(`Unknown trim size ${productConfig.trimSize} for interior PDF dimensions.`);
    }

    const widthPoints = mmToPoints(widthMm);
    const heightPoints = mmToPoints(heightMm);

    console.log(`DEBUG: Product config ${luluConfigId} interior dimensions in MM: ${widthMm}x${heightMm}. In Points: ${widthPoints.toFixed(2)}x${heightPoints.toFixed(2)}. Layout: ${layout}.`);

    return {
        width: widthPoints,
        height: heightPoints,
        layout: layout
    };
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
        const pageCount = pdfDocument.numPages;
        console.log(`Successfully extracted ${pageCount} pages from ${pdfFilePath}`);
        return pageCount;
    } catch (error) {
        console.error(`Error reading PDF page count from ${pdfFilePath}:`, error);
        throw new Error(`Failed to get PDF page count from ${pdfFilePath}.`);
    }
}

export const generateCoverPdf = async (bookTitle, authorName, luluProductId, pageCount) => {
    return new Promise(async (resolve, reject) => {
        try {
            const coverDimensions = await getCoverDimensionsFromApi(luluProductId, pageCount, 'mm');
            const { width: coverWidthMm, height: coverHeightMm, layout: coverLayout } = coverDimensions;

            const docWidthPoints = mmToPoints(coverWidthMm);
            const docHeightPoints = mmToPoints(coverHeightMm);

            console.log(`DEBUG: Cover PDF for ${luluProductId} (Pages: ${pageCount}) will be generated.`);
            console.log(`DEBUG: Lulu API MM: ${coverWidthMm.toFixed(2)}x${coverHeightMm.toFixed(2)}. Final PDFKit size in Points: ${docWidthPoints.toFixed(2)}x${docHeightPoints.toFixed(2)}. PDFKit Layout: '${coverLayout}'.`);

            if (docWidthPoints <= 0 || docHeightPoints <= 0 || docWidthPoints > 10000 || docHeightPoints > 10000) {
                const errorMessage = `Invalid or extreme cover dimensions for PDFKit: Width: ${docWidthPoints.toFixed(2)}pt, Height: ${docHeightPoints.toFixed(2)}pt. Aborting PDF generation.`;
                console.error(`❌ ${errorMessage}`);
                return reject(new Error(errorMessage));
            }

            const doc = new PDFDocument({
                size: [docWidthPoints, docHeightPoints],
                layout: coverLayout,
                autoFirstPage: false,
                margins: { top: 0, bottom: 0, left: 0, right: 0 }
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            doc.addPage();
            doc.rect(0, 0, doc.page.width, doc.page.height).fill('#313131');

            const safetyMarginInches = 0.25;
            const safetyMarginPoints = safetyMarginInches * 72;

            const contentAreaX = safetyMarginPoints;
            const contentAreaY = safetyMarginPoints;
            const contentAreaWidth = doc.page.width - (2 * safetyMarginPoints);
            const contentAreaHeight = doc.page.height - (2 * safetyMarginPoints);

            doc.fontSize(48)
                .fillColor('#FFFFFF')
                .font('Helvetica-Bold')
                .text(bookTitle, contentAreaX, contentAreaY + contentAreaHeight / 4, {
                    align: 'center',
                    width: contentAreaWidth
                });
            doc.moveDown(1);
            doc.fontSize(24)
                .fillColor('#CCCCCC')
                .font('Helvetica')
                .text(authorName || 'Inkwell AI', {
                    align: 'center',
                    width: contentAreaWidth,
                    x: contentAreaX,
                    y: doc.y
                });

            doc.end();
        } catch (error) {
            console.error("Error generating cover PDF:", error);
            reject(error);
        }
    });
};

export const generateAndSaveTextBookPdf = async (title, chapters, luluConfigId, tempDir, addFinalBlankPage = false) => {
    return new Promise(async (resolve, reject) => {
        try {
            const { width, height, layout } = getProductDimensions(luluConfigId);

            const doc = new PDFDocument({
                size: [width, height],
                layout: layout,
                margins: { top: 72, bottom: 72, left: 72, right: 72 }
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));

            doc.addPage();
            doc.fontSize(28).font('Times-Roman').text(title, { align: 'center' });
            doc.moveDown(4);
            doc.fontSize(16).text('A Story by Inkwell AI', { align: 'center' });

            for (const chapter of chapters) {
                doc.addPage();
                doc.fontSize(18).font('Times-Bold').text(`Chapter ${chapter.chapter_number}`, { align: 'center' });
                doc.moveDown(2);
                doc.fontSize(12).font('Times-Roman').text(chapter.content, { align: 'justify' });
            }
            
            if (addFinalBlankPage) {
                console.log("DEBUG: Adding a final blank page to make page count even.");
                doc.addPage();
            }

            doc.end();

            const pdfBuffer = await new Promise((resBuff, rejBuff) => {
                doc.on('end', () => resBuff(Buffer.concat(buffers)));
                doc.on('error', rejBuff);
            });

            const fileName = `interior_textbook_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.pdf`;
            const tempFilePath = path.join(tempDir, fileName);

            await fs.mkdir(tempDir, { recursive: true });
            await fs.writeFile(tempFilePath, pdfBuffer);
            console.log(`Interior Text Book PDF saved temporarily at: ${tempFilePath}`);

            resolve(tempFilePath);
        } catch (error) {
            console.error("Error generating and saving text book PDF:", error);
            reject(error);
        }
    });
};


export const generateAndSavePictureBookPdf = async (book, events, luluConfigId, tempDir) => {
    return new Promise(async (resolve, reject) => {
        try {
            const { width, height, layout } = getProductDimensions(luluConfigId);

            const doc = new PDFDocument({
                size: [width, height],
                layout: layout,
                autoFirstPage: false,
                margins: { top: 36, bottom: 36, left: 36, right: 36 }
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));

            doc.addPage();
            if (book.cover_image_url) {
                try {
                    const coverImageBuffer = await getImageBuffer(book.cover_image_url);
                    doc.image(coverImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });
                } catch (imgErr) {
                    console.error(`Failed to load cover image for interior from ${book.cover_image_url}`, imgErr);
                    doc.fontSize(40).font('Helvetica-Bold').text(book.title, { align: 'center' });
                }
            } else {
                doc.fontSize(40).font('Helvetica-Bold').text(book.title, { align: 'center' });
                doc.moveDown(2);
                doc.fontSize(18).font('Helvetica').text('A Personalized Story from Inkwell AI', { align: 'center' });
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
                    doc.fontSize(24).font('Helvetica-Bold').text(
                        event.overlay_text,
                        doc.page.margins.left,
                        doc.page.height - doc.page.margins.bottom - 100,
                        { align: 'center', width: doc.page.width - doc.page.margins.left * 2 }
                    );
                }
            }
            doc.end();

            const pdfBuffer = await new Promise((resBuff, rejBuff) => {
                doc.on('end', () => resBuff(Buffer.concat(buffers)));
                doc.on('error', rejBuff);
            });

            const fileName = `interior_picturebook_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.pdf`;
            const tempFilePath = path.join(tempDir, fileName);

            await fs.mkdir(tempDir, { recursive: true });
            await fs.writeFile(tempFilePath, pdfBuffer);
            console.log(`Interior Picture Book PDF saved temporarily at: ${tempFilePath}`);

            resolve(tempFilePath);
        } catch (error) {
            console.error("Error generating and saving picture book PDF:", error);
            reject(error);
        }
    });
};