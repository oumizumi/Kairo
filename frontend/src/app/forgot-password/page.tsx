"use client";

import React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { Orbitron } from 'next/font/google';
import api from '@/lib/api';

const orbitron = Orbitron({ subsets: ['latin'], weight: ['700'] });

export default function ForgotPasswordPage(): React.JSX.Element {
    const [email, setEmail] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            await api.post('/api/password-reset/', { email });
            setIsSubmitted(true);
        } catch (error: any) {
            console.error('Password reset error:', error);
            if (error.response?.status === 400) {
                setError('Please enter a valid email address.');
            } else if (error.response?.status === 404) {
                setError('No account found with this email address.');
            } else {
                setError('An error occurred. Please try again later.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="font-mono min-h-screen flex items-center justify-center bg-white dark:bg-[#121212] text-black dark:text-[#e0e0e0] transition-colors duration-300 px-4">
            <div className="w-full max-w-md mx-auto">
                <div className={`${orbitron.className} text-2xl sm:text-3xl font-extrabold text-black dark:text-white tracking-wide text-center mb-6 select-none`}>KAIRO</div>
                <div className="bg-gray-50 dark:bg-neutral-900 p-6 sm:p-8 rounded-xl shadow-xl w-full transition-colors duration-300">
                    <h2 className="text-xl font-bold mb-2 text-center text-gray-900 dark:text-white">Reset Password</h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm text-center mb-6">
                        Enter your university email address and we'll send you a link to reset your password.
                    </p>

                    {error && (
                        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
                            {error}
                        </div>
                    )}

                    {!isSubmitted ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="email" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">University Email</label>
                                <input
                                    id="email"
                                    type="email"
                                    placeholder="name@university.edu"
                                    className="rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-black text-gray-900 dark:text-white px-4 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500 focus:border-transparent w-full transition-colors duration-300"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                            <button
                                type="submit"
                                className="bg-black dark:bg-white text-white dark:text-black font-semibold py-2 px-4 rounded hover:opacity-90 w-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Sending...' : 'Send Reset Link'}
                            </button>
                        </form>
                    ) : (
                        <div className="text-center space-y-4">
                            <div className="text-green-400 mb-4">
                                ✓ Reset link sent successfully
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Check your email for instructions to reset your password.
                            </p>
                        </div>
                    )}

                    <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
                        Remember your password?{' '}
                        <Link href="/login" className="underline hover:text-black dark:hover:text-white">Back to Login</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
