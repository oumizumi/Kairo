"use client";

import { Orbitron } from 'next/font/google';
import Link from 'next/link';

const orbitron = Orbitron({ subsets: ['latin'], weight: ['700'] });

export default function SupportPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#121212] text-[#e0e0e0] py-12 px-4">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className={`${orbitron.className} text-2xl sm:text-3xl font-extrabold text-white tracking-wide text-center mb-6 select-none`}>
                    KAIRO
                </div>

                {/* Support Card */}
                <div className="bg-neutral-900 rounded-2xl p-6 sm:p-8 shadow-md border border-neutral-800">
                    <h1 className="text-xl sm:text-2xl font-bold text-center mb-2">
                        Support Kairo ☕
                    </h1>

                    <p className="text-gray-400 text-center mb-6 text-sm sm:text-base">
                        Kairo is built by students, for students. Your support helps keep it free and accessible for everyone at uOttawa.
                    </p>

                    {/* Buy Me a Coffee Button */}
                    <div className="flex justify-center mb-8">
                        <a
                            href="https://www.buymeacoffee.com/yourusername"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-6 py-3 bg-[#FFDD00] text-black font-semibold rounded-lg hover:bg-[#FFDD00]/90 transition-colors"
                        >
                            <span className="mr-2">☕</span>
                            Buy me a coffee
                        </a>
                    </div>

                    {/* Additional Info */}
                    <div className="text-sm text-gray-500 text-center space-y-2">
                        <p>
                            Every contribution, no matter how small, helps improve Kairo for everyone.
                        </p>
                        <p>
                            Your support goes directly towards:
                        </p>
                        <ul className="list-disc list-inside text-gray-400 space-y-1 mt-2">
                            <li>Server costs and maintenance</li>
                            <li>New features and improvements</li>
                            <li>Keeping Kairo free for all students</li>
                        </ul>
                    </div>

                    {/* Back to Home */}
                    <div className="text-center mt-8">
                        <Link
                            href="/"
                            className="text-gray-400 hover:text-white transition-colors inline-flex items-center"
                        >
                            ← Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
} 