"use client";

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

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
                setSubmitMessage(response.data.message || 'Message sent successfully!');
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
                setSubmitMessage('Server error. Please try again later.');
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen flex flex-col bg-cream dark:bg-[#121212] text-black dark:text-[#e0e0e0] transition-colors duration-300 relative font-mono">
            {/* Back to main page link */}
            <div className="absolute top-12 left-16 z-10">
                <Link 
                    href="/" 
                    className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 group"
                >
                    <svg className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span className="font-mono">Back to main page</span>
                </Link>
            </div>

            {/* Subtle horizontal line under header area */}
            <div className="absolute top-[90px] left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-neutral-800 to-transparent opacity-60"></div>

            {/* Decorative vertical lines for framing */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gray-200 dark:via-neutral-800 to-transparent opacity-40"></div>
            <div className="absolute right-8 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gray-200 dark:via-neutral-800 to-transparent opacity-40"></div>

            {/* Main content area - positioned at 45% from top */}
            <div className="flex items-start justify-center px-4 pt-[calc(45vh-250px)] min-h-screen">
                <div className="w-full max-w-md mx-auto relative animate-fadeInUp">
                    <h2 className="text-xl font-bold mb-2 text-center text-gray-900 dark:text-white">Get in Touch</h2>
                    <p className="text-gray-600 dark:text-gray-400 text-center mb-6 text-sm">
                        Questions, feedback, or feature ideas? Let us know.
                    </p>

                    {submitMessage && (
                        <div className={`mb-4 p-3 rounded border text-sm text-center animate-fadeIn ${isSuccess
                            ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                            : 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
                            }`}>
                            {submitMessage}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div>
                            <label htmlFor="fullName" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                Full Name
                            </label>
                            <input
                                id="fullName"
                                type="text"
                                placeholder="Enter your full name"
                                className="rounded border border-gray-300 dark:border-[#333] bg-cream dark:bg-[#1e1e1e] text-gray-900 dark:text-white px-4 py-2.5 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 w-full transition-all duration-200"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                required
                                disabled={isSubmitting}
                                aria-label="Full name"
                            />
                        </div>
                        <div>
                            <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                placeholder="your@email.com"
                                className="rounded border border-gray-300 dark:border-[#333] bg-cream dark:bg-[#1e1e1e] text-gray-900 dark:text-white px-4 py-2.5 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 w-full transition-all duration-200"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                disabled={isSubmitting}
                                aria-label="Email"
                            />
                        </div>
                        <div>
                            <label htmlFor="message" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                Message
                            </label>
                            <textarea
                                id="message"
                                placeholder="Type your message here..."
                                rows={5}
                                className="rounded border border-gray-300 dark:border-[#333] bg-cream dark:bg-[#1e1e1e] text-gray-900 dark:text-white px-4 py-2.5 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 w-full resize-none transition-all duration-200"
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                required
                                disabled={isSubmitting}
                                aria-label="Message"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold py-2.5 px-4 rounded w-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 focus:ring-offset-[#121212]"
                            aria-label="Send message"
                        >
                            {isSubmitting && (
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            {isSubmitting ? 'Sending...' : 'Send Message'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Footer */}
            <footer className="absolute bottom-4 left-0 right-0 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-600 opacity-60">© 2025 Kairo</p>
            </footer>
        </div>
    );
} 