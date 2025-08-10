/**
 * @fileoverview This file provides a centralized service for interacting with the Gemini API.
 * It contains functions for generating story content and a new, generic function for
 * more flexible API calls by other modules.
 */

import fetch from 'node-fetch';

let AbortController;
if (typeof globalThis.AbortController === 'function') {
    AbortController = globalThis.AbortController;
} else {
    try {
        const NodeAbortController = await import('node-abort-controller');
        AbortController = NodeAbortController.AbortController;
    } catch (e) {
        console.error("Could not load node-abort-controller. AbortController may not be available. Error:", e.message);
        throw new Error("AbortController is not available. Please ensure you are on Node.js 15+ or 'node-abort-controller' is installed.");
    }
}

/**
 * Creates a structured story bible from previous chapters of a story.
 * @param {string} previousChaptersText The text of the story's previous chapters.
 * @returns {Promise<object>} A JSON object containing key story details.
 */
export const createStoryBible = async (previousChaptersText) => {
    if (!previousChaptersText || previousChaptersText.trim() === '') {
        return {
            plot_summary_so_far: "This is the first chapter.",
            character_developments: [],
            key_objects_or_macguffins: [],
            unresolved_plot_threads: [],
            world_building_rules: []
        };
    }

    const biblePrompt = `
You are a meticulous story editor. Read the following story text and extract ONLY the following key details in a concise, structured JSON format. Do not add any conversational text or markdown formatting like \`\`\`json.

STORY TEXT:
---
${previousChaptersText}
---

OUTPUT FORMAT (JSON):
{
  "plot_summary_so_far": "A brief, 2-3 sentence summary of the main plot events that have occurred.",
  "character_developments": [
    { "character": "Character Name", "development": "Briefly describe their most recent emotional state, key decisions, or changes in their personality." }
  ],
  "key_objects_or_macguffins": ["List of important items, like 'the silver locket' or 'the encrypted data chip'"],
  "unresolved_plot_threads": ["List of mysteries or cliffhangers, e.g., 'Who sent the mysterious letter?', 'What is behind the locked door?'"],
  "world_building_rules": ["List any established rules of the world, e.g., 'Magic can only be used at night.', 'The protagonist is allergic to pineapple.'"]
}
    `.trim();

    try {
        // Using a more capable model for summarization might yield better results.
        const model = 'gemini-2.5-flash-lite'; 
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

        const payload = { contents: [{ parts: [{ text: biblePrompt }] }] };
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            console.error('[StoryBible] API call failed:', await response.text());
            throw new Error('API call for bible creation failed.');
        }

        const result = await response.json();
        const bibleText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!bibleText) {
            throw new Error('No text returned for bible creation.');
        }

        const cleanedJsonText = bibleText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedJsonText);

    } catch (error) {
        console.error('[StoryBible] Failed to create or parse story bible:', error.message);
        return {
            plot_summary_so_far: "Summary was not available due to an error.",
            character_developments: [],
            key_objects_or_macguffins: [],
            unresolved_plot_threads: [],
            world_building_rules: []
        };
    }
};

/**
 * A general-purpose function for calling the Gemini API.
 * This is intended for use by new modules that require direct API interaction.
 * @param {string} prompt The text prompt to send to the Gemini API.
 * @param {string} [model='gemini-2.5-flash-lite'] The Gemini model to use.
 * @param {Array<object>} [safetySettings=[]] Optional safety settings to override defaults.
 * @returns {Promise<string>} The raw text response from the API.
 */
