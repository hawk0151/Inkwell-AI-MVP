// backend/src/services/pdf.service.js
import PDFDocument from 'pdfkit';
import axios from 'axios';

// --- Image Helper ---
async function getImageBuffer(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary');
}

// --- Picture Book PDF Generator (MODIFIED) ---
// This function no longer fetches from the DB itself. It now accepts data.
export const generatePictureBookPdf = async (book, events) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Assuming A4 Picture Book product (8.27 x 11.69 inches) from PRODUCTS_TO_OFFER
            // For landscape: [height, width] = [11.69 * 72, 8.27 * 72]
            const widthInPoints = 11.69 * 72; // ~841.68
            const heightInPoints = 8.27 * 72; // ~595.44

            const doc = new PDFDocument({
                size: [widthInPoints, heightInPoints], // Landscape A4 equivalent
                layout: 'landscape', 
                autoFirstPage: false,
                margins: { top: 36, bottom: 36, left: 36, right: 36 }
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
                
                // Add overlay text at the bottom
                if (event.overlay_text) {
                    doc.fontSize(24).font('Helvetica-Bold').text(
                        event.overlay_text,
                        doc.page.margins.left,
                        doc.page.height - doc.page.margins.bottom - 100, // Position towards bottom
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


// --- Text Book PDF Generator ---
// MODIFIED to use exact Lulu dimensions for Novella (5.5 x 8.5 inches)
export const generateTextBookPdf = (title, chapters) => {
    return new Promise((resolve) => {
        const widthInPoints = 5.5 * 72; // 396 points
        const heightInPoints = 8.5 * 72; // 612 points

        const doc = new PDFDocument({
            size: [widthInPoints, heightInPoints], // Set exact dimensions
            layout: 'portrait', // Keep portrait
            margins: { top: 72, bottom: 72, left: 72, right: 72 }
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
            doc.addPage({ margins: { top: 72, bottom: 72, left: 72, right: 72 }}); // Ensure margins for each page
            doc.fontSize(18).font('Times-Bold').text(`Chapter ${chapter.chapter_number}`, { align: 'center' });
            doc.moveDown(2);
            doc.fontSize(12).font('Times-Roman').text(chapter.content, { align: 'justify' });
        }
        doc.end();
    });
};