import { getDb } from '../db/database.js';
import * as imageService from '../services/image.service.js';
import * as geminiService from '../services/gemini.service.js';
import { imageGenerationQueue } from '../services/queue.service.js';

const REQUIRED_CONTENT_PAGES = 20;

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
            return res.status(404).json({ message: 'Project not found or you do not have permission.' });
        }

        const updateSql = `
            UPDATE picture_books 
            SET story_bible = $1, last_modified = $2 
            WHERE id = $3
        `;
        await client.query(updateSql, [storyBibleData, new Date().toISOString(), bookId]);

        await client.query('COMMIT');

        res.status(200).json({ message: 'Story Bible saved successfully.' });

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Error in saveStoryBible controller:", err.message);
        res.status(500).json({ message: 'Failed to save Story Bible.' });
    } finally {
        if (client) client.release();
    }
};

export const generateCharacterReferences = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    let client;

    try {
        const pool = await getDb();
        client = await pool.connect();

        const bookResult = await client.query(`SELECT story_bible, book_status FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        const book = bookResult.rows[0];

        if (!book) {
            return res.status(404).json({ message: 'Project not found or you do not have permission.' });
        }
        if (!book.story_bible) {
            return res.status(400).json({ message: 'Please save your Story Bible before generating characters.' });
        }
        if (book.book_status !== 'draft') {
            return res.status(400).json({ message: 'Character references have already been generated and selected for this book.' });
        }

        const characterDescription = book.story_bible.character.description;
        const artStyle = book.story_bible.art.style;
        const referenceSheetPrompt = `Full-body character sheet for a children's book. Character: ${characterDescription}. The character is shown in a neutral pose against a plain white background. No shadows, no props, no other objects.`;

        console.log(`[Controller] Generating 3 character reference options for book ${bookId}`);
        const generationPromises = [
            imageService.generateImageFromApi(referenceSheetPrompt, artStyle),
            imageService.generateImageFromApi(referenceSheetPrompt, artStyle),
            imageService.generateImageFromApi(referenceSheetPrompt, artStyle)
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
    const userId = req.userId;
    const { characterReference } = req.body;
    let client;

    if (!characterReference || !characterReference.url) {
        return res.status(400).json({ message: 'Character reference URL is required.' });
    }

    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');

        const bookResult = await client.query(`SELECT id, book_status FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        const book = bookResult.rows[0];

        if (!book) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Project not found or you do not have permission.' });
        }
        if (book.book_status !== 'draft') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'A character has already been selected for this book.' });
        }

        const updateSql = `
            UPDATE picture_books 
            SET 
                character_reference = $1, 
                book_status = 'character_ready',
                last_modified = $2
            WHERE id = $3
        `;
        await client.query(updateSql, [characterReference, new Date().toISOString(), bookId]);

        await client.query('COMMIT');

        res.status(200).json({
            message: 'Character reference selected successfully.',
            newStatus: 'character_ready'
        });

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Error in selectCharacterReference controller:", err);
        res.status(500).json({ message: 'Failed to select character reference.' });
    } finally {
        if (client) client.release();
    }
};

export const generateStoryPlan = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    let client;

    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');

        const bookResult = await client.query(`SELECT story_bible, book_status FROM picture_books WHERE id = $1 AND user_id = $2`, [bookId, userId]);
        const book = bookResult.rows[0];

        if (!book) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Project not found.' });
        }
        if (book.book_status !== 'character_ready') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Cannot generate story plan. Book status is '${book.book_status}', but must be 'character_ready'.` });
        }
        if (!book.story_bible) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Cannot generate story plan. Story Bible has not been saved.' });
        }

        const { coreConcept, character, therapeuticGoal, tone, art } = book.story_bible;
        const storyPlanPrompt = `
You are a creative and empathetic author of children's picture books. Your task is to create a complete 20-page story plan based on the user's inputs.

**CRITICAL INSTRUCTIONS:**
- The output MUST be a valid JSON array containing exactly 20 page objects.
- Do NOT include any text, conversational filler, or markdown formatting (like \`\`\`json) outside of the JSON array itself.
- Each page object must contain three keys: "pageNumber", "storyText", and "imagePrompt".
- "storyText" should be a single, simple, complete sentence appropriate for a young child (ages 3-6).
- "imagePrompt" should be a vivid, descriptive prompt for an illustrator that includes the character and art style details.

**USER INPUTS:**
- **Core Story Concept:** ${coreConcept}
- **Main Character:** ${character.description}
- **Therapeutic Goal:** ${therapeuticGoal || 'Create a fun and engaging story.'}
- **Tone of the Book:** ${tone}
- **Art Style:** ${art.style}

**OUTPUT (JSON Array):**
[
  {
    "pageNumber": 1,
    "storyText": "A simple, complete sentence for page 1.",
    "imagePrompt": "A detailed description for the illustrator for page 1, incorporating '${character.description}' in a scene that matches the story text, rendered in a '${art.style}' style."
  },
  {
    "pageNumber": 2,
    "storyText": "A simple, complete sentence for page 2.",
    "imagePrompt": "A detailed description for the illustrator for page 2..."
  },
  ...and so on for exactly 20 pages.
]
        `.trim();

        console.log(`[Controller] Generating 20-page story plan for book ${bookId}...`);
        const rawJsonResponse = await geminiService.callGeminiAPI(storyPlanPrompt);
        
        const cleanedJson = rawJsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        let storyPlan;
        try {
            storyPlan = JSON.parse(cleanedJson);
        } catch (parseError) {
            throw new Error('The AI returned an invalid story plan format. Please try again.');
        }

        if (!Array.isArray(storyPlan) || storyPlan.length !== REQUIRED_CONTENT_PAGES) {
             throw new Error(`The AI failed to generate exactly ${REQUIRED_CONTENT_PAGES} pages. Please try again.`);
        }

        const updateSql = `
            UPDATE picture_books
            SET
                story_bible = jsonb_set(story_bible, '{storyPlan}', $1::jsonb),
                book_status = 'story_ready',
                last_modified = $2
            WHERE id = $3
        `;
        await client.query(updateSql, [JSON.stringify(storyPlan), new Date().toISOString(), bookId]);

        await client.query('COMMIT');

        res.status(200).json({
            message: 'Story plan generated successfully.',
            newStatus: 'story_ready',
            storyPlan: storyPlan
        });

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        res.status(500).json({ message: err.message || 'Failed to generate the story plan.' });
    } finally {
        if (client) client.release();
    }
};

