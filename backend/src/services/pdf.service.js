// backend/src/services/pdf.service.js
import PDFDocument from 'pdfkit';
import axios from 'axios';
import db from '../config/database.js';

// --- Database Helper Functions ---
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// --- Image Helper ---
async function getImageBuffer(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data, 'binary');
}

// --- Picture Book PDF Generator (Existing) ---
export const generatePictureBookPdf = async (bookId) => {
  const bookSql = `SELECT * FROM picture_books WHERE id = ?`;
  const book = await dbGet(bookSql, [bookId]);
  if (!book) throw new Error("Book not found.");

  const eventsSql = `SELECT * FROM timeline_events WHERE book_id = ? ORDER BY page_number ASC`;
  const events = await dbAll(eventsSql, [bookId]);

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    autoFirstPage: false,
    margins: { top: 50, bottom: 50, left: 72, right: 72 }
  });

  const buffers = [];
  doc.on('data', buffers.push.bind(buffers));

  const pdfEndPromise = new Promise((resolve) => {
    doc.on('end', () => {
      resolve(Buffer.concat(buffers));
    });
  });

  // Cover Page
  doc.addPage();
  doc.fontSize(40).font('Helvetica-Bold').text(book.title, { align: 'center' });
  doc.moveDown(2);
  doc.fontSize(18).font('Helvetica').text('A Personalized Story from Inkwell AI', { align: 'center' });

  // Timeline Pages
  for (const event of events) {
    doc.addPage();
    if (event.image_url) {
      try {
        const imageBuffer = await getImageBuffer(event.image_url);
        doc.image(imageBuffer, { fit: [450, 300], align: 'center', valign: 'top' });
        doc.moveDown(1);
      } catch (imgErr) {
        console.error(`Failed to load image from ${event.image_url}`, imgErr);
        doc.text(`[Image could not be loaded]`, { align: 'center' });
        doc.moveDown(1);
      }
    }
    if (event.event_date) {
      doc.fontSize(16).font('Helvetica-Bold').text(event.event_date, { align: 'center' });
      doc.moveDown(0.5);
    }
    if (event.description) {
      doc.fontSize(12).font('Helvetica').text(event.description, { align: 'left' });
    }
  }

  doc.end();
  return await pdfEndPromise;
};

// --- NEW FUNCTION for generating text-only book PDFs ---
export const generateTextBookPdf = (title, chapters) => {
    return new Promise((resolve) => {
        const doc = new PDFDocument({
            size: 'A5', // A standard novel size
            layout: 'portrait',
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
            doc.addPage();
            doc.fontSize(18).font('Times-Bold').text(`Chapter ${chapter.chapter_number}`, { align: 'center' });
            doc.moveDown(2);
            doc.fontSize(12).font('Times-Roman').text(chapter.content, { align: 'justify' });
        }

        doc.end();
    });
};