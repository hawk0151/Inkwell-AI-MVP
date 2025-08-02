import fetch from 'node-fetch';

export const generateStoryFromApi = async (promptDetails) => {
    const {
        recipientName,
        characterName,
        interests,
        genre,
        wordsPerPage,
        previousChaptersText = '',
        chapterNumber,
        totalChapters,
        isFinalChapter,
        maxPageCount
    } = promptDetails;

    if (!wordsPerPage || !totalChapters || !maxPageCount) {
        throw new Error('wordsPerPage, totalChapters, and maxPageCount are required for story generation.');
    }

    const safePageTarget = maxPageCount - 4;
    const targetTotalWordCount = safePageTarget * wordsPerPage;
    const targetChapterWordCount = Math.floor(targetTotalWordCount / totalChapters);

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
    - **STRICT LENGTH CONSTRAINT**: The generated text for this chapter MUST be **as close as possible to ${targetChapterWordCount} words**. This is a hard technical limit to ensure the final book fits within the page count of the physical product. Do not go significantly over this word count.
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
            // --- FIXED: Corrected typo from "EXPLICENT" to "EXPLICIT" ---
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ]
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
        if (result?.candidates?.[0]?.finishReason === 'SAFETY') {
            console.error("Gemini content blocked due to safety settings.", result.promptFeedback);
            throw new Error('The generated content was blocked for safety reasons. Please adjust your prompt.');
        }
        throw new Error('Invalid response structure from Gemini API.');
    }
    
    const words = chapterText.trim().split(/\s+/);
    console.log(`Chapter ${chapterNumber} generated with ~${words.length} words (target: ${targetChapterWordCount}).`);

    return chapterText.trim();
};