export const callGeminiAPI = async (prompt, model = 'gemini-2.5-flash-lite', safetySettings = []) => {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set in .env');
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: safetySettings.length > 0 ? safetySettings : [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
        ]
    };

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 90000); // 90-second timeout

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        clearTimeout(id);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Gemini API raw error response: ${errorText}`);
            throw new Error(`Gemini API error: ${errorText}`);
        }

        const result = await response.json();
        let generatedText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            if (result?.candidates?.[0]?.finishReason === 'SAFETY') {
                console.error("Gemini content blocked due to safety settings.", result.promptFeedback);
                throw new Error('The generated content was blocked for safety reasons. Please adjust your prompt.');
            }
            console.error("Gemini API response missing text or invalid structure:", JSON.stringify(result, null, 2));
            throw new Error('Invalid response structure from Gemini API. No text found.');
        }

        return generatedText;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            console.error('Gemini API request timed out:', error.message);
            throw new Error('Gemini API request timed out. Please try again.');
        }
        throw error;
    }
};

/**
 * NEW HELPER FUNCTION: This function now builds a cleaner prompt
 * @param {object} promptData - All the necessary data to build the prompt.
 * @returns {string} The fully formatted and structured prompt string.
 */
export const formatChapterPrompt = ({ promptDetails, storyBible, chapterNumber, totalChapters, wordCountTarget, userGuidance, chapterPlan }) => {
    // Destructure promptData for easier access
    const {
        bookTitle, mainCharacter, sidekick, genre, subGenre, tone, moral, insideJoke, setting, interests
    } = promptDetails;

    const formatBibleEntry = (entry, separator = ', ') => (entry && entry.length > 0) ? entry.join(separator) : 'None established yet.';
    const formatCharacterDevs = (devs) => (devs && devs.length > 0) ? devs.map(d => `${d.character}: ${d.development}`).join('; ') : 'None established yet.';

    let chapterInstruction = '';
    let conclusionInstruction = '';
    if (chapterNumber === totalChapters) {
        chapterInstruction = `- This is the FINAL chapter. Conclude the story in a satisfying and definitive manner.`;
        conclusionInstruction = `- The story MUST conclude in this chapter.`;
    } else {
        chapterInstruction = `- This is a middle chapter. Do NOT conclude the story. End with a compelling cliffhanger or a clear indication that the narrative continues.`;
        conclusionInstruction = `- The story MUST NOT conclude in this chapter.`;
    }
    
    // Format the beats from the plan into a readable list for the prompt
    const beatsList = chapterPlan.chapter_plan.map((beat, index) => `${index + 1}. ${beat.summary}`).join('\n');

    return `
***
# INSTRUCTIONS
- You are an expert novelist and story architect. Your task is to write a single chapter for a personalized novel.
- Adhere strictly to the story elements and progression provided in the CONTEXT section.
- Write in a style and tone that is professional, engaging, and consistent with the PROMPT DETAILS and STORY PROGRESS.
- Do NOT include any titles, chapter headings, or meta commentary in your output.

***
# PROMPT DETAILS
- **Book Title**: "${bookTitle || 'A Personalized Tale'}"
- **Genre**: ${genre || 'literary fiction'} (${subGenre || 'general fiction'})
- **Tone**: ${tone || 'whimsical and lighthearted'}.
- **Protagonist**: "${mainCharacter?.name || 'the protagonist'}"
  - Appearance: ${mainCharacter?.appearance || 'No specific appearance.'}
  - Personality: ${mainCharacter?.trait || 'No specific personality trait.'}
- **Protagonist's Goal**: The protagonist's goal and motivation are based on the initial prompt. Every chapter must move them toward this goal.
- **Sidekick**: ${sidekick?.name ? `The protagonist has a sidekick named ${sidekick.name}, a ${sidekick.type || 'companion'} with a personality of ${sidekick.trait || 'loyal and helpful'}.` : 'No sidekick.'}
- **Setting & Key Interests**: ${setting?.location || interests ? `The story is set in ${setting.location || 'a place inspired by these interests'}: ${interests}` : 'No specific setting or interests.'}
- **Moral or Inside Joke**: ${moral || insideJoke ? `The story must incorporate the following element: ${moral || insideJoke}` : 'No specific moral or joke.'}

***
# STORY PROGRESSION (from Story Bible)
- **Plot Summary So Far**: ${storyBible.plot_summary_so_far}
- **Character Developments**: ${formatCharacterDevs(storyBible.character_developments)}
- **Important Objects**: ${formatBibleEntry(storyBible.key_objects_or_macguffins)}
- **Unresolved Plot Threads**: ${formatBibleEntry(storyBible.unresolved_plot_threads, '; ')}
- **World Rules Established**: ${formatBibleEntry(storyBible.world_building_rules, '; ')}

***
# CHAPTER PLAN
- Use this plan to write the chapter:
${beatsList}

***
# CHAPTER INSTRUCTIONS
- This is Chapter ${chapterNumber} of ${totalChapters}.
- **Target Word Count**: as close as possible to ${Math.round(wordCountTarget)} words.
- **Pacing**: Focus on developing the single major conflict or discovery outlined in the beats. Build suspense and detail the unfolding of one scene.
- **Consistency**: Ensure all character traits, world rules, and plot points are consistent with previous chapters.
- **User Guidance**: ${userGuidance || 'No specific guidance provided.'}
${chapterInstruction}
${conclusionInstruction}

