import PDFDocument from 'pdfkit';
import axios from 'axios';
import { PRODUCTS_TO_OFFER } from './lulu.service.js';

// Helper function to convert mm to points
const mmToPoints = (mm) => mm * (72 / 25.4);

// Helper to get dimensions from product ID using PRECISE TEMPLATE SPECS
const getProductDimensions = (luluProductId) => {
    const product = PRODUCTS_TO_OFFER.find(p => p.id === luluProductId);
    if (!product) {
        throw new Error(`Product with ID ${luluProductId} not found in PRODUCTS_TO_OFFER.`);
    }

    let widthMm, heightMm, layout;

    switch (product.id) {
        case '0550X0850BWSTDCW060UC444GXX': // Novella (5.5 x 8.5" / 139.7 x 215.9 mm - from template)
            widthMm = 139.7; // Exact from Lulu template
            heightMm = 215.9; // Exact from Lulu template
            layout = 'portrait';
            break;
        case '0827X1169BWPRELW060UC444GNG': // A4 Story Book (8.27 x 11.69" / 209.55 x 296.9 mm - from template)
            widthMm = 209.55;
            heightMm = 296.9;
            layout = 'portrait';
            break;
        case '0614X0921BWPRELW060UC444GNG': // Royal Hardcover (6.14 x 9.21" / 156 x 234 mm - common Royal size, verify with Lulu if issues persist)
            widthMm = 156;
            heightMm = 234;
            layout = 'portrait';
            break;
        case '0827X1169FCPRELW080CW444MNG': // A4 Premium Picture Book (8.27 x 11.69" / 209.55 x 296.9 mm - from template, landscape)
            // For landscape, width > height.
            widthMm = 296.9; // Height of A4 in portrait becomes width in landscape
            heightMm = 209.55; // Width of A4 in portrait becomes height in landscape
            layout = 'landscape';
            break;
        default:
            throw new Error(`Unknown product ID ${luluProductId} for PDF dimensions.`);
    }

    const widthPoints = mmToPoints(widthMm);
    const heightPoints = mmToPoints(heightMm);

    // --- NEW DEBUG LOG ---
    console.log(`DEBUG: Product ${luluProductId} dimensions in MM: ${widthMm}x${heightMm}. In Points: ${widthPoints.toFixed(2)}x${heightPoints.toFixed(2)}.`);
    // --- END NEW DEBUG LOG ---

    return {
        width: widthPoints,
        height: heightPoints,
        layout: layout
    };
};

// --- Image Helper ---
async function getImageBuffer(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary');
}

// --- Picture Book PDF Generator (MODIFIED to accept luluProductId) ---
export const generatePictureBookPdf = async (book, events, luluProductId) => {
    return new Promise(async (resolve, reject) => {
        try {
            const { width, height, layout } = getProductDimensions(luluProductId);

            const doc = new PDFDocument({
                size: [width, height],
                layout: layout,
                autoFirstPage: false,
                // --- MODIFICATION START: Set margins once here ---
                margins: { top: 36, bottom: 36, left: 36, right: 36 }
                // --- MODIFICATION END ---
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            // --- Cover Page ---
            doc.addPage();
            if (book.cover_image_url) {
                try {
                    const coverImageBuffer = await getImageBuffer(book.cover_image_url);
                    doc.image(coverImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });
                } catch (imgErr) {
                    console.error(`Failed to load cover image from ${book.cover_image_url}`, imgErr);
                    doc.fontSize(40).font('Helvetica-Bold').text(book.title, { align: 'center' });
                }
            } else {
                doc.fontSize(40).font('Helvetica-Bold').text(book.title, { align: 'center' });
                doc.moveDown(2);
                doc.fontSize(18).font('Helvetica').text('A Personalized Story from Inkwell AI', { align: 'center' });
            }

            // --- Timeline Pages ---
            for (const event of events) {
                // --- MODIFICATION START: Remove redundant margins from addPage ---
                doc.addPage(); // Use global margins set in constructor
                // --- MODIFICATION END ---
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
        } catch (error) {
            reject(error);
        }
    });
};


// --- Text Book PDF Generator (MODIFIED to accept luluProductId) ---
export const generateTextBookPdf = (title, chapters, luluProductId) => {
    return new Promise((resolve) => {
        const { width, height, layout } = getProductDimensions(luluProductId);

        const doc = new PDFDocument({
            size: [width, height],
            layout: layout,
            // --- MODIFICATION START: Set margins once here ---
            margins: { top: 72, bottom: 72, left: 72, right: 72 }
            // --- MODIFICATION END ---
        });

        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            resolve(Buffer.concat(buffers));
        });

        // --- Title Page ---
        doc.addPage();
        doc.fontSize(28).font('Times-Roman').text(title, { align: 'center' });
        doc.moveDown(4);
        doc.fontSize(16).text('A Story by Inkwell AI', { align: 'center' });

        // --- Chapter Pages ---
        for (const chapter of chapters) {
            // --- MODIFICATION START: Remove redundant margins from addPage ---
            doc.addPage(); // Use global margins set in constructor
            // --- MODIFICATION END ---
            doc.fontSize(18).font('Times-Bold').text(`Chapter ${chapter.chapter_number}`, { align: 'center' });
            doc.moveDown(2);
            doc.fontSize(12).font('Times-Roman').text(chapter.content, { align: 'justify' });
        }
        doc.end();
    });
};