import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';
import * as pdfService from '../services/pdf.service.js';
import * as luluService from '../services/lulu.service.js';
import * as stripeService from '../services/stripe.service.js';
import * as imageService from '../services/image.service.js';
import * as fileHostService from '../services/fileHost.service.js';
import * as geminiService from '../services/gemini.service.js';
import jsonwebtoken from 'jsonwebtoken';
import { JWT_QUOTE_SECRET } from '../config/jwt.config.js';
import fs from 'fs/promises';
import { imageGenerationQueue } from '../services/queue.service.js';

const PROFIT_MARGIN_AUD = 15.00;
const REQUIRED_CONTENT_PAGES = 20;

async function getFullPictureBook(bookId, userId, client) {
    const bookResult = await client.query(`SELECT *, user_cover_image_url, story_bible, character_reference, book_status FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
    const book = bookResult.rows[0];
    if (!book) return null;
    
    const eventsSql = `
        SELECT id, book_id, page_number, story_text, image_style, image_url_print, 
               uploaded_image_url, image_url, image_url_preview, overlay_text, 
               is_bold_story_text, last_modified, prompt_metadata
        FROM timeline_events 
        WHERE book_id = $1 ORDER BY page_number ASC
    `;
    const timelineResult = await client.query(eventsSql, [bookId]);

    if (book.story_bible && book.story_bible.storyPlan) {
        book.timeline = timelineResult.rows.map(event => {
            const planData = book.story_bible.storyPlan.find(p => p.pageNumber === event.page_number);
            return {
                ...event,
                image_prompt: event.prompt_metadata?.imagePrompt || (planData ? planData.imagePrompt : '')
            };
        });
    } else {
        book.timeline = timelineResult.rows;
    }
    
    return book;
}

export const createPictureBook = async (req, res) => {
    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();
        let { title, luluProductId } = req.body;
        const userId = req.userId;
        if (!luluProductId) {
            const defaultPictureBookConfig = luluService.findProductConfiguration('SQUARE_HC_8.75x8.75');
            if (defaultPictureBookConfig) {
                luluProductId = defaultPictureBookConfig.id;
            } else {
                return res.status(400).json({ message: "Lulu product ID is required, and no default could be found." });
            }
        }
        const countResult = await client.query(`SELECT COUNT(*) as count FROM picture_books WHERE user_id = $1`, [userId]);
        const { count } = countResult.rows[0];
        if (count >= 5) {
            return res.status(403).json({ message: "You have reached the maximum of 5 projects." });
        }
        const bookId = randomUUID();
        const currentDate = new Date().toISOString();
        const sql = `INSERT INTO picture_books (id, user_id, title, date_created, last_modified, lulu_product_id, book_status) VALUES ($1, $2, $3, $4, $5, $6, 'draft')`;
        await client.query(sql, [bookId, userId, title, currentDate, currentDate, luluProductId]);
        res.status(201).json({ bookId: bookId });
    } catch (err) {
        console.error("Error creating picture book:", err.message);
        res.status(500).json({ message: 'Failed to create picture book.' });
    } finally {
        if (client) client.release();
    }
};

export const getPictureBook = async (req, res) => {
    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();
        const { bookId } = req.params;
        const userId = req.userId;
        const book = await getFullPictureBook(bookId, userId, client);
        if (!book) {
            return res.status(404).json({ message: 'Project not found.' });
        }
        res.status(200).json({ book, timeline: book.timeline });
    } catch (err) {
        console.error("Error fetching project:", err.message);
        res.status(500).json({ message: 'Failed to fetch project details.' });
    } finally {
        if (client) client.release();
    }
};

export const getPictureBooks = async (req, res) => {
    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();
        const userId = req.userId;
        const sql = `SELECT pb.id, pb.title, pb.last_modified, pb.is_public, pb.user_cover_image_url, pb.lulu_product_id, pb.book_status FROM picture_books AS pb WHERE user_id = $1 ORDER BY pb.last_modified DESC`;
        const booksResult = await client.query(sql, [userId]);
        const books = booksResult.rows;

        const booksWithType = books.map(book => {
            const productConfig = luluService.findProductConfiguration(book.lulu_product_id);
            return {
                ...book,
                productName: productConfig ? productConfig.name : 'Unknown Book',
                type: 'pictureBook'
            };
        });

        res.status(200).json(booksWithType);
    } catch (err) {
        console.error("Error fetching picture book projects:", err.message);
        res.status(500).json({ message: 'Failed to fetch projects.' });
    } finally {
        if (client) client.release();
    }
};

export const saveStoryBible = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    const storyBibleData = req.body;
    let client;

    if (!storyBibleData || Object.keys(storyBibleData).length === 0) {
        return res.status(400).json({ message: 'Story Bible data is required.' });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');

        const bookResult = await client.query(`SELECT id FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        if (bookResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Project not found.' });
        }

        const newStatus = storyBibleData.storyPlan && storyBibleData.storyPlan.length > 0 ? 'writing' : 'draft';
        
        const updateSql = `
            UPDATE picture_books 
            SET story_bible = $1, character_reference = $2, title = $3, book_status = $4, last_modified = NOW()
            WHERE id = $5
        `;
        await client.query(updateSql, [ storyBibleData, storyBibleData.characterReference || null, storyBibleData.title || 'Untitled Book', newStatus, bookId ]);

        if (storyBibleData.storyPlan && storyBibleData.storyPlan.length > 0) {
            await client.query('DELETE FROM timeline_events WHERE book_id = $1', [bookId]);
            
            const insertEventSql = `
                INSERT INTO timeline_events (book_id, page_number, story_text, image_style, prompt_metadata)
                VALUES ($1, $2, $3, $4, $5)
            `;
            for (const page of storyBibleData.storyPlan) {
                const metadata = { imagePrompt: page.imagePrompt };
                await client.query(insertEventSql, [ bookId, page.pageNumber, page.storyText, storyBibleData.art?.style || 'watercolor', JSON.stringify(metadata) ]);
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Story Bible saved successfully.' });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Error in saveStoryBible controller:", err);
        res.status(500).json({ message: 'Failed to save Story Bible.' });
    } finally {
        if (client) client.release();
    }
};

export const generateCharacterReferences = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    const { description, artStyle } = req.body;
    let client;

    try {
        const pool = await getDb();
        client = await pool.connect();

        const bookResult = await client.query(`SELECT story_bible, book_status FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        const book = bookResult.rows[0];

        if (!book) return res.status(404).json({ message: 'Project not found.' });
        if (!book.story_bible && !description) return res.status(400).json({ message: 'Please save your Story Bible or provide a description before generating characters.' });
        if (book.book_status !== 'draft') return res.status(400).json({ message: 'Character references cannot be re-generated for this book.' });
        
        const characterDescription = description || book.story_bible.character.description;
        const finalArtStyle = artStyle || book.story_bible.art.style;
        
        const referenceSheetPrompt = `A single, solo character concept for a children's book. Centered full-body view of one character only: ${characterDescription}. The character is in a neutral pose against a plain white background. Simple, clean, no other objects or people.`;

        console.log(`[Controller] Generating 3 character reference options for book ${bookId}`);
        const generationPromises = [
            imageService.generateImageFromApi(referenceSheetPrompt, finalArtStyle),
            imageService.generateImageFromApi(referenceSheetPrompt, finalArtStyle),
            imageService.generateImageFromApi(referenceSheetPrompt, finalArtStyle)
        ];
        const imageBuffers = await Promise.all(generationPromises);
        console.log(`[Controller] ✅ 3 raw images generated.`);

        const uploadFolder = `inkwell-ai/user_${userId}/books/${bookId}/references`;
        const uploadPromises = imageBuffers.map((buffer, index) => {
            const publicId = `character-reference-${index + 1}`;
            return imageService.uploadImageToCloudinary(buffer, uploadFolder, publicId);
        });
        const referenceImageUrls = await Promise.all(uploadPromises);
        console.log(`[Controller] ✅ 3 images uploaded to Cloudinary.`);

        res.status(200).json({ referenceImageUrls });
    } catch (err) {
        console.error("Error in generateCharacterReferences controller:", err);
        res.status(500).json({ message: 'Failed to generate character references.' });
    } finally {
        if (client) client.release();
    }
};

export const selectCharacterReference = async (req, res) => {
    const { bookId } = req.params;
    const { characterReference } = req.body;
    let client;

    if (!characterReference || !characterReference.url) {
        return res.status(400).json({ message: 'Character reference URL is required.' });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();
        
        const updateSql = `
            UPDATE picture_books 
            SET character_reference = $1, book_status = 'character_ready', last_modified = NOW()
            WHERE id = $2
        `;
        await client.query(updateSql, [characterReference, bookId]);

        res.status(200).json({
            message: 'Character reference selected successfully.',
            newStatus: 'character_ready'
        });
    } catch (err) {
        console.error("Error in selectCharacterReference controller:", err);
        res.status(500).json({ message: 'Failed to select character reference.' });
    } finally {
        if (client) client.release();
    }
};

export const generateStoryPlan = async (req, res) => {
    const { bookId } = req.params;
    let client;
    let storyPlanPrompt = '';

    try {
        const pool = await getDb();
        client = await pool.connect();
        
        const bookResult = await client.query(`SELECT story_bible, book_status FROM picture_books WHERE id = $1`, [bookId]);
        const book = bookResult.rows[0];

        if (!book) return res.status(404).json({ message: 'Project not found.' });
        if (!book.story_bible) return res.status(400).json({ message: 'Cannot generate story plan. Story Bible has not been saved.' });

        const { coreConcept, character, therapeuticGoal, tone, art } = book.story_bible;

        storyPlanPrompt = `
You are an expert children's book author. Create a 20-page story plan based on these inputs.
The output MUST be a valid JSON array of 20 objects and nothing else.
**CRITICAL INSTRUCTIONS FOR EACH PAGE'S "imagePrompt":**
- Each "imagePrompt" must be vivid, descriptive, and visually exciting.
- Describe the character's specific ACTION and EMOTION.
- Describe the SCENE and ENVIRONMENT with 2-3 key details.
- Vary the framing (e.g., "close-up on the character's face," "wide shot of the bedroom").
- Do NOT just repeat the story text. Create a prompt an illustrator can use.
**EXAMPLE of a good "imagePrompt":**
"A wide shot of a messy bedroom at night. The main character, a small bear, is peeking out from under a blue blanket, his eyes wide with fear. The only light comes from a soft night-light in the corner."
**USER INPUTS:**
- Core Concept: ${coreConcept}
- Main Character: ${character.description}
- Therapeutic Goal: ${therapeuticGoal || 'Create a fun and engaging story.'}
- Tone: ${tone}
- Art Style: ${art.style}
**OUTPUT (JSON Array Only):**
        `.trim();

        console.log(`[Controller] Generating 20-page story plan for book ${bookId}...`);
        const rawJsonResponse = await geminiService.callGeminiAPI(storyPlanPrompt);
        
        const cleanedJson = rawJsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        let storyPlan = JSON.parse(cleanedJson);

        if (!Array.isArray(storyPlan) || storyPlan.length !== REQUIRED_CONTENT_PAGES) {
             throw new Error(`The AI failed to generate exactly ${REQUIRED_CONTENT_PAGES} pages. Please try again.`);
        }

        const historySql = `INSERT INTO prompt_history (book_id, api_used, full_prompt, api_response, was_successful) VALUES ($1, $2, $3, $4, $5)`;
        await client.query(historySql, [bookId, 'Gemini Story Plan', storyPlanPrompt, { storyPlan }, true]);

        res.status(200).json({ storyPlan });

    } catch (err) {
        if (client) {
            const historySql = `INSERT INTO prompt_history (book_id, api_used, full_prompt, was_successful, error_message) VALUES ($1, $2, $3, $4, $5)`;
            await client.query(historySql, [bookId, 'Gemini Story Plan', storyPlanPrompt, false, err.message]);
        }
        res.status(500).json({ message: err.message || 'Failed to generate the story plan.' });
    } finally {
        if (client) client.release();
    }
};

export const improvePrompt = async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ message: 'A prompt to improve is required.' });
    }

    try {
        const masterPrompt = `
You are a master of crafting highly specific and effective image prompts for the Stability AI model. Your task is to take a user's basic request and rewrite it as a single, coherent, and detailed prompt. This prompt must follow a strict format and prioritize visual clarity above all else to ensure a perfect output.

**CRITICAL INSTRUCTIONS:**
- The output MUST be a single, descriptive paragraph.
- The output MUST NOT contain any conversational text, labels like "Prompt:" or "Description:", or numbered lists.
- The output MUST NOT contain any negative prompts.

**STRICT TEMPLATE TO FOLLOW:**
[Main Subject/Character] is [performing a specific action] with [an emotion or mood]. The scene is set in [a specific, detailed environment]. The image should have a [camera shot or framing] with [a specific type of lighting].

**USER'S PROMPT TO IMPROVE:**
"${prompt}"

**IMPROVED PROMPT:**
`.trim();

        const improvedPrompt = await geminiService.callGeminiAPI(masterPrompt);

        const cleanedPrompt = improvedPrompt.replace(/```/g, '').trim();

        res.status(200).json({ improvedPrompt: cleanedPrompt });

    } catch (err) {
        console.error("Error in improvePrompt controller:", err.message);
        res.status(500).json({ message: 'Failed to improve the prompt.' });
    }
};

export const generateSinglePageImage = async (req, res) => {
    const { bookId, pageNumber } = req.params;
    const userId = req.userId;
    const { prompt } = req.body; 
    let client;
    let historyId = null;

    try {
        const pool = await getDb();
        client = await pool.connect();

        const bookResult = await client.query(`SELECT character_reference, story_bible FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        if (bookResult.rows.length === 0) {
            return res.status(404).json({ message: 'Book not found.' });
        }
        
        const book = bookResult.rows[0];
        
        if (!book.character_reference?.url) {
            return res.status(400).json({ message: 'Character reference image is missing for this book.' });
        }
        if (!prompt) {
            return res.status(400).json({ message: 'An image description prompt is required.' });
        }

        const imageServiceOptions = {
            referenceImageUrl: book.character_reference.url,
            prompt: prompt,
            style: book.story_bible?.art?.style || 'watercolor',
            characterFeatures: book.story_bible?.character?.description,
            mood: book.story_bible?.tone,
            bookId,
            pageNumber
        };
        
        const historySql = `INSERT INTO prompt_history (book_id, page_number, api_used, full_prompt) VALUES ($1, $2, $3, $4) RETURNING id`;
        const historyResult = await client.query(historySql, [bookId, pageNumber, 'Stability AI Style Reference', JSON.stringify(imageServiceOptions)]);
        historyId = historyResult.rows[0].id;
        
        const { previewUrl, printUrl } = await imageService.generateImageFromReference(imageServiceOptions);

        const updateSql = `
            UPDATE timeline_events 
            SET image_url = $1, image_url_preview = $2, image_url_print = $3, uploaded_image_url = NULL
            WHERE book_id = $4 AND page_number = $5
        `;
        await client.query(updateSql, [previewUrl, previewUrl, printUrl, bookId, pageNumber]);
        
        const updateHistorySql = `UPDATE prompt_history SET was_successful = true, generated_image_url = $1 WHERE id = $2`;
        await client.query(updateHistorySql, [previewUrl, historyId]);

        res.status(200).json({ message: 'Image generated successfully!', imageUrl: previewUrl });

    } catch (error) {
        if (client && historyId) {
            const updateHistorySql = `UPDATE prompt_history SET was_successful = false, error_message = $1 WHERE id = $2`;
            await client.query(updateHistorySql, [error.message, historyId]);
        }
        console.error(`[Controller] Error generating image for page ${pageNumber}:`, error);
        res.status(500).json({ message: 'Failed to generate image.' });
    } finally {
        if (client) client.release();
    }
};

