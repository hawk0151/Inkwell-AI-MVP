// backend/src/services/gemini.service.js

import fetch from 'node-fetch';

export const generateStoryFromApi = async (promptDetails) => {
    const {
        recipientName,
        characterName,
        interests,
        genre,
        wordsPerPage, // This is the target words per *average page*
        previousChaptersText = '',
        chapterNumber,
        totalChapters,
        isFinalChapter,
        maxPageCount
    } = promptDetails;

    if (!wordsPerPage || !totalChapters || !maxPageCount) {
        throw new Error('wordsPerPage, totalChapters, and maxPageCount are required for story generation.');
    }

    // --- MODIFIED: Ensure placeholders are replaced BEFORE sending to AI ---
    // This is crucial. The AI should never see "[Child's name]".
    // For now, let's use a simple placeholder replacement.
    // Ideally, `promptDetails` should include `recipientGender` for accurate pronoun use.
    // For this fix, assuming generic/default pronouns if gender isn't known.
    const pronounThey = "they"; // Default neutral pronoun
    const pronounThem = "them";
    const pronounTheir = "their";
    const pronounHeSheThey = "he/she/they"; // If gender is truly unknown to AI
    const pronounHimHerThem = "him/her/them"; // If gender is truly unknown to AI
    const pronounHisHerTheir = "his/her/their"; // If gender is truly unknown to AI


    // --- CRITICAL: Placeholder substitution directly in the story text ---
    // If previousChaptersText contains these, they need to be substituted too.
    // For now, let's focus on the prompt itself, assuming recipientName is the key.
    // This also highlights that your story template (the prompt string) should use `recipientName`
    // and `characterName` directly, not `[Child's name]` or `[Dad]`.
    // The provided story content also uses these placeholders. If this content is coming
    // from AI, it means the AI is *generating* them.
    // This means the AI isn't understanding its role to *generate* the name, but just repeat.
    // Let's make the prompt explicitly tell it to use the name.

    // Let's refine the prompt and assume the AI needs to be told to use the name directly.
    // The problem might be the AI *generating* the brackets if it sees them in examples.
    // Given the example, it seems the AI is being told to generate placeholders, which is wrong.

    // Let's assume the problem is the AI is re-generating the brackets.
    // The fix involves making the prompt clearer and removing any examples of brackets.
    // And if `previousChaptersText` has `[Child's name]`, it needs to be pre-processed.

    // Let's hardcode a replacement for the *output* of the AI for now,
    // and then guide the prompt to NOT use placeholders.
    // This is a temporary measure if the AI cannot be fully controlled via prompt.

    // Re-evaluating based on your output: "He knows that [child's name] is in danger."
    // This strongly suggests the AI *itself* is putting the brackets in.
    // This means the prompt isn't strong enough.

    // Proposed solution: Remove bracketed examples from the prompt, and ensure it always uses
    // recipientName and characterName *directly*.

    // First, let's ensure the prompt doesn't ask for placeholders.
    // Then, for a robust solution, you might need a post-processing step if AI still outputs them.
    // For now, let's assume the prompt fix is enough.

    // Determine target chapter word count (re-using the logic from previous turn that was correct conceptually)
    const approximatePagesPerChapter = Math.floor((maxPageCount - 4) / totalChapters);
    const targetChapterWordsBasedOnPages = wordsPerPage * Math.max(2, approximatePagesPerChapter); // Aim for at least 2 pages
    const finalTargetChapterWordCount = Math.max(targetChapterWordsBasedOnPages, 800); // Minimum 800 words per chapter

    console.log(`[Gemini Service] Calculated targetChapterWordCount for Chapter ${chapterNumber}: ${finalTargetChapterWordCount} words.`);


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

    // --- MODIFIED: Significantly revised prompt to handle placeholders and emphasize word count ---
    const prompt = `
    ROLE: You are a professional novelist writing a continuous, multi-chapter story for a children's personalized book.
    You MUST replace ALL instances of "[Child's name]", "[him/her/them]", "[his/her/their]" with the actual child's name "${recipientName}" and appropriate pronouns.
    You MUST replace ALL instances of "[Dad]" with the character name "${characterName}".
    Adherence to length constraints is critical.

    PREVIOUS CHAPTERS (for context only - DO NOT REGENERATE):
    ${previousChaptersText.replace(/\[Child's name\]/g, recipientName).replace(/\[him\/her\/them\]/g, pronounHimHerThem).replace(/\[his\/her\/their\]/g, pronounHisHerTheir).replace(/\[Dad\]/g, characterName)}
    
    TASK: Write ONLY chapter ${chapterNumber} of a story for a reader named ${recipientName}.

    STORY DETAILS:
    - Main Character: ${characterName}
    - Child Character: ${recipientName}
    - Themes & Interests: ${interests}
    - Genre: ${genre}
    
    REQUIREMENTS:
    - **STRICT LENGTH CONSTRAINT**: The generated text for this chapter MUST be **as close as possible to ${finalTargetChapterWordCount} words**. This is a hard technical limit to ensure the final book fits within the page count of the physical product. Do not go significantly over this word count. Prioritize story quality and coherence within this limit.
    - ${chapterInstruction}
    - ${conclusionInstruction}
    - **DO NOT** write "The End" or any similar concluding phrases.
    - **DO NOT** include any titles or chapter headings like "Chapter ${chapterNumber}".
    - **ALWAYS** refer to the child character by their actual name: "${recipientName}".
    - **ALWAYS** refer to the "Dad" character by their actual name: "${characterName}".
    - Continue the story seamlessly from the "PREVIOUS CHAPTERS".
    - Begin immediately with the story text for chapter ${chapterNumber}.
    - Ensure fluid narrative progression and character consistency.
    
    Begin writing chapter ${chapterNumber} now.
    `;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ]
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 90000 // Increased timeout for potentially longer responses
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API raw error response: ${errorText}`); // Log raw error for debugging
        throw new Error(`Gemini API error: ${errorText}`);
    }

    const result = await response.json();
    let chapterText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!chapterText) {
        if (result?.candidates?.[0]?.finishReason === 'SAFETY') {
            console.error("Gemini content blocked due to safety settings.", result.promptFeedback);
            throw new Error('The generated content was blocked for safety reasons. Please adjust your prompt.');
        }
        console.error("Gemini API response missing chapter text:", JSON.stringify(result, null, 2)); // Log full result for debugging
        throw new Error('Invalid response structure from Gemini API. No chapter text found.');
    }
    
    const words = chapterText.trim().split(/\s+/);
    console.log(`Chapter ${chapterNumber} generated with ~${words.length} words (target: ${finalTargetChapterWordCount}).`);

    return chapterText.trim();
};