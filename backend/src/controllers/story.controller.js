// backend/src/controllers/story.controller.js
import { generateStoryFromApi } from '../services/gemini.service.js';

export const generateStory = async (req, res) => {
  try {
    const promptDetails = req.body;

    if (
      !promptDetails ||
      !promptDetails.characterName ||
      !promptDetails.interests ||
      !promptDetails.genre ||
      !promptDetails.pageCount
    ) {
      return res.status(400).json({ message: 'Incomplete story details provided.' });
    }

    const story = await generateStoryFromApi(promptDetails);

    res.status(200).json({ story });
  } catch (error) {
    console.error('Error in story controller:', error);
    res.status(500).json({ message: 'Failed to generate story.', error: error.message });
  }
};
