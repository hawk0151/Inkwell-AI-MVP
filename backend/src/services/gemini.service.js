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
        maxPageCount // This is the maximum pages the *entire book* can have
    } = promptDetails;

    if (!wordsPerPage || !totalChapters || !maxPageCount) {
        throw new Error('wordsPerPage, totalChapters, and maxPageCount are required for story generation.');
    }

    // --- MODIFIED: Corrected the target chapter word count calculation ---
    // The previous logic was causing the AI to target the *total book word count* per chapter.
    // We want the AI to target wordsPerPage *for the content it generates for *this* chapter*.
    // Since each chapter should conceptually fill multiple pages, we can aim for a multiple of wordsPerPage.
    // Let's aim for 2-3 pages per chapter on average if not the final chapter, to distribute content.
    // However, the most direct interpretation of "words per page" is for one conceptual page.
    // For now, let's make the target for *this chapter* a reasonable multiple of wordsPerPage
    // or simply wordsPerPage, and let PDFKit handle wrapping.
    // A better approach is to guide it toward a sensible chapter length.

    // Let's assume an average chapter should fill roughly 4-6 pages for a multi-chapter book.
    // This value can be tuned. For a novella, 5 pages * 250 words/page = 1250 words per chapter.
    // totalChapters / maxPageCount suggests the distribution.
    const approximatePagesPerChapter = Math.floor((maxPageCount - 4) / totalChapters); // Subtract safety buffer
    // Ensure a minimum reasonable chapter length, e.g., 2 pages worth
    const targetChapterWordCount = Math.max(wordsPerPage * 2, wordsPerPage * approximatePagesPerChapter);
    
    // Fallback if calculated targetChapterWordCount is too low (e.g., for very short books or many chapters)
    const minChapterWords = 800; // Ensure chapters are not too short.
    const finalTargetChapterWordCount = Math.max(targetChapterWordCount, minChapterWords);

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

    const prompt = `
    ROLE: You are a professional novelist writing a continuous, multi-chapter story for a children's personalized book. Adherence to length constraints is critical.

    PREVIOUS CHAPTERS (for context only):
    ${previousChaptersText}
    
    TASK: Write ONLY chapter ${chapterNumber} of a story for a reader named ${recipientName}.

    STORY DETAILS:
    - Main Character: ${characterName}
    - Themes & Interests: ${interests}
    - Genre: ${genre}
    
    REQUIREMENTS:
    - **STRICT LENGTH CONSTRAINT**: The generated text for this chapter MUST be **as close as possible to ${finalTargetChapterWordCount} words**. This is a hard technical limit to ensure the final book fits within the page count of the physical product. Do not go significantly over this word count.
    - ${chapterInstruction}
    - ${conclusionInstruction}
    - **DO NOT** write "The End" or any similar concluding phrases.
    - **DO NOT** include any titles or chapter headings like "Chapter ${chapterNumber}".
    - Continue the story seamlessly from the "PREVIOUS CHAPTERS".
    - Begin immediately with the story text for chapter ${chapterNumber}.
    
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