// ✅ NEW: Controller for queuing all page images for asynchronous generation.
export const generateAllImages = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    let client;

    try {
        const pool = await getDb();
        client = await pool.connect();

        const book = await getFullPictureBook(bookId, userId, client);
        if (!book) {
            return res.status(404).json({ message: 'Project not found.' });
        }
        
        if (!book.character_reference?.url) {
            return res.status(400).json({ message: 'A character reference must be selected before generating images.' });
        }

        // Filter for pages that have a prompt but don't have a generated or uploaded image.
        const pagesToGenerate = book.timeline.filter(event => 
            event.image_prompt && !event.image_url && !event.uploaded_image_url
        );

        if (pagesToGenerate.length === 0) {
            return res.status(200).json({ message: 'All pages with descriptions already have an image.' });
        }

        const jobPromises = pagesToGenerate.map(event => {
            const jobData = {
                bookId: book.id,
                userId: userId,
                pageNumber: event.page_number,
                prompt: event.image_prompt,
            };
            // The job ID prevents queuing the same page for generation if it's already in the queue.
            const jobId = `${book.id}-${event.page_number}`;
            return imageGenerationQueue.add('generate-single-page-image', jobData, { jobId });
        });

        await Promise.all(jobPromises);

        res.status(202).json({ 
            message: `Image generation has been queued for ${pagesToGenerate.length} pages.`,
            pagesQueued: pagesToGenerate.length
        });

    } catch (error) {
        console.error('[Controller] Error queuing batch image generation:', error);
        res.status(500).json({ message: 'Failed to start the image generation process.' });
    } finally {
        if (client) client.release();
    }
};


