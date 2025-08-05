// backend/src/controllers/contact.controller.js
import { sendContactEmail } from '../services/email.service.js';

export const submitContactForm = async (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ message: 'All form fields are required.' });
    }

    try {
        const result = await sendContactEmail(name, email, message);
        
        if (result.success) {
            res.status(200).json({ message: 'Your message has been sent successfully!' });
        } else {
            console.error("Failed to send email with service:", result.error);
            res.status(500).json({ message: 'Failed to send your message. Please try again later.' });
        }
    } catch (error) {
        console.error("Error in contact form controller:", error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
};