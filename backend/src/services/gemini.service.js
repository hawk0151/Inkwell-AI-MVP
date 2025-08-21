/**
 * @fileoverview This file provides a centralized service for interacting with the Gemini API.
 * It contains functions for generating story content, creating a story bible, and planning chapters.
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

const sanitizeText = (text) => {
    if (!text) return '';
    let sanitized = text.replace(/\[[^\]]*?\]/g, '').trim();
    sanitized = sanitized.replace(/^\s*Chapter\s+\d+[:.]?\s*$/gim, '').trim();
    sanitized = sanitized.replace(/^\s*(The End|Epilogue)\s*$/gim, '').trim();
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    return sanitized;
};

/**
 * A general-purpose function for calling the Gemini API.
 * @param {string} prompt The text prompt to send to the Gemini API.
 * @param {string} [model='gemini-1.5-flash-latest'] The Gemini model to use.
 * @param {Array<object>} [safetySettings=[]] Optional safety settings to override defaults.
 * @param {object} [generationConfig={}] Optional generation config, e.g., for JSON mode.
 * @returns {Promise<string>} The raw text response from the API.
 */
export const callGeminiAPI = async (prompt, model = 'gemini-1.5-flash-latest', safetySettings = [], generationConfig = {}) => {
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
        ],
        generationConfig,
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
 * Creates a structured story bible from previous chapters of a story.
 * @param {string} previousChaptersText The text of the story's previous chapters.
 * @param {string} [model='gemini-1.5-pro-latest'] The model to use for bible creation.
 * @returns {Promise<object>} A JSON object containing key story details.
 */
export const createStoryBible = async (previousChaptersText, model = 'gemini-1.5-pro-latest') => {
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
You are a meticulous story editor. Read the following story text and extract ONLY the following key details in a concise, structured JSON format. Your output will be parsed directly as JSON. Do not add any conversational text or markdown formatting.

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
        const bibleText = await callGeminiAPI(biblePrompt, model, [], { responseMimeType: "application/json" });
        return JSON.parse(bibleText);
    } catch (error) {
        console.error('[StoryBible] Failed to create or parse story bible:', error.message);
        throw new Error(`Story Bible creation failed: ${error.message}`);
    }
};

/**
 * Creates a 3-beat chapter plan for the final chapter to ensure a satisfying conclusion.
 * @param {object} storyBible The story bible containing unresolved plot threads.
 * @returns {Promise<object>} A JSON object with a "chapter_plan" array.
 */
export const createChapterPlan = async (storyBible) => {
    const threads = storyBible.unresolved_plot_threads.join('; ') || 'all remaining mysteries';
    const planPrompt = `
You are a master story planner. Based on the following unresolved plot threads, create a simple 3-beat chapter plan for a satisfying final chapter. The plan must ensure all mysteries are solved.

UNRESOLVED THREADS: ${threads}

Output a JSON object with a single key "chapter_plan" which is an array of objects, each with a "summary" key. Do not add any other text or markdown.

Example Format:
{
  "chapter_plan": [
    { "summary": "Beat 1: The final confrontation with the antagonist where their motives are revealed." },
    { "summary": "Beat 2: The protagonist uses their knowledge to overcome the final obstacle, resolving the central conflict." },
    { "summary": "Beat 3: A brief epilogue showing the characters in their new reality, reflecting on the events and their growth." }
  ]
}
    `.trim();

    try {
        const planText = await callGeminiAPI(planPrompt, 'gemini-1.5-flash-latest', [], { responseMimeType: "application/json" });
        return JSON.parse(planText);
    } catch (error) {
        console.error('[ChapterPlan] Failed to create or parse chapter plan:', error.message);
        throw new Error(`Chapter plan creation failed: ${error.message}`);
    }
};


// --- PROMPT BUILDER HELPER FUNCTIONS ---

