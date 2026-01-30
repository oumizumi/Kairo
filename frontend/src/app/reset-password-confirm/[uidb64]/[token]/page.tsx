"use client";

import React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import api from '@/lib/api';

interface PageProps {
    params: {
        uidb64: string;
        token: string;
    };
}

export default function ResetPasswordConfirmPage({ params }: PageProps): React.JSX.Element {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            setIsLoading(false);
            return;
        }

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters long.');
            setIsLoading(false);
            return;
        }

        try {
            await api.post('/api/auth/password-reset/confirm/', {
                uidb64: params.uidb64,
                token: params.token,
                new_password: newPassword,
                confirm_password: confirmPassword
            });
            setIsSuccess(true);
        } catch (error: any) {
            if (error.response?.status === 400) {
                if (error.response.data?.new_password) {
                    setError(error.response.data.new_password[0]);
                } else if (error.response.data?.error) {
                    setError(error.response.data.error);
                } else {
                    setError('Invalid request. Please check your input.');
                }
            } else {
                setError('An error occurred. Please try again later.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-cream dark:bg-[#121212] text-black dark:text-[#e0e0e0] transition-colors duration-300 relative font-mono">
            {/* Logo with proper anchoring */}
            <div className="absolute top-6 left-8 z-10">
                <Link 
                    href="/" 
                    className="inline-block drop-shadow-md hover:drop-shadow-[0_0_8px_rgba(249,115,22,0.6)] transition-all duration-200 hover:scale-105"
                >
                    <Logo size={56} />
                </Link>
            </div>

            {/* Subtle horizontal line under header area */}
            <div className="absolute top-[90px] left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-neutral-800 to-transparent opacity-60"></div>

            {/* Decorative vertical lines for framing */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gray-200 dark:via-neutral-800 to-transparent opacity-40"></div>
            <div className="absolute right-8 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gray-200 dark:via-neutral-800 to-transparent opacity-40"></div>

            {/* Main content area - positioned at 45% from top */}
            <div className="flex items-start justify-center px-4 pt-[calc(45vh-200px)] min-h-screen">
                <div className="w-full max-w-md mx-auto relative animate-fadeInUp">
                    <h2 className="text-xl font-bold mb-2 text-center text-gray-900 dark:text-white">Reset Your Password</h2>

                    {!isSuccess ? (
                        <>
                            <p className="text-gray-600 dark:text-gray-400 text-center mb-6 text-sm">
                                Enter your new password below.
                            </p>

                            {error && (
                                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-center animate-fadeIn">
                                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-3">
                                <div>
                                    <label htmlFor="newPassword" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                                    <div className="relative">
                                        <input
                                            id="newPassword"
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Enter new password"
                                            className="rounded border border-gray-300 dark:border-[#333] bg-cream dark:bg-[#1e1e1e] text-gray-900 dark:text-white px-4 py-2.5 pr-10 focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316] w-full transition-all duration-200"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                            disabled={isLoading}
                                            minLength={8}
                                            aria-label="New password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 hover:opacity-80 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#f97316]"
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            disabled={isLoading}
                                        >
                                            {showPassword ? (
                                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.02-2.78 2.98-5.1 5.47-6.57M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8-.64 1.75-1.7 3.3-3.02 4.57M1 1l22 22"/>
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/>
                                                    <circle cx="12" cy="12" r="3"/>
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="confirmPassword" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</label>
                                    <div className="relative">
                                        <input
                                            id="confirmPassword"
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            placeholder="Confirm new password"
                                            className="rounded border border-gray-300 dark:border-[#333] bg-cream dark:bg-[#1e1e1e] text-gray-900 dark:text-white px-4 py-2.5 pr-10 focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316] w-full transition-all duration-200"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            disabled={isLoading}
                                            minLength={8}
                                            aria-label="Confirm password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 hover:opacity-80 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#f97316]"
                                            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                            disabled={isLoading}
                                        >
                                            {showConfirmPassword ? (
                                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.02-2.78 2.98-5.1 5.47-6.57M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8-.64 1.75-1.7 3.3-3.02 4.57M1 1l22 22"/>
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/>
                                                    <circle cx="12" cy="12" r="3"/>
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    className="bg-gradient-to-r from-[#f97316] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] text-white font-semibold py-2.5 px-4 rounded w-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:ring-offset-2 focus:ring-offset-[#121212]"
                                    disabled={isLoading}
                                    aria-label="Reset password"
                                >
                                    {isLoading && (
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    )}
                                    {isLoading ? 'Resetting...' : 'Reset Password'}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="text-center space-y-4 animate-fadeIn">
                            <div className="text-green-600 dark:text-green-400 mb-4 text-lg">
                                ✓ Password reset successfully
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Your password has been updated. You can now log in with your new password.
                            </p>
                            <Link
                                href="/login"
                                className="bg-gradient-to-r from-[#f97316] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] text-white font-semibold py-2.5 px-4 rounded w-full transition-all duration-200 inline-block text-center focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:ring-offset-2 focus:ring-offset-[#121212]"
                            >
                                Go to Login
                            </Link>
                        </div>
                    )}

                    {!isSuccess && (
                        <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-5">
                            Remember your password?{' '}
                            <Link href="/login" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:underline transition">Back to Login</Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <footer className="absolute bottom-4 left-0 right-0 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-600 opacity-60">© 2025 Kairo</p>
            </footer>
        </div>
    );
} 