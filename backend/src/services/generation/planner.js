// backend/src/services/generation/planner.js

/**
 * @fileoverview This module generates a structured story plan or a series of scene-level beats for a chapter.
 * It uses the generic Gemini API service to keep API interaction logic separate and reusable.
 */

import { callGeminiAPI } from '../gemini.service.js';

/**
 * Generates a chapter plan by instructing the Gemini model to act as a story planner.
 * @param {object} promptDetails The user-provided details for the story.
 * @param {object} storyBible A structured summary of the story's progression so far.
 * @returns {Promise<object>} A JSON object representing the chapter plan.
 */
export const generateChapterPlan = async (promptDetails, storyBible) => {
    // --- MODIFICATION: Destructure all custom fields from promptDetails ---
    // This ensures the planner has access to the full context of the user's prompt.
    const {
        genre, tone, characterDetails, sidekick, setting, moral, insideJoke, guidance
    } = promptDetails;

    const formatBibleEntry = (entry, separator = ', ') => (entry && entry.length > 0) ? entry.join(separator) : 'None established yet.';
    const formatCharacterDevs = (devs) => (devs && devs.length > 0) ? devs.map(d => `${d.character}: ${d.development}`).join('; ') : 'None established yet.';

    const characterName = characterDetails?.name || 'the protagonist';
    const userGuidanceInstruction = guidance ? `\n- **GUIDANCE**: Adhere to the following specific instructions for this chapter plan: "${guidance}"` : '';

    // --- MODIFICATION: The planner prompt is now richer with all user details. ---
    // This is the core fix for this file, making the generated plan non-generic.
    const plannerPrompt = `
You are a master story planner. Your task is to generate a detailed, structured plan for the next chapter of a story.

**Instructions:**
1.  **Read the provided story context.** Pay close attention to all details to ensure consistency.
2.  **Create a plan for the next chapter only.** The plan should consist of 3-5 distinct beats.
3.  **For each beat, provide a brief summary.** Each summary should describe a key event, a character's action, or a new revelation that moves the story forward.
4.  **Do not write any prose.** Your output must be a concise, structured plan, not a story.
5.  **Strictly use the JSON format provided below.** Do not include any extra text, commentary, or markdown outside of the JSON object itself.

**Story Context:**
-   **Genre & Tone:** ${genre || 'literary fiction'}, with a tone that is ${tone || 'whimsical and lighthearted'}.
-   **Main Character:** The protagonist's name is "${characterName}".
-   **Sidekick:** ${sidekick?.name ? `The protagonist has a sidekick named ${sidekick.name}, who is a ${sidekick.type}.` : 'No sidekick.'}
-   **Setting:** ${setting?.location ? `The story is set primarily in ${setting.location}.` : 'No specific setting.'}
-   **Moral or Inside Joke:** ${moral || insideJoke ? `Incorporate this element: "${moral || insideJoke}"` : 'None.'}
-   **Current Plot:**
    -   Summary So Far: ${storyBible.plot_summary_so_far}
    -   Character Developments: ${formatCharacterDevs(storyBible.character_developments)}
    -   Unresolved Threads: ${formatBibleEntry(storyBible.unresolved_plot_threads, '; ')}
    -   World Rules: ${formatBibleEntry(storyBible.world_building_rules, '; ')}
    ${userGuidanceInstruction}

**JSON Output Format:**
\`\`\`json
{
    "chapter_plan": [
        {
            "beat_number": 1,
            "summary": "The protagonist, ${characterName}, must [a specific action]."
        },
        {
            "beat_number": 2,
            "summary": "This action leads to [a new revelation or conflict]."
        },
        {
            "beat_number": 3,
            "summary": "The chapter ends with a cliffhanger related to [the new revelation or conflict]."
        }
    ]
}
\`\`\`

**Begin writing the chapter plan JSON now, based on the above context.**
`.trim();

    try {
        const rawResponse = await callGeminiAPI(plannerPrompt);
        // Clean up the response to ensure it's valid JSON
        const cleanedJsonText = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedJsonText);
    } catch (error) {
        console.error('[Planner Service] Failed to generate or parse chapter plan:', error.message);
        throw new Error('Failed to generate chapter plan from Gemini API.');
    }
};