export const generateEventImage = async (req, res) => {
    const { bookId, pageNumber } = req.params;
    const { prompt, style } = req.body;
    const userId = req.userId;
    let client;
    try {
        const { previewUrl, printUrl } = await imageService.processAndUploadImageVersions(prompt, style, userId, bookId, pageNumber);

        const pool = await getDb();
        client = await pool.connect();
        const updateSql = `
            UPDATE timeline_events 
            SET image_url_preview = $1, image_url_print = $2, 
                image_url = $3, uploaded_image_url = NULL, image_style = $4
            WHERE book_id = $5 AND page_number = $6
        `;
        const result = await client.query(updateSql, [previewUrl, printUrl, previewUrl, style, bookId, pageNumber]);

        if (result.rowCount === 0) {
            throw new Error(`Page number ${pageNumber} not found for book ${bookId}.`);
        }
        
        res.status(200).json({ previewUrl, printUrl });
    } catch(err) {
        console.error('Error generating event image:', err);
        res.status(500).json({ message: 'Failed to generate image.' });
    } finally {
        if (client) client.release();
    }
};

export const uploadCoverImage = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    let client;

    if (!req.file) {
        return res.status(400).json({ message: 'No image file provided.' });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();

        const bookResult = await client.query(`SELECT id FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        if (bookResult.rows.length === 0) {
            return res.status(404).json({ message: 'Project not found or you do not have permission to edit it.' });
        }

        const folder = `inkwell-ai/user_${userId}/covers`;
        const imageUrl = await fileHostService.uploadImageBuffer(req.file.buffer, folder);

        await client.query(`UPDATE picture_books SET user_cover_image_url = $1, last_modified = $2 WHERE id = $3`, [imageUrl, new Date().toISOString(), bookId]);

        res.status(200).json({ message: 'Cover image uploaded successfully!', imageUrl });

    } catch (err) {
        console.error("Error uploading cover image:", err.message);
        res.status(500).json({ message: 'Failed to upload cover image.' });
    } finally {
        if (client) client.release();
    }
};

export const saveTimelineEvents = async (req, res) => {
    let client;
    const { bookId } = req.params;
    const { events } = req.body;
    const userId = req.userId;

    if (!Array.isArray(events)) {
        return res.status(400).json({ message: "Invalid request body. 'events' must be an array." });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');

        const bookResult = await client.query(`SELECT id FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        if (bookResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Project not found or you do not have permission.' });
        }
        
        if (events.length > 0) {
            const upsertSql = `
                INSERT INTO timeline_events (
                    book_id, page_number, event_date, story_text, image_url, 
                    image_style, uploaded_image_url, overlay_text, is_bold_story_text,
                    image_url_preview, image_url_print
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (book_id, page_number) 
                DO UPDATE SET 
                    event_date = EXCLUDED.event_date,
                    story_text = EXCLUDED.story_text,
                    image_url = EXCLUDED.image_url,
                    image_style = EXCLUDED.image_style,
                    uploaded_image_url = EXCLUDED.uploaded_image_url,
                    overlay_text = EXCLUDED.overlay_text,
                    is_bold_story_text = EXCLUDED.is_bold_story_text,
                    image_url_preview = EXCLUDED.image_url_preview,
                    image_url_print = EXCLUDED.image_url_print;
            `;
            
            for (let i = 0; i < events.length; i++) {
                const event = events[i];
                await client.query(upsertSql, [
                    bookId, 
                    i + 1,
                    event.event_date || null,
                    event.story_text || null, 
                    event.image_url || null, 
                    event.image_style || null,
                    event.uploaded_image_url || null, 
                    event.overlay_text || null, 
                    event.is_bold_story_text || false,
                    event.image_url_preview || null, 
                    event.image_url_print || null
                ]);
            }
        }
        
        const maxPageNumber = events.length;
        await client.query(`DELETE FROM timeline_events WHERE book_id = $1 AND page_number > $2`, [bookId, maxPageNumber]);

        await client.query(`UPDATE picture_books SET last_modified = $1 WHERE id = $2`, [new Date().toISOString(), bookId]);
        await client.query('COMMIT');
        res.status(200).json({ message: 'Timeline events saved successfully.' });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error(`Error in saveTimelineEvents controller:`, err.message);
        res.status(500).json({ message: 'Failed to save timeline events.' });
    } finally {
        if (client) client.release();
    }
};