const buildInstructionsSection = () => `
***
# INSTRUCTIONS
- You are an expert novelist and story architect. Your task is to write a single chapter for a personalized novel.
- Adhere strictly to the story elements and progression provided in the CONTEXT section.
- Write in a style and tone that is professional, engaging, and consistent with the PROMPT DETAILS and STORY PROGRESS.
- Do NOT include any titles, chapter headings, or meta commentary in your output.
***
`.trim();

const buildDetailsSection = ({ bookTitle, mainCharacter, sidekick, genre, subGenre, tone, moral, insideJoke, setting, interests, inclusion }) => {
    const friends = inclusion?.friends || [];
    let friendsString = 'No other friends or family specified.';
    if (friends.length > 0) {
        friendsString = friends.map(f => `${f.name} (${f.type}): ${f.trait}`).join('; ');
    }

    return `
# PROMPT DETAILS
- **Book Title**: "${bookTitle || 'A Personalized Tale'}"
- **Genre**: ${genre || 'literary fiction'} (${subGenre || 'general fiction'})
- **Tone**: ${tone || 'whimsical and lighthearted'}.
- **Protagonist**: "${mainCharacter?.name || 'the protagonist'}"
  - Appearance: ${mainCharacter?.appearance || 'No specific appearance.'}
  - Personality: ${mainCharacter?.trait || 'No specific personality trait.'}
- **Protagonist's Goal**: The protagonist's goal and motivation are based on the initial prompt. Every chapter must move them toward this goal.
- **Sidekick**: ${sidekick?.name ? `The protagonist has a sidekick named ${sidekick.name}, a ${sidekick.type || 'companion'} with a personality of ${sidekick.trait || 'loyal and helpful'}.` : 'No sidekick.'}
- **Other Characters**: ${friendsString}
- **Setting & Key Interests**: ${setting?.location || interests ? `The story is set in ${setting.location || 'a place inspired by these interests'}: ${interests}` : 'No specific setting or interests.'}
- **Moral or Inside Joke**: ${moral || insideJoke ? `The story must incorporate the following element: ${moral || insideJoke}` : 'No specific moral or joke.'}
***
`.trim();
};

const buildBibleSection = (storyBible) => {
    const formatBibleEntry = (entry, separator = ', ') => (entry && entry.length > 0) ? entry.join(separator) : 'None established yet.';
    const formatCharacterDevs = (devs) => (devs && devs.length > 0) ? devs.map(d => `${d.character}: ${d.development}`).join('; ') : 'None established yet.';

    return `
# STORY PROGRESSION (from Story Bible)
- **Plot Summary So Far**: ${storyBible.plot_summary_so_far}
- **Character Developments**: ${formatCharacterDevs(storyBible.character_developments)}
- **Important Objects**: ${formatBibleEntry(storyBible.key_objects_or_macguffins)}
- **Unresolved Plot Threads**: ${formatBibleEntry(storyBible.unresolved_plot_threads, '; ')}
- **World Rules Established**: ${formatBibleEntry(storyBible.world_building_rules, '; ')}
***
`.trim();
};

const buildChapterPlanSection = (chapterPlan) => {
    if (!chapterPlan || !chapterPlan.chapter_plan || chapterPlan.chapter_plan.length === 0) {
        return ''; // Return empty string if there's no plan
    }
    const beatsList = chapterPlan.chapter_plan.map((beat, index) => `${index + 1}. ${beat.summary}`).join('\n');
    return `
# CHAPTER PLAN
- Use this explicit plan to write the chapter:
${beatsList}
***
`.trim();
};

