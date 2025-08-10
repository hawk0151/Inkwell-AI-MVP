// backend/src/utils/prompt.util.js

const FORBIDDEN_WORDS = [
    "hate speech",
    "extreme violence",
    "gory",
    "murder",
    "sexual content",
    "explicit",
    // Adding examples of copyrighted terms to the list
    "michael jordan",
    "star wars",
    "harry potter",
    "marvel comics",
    "star trek",
];

/**
 * Checks a user's prompt for forbidden content, including hate speech,
 * extreme violence, and potential copyright infringement.
 * @param {object} promptData - The user-submitted prompt data.
 * @returns {object} An object with a 'valid' boolean and a 'message' string.
 */
export const validatePrompt = (promptData) => {
    const combinedPromptText = `${promptData.bookTitle || ''} ${promptData.genre || ''} ${promptData.description || ''}`.toLowerCase();

    // Check for copyrighted names/themes
    for (const name of ["michael jordan", "star wars", "harry potter", "marvel comics", "star trek"]) {
        if (combinedPromptText.includes(name)) {
            return {
                valid: false,
                message: "This prompt contains copyrighted material. Please use your own original characters and ideas."
            };
        }
    }

    // Check for hate speech and extreme violence
    for (const word of FORBIDDEN_WORDS) {
        if (combinedPromptText.includes(word)) {
            return {
                valid: false,
                message: "This prompt contains content that violates our community guidelines. Please avoid themes of hate speech or extreme violence."
            };
        }
    }

    // If all checks pass, the prompt is valid
    return { valid: true, message: "Prompt is valid." };
};
