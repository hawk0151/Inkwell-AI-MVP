// backend/src/services/image.service.js
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

export const generateImageFromApi = async (prompt, style) => {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    throw new Error("Stability AI API key is not configured in .env file.");
  }

  const engineId = 'stable-diffusion-xl-1024-v1-0';
  const apiUrl = `https://api.stability.ai/v1/generation/${engineId}/text-to-image`;

  const fullPrompt = `A beautiful, whimsical, ${style}-style children's book illustration of: ${prompt}. Clean lines, vibrant pastel colors, storybook setting, safe for all audiences, high detail.`;

  try {
    const response = await axios.post(
      apiUrl,
      {
        text_prompts: [{ text: fullPrompt }],
        cfg_scale: 7,
        height: 1024,
        width: 1024,
        samples: 1,
        steps: 30,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
      }
    );

    const image = response.data.artifacts[0];
    if (image && image.base64) {
      return image.base64;
    } else {
      throw new Error('Failed to parse image from Stability AI API response.');
    }
  } catch (error) {
    const errorMessage = error.response ? error.response.data.message : error.message;
    console.error('Error calling Stability AI API:', errorMessage);
    throw new Error('An error occurred while generating the image.');
  }
};

export const uploadImageToCloudinary = (fileBuffer, folder) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({
        resource_type: 'image',
        folder: folder
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result.secure_url);
      }
    ).end(fileBuffer);
  });
};
