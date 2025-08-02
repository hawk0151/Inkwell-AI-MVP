// CHANGES:
// - AbortController import/usage adjusted for CommonJS/Node.js 16+ compatibility.
// - Remaining-word budgeting logic improved: previousChaptersText is sanitized before word count,
//   and robust logging for budget calculation.
// - Prompt hygiene enhanced: trimmed, and output control instruction is prominent.
// - Logging and edge cases: improved handling for negative/zero remaining budget/chapters.
// - Output validation reminder: explicitly stated trimming for extraneous content.
// - Header comment updated for accuracy.
// - REFINEMENT: Used sanitized previousChaptersText in prompt.
// - REFINEMENT: Refined post-generation cleanup regex for more conservative removal.
// - REFINEMENT: Separated logging for different cleanup types.
// - FIX: Added fallback for 'recipientName' and 'characterName' in prompt if they are undefined or empty.
// - CRITICAL CHANGE: Reworked prompt to treat 'recipientName' ONLY as the reader/owner of the book,
//   NOT as a character in the story. The story will now feature 'characterName' (the adult) and a generic, unnamed child.

import fetch from 'node-fetch';

// Check for global AbortController (Node.js 15+). If not present, conditionally require the polyfill.
let AbortController;
if (typeof globalThis.AbortController === 'function') {
    AbortController = globalThis.AbortController;
} else {
    try {
        // This assumes 'node-abort-controller' is a direct dependency.
        const NodeAbortController = require('node-abort-controller');
        AbortController = NodeAbortController.AbortController;
    } catch (e) {
        console.error("Could not load node-abort-controller. AbortController may not be available. Error:", e.message);
        throw new Error("AbortController is not available. Please ensure you are on Node.js 15+ or 'node-abort-controller' is installed.");
    }
}