export const generatePreviewPdf = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    let client;
    let tempPdfPath = null;
    try {
        const pool = await getDb();
        client = await pool.connect();
        const book = await getFullPictureBook(bookId, userId, client);
        if (!book) return res.status(404).json({ message: "Project not found." });

        const productConfig = luluService.findProductConfiguration(book.lulu_product_id);
        if (!productConfig) throw new Error(`Product config not found for ${book.lulu_product_id}.`);

        const { path } = await pdfService.generateAndSavePictureBookPdf(book, productConfig);
        tempPdfPath = path;
        
        const publicId = `preview_${bookId}_${Date.now()}`;
        const previewUrl = await fileHostService.uploadPreviewFile(tempPdfPath, publicId);
        
        res.status(200).json({ previewUrl });
    } catch (error) {
        console.error(`[Controller] Error generating preview PDF for book ${bookId}:`, error);
        res.status(500).json({ message: 'Failed to generate preview PDF.' });
    } finally {
        if (client) client.release();
        if (tempPdfPath) {
            try { await fs.unlink(tempPdfPath); } catch (e) { console.error(`[Cleanup] Error deleting temp preview PDF: ${e.message}`); }
        }
    }
};

export const createBookCheckoutSession = async (req, res) => {
    const { bookId } = req.params;
    const { shippingAddress, selectedShippingLevel, quoteToken } = req.body;
    let client;
    let tempInteriorPdfPath = null;
    let tempCoverPdfPath = null;

    if (!shippingAddress || !selectedShippingLevel || !quoteToken) {
        return res.status(400).json({ message: "Missing shipping address, selected shipping level, or quote token." });
    }

    try {
        const decodedQuote = jsonwebtoken.verify(quoteToken, JWT_QUOTE_SECRET);
        if (decodedQuote.bookId !== bookId || decodedQuote.bookType !== 'pictureBook') {
            return res.status(400).json({ message: 'Shipping quote details do not match the selected book.' });
        }

        const pool = await getDb();
        client = await pool.connect();
        const book = await getFullPictureBook(bookId, req.userId, client);
        if (!book) {
            return res.status(404).json({ message: "Project not found." });
        }

        if (book.timeline.length !== REQUIRED_CONTENT_PAGES) {
            const errorMessage = `This book must have exactly ${REQUIRED_CONTENT_PAGES} pages to be printed.`;
            return res.status(400).json({ message: "Book is incomplete.", detailedError: errorMessage });
        }

        const productConfig = luluService.findProductConfiguration(book.lulu_product_id);
        
        const { path: interiorPdfPath, pageCount: finalPageCount } = await pdfService.generateAndSavePictureBookPdf(book, productConfig);
        tempInteriorPdfPath = interiorPdfPath;
        
        const coverDimensions = await luluService.getCoverDimensions(productConfig.luluSku, finalPageCount, 'mm');
        
        let coverPdfPath;
        if (productConfig.productType === 'novel') {
            console.log('[Checkout PB] Generating textbook-style cover...');
            const { path } = await pdfService.generateTextbookCoverPdf(book, productConfig, coverDimensions);
            coverPdfPath = path;
        } else {
            console.log('[Checkout PB] Generating picture book-style cover...');
            const { path } = await pdfService.generateCoverPdf(book, productConfig, coverDimensions);
            coverPdfPath = path;
        }
        tempCoverPdfPath = coverPdfPath;

        console.log('[Checkout PB] Uploading print files for validation...');
        const [interiorUrl, coverUrl] = await Promise.all([
            fileHostService.uploadPrintFile(interiorPdfPath, `interior_${bookId}_${Date.now()}`),
            fileHostService.uploadPrintFile(tempCoverPdfPath, `cover_${bookId}_${Date.now()}`)
        ]);

        console.log('[Checkout PB] Submitting files for Lulu validation...');
        const [interiorValidation, coverValidation] = await Promise.all([
            luluService.validateInteriorFile(interiorUrl, productConfig.luluSku),
            luluService.validateCoverFile(coverUrl, productConfig.luluSku, finalPageCount)
        ]);

        if (interiorValidation.status !== 'VALIDATED' && interiorValidation.status !== 'NORMALIZED' || coverValidation.status !== 'VALIDATED' && coverValidation.status !== 'NORMALIZED') {
            const validationErrors = [
                ...(interiorValidation.errors || []),
                ...(coverValidation.errors || [])
            ];
            console.error('[Checkout PB ERROR] Lulu file validation failed:', validationErrors);
            return res.status(400).json({
                message: 'One or more of your files failed Lulu’s validation.',
                detailedError: 'Please check your book content for issues and try again.',
                validationErrors: validationErrors
            });
        }
        
        console.log('[Checkout PB] ✅ Both interior and cover files validated successfully!');
        
        const { shippingOptions } = await luluService.getLuluShippingOptionsAndCosts(
            productConfig.luluSku,
            finalPageCount,
            shippingAddress
        );

        const selectedOption = shippingOptions.find(option => option.level === selectedShippingLevel);
        if (!selectedOption) {
            return res.status(400).json({ message: "Selected shipping option not found." });
        }

        const luluTotalCostAUD = productConfig.basePrice + parseFloat(selectedOption.cost);
        const finalPriceAUD = luluTotalCostAUD + PROFIT_MARGIN_AUD;
        const finalPriceInCents = Math.round(finalPriceAUD * 100);
        
        console.log(`[Checkout PB] Final Pricing (AUD): Lulu Total=$${luluTotalCostAUD.toFixed(2)}, Profit=$${PROFIT_MARGIN_AUD} -> TOTAL=$${finalPriceAUD.toFixed(2)}`);
        
        const orderId = randomUUID();
        const insertOrderSql = `
            INSERT INTO orders (
                id, user_id, book_id, book_type, book_title, lulu_product_id, status,
                total_price_aud, currency, actual_page_count, shipping_level_selected,
                interior_pdf_url, cover_pdf_url, order_date, updated_at 
            ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, 'AUD', $8, $9, $10, $11, $12, $13)`;

        await client.query(insertOrderSql, [
            orderId, req.userId, bookId, 'pictureBook', book.title, productConfig.luluSku,
            parseFloat(finalPriceAUD.toFixed(2)), finalPageCount,
            selectedShippingLevel, interiorUrl, coverUrl, new Date(), new Date()
        ]);

        const session = await stripeService.createStripeCheckoutSession(
            {
                name: book.title,
                description: `Custom Picture Book - ${productConfig.name}`,
                priceInCents: finalPriceInCents
            },
            shippingAddress, req.userId, orderId, bookId, 'pictureBook'
        );

        await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]);

        res.status(200).json({ url: session.url, sessionId: session.id });

    } catch (error) {
        console.error("[Checkout PB ERROR]", error.stack);
        const detailedError = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ message: 'Failed to create checkout session.', detailedError });
    } finally {
        if (client) client.release();
        if (tempInteriorPdfPath) {
            try { await fs.unlink(tempInteriorPdfPath); } catch (e) { console.error(`[Cleanup] Error deleting temp interior PDF: ${e.message}`); }
        }
        if (tempCoverPdfPath) {
            try { await fs.unlink(tempCoverPdfPath); } catch (e) { console.error(`[Cleanup] Error deleting temp cover PDF: ${e.message}`); }
        }
    }
};