const buildChapterInstructionsSection = ({ storyBible, chapterNumber, totalChapters, wordCountTarget, userGuidance }) => {
    let chapterInstruction = '';
    let conclusionInstruction = '';

    if (chapterNumber === totalChapters) {
        const threadsToResolve = (storyBible.unresolved_plot_threads && storyBible.unresolved_plot_threads.length > 0)
            ? storyBible.unresolved_plot_threads.join('; ')
            : 'all remaining mysteries';

        chapterInstruction = `- This is the FINAL chapter. Conclude the story in a satisfying and definitive manner.`;
        conclusionInstruction = `
- **CRITICAL**: You MUST resolve all major storylines and provide a definitive conclusion.
- Specifically, you MUST address and solve the following unresolved plot threads: "${threadsToResolve}"
- Provide clear answers to the central mysteries and give the protagonist a sense of closure.`;

    } else {
        chapterInstruction = `- This is a middle chapter. Do NOT conclude the story. End with a compelling cliffhanger or a clear indication that the narrative continues.`;
        conclusionInstruction = `- The story MUST NOT conclude in this chapter.`;
    }

    return `
# CHAPTER INSTRUCTIONS
- This is Chapter ${chapterNumber} of ${totalChapters}.
- **Target Word Count**: as close as possible to ${Math.round(wordCountTarget)} words.
- **Pacing**: Focus on developing the single major conflict or discovery outlined in the beats. Build suspense and detail the unfolding of one scene.
- **Consistency**: Ensure all character traits, world rules, and plot points are consistent with previous chapters.
- **User Guidance**: ${userGuidance || 'No specific guidance provided.'}
${chapterInstruction}
${conclusionInstruction}
***
`.trim();
};

const buildOutputSection = () => `
# OUTPUT
- **Output ONLY the chapter prose.**
- **Start immediately with the story text, flowing from previous events.**
- **Do NOT include any chapter headings or meta commentary.**
`.trim();


/**
 * This function now builds a cleaner prompt by assembling modular sections.
 * @param {object} promptData - All the necessary data to build the prompt.
 * @returns {string} The fully formatted and structured prompt string.
 */
export const formatChapterPrompt = (promptData) => {
    const sections = [
        buildInstructionsSection(),
        buildDetailsSection(promptData.promptDetails),
        buildBibleSection(promptData.storyBible),
        buildChapterPlanSection(promptData.chapterPlan),
        buildChapterInstructionsSection(promptData),
        buildOutputSection()
    ];
    return sections.filter(Boolean).join('\n').trim(); // filter(Boolean) removes empty sections
};

export const generateStoryFromApi = async (promptDetails, guidance = '', safetySettings = []) => {
    const {
        wordsPerPage, totalChapters, previousChaptersText = '', chapterNumber, maxPageCount, wordTarget
    } = promptDetails;

    const sanitizedPreviousChaptersText = sanitizeText(previousChaptersText);
    console.log('[Gemini Service] Creating Story Bible for context...');
    const storyBible = await createStoryBible(sanitizedPreviousChaptersText);

    let chapterPlan = { chapter_plan: [] }; // Default empty plan

    if (chapterNumber === totalChapters) {
        console.log('[Gemini Service] Generating conclusive chapter plan for the final chapter...');
        try {
            chapterPlan = await createChapterPlan(storyBible);
        } catch (e) {
            console.error('[Gemini Service] Failed to generate conclusive chapter plan, proceeding without one.', e.message);
            // The process can continue, but the ending might be weak as a fallback.
        }
    }

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
    });
    
    // --- DIAGNOSTIC LOG ADDED ---
    // This will print the entire final prompt to the console.
    console.log('--- FINAL PROMPT SENT TO GEMINI API ---');
    console.log(prompt);
    console.log('--------------------------------------');
    // --- END OF DIAGNOSTIC LOG ---

    const rawResponse = await callGeminiAPI(prompt, 'gemini-1.5-flash-latest', safetySettings);
    
    const chapterText = sanitizeText(rawResponse);

    const words = chapterText.split(/\s+/).filter(word => word.length > 0);
    console.log(`Chapter ${chapterNumber} generated with ~${words.length} words (target: ${Math.round(finalTargetChapterWordCount)}).`);

    return chapterText.trim();
};
/**
 * Takes a user's picture book character description and distills it into
 * clean, visual-only keywords for an image generation model.
 * @param {string} description The raw character description from the user.
 * @returns {Promise<string>} A comma-separated string of visual keywords.
 */
