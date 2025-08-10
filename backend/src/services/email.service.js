// backend/src/services/email.service.js
import sgMail from '@sendgrid/mail';

// Set the SendGrid API key from your environment variables.
// This is done once when the application module is first loaded.
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Sends a contact form email using the SendGrid service.
 * @param {string} name - The name of the person submitting the form.
 * @param {string} email - The email address of the person submitting the form.
 * @param {string} message - The message content from the form.
 * @returns {Promise<{success: boolean, error?: string}>} - An object indicating success or failure.
 */
export const sendContactEmail = async (name, email, message) => {
    // Retrieve your verified sender email from environment variables.
    const senderEmail = process.env.SENDER_EMAIL;

    // Check if the sender email is configured. If not, the service cannot proceed.
    if (!senderEmail) {
        console.error("❌ SENDER_EMAIL is not configured in environment variables.");
        return { success: false, error: "Email service is not configured." };
    }

    // Construct the email message object for the SendGrid API.
    const msg = {
        to: senderEmail, // The email is sent TO your support inbox.
        from: senderEmail, // The email is sent FROM your verified SendGrid sender address.
        replyTo: email, // IMPORTANT: When you hit "Reply", it will reply to the user, not yourself.
        subject: `New Contact Form Message from ${name}`,
        // Use HTML for a nicely formatted email body.
        html: `
            <p>You have received a new message from your Inkwell AI contact form.</p>
            <hr>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Message:</strong></p>
            <p>${message}</p>
            <hr>
        `,
    };

    try {
        // Attempt to send the email using the SendGrid client.
        await sgMail.send(msg);
        console.log(`✅ Contact email from ${email} sent successfully via SendGrid.`);
        // Return a success object if the email is sent.
        return { success: true };
    } catch (error) {
        // If an error occurs during sending, log the full error details for debugging.
        // SendGrid provides detailed error responses in the 'response.body'.
        console.error("❌ Error sending email with SendGrid:", error.response?.body || error.message);
        // Return a failure object with the error message.
        return { success: false, error: error.message };
    }
};