"use client";

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signup, guestLogin } from '@/lib/api';
import Logo from '@/components/Logo';
import { getDeviceSpecificRoute } from '@/utils/deviceDetection';

function SignupForm() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [program, setProgram] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGuestLoading, setIsGuestLoading] = useState(false);
    const [error, setError] = useState('');
    const [redirectTo, setRedirectTo] = useState(getDeviceSpecificRoute());
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const redirect = searchParams.get('redirect');
        if (redirect) {
            // Handle encoded redirect URLs
            try {
                const decodedRedirect = decodeURIComponent(redirect);
                setRedirectTo(decodedRedirect);
            } catch {
                // If decoding fails, use the redirect as-is
                setRedirectTo(redirect.startsWith('/') ? redirect : `/${redirect}`);
            }
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            await signup({ username, first_name: '', last_name: '', email, password, program: program || undefined });
            // Redirect to intended destination on successful signup
            router.push(redirectTo);
        } catch (err) {
            if (err instanceof Error) {
                // Provide contextual error messages
                if (err.message.includes('already exists') || err.message.includes('taken')) {
                    setError('This username or email is already taken. Please try another.');
                } else if (err.message.includes('500') || err.message.includes('timeout') || err.message.includes('Network')) {
                    setError('Server error. Please try again later.');
                } else {
                    setError(err.message);
                }
            } else {
                setError('Unable to create account. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleGuestLogin = async () => {
        setIsGuestLoading(true);
        setError('');

        try {
            await guestLogin();
            // Redirect to intended destination on successful guest login
            router.push(redirectTo);
        } catch (err) {
            if (err instanceof Error) {
                if (err.message.includes('500') || err.message.includes('timeout') || err.message.includes('Network')) {
                    setError('Server error. Please try again later.');
                } else {
                    setError(err.message);
                }
            } else {
                setError('Unable to create guest account. Please try again.');
            }
        } finally {
            setIsGuestLoading(false);
        }
    };

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
                    <h2 className="text-xl font-bold mb-6 text-center text-gray-900 dark:text-white">Create your account</h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-center animate-fadeIn">
                            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                        </div>
                    )}

                    <form className="space-y-3" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="username" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
                            <input
                                id="username"
                                type="text"
                                placeholder="Choose a username"
                                className="rounded border border-gray-300 dark:border-[#333] bg-cream dark:bg-[#1e1e1e] text-gray-900 dark:text-white px-4 py-2.5 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 w-full transition-all duration-200"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                required
                                disabled={isLoading || isGuestLoading}
                                aria-label="Username"
                            />
                        </div>
                        <div>
                            <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                            <input
                                id="email"
                                type="email"
                                placeholder="your@email.com"
                                className="rounded border border-gray-300 dark:border-[#333] bg-cream dark:bg-[#1e1e1e] text-gray-900 dark:text-white px-4 py-2.5 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 w-full transition-all duration-200"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                disabled={isLoading || isGuestLoading}
                                aria-label="Email"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Create a password"
                                    className="rounded border border-gray-300 dark:border-[#333] bg-cream dark:bg-[#1e1e1e] text-gray-900 dark:text-white px-4 py-2.5 pr-10 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 w-full transition-all duration-200"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    disabled={isLoading || isGuestLoading}
                                    aria-label="Password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 hover:opacity-80 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    disabled={isLoading || isGuestLoading}
                                >
                                    {showPassword ? (
                                        <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.02-2.78 2.98-5.1 5.47-6.57M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8-.64 1.75-1.7 3.3-3.02 4.57M1 1l22 22" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="program" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Program (optional)</label>
                            <input
                                id="program"
                                type="text"
                                placeholder="e.g., Computer Science"
                                className="rounded border border-gray-300 dark:border-[#333] bg-cream dark:bg-[#1e1e1e] text-gray-900 dark:text-white px-4 py-2.5 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 w-full transition-all duration-200"
                                value={program}
                                onChange={e => setProgram(e.target.value)}
                                disabled={isLoading || isGuestLoading}
                                aria-label="Program (optional)"
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold py-2.5 px-4 rounded w-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 focus:ring-offset-[#121212] shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                            disabled={isLoading || isGuestLoading}
                            aria-label="Sign up for an account"
                        >
                            {isLoading && (
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            {isLoading ? 'Creating Account...' : 'Sign Up'}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center my-5">
                        <div className="flex-1 border-t border-gray-300 dark:border-neutral-700"></div>
                        <span className="px-3 text-sm text-gray-500 dark:text-gray-400">or</span>
                        <div className="flex-1 border-t border-gray-300 dark:border-neutral-700"></div>
                    </div>

                    {/* Guest Login Button */}
                    <button
                        onClick={handleGuestLogin}
                        className="bg-transparent border border-gray-400 dark:border-gray-500 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded hover:bg-gray-100 dark:hover:bg-[#1f1f1f] hover:border-gray-500 dark:hover:border-[#333] w-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#f97316]"
                        disabled={isLoading || isGuestLoading}
                        aria-label="Continue as guest"
                    >
                        {isGuestLoading && (
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        {isGuestLoading ? 'Creating Guest Account...' : 'Continue as Guest'}
                    </button>

                    <div className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">
                        Try Kairo without creating an account
                    </div>

                    <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-5">
                        Already have an account?{' '}
                        <Link href={redirectTo !== getDeviceSpecificRoute() ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login'} className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:underline transition">Login</Link>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="absolute bottom-4 left-0 right-0 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-600 opacity-60">© 2025 Kairo</p>
            </footer>
        </div>
    );
}

export default function SignupPage() {
    return (
        <Suspense fallback={
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

                {/* Main content area */}
                <div className="flex items-start justify-center px-4 pt-[calc(45vh-250px)] min-h-screen">
                    <div className="w-full max-w-md mx-auto relative">
                        <div className="flex items-center justify-center py-8">
                            <div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <footer className="absolute bottom-4 left-0 right-0 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-600 opacity-60">© 2025 Kairo</p>
                </footer>
            </div>
        }>
            <SignupForm />
        </Suspense>
    );
} 