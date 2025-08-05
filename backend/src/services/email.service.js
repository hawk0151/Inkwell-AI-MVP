// backend/src/services/email.service.js
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export const sendContactEmail = async (name, email, message) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.CONTACT_FORM_RECIPIENT,
            subject: `New Contact Form Submission from ${name}`,
            html: `
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Message:</strong></p>
                <p>${message}</p>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent successfully from ${email} to ${process.env.CONTACT_FORM_RECIPIENT}.`);
        return { success: true };
    } catch (error) {
        console.error("❌ Failed to send contact email:", error);
        return { success: false, error: error.message };
    }
};