export const getVisualKeywordsFromDescription = async (description) => {
    console.log(`[Gemini] Distilling visual keywords for picture book character...`);
    const masterPrompt = `
        You are an expert prompt engineer's assistant for children's book illustrations.
        Analyze the following character description and extract ONLY the key visual, physical attributes.
        - IGNORE non-visual traits (like personality, conditions, names, or feelings).
        - CONVERT possessions into actions (e.g., "loves his teddy bear" becomes "holding a one-eyed teddy bear").
        - The output MUST be a clean, comma-separated list of keywords suitable for an AI image generator.
        - DO NOT use any conversational text or labels.

        Example Input: "Leo is a brave 5-year-old lion cub with a fluffy mane and a scar over his left eye. He is adventurous and kind."
        Example Output: 5-year-old lion cub, fluffy mane, scar over left eye

        User's Description: "${description}"

        Keywords:
    `.trim();

    try {
        // We use the general-purpose callGeminiAPI function you already have.
        const keywords = await callGeminiAPI(masterPrompt);
        const cleanedKeywords = keywords.replace(/Keywords:/gi, '').trim();
        console.log(`[Gemini] ✅ Distilled keywords: ${cleanedKeywords}`);
        return cleanedKeywords;
    } catch (error) {
        console.error("[Gemini] Error distilling keywords:", error);
        // Fallback to the original description if Gemini fails, so the app doesn't crash.
        return description; 
    }
};

/**
 * Transforms a user's description into a highly detailed and structured prompt,
 * dynamically incorporating the user's selected art style.
 * @param {string} description The raw character description from the user.
 * @param {string} artStyle The user's selected art style (e.g., 'digital-art').
 * @returns {Promise<string>} A detailed, style-aware prompt for Stability AI.
 */
export const createStyleAwareStabilityPrompt = async (description, artStyle) => {
    console.log(`[Gemini] Creating style-aware Stability AI prompt with style: ${artStyle}...`);
    const masterPrompt = `
        You are an expert AI prompt engineer for a children's book illustrator.
        Your task is to convert a simple user description into a detailed, powerful, and structured prompt for the Stability AI model, strictly adhering to a specific art style.

        **User's Description:** "${description}"
        **Required Art Style:** "${artStyle}"

        **Instructions:**
        1.  Create a prompt that is a single block of text with concepts separated by commas.
        2.  The prompt's primary focus MUST be the specified **Art Style**.
        3.  It MUST describe a 'character design sheet' or 'concept art' of a single, solo character on a plain white background.
        4.  It must incorporate all key visual details from the user's description.
        5.  DO NOT use photorealistic, 8k, or cinematic keywords. The style must match the user's selection.

        **Example for artStyle='anime'**: "anime character design sheet, concept art, of a 3-year-old boy with brown hair and blue eyes, solo character, full body portrait, plain white background, clean line art, cell shading."

        **Example for artStyle='fantasy-art'**: "fantasy art character concept sheet, of a 3-year-old boy with brown hair and blue eyes, full body portrait, plain white background, painterly style, detailed."

        Now, create the perfect prompt based on the user's description and the required art style.
    `.trim();

    try {
        const stabilityPrompt = await callGeminiAPI(masterPrompt);
        console.log(`[Gemini] ✅ Created new style-aware Stability AI prompt.`);
        return stabilityPrompt.replace(/\s+/g, ' ').trim();
    } catch (error) {
        console.error("[Gemini] Error creating style-aware Stability AI prompt:", error);
        // Fallback to a basic prompt structure if Gemini fails
        return `character sheet, in the style of ${artStyle}, concept art of ${description}, full body portrait, plain white background.`;
    }
};