"use client";

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Orbitron } from 'next/font/google';
import { login, guestLogin } from '@/lib/api';
import ThemeToggle from '@/components/ThemeToggle';
import { getDeviceSpecificRoute } from '@/utils/deviceDetection';

const orbitron = Orbitron({ subsets: ['latin'], weight: ['700'] });

function LoginForm() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
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
                // If decoding fails, handle as before
                setRedirectTo(redirect.startsWith('/') ? redirect : `/${redirect}`);
            }
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            await login({ identifier, password });
            // Redirect to intended destination on successful login
            router.push(redirectTo);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
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
            setError(err instanceof Error ? err.message : 'Guest login failed');
        } finally {
            setIsGuestLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#121212] text-black dark:text-[#e0e0e0] transition-colors duration-300 px-4" style={{ fontFamily: 'Monaco, Menlo, "Courier New", monospace' }}>
            <div className="w-full max-w-md mx-auto">
                <div className={`${orbitron.className} text-2xl sm:text-3xl font-extrabold text-black dark:text-white tracking-wide text-center mb-6 select-none`}>KAIRO</div>
                <div className="bg-gray-50 dark:bg-neutral-900 p-6 sm:p-8 rounded-xl shadow-xl border border-gray-200 dark:border-neutral-700 w-full transition-colors duration-300">
                    <h2 className="text-xl font-bold mb-6 text-center text-gray-900 dark:text-white">Welcome back</h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded text-red-800 dark:text-red-200 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="identifier" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Email or Username</label>
                            <input
                                id="identifier"
                                type="text"
                                placeholder="Enter your email or username"
                                className="mb-4 rounded border border-gray-300 dark:border-white/5 bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-[#e0e0e0] px-4 py-2 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500 focus:border-transparent w-full transition-colors duration-300"
                                value={identifier}
                                onChange={e => setIdentifier(e.target.value)}
                                required
                                disabled={isLoading || isGuestLoading}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                            <div className="relative mb-2">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter your password"
                                    className="rounded border border-gray-300 dark:border-white/5 bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-[#e0e0e0] px-4 py-2 pr-10 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500 focus:border-transparent w-full transition-colors duration-300"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    disabled={isLoading || isGuestLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    disabled={isLoading || isGuestLoading}
                                >
                                    {showPassword ? (
                                        <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.02-2.78 2.98-5.1 5.47-6.57M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8-.64 1.75-1.7 3.3-3.02 4.57M1 1l22 22"/>
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                            <div className="flex justify-end mb-4">
                                <Link
                                    href="/forgot-password"
                                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-blue-400 transition-colors"
                                >
                                    Forgot Password?
                                </Link>
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="bg-gray-900 dark:bg-white text-white dark:text-black font-semibold py-2 px-4 rounded hover:bg-gray-800 dark:hover:bg-neutral-300 w-full transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isLoading || isGuestLoading}
                        >
                            {isLoading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center my-6">
                        <div className="flex-1 border-t border-gray-300 dark:border-neutral-700"></div>
                        <span className="px-3 text-sm text-gray-500 dark:text-gray-400">or</span>
                        <div className="flex-1 border-t border-gray-300 dark:border-neutral-700"></div>
                    </div>

                    {/* Guest Login Button */}
                    <button
                        onClick={handleGuestLogin}
                        className="bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white font-semibold py-2 px-4 rounded hover:bg-gray-200 dark:hover:bg-neutral-700 w-full transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 dark:border-neutral-600"
                        disabled={isLoading || isGuestLoading}
                    >
                        {isGuestLoading ? 'Creating Guest Account...' : 'Continue as Guest'}
                    </button>

                    <div className="text-center text-xs text-gray-500 dark:text-gray-500 mt-2">
                        Try Kairo without creating an account
                    </div>

                    <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
                        Don't have an account?{' '}
                        <Link href={redirectTo !== getDeviceSpecificRoute() ? `/signup?redirect=${encodeURIComponent(redirectTo)}` : '/signup'} className="text-blue-600 dark:text-white underline hover:text-blue-800 dark:hover:text-blue-400 transition-colors">Sign up</Link>
                    </div>
                </div>
            </div>
            <ThemeToggle />
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#121212] text-black dark:text-[#e0e0e0] transition-colors duration-300 px-4" style={{ fontFamily: 'Monaco, Menlo, "Courier New", monospace' }}>
                <div className="w-full max-w-md mx-auto">
                    <div className={`${orbitron.className} text-2xl sm:text-3xl font-extrabold text-black dark:text-white tracking-wide text-center mb-6 select-none`}>KAIRO</div>
                    <div className="bg-gray-50 dark:bg-neutral-900 p-8 rounded-xl shadow-xl border border-gray-200 dark:border-neutral-700 w-full sm:w-[350px] mx-auto transition-colors duration-300">
                        <div className="flex items-center justify-center py-8">
                            <div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    </div>
                </div>
                <ThemeToggle />
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
} 