export const deletePictureBook = async (req, res) => {
    let client;
    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');
        const { bookId } = req.params;
        const userId = req.userId;
        const bookResult = await client.query(`SELECT id FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        const book = bookResult.rows[0];
        if (!book) return res.status(404).json({ message: 'Project not found.' });
        await client.query(`DELETE FROM timeline_events WHERE book_id = $1`, [bookId]);
        await client.query(`DELETE FROM picture_books WHERE id = $1`, [bookId]);
        await client.query('COMMIT');
        res.status(200).json({ message: 'Project deleted successfully.' });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Error deleting project:", err.message);
        res.status(500).json({ message: 'Failed to delete project.' });
    } finally {
        if (client) client.release();
    }
};

export const deleteTimelineEvent = async (req, res) => {
    let client;
    const { bookId, pageNumber } = req.params;
    const userId = req.userId;
    try {
        const pool = await getDb();
        client = await pool.connect();
        const bookResult = await client.query(`SELECT id FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        const book = bookResult.rows[0];
        if (!book) {
            return res.status(404).json({ message: 'Project not found or you do not have permission to edit it.' });
        }
        await client.query(`DELETE FROM timeline_events WHERE book_id = $1 AND page_number = $2`, [bookId, pageNumber]);
        await client.query(`UPDATE timeline_events SET page_number = page_number - 1 WHERE book_id = $1 AND page_number > $2`, [bookId, pageNumber]);
        await client.query(`UPDATE picture_books SET last_modified = $1 WHERE id = $2`, [new Date().toISOString(), bookId]);
        res.status(200).json({ message: `Page ${pageNumber} deleted successfully and subsequent pages re-ordered.` });
    } catch (err) {
        console.error(`Error in deleteTimelineEvent controller:`, err.message);
        res.status(500).json({ message: 'Failed to delete the page.' });
    } finally {
        if (client) client.release();
    }
};

