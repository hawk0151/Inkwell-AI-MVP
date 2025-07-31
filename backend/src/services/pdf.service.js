import PDFDocument from 'pdfkit';
import axios from 'axios';
// MODIFIED: Import getCoverDimensionsFromApi
import { PRODUCTS_TO_OFFER, getCoverDimensionsFromApi } from './lulu.service.js';

// Helper function to convert mm to points
const mmToPoints = (mm) => mm * (72 / 25.4);

// Helper to get dimensions from product ID for INTERIOR PDFs
const getProductDimensions = (luluProductId) => {
    const product = PRODUCTS_TO_OFFER.find(p => p.id === luluProductId);
    if (!product) {
        throw new Error(`Product with ID ${luluProductId} not found in PRODUCTS_TO_OFFER.`);
    }

    let widthMm, heightMm, layout;

    // These are interior dimensions, which remain fixed based on Lulu's templates
    switch (product.id) {
        case '0550X0850BWSTDCW060UC444GXX': // Novella (5.5 x 8.5" / 139.7 x 215.9 mm)
            widthMm = 139.7;
            heightMm = 215.9;
            layout = 'portrait';
            break;
        case '0827X1169BWPRELW060UC444GNG': // A4 Story Book (8.27 x 11.69" / 209.55 x 296.9 mm)
            widthMm = 209.55;
            heightMm = 296.9;
            layout = 'portrait';
            break;
        case '0614X0921BWPRELW060UC444GNG': // Royal Hardcover (6.14 x 9.21" / 156 x 234 mm)
            widthMm = 156;
            heightMm = 234;
            layout = 'portrait';
            break;
        case '0827X1169FCPRELW080CW444MNG': // A4 Premium Picture Book (8.27 x 11.69" / 209.55 x 296.9 mm - portrait internal dimensions for a landscape book)
            // Interior PDF for a landscape book is still generated in portrait
            widthMm = 209.55;
            heightMm = 296.9;
            layout = 'portrait'; // Interior content for landscape book still uses portrait pages
            break;
        default:
            throw new Error(`Unknown product ID ${luluProductId} for interior PDF dimensions.`);
    }

    const widthPoints = mmToPoints(widthMm);
    const heightPoints = mmToPoints(heightMm);

    console.log(`DEBUG: Product ${luluProductId} interior dimensions in MM: ${widthMm}x${heightMm}. In Points: ${widthPoints.toFixed(2)}x${heightPoints.toFixed(2)}. Layout: ${layout}.`);

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

// --- MODIFIED: Cover PDF Generator to use Lulu API for dimensions directly ---
export const generateCoverPdf = async (bookTitle, authorName, luluProductId, pageCount) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Get dimensions directly from Lulu API
            const { width: coverWidthMm, height: coverHeightMm, layout: coverLayout } =
                await getCoverDimensionsFromApi(luluProductId, pageCount, 'mm');

            // Convert MM to points for PDFKit using Lulu's direct width/height
            const docWidthPoints = mmToPoints(coverWidthMm);
            const docHeightPoints = mmToPoints(coverHeightMm);

            console.log(`DEBUG: Cover PDF for ${luluProductId} (Pages: ${pageCount}) will be generated with dimensions from Lulu API in MM: ${coverWidthMm.toFixed(2)}x${coverHeightMm.toFixed(2)}. Final PDFKit setup in Points: ${docWidthPoints.toFixed(2)}x${docHeightPoints.toFixed(2)}. Layout: ${coverLayout}.`);

            // Validate the dimensions before generating
            if (docWidthPoints <= 0 || docHeightPoints <= 0 || docWidthPoints > 10000 || docHeightPoints > 10000) {
                const errorMessage = `Invalid or extreme cover dimensions for PDFKit: Width: ${docWidthPoints.toFixed(2)}pt, Height: ${docHeightPoints.toFixed(2)}pt. Aborting PDF generation.`;
                console.error(`❌ ${errorMessage}`);
                return reject(new Error(errorMessage));
            }

            const doc = new PDFDocument({
                size: [docWidthPoints, docHeightPoints], // Use direct dimensions from Lulu API
                layout: coverLayout, // Use layout returned by Lulu API call
                autoFirstPage: false,
                margins: { top: 0, bottom: 0, left: 0, right: 0 } // Covers usually have full bleed, no internal margins needed
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            doc.addPage();

            // Fill background
            doc.rect(0, 0, doc.page.width, doc.page.height).fill('#313131'); // Dark background

            doc.fontSize(48)
                .fillColor('#FFFFFF')
                .font('Helvetica-Bold')
                .text(bookTitle, 0, doc.page.height / 3, { // Centered vertically in the upper third
                    align: 'center',
                    width: doc.page.width // Center across the full spread
                });
            doc.moveDown(1);
            doc.fontSize(24)
                .fillColor('#CCCCCC')
                .font('Helvetica')
                .text(authorName || 'Inkwell AI', {
                    align: 'center',
                    width: doc.page.width // Center across the full spread
                });

            doc.end();
        } catch (error) {
            console.error("Error generating cover PDF:", error);
            reject(error);
        }
    });
};


// --- Picture Book PDF Generator (MODIFIED to accept luluProductId) ---
export const generatePictureBookPdf = async (book, events, luluProductId) => {
    return new Promise(async (resolve, reject) => {
        try {
            const { width, height, layout } = getProductDimensions(luluProductId);

            const doc = new PDFDocument({
                size: [width, height],
                layout: layout,
                autoFirstPage: false,
                margins: { top: 36, bottom: 36, left: 36, right: 36 }
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            doc.addPage();
            if (book.cover_image_url) {
                try {
                    const coverImageBuffer = await getImageBuffer(book.cover_image_url);
                    doc.image(coverImageBuffer, 0, 0, { fit: [doc.page.width - 72, doc.page.height - 150], align: 'center', valign: 'top' });
                } catch (imgErr) {
                    console.error(`Failed to load cover image for interior from ${book.cover_image_url}`, imgErr);
                    doc.fontSize(40).font('Helvetica-Bold').text(book.title, { align: 'center' });
                }
            } else {
                doc.fontSize(40).font('Helvetica-Bold').text(book.title, { align: 'center' });
                doc.moveDown(2);
                doc.fontSize(18).font('Helvetica').text('A Personalized Story from Inkwell AI', { align: 'center' });
            }

            // --- Timeline Pages ---
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
            margins: { top: 72, bottom: 72, left: 72, right: 72 }
        });

        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            resolve(Buffer.concat(buffers));
        });

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
        doc.end();
    });
};