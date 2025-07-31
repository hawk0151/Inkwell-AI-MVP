// backend/src/services/gemini.service.js
import fetch from 'node-fetch';

export const generateStoryFromApi = async (promptDetails) => {
    const {
        recipientName,
        characterName,
        interests,
        genre,
        pageCount, // Still useful for overall context for AI
        wordsPerPage, // NEW: Use wordsPerPage for target word count
        previousChaptersText = '',
        chapterNumber,
        totalChapters, // NEW: Passed from controller
        isFinalChapter, // NEW: Passed from controller
    } = promptDetails;

    if (!pageCount || !wordsPerPage || !totalChapters) {
        throw new Error('pageCount, wordsPerPage, and totalChapters are required parameters for generating a story.');
    }

    const targetChapterWordCount = Math.floor(pageCount * wordsPerPage / totalChapters); // MODIFIED: Calculate based on book's total pages and desired words/page

    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set in .env');
    }

    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    // --- UPDATED PROMPT WITH DYNAMIC INSTRUCTIONS FOR FINAL CHAPTER ---
    let chapterInstruction = '';
    let conclusionInstruction = '';

    if (isFinalChapter) {
        chapterInstruction = `**CRITICAL**: This is the FINAL chapter (Chapter ${chapterNumber} of ${totalChapters}). Conclude the story in a satisfying and definitive manner, resolving key plot points and character arcs.`;
        conclusionInstruction = `- **MUST CONCLUDE THE STORY**. Provide a clear, satisfying, and definitive ending.`;
    } else {
        chapterInstruction = `**CRITICAL**: This is Chapter ${chapterNumber} of ${totalChapters}. Do NOT conclude the story. End the chapter in a way that makes the reader want to know what happens next.`;
        conclusionInstruction = `- **DO NOT CONCLUDE THE STORY**. End the chapter with a cliffhanger or a clear indication that the narrative continues.`;
    }

    const prompt = `
    ROLE: You are a professional novelist writing a continuous, multi-chapter story for a children's personalized book.

    PREVIOUS CHAPTERS (for context only):
    ${previousChaptersText}
    
    TASK: Write ONLY chapter ${chapterNumber} of a story for a reader named ${recipientName}.

    STORY DETAILS:
    - Main Character: ${characterName}
    - Themes & Interests: ${interests}
    - Genre: ${genre}
    
    REQUIREMENTS:
    - **CRITICAL**: The generated text for this chapter MUST be approximately ${targetChapterWordCount} words.
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
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${errorText}`);
    }

    const result = await response.json();
    let chapterText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!chapterText) {
        throw new Error('Invalid response structure from Gemini API.');
    }
    
    const words = chapterText.trim().split(/\s+/);
    console.log(`Chapter ${chapterNumber} generated with ~${words.length} words (target: ${targetChapterWordCount}).`);

    return chapterText.trim();
};