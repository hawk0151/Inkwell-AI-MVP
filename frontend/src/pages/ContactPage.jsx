// frontend/src/pages/ContactPage.jsx
import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import apiClient from '../services/apiClient';
import { motion } from 'framer-motion';
import PageHeader from '../components/PageHeader';
import { Alert, LoadingSpinner } from '../components/common.jsx';

// Function to send the contact form data to our new backend endpoint
const sendContactMessage = (formData) => apiClient.post('/contact', formData);

function ContactPage() {
    const [formData, setFormData] = useState({ name: '', email: '', message: '' });
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [submissionError, setSubmissionError] = useState(null);

    const mutation = useMutation({
        mutationFn: sendContactMessage,
        onSuccess: () => {
            setIsSubmitted(true);
            setSubmissionError(null);
            setFormData({ name: '', email: '', message: '' }); // Clear the form
        },
        onError: (err) => {
            console.error("Contact form submission failed:", err);
            setSubmissionError("Failed to send your message. Please try again.");
            setIsSubmitted(false);
        },
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => ({ ...prevData, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    const isSubmitting = mutation.isPending;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="max-w-xl mx-auto py-12 px-4 sm:px-6 lg:px-8"
        >
            <PageHeader
                title="Contact Us"
                subtitle="Have a question or feedback? We'd love to hear from you."
            />
            
            {isSubmitted && (
                <Alert type="success" title="Message Sent!">
                    Thank you for contacting us. We will get back to you shortly.
                </Alert>
            )}

            {submissionError && (
                <Alert type="error" title="Submission Failed">
                    {submissionError}
                </Alert>
            )}

            {!isSubmitted && (
                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-slate-300">Name</label>
                        <input
                            type="text"
                            name="name"
                            id="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            className="mt-1 block w-full rounded-md bg-slate-800 border-slate-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-300">Email</label>
                        <input
                            type="email"
                            name="email"
                            id="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            className="mt-1 block w-full rounded-md bg-slate-800 border-slate-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="message" className="block text-sm font-medium text-slate-300">Message</label>
                        <textarea
                            name="message"
                            id="message"
                            rows="4"
                            value={formData.message}
                            onChange={handleChange}
                            required
                            className="mt-1 block w-full rounded-md bg-slate-800 border-slate-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        ></textarea>
                    </div>
                    <div>
                        <motion.button
                            type="submit"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            disabled={isSubmitting}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {isSubmitting ? <LoadingSpinner text="Sending..." /> : 'Submit Message'}
                        </motion.button>
                    </div>
                </form>
            )}
        </motion.div>
    );
}

export default ContactPage;