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

const getProductDimensions = (luluConfigId) => {
    const productConfig = LULU_PRODUCT_CONFIGURATIONS.find(p => p.id === luluConfigId);
    if (!productConfig) {
        throw new Error(`Product configuration with ID ${luluConfigId} not found.`);
    }

    let widthMm, heightMm, layout;

    switch (productConfig.trimSize) {
        case '5.75x8.75':
            widthMm = 146.05;
            heightMm = 222.25;
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
    // --- TEMPORARY FIX START ---
    // Hardcoding dimensions for the Novella (0550X0850BWSTDPB060UC444GXX) based on Lulu's rejection message.
    // This bypasses the problematic getCoverDimensionsFromApi for now.
    let actualCoverWidthMm;
    let actualCoverHeightMm;
    let actualLayout;

    if (productConfig.luluSku === '0550X0850BWSTDPB060UC444GXX') {
        // Lulu expects: 11.396"-11.521" x 8.688"-8.812"
        // Let's pick a value within the range, converted to mm.
        // Approx mid-point: 11.4585" x 8.75"
        actualCoverWidthMm = 290.945; // Corresponds to 11.4585 inches
        actualCoverHeightMm = 222.25; // Corresponds to 8.75 inches
        actualLayout = 'portrait'; // Assuming portrait for a typical book cover
        
        console.warn(`⚠️ generateCoverPdf: Using hardcoded dimensions for SKU ${productConfig.luluSku} to bypass Lulu API issue.`);
        console.warn(`   Hardcoded dimensions: ${actualCoverWidthMm}mm x ${actualCoverHeightMm}mm`);
    } else {
        // Fallback to the original logic if it's a different product.
        // NOTE: This will still use the 'fallback dimensions' if getCoverDimensionsFromApi fails for other SKUs.
        actualCoverWidthMm = coverDimensions.width;
        actualCoverHeightMm = coverDimensions.height;
        actualLayout = coverDimensions.layout;
        console.warn(`⚠️ generateCoverPdf: Using dimensions from 'coverDimensions' for SKU ${productConfig.luluSku}.`);
    }

    const docWidthPoints = mmToPoints(actualCoverWidthMm);
    const docHeightPoints = mmToPoints(actualCoverHeightMm);

    const doc = new PDFDocument({
        size: [docWidthPoints, docHeightPoints],
        layout: actualLayout,
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });
    // --- TEMPORARY FIX END ---
    
    const tempPdfsDir = path.resolve(process.cwd(), 'tmp', 'pdfs');
    await fs.mkdir(tempPdfsDir, { recursive: true });
    const tempFilePath = path.join(tempPdfsDir, `cover_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.pdf`);

    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#313131');
    const safetyMarginPoints = 0.25 * 72;
    const contentAreaWidth = doc.page.width - (2 * safetyMarginPoints);

    doc.fontSize(48).fillColor('#FFFFFF').font('Helvetica-Bold')
       .text(book.title, safetyMarginPoints, doc.page.height / 4, {
           align: 'center', width: contentAreaWidth
       });
    doc.moveDown(1);
    doc.fontSize(24).fillColor('#CCCCCC').font('Helvetica')
       .text('Inkwell AI', {
           align: 'center', width: contentAreaWidth
       });

    doc.end();

    const pdfBuffer = await streamToBuffer(doc);
    await fs.writeFile(tempFilePath, pdfBuffer);
    
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

    doc.fontSize(28).font('Times-Roman').text(book.title, { align: 'center' });
    doc.moveDown(4);
    doc.fontSize(16).text('A Story by Inkwell AI', { align: 'center' });

    for (const chapter of book.chapters) {
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

    if (addFinalBlankPage) {
        console.log("DEBUG: Adding a final blank page to make page count even.");
        doc.addPage();
    }
    doc.end();

    const pdfBuffer = await streamToBuffer(doc);
    await fs.writeFile(tempFilePath, pdfBuffer);

    return tempFilePath;
};