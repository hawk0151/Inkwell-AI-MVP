import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';
import { callGeminiAPI } from '../services/gemini.service.js';
import * as pdfService from '../services/pdf.service.js';
import * as luluService from '../services/lulu.service.js';
import * as stripeService from '../services/stripe.service.js';
import * as imageService from '../services/image.service.js';
import * as fileHostService from '../services/fileHost.service.js';
import * as geminiService from '../services/gemini.service.js';
import jsonwebtoken from 'jsonwebtoken';
import { JWT_QUOTE_SECRET } from '../config/jwt.config.js';
import fs from 'fs/promises';
import { imageGenerationQueue, flowProducer } from '../services/queue.service.js';
// Add this helper function after your imports
const emitProgress = (req, bookId, progressData) => {
    if (req.io) {
        // Emit the event to a specific "room" named after the bookId.
        req.io.to(bookId).emit('checkout_progress', progressData);
        console.log(`[Socket.IO] Emitted progress to room ${bookId}: ${progressData.message}`);
    }
};

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
            const planData = book.story_bible.storyPlan.find(p => p.page_number === event.page_number);
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

        // --- FIX: Add a safety check for the art style ---
        if (storyBibleData.art && storyBibleData.art.style === 'watercolor') {
            console.log(`[Controller/Save] WARNING: Intercepted invalid 'watercolor' style, defaulting to 'digital-art'.`);
            storyBibleData.art.style = 'digital-art';
        }
        // --- END FIX ---

        await client.query('LOCK TABLE timeline_events IN SHARE ROW EXCLUSIVE MODE');

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
        await client.query(updateSql, [storyBibleData, storyBibleData.characterReference || null, storyBibleData.title || 'Untitled Book', newStatus, bookId]);

        if (storyBibleData.storyPlan && storyBibleData.storyPlan.length > 0) {
            await client.query('DELETE FROM timeline_events WHERE book_id = $1', [bookId]);

            const insertEventSql = `
                INSERT INTO timeline_events (book_id, page_number, story_text, image_style, prompt_metadata)
                VALUES ($1, $2, $3, $4, $5)
            `;
            for (const page of storyBibleData.storyPlan) {
                const metadata = { imagePrompt: page.imagePrompt };
                await client.query(insertEventSql, [bookId, page.page_number, page.storyText, storyBibleData.art?.style || 'digital-art', JSON.stringify(metadata)]);
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
    const { characterDetails, artStyle } = req.body;
    let client;

    try {
        const pool = await getDb();
        client = await pool.connect();

        // --- FIX: Fetch the story_bible to ensure a fallback art style is available ---
        const bookResult = await client.query(`SELECT story_bible, book_status FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        const book = bookResult.rows[0];

        if (!book) return res.status(404).json({ message: 'Project not found.' });
        if (book.book_status !== 'draft') return res.status(400).json({ message: 'Character references cannot be re-generated for this book.' });
        
        if (!characterDetails || !characterDetails.age || !characterDetails.gender) {
             return res.status(400).json({ message: 'Incomplete character details provided.' });
        }

        const finalArtStyle = artStyle || book.story_bible?.art?.style;
        if (!finalArtStyle) {
            return res.status(400).json({ message: 'An art style is required.' });
        }
        
        const ageMap = {
            'toddler': '(toddler:1.3), 3 years old, (chubby cheeks:1.2), baby face, large innocent eyes, short and chubby build',
            'young-child': 'a young child (6 years old)',
            'child': 'a child (10 years old)'
        };
        
        const descriptionParts = [
            ageMap[characterDetails.age] || 'a child',
            characterDetails.gender,
            characterDetails.ethnicity,
            characterDetails.hair,
            characterDetails.clothing
        ];

        if (characterDetails.extras) descriptionParts.push(characterDetails.extras);
        const finalDescription = descriptionParts.filter(Boolean).join(', ');

        const styleDescription = "(charming children's book illustration:1.4), (picture book style:1.3), vibrant colors, digital painting, soft friendly art style";
        const positivePrompt = `(solo full body portrait:1.5), ${finalDescription}, in a neutral t-pose, simple plain white background, ${styleDescription}`;
        const negativePrompt = `(photorealistic:2.0), (realistic:2.0), (photo:2.0), (adult:2.0), (teenager:2.0), angry, sad, two characters, multiple characters, text, watermark`;

        console.log(`[Controller] Generating TWO character references with FINAL ILLUSTRATION prompting.`);
        console.log(`[Controller] Positive Prompt: ${positivePrompt}`);
        console.log(`[Controller] Negative Prompt: ${negativePrompt}`);

        const generationPromises = [
            imageService.generateImageFromApi(positivePrompt, null, negativePrompt, 0),
            imageService.generateImageFromApi(positivePrompt, null, negativePrompt, Math.floor(Math.random() * 4294967295))
        ];

        const imageBuffers = await Promise.all(generationPromises);

        const uploadFolder = `inkwell-ai/user_${userId}/books/${bookId}/references`;
        const uploadPromises = imageBuffers.map((buffer, index) => 
            imageService.uploadImageToCloudinary(buffer, uploadFolder, `character-reference-${index + 1}`)
        );
        const referenceImageUrls = await Promise.all(uploadPromises);

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

        const bookResult = await client.query(`SELECT story_bible FROM picture_books WHERE id = $1`, [bookId]);
        const book = bookResult.rows[0];

        if (!book) return res.status(404).json({ message: 'Project not found.' });
        if (!book.story_bible) return res.status(400).json({ message: 'Cannot generate story plan. Story Bible has not been saved.' });

        const { coreConcept, character } = book.story_bible;

        // --- FIX: Add our specific style keywords directly into the prompt instructions ---
        const styleKeywords = "charming children's book illustration, picture book style, vibrant colors, digital painting, soft friendly art style";

        storyPlanPrompt = `
You are an expert children's book author. Create a 20-page story plan based on these inputs.
The output MUST be a valid JSON array of 20 objects. Each object must have "page_number", "storyText", and "imagePrompt".

**CRITICAL INSTRUCTIONS FOR EVERY "imagePrompt":**
1.  **Style:** Every imagePrompt MUST describe a scene in the following style: "${styleKeywords}".
2.  **Character:** The main character's name is "${character.name || 'the main character'}". Use this name in the story text.
3.  **Scenery:** If the main character is NOT in the scene, the prompt MUST begin with the tag "[no character]".
4.  **Detail:** Describe the SCENE, ENVIRONMENT, and CAMERA SHOT (e.g., "close-up," "wide shot").

**USER INPUTS:**
- Core Concept: ${coreConcept}
- Main Character Name: ${character.name || 'Not specified'}
- Main Character Description: A ${character.description.age} ${character.description.gender} ${character.description.ethnicity} with ${character.description.hair}.

**OUTPUT (JSON Array Only):**
        `.trim();

        console.log(`[Controller] Generating 20-page story plan for book ${bookId}...`);
        const rawJsonResponse = await geminiService.callGeminiAPI(storyPlanPrompt);
        
        const cleanedJson = rawJsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        let storyPlan = JSON.parse(cleanedJson);

        if (!Array.isArray(storyPlan) || storyPlan.length !== 20) {
            throw new Error(`The AI failed to generate exactly 20 pages. Please try again.`);
        }

        res.status(200).json({ storyPlan });

    } catch (err) {
        console.error(`[Controller] Error generating story plan for book ${bookId}:`, err);
        res.status(500).json({ message: err.message || 'Failed to generate the story plan.' });
    } finally {
        if (client) client.release();
    }
};

export const improvePrompt = async (req, res) => {
    const { prompt, isScenery } = req.body; // <-- now receives isScenery flag
    if (!prompt) {
        return res.status(400).json({ message: 'A prompt to improve is required.' });
    }

    try {
        // --- NEW: Dynamic instructions based on context ---
        const subject = isScenery ? 'a beautiful scenery shot' : 'a character in a scene';
        const template = isScenery
            ? `[A beautiful landscape/scenery shot of...] with [specific type of lighting] and [an emotion or mood]. The image should have a [camera shot or framing].`
            : `[Main Subject/Character] is [performing a specific action] with [an emotion or mood]. The scene is set in [a specific, detailed environment]. The image should have a [camera shot or framing] with [a specific type of lighting].`;

        const masterPrompt = `
You are a master of crafting highly specific and effective image prompts for the Stability AI model. Your task is to take a user's basic request and rewrite it as a single, coherent, and detailed paragraph.

**CONTEXT:** The user is creating an illustration for a children's book. The target image is for **${subject}**.

**CRITICAL INSTRUCTIONS:**
- The output MUST be a single, descriptive paragraph.
- The output MUST NOT contain any conversational text, labels, or numbered lists.
- The output MUST NOT contain any negative prompts.

**STRICT TEMPLATE TO FOLLOW:**
${template}

**USER'S PROMPT TO IMPROVE:**
"${prompt}"

**IMPROVED PROMPT:**
`.trim();

        const improvedPrompt = await callGeminiAPI(masterPrompt);
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

    try {
        const pool = await getDb();
        client = await pool.connect();

        // Fetch the full story_bible to get the art style
        const bookResult = await client.query(`SELECT character_reference, story_bible FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        if (bookResult.rows.length === 0) {
            return res.status(404).json({ message: 'Book not found.' });
        }
        
        const book = bookResult.rows[0];
        
        if (!prompt) {
            return res.status(400).json({ message: 'An image description prompt is required.' });
        }

        const isSceneryOnly = prompt.toLowerCase().includes('[no character]');
        const sceneDescription = prompt.replace(/\[no character\]/gi, '').trim();

        if (!isSceneryOnly && !book.character_reference?.url) {
            return res.status(400).json({ message: 'A character reference must be selected.' });
        }

        // --- FIX: Add our proven style keywords to the user's scene prompt ---
        const styleKeywords = "(charming children's book illustration:1.4), (picture book style:1.3), vibrant colors, digital painting, soft friendly art style";
        const finalPromptForAI = `${sceneDescription}, ${styleKeywords}`;

        const imageServiceOptions = {
            referenceImageUrl: book.character_reference?.url,
            prompt: finalPromptForAI, // Pass the combined prompt
            pageNumber,
            isSceneryOnly
        };
        
        const imageBuffer = await imageService.generateImageFromReference(imageServiceOptions);
        const uploadFolder = `inkwell-ai/user_${userId}/books/${bookId}/pages`;
        const imageUrl = await imageService.uploadImageToCloudinary(imageBuffer, uploadFolder, `page_${pageNumber}`);
        
        const updateSql = `
            UPDATE timeline_events 
            SET image_url = $1, image_url_preview = $2, image_url_print = $3, uploaded_image_url = NULL, last_modified = NOW()
            WHERE book_id = $4 AND page_number = $5
        `;
        await client.query(updateSql, [imageUrl, imageUrl, imageUrl, bookId, pageNumber]);

        res.status(200).json({ message: 'Image generated and saved successfully!', imageUrl });

    } catch (error) {
        console.error(`[Controller] Error generating image for page ${pageNumber}:`, error);
        res.status(500).json({ message: 'Failed to generate and save image.' });
    } finally {
        if (client) client.release();
    }
};

export const generateAllImages = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    let client;

    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');

        const book = await getFullPictureBook(bookId, userId, client);
        if (!book) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Project not found.' });
        }

        if (!book.character_reference?.url) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'A character reference must be selected before generating images.' });
        }

        await client.query(`UPDATE picture_books SET book_status = 'generating-images' WHERE id = $1`, [bookId]);

        const pagesToGenerate = book.timeline.filter(event =>
            event.image_prompt && !event.image_url && !event.uploaded_image_url
        );

        if (pagesToGenerate.length === 0) {
            await client.query('ROLLBACK');
            return res.status(200).json({ message: 'All pages with descriptions already have an image.' });
        }

        const childJobs = pagesToGenerate.map(event => ({
            name: 'generate-single-page-image',
            data: {
                bookId: book.id,
                userId: userId,
                pageNumber: event.page_number,
                prompt: event.image_prompt,
            },
            queueName: imageGenerationQueue.name,
            opts: { jobId: `${book.id}-${event.page_number}` }
        }));

        await flowProducer.add({
            name: 'generate-all-images-flow',
            queueName: imageGenerationQueue.name,
            data: { bookId, userId, finalStatus: 'writing' },
            children: childJobs,
        });

        await client.query('COMMIT');

        res.status(202).json({
            message: `Image generation has been queued for ${pagesToGenerate.length} pages.`,
            pagesQueued: pagesToGenerate.length
        });

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
            await client.query(`UPDATE picture_books SET book_status = 'writing' WHERE id = $1`, [bookId]);
        }
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
    } catch (err) {
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
            return res.status(404).json({ message: 'Project not found.' });
        }

        const folder = `inkwell-ai/user_${userId}/covers`;
        const imageUrl = await fileHostService.uploadImageBuffer(req.file.buffer, folder);

        // --- FIX: This query now ONLY updates the cover image URL ---
        const updateSql = `
            UPDATE picture_books
            SET user_cover_image_url = $1, last_modified = NOW()
            WHERE id = $2
        `;
        await client.query(updateSql, [imageUrl, bookId]);
        // --- END FIX ---

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
            return res.status(404).json({ message: 'Project not found.' });
        }
        
        // --- REPLACEMENT: This query now saves all relevant fields, including image URLs ---
        const updateSql = `
            UPDATE timeline_events
            SET 
                story_text = $1,
                prompt_metadata = jsonb_set(coalesce(prompt_metadata, '{}'::jsonb), '{imagePrompt}', to_jsonb($2::text), true),
                image_url = $3,
                image_url_preview = $4,
                image_url_print = $5,
                uploaded_image_url = $6,
                last_modified = NOW()
            WHERE id = $7 AND book_id = $8;
        `;
        
        for (const event of events) {
            if (event.id) { // Only update events that already exist
                await client.query(updateSql, [
                    event.story_text,
                    event.image_prompt,
                    event.image_url,
                    event.image_url_preview,
                    event.image_url_print,
                    event.uploaded_image_url, // This will be null for AI-generated images
                    event.id,
                    bookId
                ]);
            }
        }
        // --- END OF REPLACEMENT ---
        
        await client.query(`UPDATE picture_books SET last_modified = NOW() WHERE id = $1`, [bookId]);
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
        if (!book) {
            return res.status(404).json({ message: "Project not found." });
        }

        const productConfig = luluService.findProductConfiguration(book.lulu_product_id);
        if (!productConfig) {
            throw new Error(`Product config not found for ${book.lulu_product_id}.`);
        }

        // Call the PDF service, passing 'true' to activate the watermark
        const { path } = await pdfService.generateAndSavePictureBookPdf(book, productConfig, true);
        tempPdfPath = path;
        
        const publicId = `preview_${bookId}_${Date.now()}`;
        const previewUrl = await fileHostService.uploadPreviewFile(tempPdfPath, publicId);
        
        res.status(200).json({ previewUrl });

    } catch (error) {
        console.error(`[Controller] Error generating preview PDF for book ${bookId}:`, error);
        res.status(500).json({ message: 'Failed to generate preview PDF.' });
    } finally {
        if (client) client.release();
        // Clean up the temporary file from the server
        if (tempPdfPath) {
            try { 
                await fs.unlink(tempPdfPath); 
            } catch (e) { 
                console.error(`[Cleanup] Error deleting temp preview PDF: ${e.message}`); 
            }
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

        emitProgress(req, bookId, { step: 1, totalSteps: 6, message: 'Generating your book pages...' });
        const { path: interiorPdfPath, pageCount: finalPageCount } = await pdfService.generateAndSavePictureBookPdf(book, productConfig);
        tempInteriorPdfPath = interiorPdfPath;

        emitProgress(req, bookId, { step: 2, totalSteps: 6, message: 'Creating your cover...' });
        const coverDimensions = await luluService.getCoverDimensions(productConfig.luluSku, finalPageCount);

        let coverPdfPath;
        if (productConfig.productType === 'novel') {
            const { path } = await pdfService.generateTextbookCoverPdf(book, productConfig, coverDimensions);
            coverPdfPath = path;
        } else {
            const { path } = await pdfService.generateCoverPdf(book, productConfig, coverDimensions);
            coverPdfPath = path;
        }
        tempCoverPdfPath = coverPdfPath;

        emitProgress(req, bookId, { step: 3, totalSteps: 6, message: 'Uploading files for printing...' });
        const [interiorUrl, coverUrl] = await Promise.all([
            fileHostService.uploadPrintFile(interiorPdfPath, `interior_${bookId}_${Date.now()}`),
            fileHostService.uploadPrintFile(tempCoverPdfPath, `cover_${bookId}_${Date.now()}`)
        ]);

        emitProgress(req, bookId, { step: 4, totalSteps: 6, message: 'Validating files with our printer...' });
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
            emitProgress(req, bookId, { error: 'File validation failed. Please check your book content.' });
            return res.status(400).json({
                message: 'One or more of your files failed Lulu’s validation.',
                detailedError: 'Please check your book content for issues and try again.',
                validationErrors: validationErrors
            });
        }

        emitProgress(req, bookId, { step: 5, totalSteps: 6, message: 'Calculating final costs...' });
        const { shippingOptions } = await luluService.getLuluShippingOptionsAndCosts(
            productConfig.luluSku,
            finalPageCount,
            shippingAddress
        );

        const selectedOption = shippingOptions.find(option => option.level === selectedShippingLevel);
        if (!selectedOption) {
            throw new Error("Selected shipping option not found.");
        }

        const luluTotalCostAUD = productConfig.basePrice + parseFloat(selectedOption.cost);
        const finalPriceAUD = luluTotalCostAUD + PROFIT_MARGIN_AUD;
        const finalPriceInCents = Math.round(finalPriceAUD * 100);

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

        emitProgress(req, bookId, { step: 6, totalSteps: 6, message: 'Redirecting to payment...' });
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
        emitProgress(req, bookId, { error: 'An unexpected error occurred. Please try again.' });
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

// in src/controllers/pictureBook.controller.js

export const prepareBookForPrint = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    let client;

    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');

        const book = await getFullPictureBook(bookId, userId, client);
        if (!book) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Project not found.' });
        }

        await client.query(`UPDATE picture_books SET book_status = 'generating-print' WHERE id = $1`, [bookId]);

        const pagesToGenerate = book.timeline
            .filter(event => event && (typeof event.page_number === 'number'))
            .filter(event => !event.image_url_print && event.story_text);

        if (pagesToGenerate.length === 0) {
            await client.query(`UPDATE picture_books SET book_status = 'print-ready' WHERE id = $1`, [bookId]);
            await client.query('COMMIT');
            return res.status(200).json({ message: 'All pages are already prepared for printing.' });
        }

        const childJobs = pagesToGenerate.map(event => ({
            name: 'generate-single-page-image', // This should match your worker's job name
            data: {
                bookId: book.id,
                userId: userId,
                // --- FIX: Ensure pageNumber is correctly named and passed ---
                pageNumber: event.page_number,
                prompt: event.image_prompt || event.story_text,
                style: event.image_style || book.story_bible?.art?.style || 'digital-art'
            },
            queueName: imageGenerationQueue.name,
            opts: { jobId: `${book.id}-${event.page_number}` } // Use a unique job ID
        }));

        console.log(`[Controller] Queuing flow for ${childJobs.length} pages for book ${bookId}`);

        await flowProducer.add({
            name: 'prepare-for-print-flow',
            queueName: imageGenerationQueue.name,
            data: { bookId, userId, finalStatus: 'print-ready' },
            children: childJobs,
        });

        await client.query('COMMIT');

        res.status(202).json({
            message: `Print preparation started in the background for ${pagesToGenerate.length} pages.`,
            pagesQueued: pagesToGenerate.length
        });

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
            await client.query(`UPDATE picture_books SET book_status = 'error' WHERE id = $1`, [bookId]);
        }
        console.error('[Controller] Error preparing book for print:', error);
        res.status(500).json({ message: 'Failed to start print preparation process.' });
    } finally {
        if (client) client.release();
    }
};

export const getGenerationStatus = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;

    try {
        const jobs = await imageGenerationQueue.getJobs([
            'active', 'waiting', 'completed', 'failed'
        ]);

        const jobStatus = jobs
            .filter(job => job.data.bookId === bookId && job.data.userId === userId)
            .map(job => {
                return {
                    pageNumber: job.data.pageNumber,
                    status: job.state,
                    progress: job.progress,
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
            // --- FIX: More descriptive error message ---
            return res.status(404).json({ message: `Upload failed: Page with ID ${eventId} not found or permission denied.` });
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