***
# OUTPUT
- **Output ONLY the chapter prose.**
- **Start immediately with the story text, flowing from previous events.**
- **Do NOT include any chapter headings or meta commentary.**

`.trim();
};

export const generateStoryFromApi = async (promptDetails, guidance = '', chapterPlan = { chapter_plan: [] }) => {
    const {
        wordsPerPage, totalChapters, previousChaptersText = '', chapterNumber, maxPageCount, wordTarget
    } = promptDetails;

    const sanitizedPreviousChaptersText = previousChaptersText.replace(/\[[^\]]*?\]/g, '').replace(/\s+/g, ' ').trim();
    console.log('[Gemini Service] Creating Story Bible for context...');
    const storyBible = await createStoryBible(sanitizedPreviousChaptersText);

    if (!wordsPerPage || !totalChapters || !maxPageCount) {
        throw new Error('wordsPerPage, totalChapters, and maxPageCount are required for story generation.');
    }

    const availableContentPages = Math.max(0, maxPageCount - 4);
    const totalContentWordsBudget = availableContentPages * wordsPerPage;
    const previousWordsCount = sanitizedPreviousChaptersText.split(' ').filter(word => word.length > 0).length;
    const remainingBudget = totalContentWordsBudget - previousWordsCount;
    const remainingChapters = Math.max(1, totalChapters - chapterNumber + 1);
    let rawTarget = remainingBudget / remainingChapters;
    const MIN_CHAPTER_WORDS = wordTarget?.min || 800;
    const MAX_CHAPTER_WORDS = wordTarget?.max || 1200;
    let finalTargetChapterWordCount = Math.min(Math.max(rawTarget, MIN_CHAPTER_WORDS), MAX_CHAPTER_WORDS);

    if (remainingBudget < 0 || isNaN(rawTarget)) {
        console.warn(`[Gemini Service] Warning: Chapter ${chapterNumber}: Negative remaining budget. Defaulting to MIN_CHAPTER_WORDS.`);
        finalTargetChapterWordCount = MIN_CHAPTER_WORDS;
    }

    console.log(`[Gemini Service] Chapter ${chapterNumber} Budgeting:`);
    console.log(` - Total Content Words Budget: ${totalContentWordsBudget}`);
    console.log(` - Previous Chapters Word Count (sanitized): ${previousWordsCount}`);
    console.log(` - Remaining Budget: ${remainingBudget}`);
    console.log(` - Remaining Chapters: ${remainingChapters}`);
    console.log(` - Raw Target per Chapter: ${Math.round(rawTarget)}`);
    console.log(` - Final Target Chapter Word Count (clamped ${MIN_CHAPTER_WORDS}-${MAX_CHAPTER_WORDS}): ${Math.round(finalTargetChapterWordCount)} words.`);

    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set in .env');
    }

    const prompt = formatChapterPrompt({
        promptDetails,
        storyBible,
        chapterNumber,
        totalChapters,
        wordCountTarget: finalTargetChapterWordCount,
        userGuidance: guidance,
        chapterPlan,
        sanitizedPreviousChaptersText: sanitizedPreviousChaptersText
    });
    
    // --- DIAGNOSTIC LOG ADDED ---
    // This will print the entire final prompt to the console.
    console.log('--- FINAL PROMPT SENT TO GEMINI API ---');
    console.log(prompt);
    console.log('--------------------------------------');
    // --- END OF DIAGNOSTIC LOG ---

    const rawResponse = await callGeminiAPI(prompt);
    
    let chapterText = rawResponse.replace(/\[[^\]]*?\]/g, '').trim();
    chapterText = chapterText.replace(/^\s*Chapter\s+\d+[:.]?\s*$/gim, '').trim();
    chapterText = chapterText.replace(/^\s*(The End|Epilogue)\s*$/gim, '').trim();

    const words = chapterText.split(/\s+/).filter(word => word.length > 0);
    console.log(`Chapter ${chapterNumber} generated with ~${words.length} words (target: ${Math.round(finalTargetChapterWordCount)}).`);

    return chapterText.trim();
};