export const togglePictureBookPrivacy = async (req, res) => {
    let client;
    const { bookId } = req.params;
    const userId = req.userId;
    const { is_public } = req.body;
    if (typeof is_public !== 'boolean') {
        return res.status(400).json({ message: 'is_public must be a boolean value.' });
    }
    try {
        const pool = await getDb();
        client = await pool.connect();
        const bookResult = await client.query(`SELECT id, user_id FROM picture_books WHERE id = $1`, [bookId]);
        const book = bookResult.rows[0];
        if (!book) {
            return res.status(404).json({ message: 'Project not found.' });
        }
        if (book.user_id !== userId) {
            return res.status(403).json({ message: 'You are not authorized to edit this project.' });
        }
        await client.query(`UPDATE picture_books SET is_public = $1 WHERE id = $2`, [is_public, bookId]);
        res.status(200).json({
            message: `Book status successfully set to ${is_public ? 'public' : 'private'}.`,
            is_public: is_public
        });
    } catch (err) {
        console.error("Error toggling book privacy:", err.message);
        res.status(500).json({ message: 'Failed to update project status.' });
    } finally {
        if (client) client.release();
    }
};

export const prepareBookForPrint = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    let client;

    try {
        const pool = await getDb();
        client = await pool.connect();

        const book = await getFullPictureBook(bookId, userId, client);
        if (!book) {
            return res.status(404).json({ message: 'Project not found.' });
        }

        const pagesToGenerate = book.timeline.filter(event => 
            !event.image_url_print && 
            event.story_text
        );

        if (pagesToGenerate.length === 0) {
            return res.status(200).json({ message: 'All pages are already prepared for printing.' });
        }

        const jobPromises = pagesToGenerate.map(event => {
            const jobData = {
                bookId: book.id,
                userId: userId,
                pageNumber: event.page_number,
                prompt: event.story_text,
                style: event.image_style || 'watercolor'
            };
            console.log(`[Controller] Queuing job for page ${event.page_number}`);
            return imageGenerationQueue.add('generate-page-image', jobData);
        });

        await Promise.all(jobPromises);

        res.status(202).json({ 
            message: `Image generation started in the background for ${pagesToGenerate.length} pages.`,
            pagesQueued: pagesToGenerate.length
        });

    } catch (error) {
        console.error('[Controller] Error preparing book for print:', error);
        res.status(500).json({ message: 'Failed to start print preparation process.' });
    } finally {
        if (client) client.release();
    }
};
// ✅ NEW: Controller function to get the status of all active image generation jobs for a book.
export const getGenerationStatus = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;

    try {
        // Get jobs for the specific book from the queue
        const jobs = await imageGenerationQueue.getJobs([
            'active', 'waiting', 'completed', 'failed'
        ]);

        // Filter and map the jobs to get a cleaner status report
        const jobStatus = jobs
            .filter(job => job.data.bookId === bookId && job.data.userId === userId)
            .map(job => {
                return {
                    pageNumber: job.data.pageNumber,
                    status: job.state,
                    progress: job.progress, // BullMQ provides a progress field
                    id: job.id
                };
            });
        
        res.status(200).json({ jobs: jobStatus });

    } catch (error) {
        console.error('[Controller] Error fetching generation status:', error);
        res.status(500).json({ message: 'Failed to retrieve generation status.' });
    }
};

