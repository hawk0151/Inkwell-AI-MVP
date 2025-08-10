// backend/listModels.js
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Initialize environment variables from .env file
dotenv.config();

async function getAvailableModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("ERROR: GEMINI_API_KEY not found in your .env file.");
        return;
    }

    const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;

    try {
        console.log("Fetching available models from Google AI...");
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("API request failed with status:", response.status);
            console.error("Response:", errorText);
            return;
        }

        const data = await response.json();
        
        console.log("\n--- ✅ SUCCESS! Here are your available models ---");
        if (data.models && data.models.length > 0) {
            data.models.forEach(model => {
                // We only care about models that support the 'generateContent' method
                if (model.supportedGenerationMethods.includes('generateContent')) {
                    console.log(`- Name: ${model.displayName}`);
                    console.log(`  API ID: ${model.name}`);
                    console.log(`  Description: ${model.description.substring(0, 80)}...`);
                    console.log('----------------------------------------------------');
                }
            });
        } else {
            console.log("No models found.");
        }

    } catch (error) {
        console.error("An error occurred while running the script:", error);
    }
}

getAvailableModels();