export const generateStoryFromApi = async (promptDetails) => {
    const {
        recipientName, // Now ONLY the name of the book's reader/owner
        characterName, // The main character in the story (e.g., Peter)
        characterGender, // This refers to the gender of 'characterName'
        interests,
        genre,
        wordsPerPage, // This is the target words per *average page*
        previousChaptersText = '',
        chapterNumber,
        totalChapters,
        isFinalChapter,
        maxPageCount
    } = promptDetails;

    // --- FIX: Add a robust check for recipientName with a fallback ---
    const actualRecipientName = (typeof recipientName === 'string' && recipientName.trim() !== '') 
                                ? recipientName.trim() 
                                : 'dear reader'; // Fallback for the book's reader/owner

    if (actualRecipientName === 'dear reader' && (typeof recipientName !== 'string' || recipientName.trim() === '')) {
        console.warn(`[Gemini Service] Chapter ${chapterNumber}: recipientName was undefined or empty. Using fallback: "${actualRecipientName}". This indicates a potential upstream data issue.`);
    }

    // --- FIX: Add a robust check for characterName with a fallback ---
    const actualCharacterName = (typeof characterName === 'string' && characterName.trim() !== '') 
                                ? characterName.trim() 
                                : 'the guardian'; // Fallback name for adult character

    if (actualCharacterName === 'the guardian' && (typeof characterName !== 'string' || characterName.trim() === '')) {
        console.warn(`[Gemini Service] Chapter ${chapterNumber}: characterName was undefined or empty. Using fallback: "${actualCharacterName}". This indicates a potential upstream data issue for the main adult character.`);
    }

    if (!wordsPerPage || !totalChapters || !maxPageCount) {
        throw new Error('wordsPerPage, totalChapters, and maxPageCount are required for story generation.');
    }

    // --- 2. Ensure remaining-word budgeting logic is correct and robust ---
    const availableContentPages = Math.max(0, maxPageCount - 4); // reserve 4 pages for front/back matter
    const totalContentWordsBudget = availableContentPages * wordsPerPage;

    // Sanitize previousChaptersText before counting to prevent pollution from artifacts
    const sanitizedPreviousChaptersText = previousChaptersText
        .replace(/\[.*?\]/g, '') // Strip any leftover bracketed placeholders
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim(); // Trim leading/trailing whitespace

    const previousWordsCount = sanitizedPreviousChaptersText.split(' ').filter(word => word.length > 0).length;
    
    const remainingBudget = totalContentWordsBudget - previousWordsCount;
    // Guard against remainingChapters being zero or negative
    const remainingChapters = Math.max(1, totalChapters - chapterNumber + 1);

    let rawTarget = remainingBudget / remainingChapters;

    // Clamp rawTarget to MIN=800 and MAX=1200
    const MIN_CHAPTER_WORDS = 800;
    const MAX_CHAPTER_WORDS = 1200;
    let finalTargetChapterWordCount = Math.min(Math.max(rawTarget, MIN_CHAPTER_WORDS), MAX_CHAPTER_WORDS);

    // 4. Logging and edge cases:
    if (remainingBudget < 0 || isNaN(rawTarget)) {
        console.warn(`[Gemini Service] Warning: Chapter ${chapterNumber}: Negative remaining budget (${remainingBudget}) or nonsensical raw target (${rawTarget}). Defaulting target to MIN_CHAPTER_WORDS (${MIN_CHAPTER_WORDS}).`);
        finalTargetChapterWordCount = MIN_CHAPTER_WORDS; // Fallback to MIN if budget is problematic
    }

    console.log(`[Gemini Service] Chapter ${chapterNumber} Budgeting:`);
    console.log(`  - Total Content Words Budget: ${totalContentWordsBudget} (from ${availableContentPages} pages * ${wordsPerPage} words/page)`);
    console.log(`  - Previous Chapters Word Count (sanitized): ${previousWordsCount}`);
    console.log(`  - Remaining Budget: ${remainingBudget}`);
    console.log(`  - Remaining Chapters: ${remainingChapters}`);
    console.log(`  - Raw Target per Chapter: ${Math.round(rawTarget)}`);
    console.log(`  - Final Target Chapter Word Count (clamped ${MIN_CHAPTER_WORDS}-${MAX_CHAPTER_WORDS}): ${Math.round(finalTargetChapterWordCount)} words.`);


    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set in .env');
    }

    const model = process.env.GEMINI_MODEL || 'gemini-1.0-pro';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    let chapterInstruction = '';
    let conclusionInstruction = '';

    if (isFinalChapter) {
        chapterInstruction = `This is the FINAL chapter (Chapter ${chapterNumber} of ${totalChapters}). Conclude the story in a satisfying and definitive manner, resolving key plot points and character arcs.`;
        conclusionInstruction = `- **MUST CONCLUDE THE STORY**. Provide a clear, satisfying, and definitive ending.`;
    } else {
        chapterInstruction = `This is Chapter ${chapterNumber} of ${totalChapters}. Do NOT conclude the story. End the chapter in a way that makes the reader want to know what happens next.`;
        conclusionInstruction = `- **DO NOT CONCLUDE THE STORY**. End the chapter with a cliffhanger or a clear indication that the narrative continues.`;
    }

    // 7. Pronoun defaults: Default to neutral if gender is not specified or recognized
    const characterPronounSubject = characterGender === 'male' ? 'he' : characterGender === 'female' ? 'she' : 'they';
    const characterPronounObject = characterGender === 'male' ? 'him' : characterGender === 'female' ? 'her' : 'them';
    const characterPronounPossessive = characterGender === 'male' ? 'his' : characterGender === 'female' ? 'her' : 'their';

    // 3. Prompt hygiene: Trim incidental leading/trailing whitespace and ensure top-line instruction
    const prompt = `
OUTPUT ONLY THE CHAPTER PROSE, NOTHING ELSE.

ROLE: You are a professional novelist writing a continuous, multi-chapter story for a children's personalized book.
This story is for a reader named "${actualRecipientName}". The reader is NOT a character in the story and should NEVER be directly mentioned in the narrative.
You MUST adhere strictly to the provided names and pronouns for characters.

PREVIOUS CHAPTERS (for context only - DO NOT REGENERATE):
${sanitizedPreviousChaptersText}

TASK: Write ONLY chapter ${chapterNumber} of a story.

STORY DETAILS:
- Main Character: ${actualCharacterName} (Pronouns: ${characterPronounSubject}/${characterPronounObject}/${characterPronounPossessive})
- A child character is present in the story, but they are NOT named. Refer to them as "the child," "the little one," or use appropriate pronouns.
- Themes & Interests: ${interests}
- Genre: ${genre}

REQUIREMENTS:
- **STRICT LENGTH CONSTRAINT**: The generated text for this chapter MUST be **as close as possible to ${Math.round(finalTargetChapterWordCount)} words**. This is a hard technical limit to ensure the final book fits within the page count of the physical product. Do not go significantly over this word count. Prioritize story quality and coherence within this limit.
- ${chapterInstruction}
- ${conclusionInstruction}
- **DO NOT** write "The End" or any similar concluding phrases.
- **DO NOT** include any titles or chapter headings like "Chapter ${chapterNumber}".
- **IMPORTANT: NEVER use placeholders or text in brackets.** Always use actual names/terms.
    - **NEVER** mention the reader's name ("${actualRecipientName}") in the story. The reader is the audience, not a character.
    - **ALWAYS** refer to the main character by their actual name: "${actualCharacterName}".
    - When referring to the main character, use the correct pronouns: "${characterPronounSubject}", "${characterPronounObject}", "${characterPronounPossessive}".
    - When referring to the child character, use generic terms like "the child", "the little one", or appropriate pronouns. DO NOT assign them a specific name.
- Continue the story seamlessly from the "PREVIOUS CHAPTERS".
- Begin immediately with the story text for chapter ${chapterNumber}.
- Ensure fluid narrative progression and character consistency.

Begin writing chapter ${chapterNumber} now.
    `.trim(); // Trim the entire prompt string

    // Payload construction: Define the request payload object before calling fetch
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ]
    };

    // 4. Timeout enforcement: Use AbortController correctly
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 90000); // 90 seconds timeout

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal, // Pass the AbortController's signal
        });

        clearTimeout(id); // Clear the timeout if the request completes

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Gemini API raw error response: ${errorText}`); // Log raw error for debugging
            throw new Error(`Gemini API error: ${errorText}`);
        }

        const result = await response.json();
        let chapterText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!chapterText) {
            // 8. Error logging: Differentiate safety blocks vs structural failures
            if (result?.candidates?.[0]?.finishReason === 'SAFETY') {
                console.error("Gemini content blocked due to safety settings.", result.promptFeedback);
                throw new Error('The generated content was blocked for safety reasons. Please adjust your prompt.');
            }
            console.error("Gemini API response missing chapter text or invalid structure:", JSON.stringify(result, null, 2)); // Log full result for debugging
            throw new Error('Invalid response structure from Gemini API. No chapter text found.');
        }
        
        // 5. Placeholder sanitization & 6. Refined Post-Generation Cleanup Regex:
        const originalChapterText = chapterText;
        let cleanedUp = false;

        // Strip any bracketed placeholders
        const postPlaceholderCleanedText = originalChapterText.replace(/\[.*?\]/g, '').trim();
        if (postPlaceholderCleanedText !== originalChapterText) {
            console.warn(`[Gemini Service] Chapter ${chapterNumber}: Placeholders removed post-generation.`);
            cleanedUp = true;
        }
        chapterText = postPlaceholderCleanedText;

        // Remove "Chapter N:" style headings ONLY if they are at the very beginning of a line
        const postHeadingCleanedText = chapterText.replace(/^\s*Chapter\s+\d+[:.]?\s*$/gim, '').trim();
        if (postHeadingCleanedText !== chapterText) {
            console.warn(`[Gemini Service] Chapter ${chapterNumber}: Chapter heading removed post-generation.`);
            cleanedUp = true;
        }
        chapterText = postHeadingCleanedText;

        // Remove "The End" or "Epilogue" lines ONLY if they appear alone on a line
        const postEndingCleanedText = chapterText.replace(/^\s*(The End|Epilogue)\s*$/gim, '').trim();
        if (postEndingCleanedText !== chapterText) {
            console.warn(`[Gemini Service] Chapter ${chapterNumber}: Concluding phrase removed post-generation.`);
            cleanedUp = true;
        }
        chapterText = postEndingCleanedText;

        // Final trim for any remaining leading/trailing whitespace after all cleanups
        chapterText = chapterText.trim();
        
        const words = chapterText.split(/\s+/).filter(word => word.length > 0); 
        console.log(`Chapter ${chapterNumber} generated with ~${words.length} words (target: ${Math.round(finalTargetChapterWordCount)}).`);

        return chapterText;
    } catch (error) {
        clearTimeout(id); // Ensure timeout is cleared on error
        if (error.name === 'AbortError') {
            console.error('Gemini API request timed out:', error.message);
            throw new Error('Gemini API request timed out. Please try again.');
        }
        throw error; // Re-throw other errors
    }
};