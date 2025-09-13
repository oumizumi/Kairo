"use client";

import { useState } from 'react';
import { Orbitron } from 'next/font/google';
import ThemeToggle from '@/components/ThemeToggle';
import api from '@/lib/api';

const orbitron = Orbitron({ subsets: ['latin'], weight: ['700'] });

export default function ContactPage() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitMessage, setSubmitMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        setSubmitMessage('');

        try {
            const response = await api.post('/api/contact/send/', {
                fullName,
                email,
                message
            });

            if (response.status === 200) {
                setIsSuccess(true);
                setSubmitMessage(response.data.message || 'Your message has been sent successfully!');
                // Clear form
                setFullName('');
                setEmail('');
                setMessage('');
            }
        } catch (error: any) {
            setIsSuccess(false);
            if (error.response?.data?.error) {
                setSubmitMessage(error.response.data.error);
            } else if (error.response?.data) {
                // Handle field-specific errors
                const errors = error.response.data;
                const errorMessages = Object.values(errors).flat();
                setSubmitMessage(errorMessages.join(' '));
            } else {
                setSubmitMessage('Failed to send message. Please try again later.');
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#121212] text-black dark:text-[#e0e0e0] transition-colors duration-300 px-4" style={{ fontFamily: 'Monaco, Menlo, "Courier New", monospace' }}>
            <div className="w-full max-w-md mx-auto">
                <div className={`${orbitron.className} text-2xl sm:text-3xl font-extrabold text-black dark:text-white tracking-wide text-center mb-6 select-none`}>
                    KAIRO
                </div>
                <div className="bg-gray-50 dark:bg-neutral-900 p-6 sm:p-8 rounded-xl shadow-xl border border-gray-200 dark:border-neutral-700 w-full transition-colors duration-300">
                    <h2 className="text-2xl font-bold mb-2 text-center text-gray-900 dark:text-white">Get in Touch</h2>
                    <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                        Questions, feedback, or feature ideas? Let us know.
                    </p>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {submitMessage && (
                            <div className={`p-3 rounded border text-sm ${isSuccess
                                ? 'bg-green-50 dark:bg-green-900/50 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200'
                                : 'bg-red-50 dark:bg-red-900/50 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200'
                                }`}>
                                {submitMessage}
                            </div>
                        )}

                        <div>
                            <label htmlFor="fullName" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                                Full Name
                            </label>
                            <input
                                id="fullName"
                                type="text"
                                placeholder="Enter your full name"
                                className="rounded border border-gray-300 dark:border-white/5 bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-[#e0e0e0] px-4 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500 focus:border-transparent w-full transition-colors duration-300"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                        <div>
                            <label htmlFor="email" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                placeholder="Enter your email"
                                className="rounded border border-gray-300 dark:border-white/5 bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-[#e0e0e0] px-4 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500 focus:border-transparent w-full transition-colors duration-300"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                        <div>
                            <label htmlFor="message" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                                Message
                            </label>
                            <textarea
                                id="message"
                                placeholder="Type your message here..."
                                rows={4}
                                className="rounded border border-gray-300 dark:border-white/5 bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-[#e0e0e0] px-4 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500 focus:border-transparent w-full resize-none transition-colors duration-300"
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-gray-900 dark:bg-white text-white dark:text-black font-semibold py-2 px-4 rounded hover:bg-gray-800 dark:hover:bg-neutral-300 w-full transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Sending...' : 'Send Message'}
                        </button>
                    </form>
                </div>
            </div>
            <ThemeToggle />
        </div>
    );
} 