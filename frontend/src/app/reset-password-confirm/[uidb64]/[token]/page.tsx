"use client";

import React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Orbitron } from 'next/font/google';
import api from '@/lib/api';

const orbitron = Orbitron({ subsets: ['latin'], weight: ['700'] });

interface PageProps {
    params: {
        uidb64: string;
        token: string;
    };
}

export default function ResetPasswordConfirmPage({ params }: PageProps): React.JSX.Element {
    const router = useRouter();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [isValidToken, setIsValidToken] = useState(true);

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
        <div className="font-mono min-h-screen flex items-center justify-center bg-black text-white px-4">
            <div className="w-full max-w-md mx-auto">
                <div className={`${orbitron.className} text-2xl sm:text-3xl font-extrabold text-white tracking-wide text-center mb-6 select-none`}>KAIRO</div>
                <div className="bg-neutral-900 p-6 sm:p-8 rounded-xl shadow-xl w-full">
                    <h2 className="text-xl font-bold mb-2 text-center">Reset Your Password</h2>

                    {!isSuccess ? (
                        <>
                            <p className="text-gray-400 text-sm text-center mb-6">
                                Enter your new password below.
                            </p>

                            {error && (
                                <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="newPassword" className="block mb-1 text-sm font-medium">New Password</label>
                                    <input
                                        id="newPassword"
                                        type="password"
                                        placeholder="Enter new password"
                                        className="rounded border border-neutral-700 bg-black text-white px-4 py-2 focus:ring-2 focus:ring-red-500 w-full"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        disabled={isLoading}
                                        minLength={8}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="confirmPassword" className="block mb-1 text-sm font-medium">Confirm Password</label>
                                    <input
                                        id="confirmPassword"
                                        type="password"
                                        placeholder="Confirm new password"
                                        className="rounded border border-neutral-700 bg-black text-white px-4 py-2 focus:ring-2 focus:ring-red-500 w-full"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        disabled={isLoading}
                                        minLength={8}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="bg-white text-black font-semibold py-2 px-4 rounded hover:bg-neutral-300 w-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Resetting...' : 'Reset Password'}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="text-center space-y-4">
                            <div className="text-green-400 mb-4">
                                ✓ Password reset successfully
                            </div>
                            <p className="text-sm text-gray-400">
                                Your password has been updated. You can now log in with your new password.
                            </p>
                            <Link
                                href="/login"
                                className="bg-white text-black font-semibold py-2 px-4 rounded hover:bg-neutral-300 w-full transition-colors inline-block text-center"
                            >
                                Go to Login
                            </Link>
                        </div>
                    )}

                    {!isSuccess && (
                        <div className="text-center text-sm text-gray-400 mt-6">
                            Remember your password?{' '}
                            <Link href="/login" className="text-white underline hover:text-red-400">Back to Login</Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
} 