export const generatePreviewPages = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    const PREVIEW_COUNT = 3;
    let client;

    try {
        const pool = await getDb();
        client = await pool.connect();

        const bookResult = await client.query(
            `SELECT story_bible, character_reference, book_status FROM picture_books WHERE id = $1 AND user_id = $2`,
            [bookId, userId]
        );
        const book = bookResult.rows[0];

        if (!book) {
            return res.status(404).json({ message: 'Project not found.' });
        }
        if (book.book_status !== 'story_ready') {
            return res.status(400).json({ message: `Cannot generate preview. Book status is '${book.book_status}', but must be 'story_ready'.` });
        }
        if (!book.story_bible?.storyPlan || !book.character_reference?.url) {
            return res.status(400).json({ message: 'Book is missing a story plan or character reference.' });
        }

        const storyPlan = book.story_bible.storyPlan;
        const pagesToPreview = storyPlan.slice(0, PREVIEW_COUNT);
        const characterReferenceUrl = book.character_reference.url;
        const artStyle = book.story_bible.art.style;

        const previewPromises = pagesToPreview.map(page =>
            imageService.generateImageFromReference({
                referenceImageUrl: characterReferenceUrl,
                prompt: page.imagePrompt,
                style: artStyle,
                bookId: bookId,
                pageNumber: `preview_${page.pageNumber}`
            })
        );
        const generatedImageObjects = await Promise.all(previewPromises);
        const previewImageUrls = generatedImageObjects.map(img => img.previewUrl);

        res.status(200).json({ previewImageUrls });

    } catch (err) {
        console.error("Error in generatePreviewPages controller:", err);
        res.status(500).json({ message: 'Failed to generate preview pages.' });
    } finally {
        if (client) client.release();
    }
};

export const generateFullBook = async (req, res) => {
    const { bookId } = req.params;
    const userId = req.userId;
    let client;

    try {
        const pool = await getDb();
        client = await pool.connect();
        await client.query('BEGIN');

        const bookResult = await client.query(
            `SELECT id, book_status FROM picture_books WHERE id = $1 AND user_id = $2`,
            [bookId, userId]
        );
        const book = bookResult.rows[0];

        if (!book) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Project not found.' });
        }
        if (book.book_status !== 'story_ready') {
             await client.query('ROLLBACK');
            return res.status(400).json({ message: `Book cannot be generated. Status is '${book.book_status}', but must be 'story_ready'.` });
        }
        
        const jobData = { bookId, userId };
        await imageGenerationQueue.add('generate-full-picture-book', jobData, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
        });
        console.log(`[Controller] Job added to imageGenerationQueue for book ${bookId}`);

        await client.query(
            `UPDATE picture_books SET book_status = 'generating', last_modified = $1 WHERE id = $2`,
            [new Date().toISOString(), bookId]
        );

        await client.query('COMMIT');

        res.status(202).json({ 
            message: 'Book generation has started. This may take several minutes.',
            newStatus: 'generating'
        });

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Error in generateFullBook controller:", err);
        res.status(500).json({ message: 'Failed to start book generation.' });
    } finally {
        if (client) client.release();
    }
};