export const uploadEventImage = async (req, res) => {
    console.log('--- WE ARE INSIDE THE UPLOAD EVENT IMAGE FUNCTION ---'); 
    const { eventId } = req.params;
    const userId = req.userId;
    let client;

    if (!req.file) {
        return res.status(400).json({ message: 'No image file provided.' });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();

        const eventResult = await client.query(`
            SELECT te.id, te.book_id, pb.user_id 
            FROM timeline_events te
            JOIN picture_books pb ON te.book_id = pb.id
            WHERE te.id = $1 AND pb.user_id = $2
        `, [eventId, userId]);

        if (eventResult.rows.length === 0) {
            return res.status(404).json({ message: 'Page not found or you do not have permission to edit it.' });
        }
        
        const { book_id } = eventResult.rows[0];

        const folder = `inkwell-ai/user_${userId}/books/${book_id}/uploads`;
        const imageUrl = await fileHostService.uploadImageBuffer(req.file.buffer, folder);

        await client.query(`
            UPDATE timeline_events 
            SET uploaded_image_url = $1, image_url = NULL, image_url_preview = NULL, image_url_print = NULL
            WHERE id = $2
        `, [imageUrl, eventId]);

        res.status(200).json({ message: 'Image uploaded successfully!', imageUrl });

    } catch (err) {
        console.error("Error uploading event image:", err.message);
        res.status(500).json({ message: 'Failed to upload image.' });
    } finally {
        if (client) client.release();
    }
};