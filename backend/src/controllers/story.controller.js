import { generateStoryFromApi } from '../services/gemini.service.js';

export const generateStory = async (req, res) => {
  try {
    const promptDetails = req.body.promptDetails; // NEW: The frontend now sends data nested under a 'promptDetails' key
    const bookTitle = req.body.title; // NEW: Separated title

    // --- ADDED: A more robust validation check for all new required fields ---
    if (
      !promptDetails ||
      !bookTitle ||
      !promptDetails.characterDetails?.name ||
      !promptDetails.recipientName ||
      !promptDetails.interests ||
      !promptDetails.genre ||
      !promptDetails.pageCount
    ) {
      return res.status(400).json({ message: 'Incomplete story details provided.' });
    }

    // NEW: Pass the bookTitle into the service function
    const story = await generateStoryFromApi({ ...promptDetails, bookTitle });

    res.status(200).json({ story });
  } catch (error) {
    console.error('Error in story controller:', error);
    res.status(500).json({ message: 'Failed to generate story.', error: error.message });
  }
};