'use client';

import Link from 'next/link';
import { Orbitron } from 'next/font/google';
import { useState, useEffect } from 'react';
import Logo from './Logo';

const orbitron = Orbitron({ subsets: ['latin'], weight: ['700'] });

// Top Layout Components - Always visible at the top of the page
export function TopNavigation() {
    return (
        <div className="relative z-40 px-4 sm:px-6 py-4 sm:py-6">
            <div className="max-w-6xl mx-auto flex justify-between items-center">
                {/* Logo */}
                <Link 
                    href="/" 
                    className="drop-shadow-md hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.6)] transition-all duration-200 hover:scale-105"
                >
                    <Logo size={56} />
                </Link>
                
                {/* Navigation Links */}
                <div className="font-mono flex items-center gap-4 sm:gap-6 lg:gap-8">
                    <Link
                        href="/login"
                        className="text-sm sm:text-base lg:text-lg font-medium text-gray-700 dark:text-white hover:text-blue-600 dark:hover:text-indigo-400 transition-colors duration-200"
                    >
                        Login
                    </Link>
                    <Link
                        href="/signup"
                        className="text-sm sm:text-base lg:text-lg font-medium text-gray-700 dark:text-white hover:text-blue-600 dark:hover:text-indigo-400 transition-colors duration-200"
                    >
                        Sign up
                    </Link>
                    <Link
                        href="/contact"
                        className="hidden sm:block text-sm sm:text-base lg:text-lg font-medium text-gray-600 dark:text-white/80 hover:text-blue-600 dark:hover:text-indigo-400 transition-colors duration-200"
                    >
                        Contact
                    </Link>
                </div>
            </div>
        </div>
    );
}

// Dynamic Floating Navbar - Only appears when scrolling
export default function Navbar() {
    const [showNavbar, setShowNavbar] = useState(false);

    useEffect(() => {
        const onScroll = () => {
            setShowNavbar(window.scrollY > 100);
        };

        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <nav className={`fixed top-3 left-1/2 transform -translate-x-1/2 z-50 text-gray-900 dark:text-white transition-all duration-400 ease-out ${
            showNavbar 
                ? 'opacity-100 pointer-events-auto translate-y-0 scale-105 bg-white/95 dark:bg-gradient-to-b dark:from-[#111111]/95 dark:to-[#0f0f0f]/95 backdrop-blur-md shadow-xl dark:shadow-2xl dark:shadow-blue-900/20 rounded-2xl px-10 py-6 max-w-6xl w-[calc(100%-3rem)] border border-gray-200/20 dark:border-white/5' 
                : 'opacity-0 pointer-events-none -translate-y-4 scale-95'
        }`}>
            <div className="flex justify-between items-center">
                <Link 
                    href="/" 
                    className="drop-shadow-md hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.6)] transition-all duration-200 hover:scale-105"
                >
                    <Logo size={44} />
                </Link>
                <div className="font-mono flex items-center gap-5 sm:gap-8">
                    <Link
                        href="/login"
                        className="text-sm sm:text-lg font-medium text-gray-700 dark:text-white hover:text-blue-600 dark:hover:text-indigo-400 transition-colors duration-200"
                    >
                        Login
                    </Link>
                    <Link
                        href="/signup"
                        className="text-sm sm:text-lg font-medium text-gray-700 dark:text-white hover:text-blue-600 dark:hover:text-indigo-400 transition-colors duration-200"
                    >
                        Sign up
                    </Link>
                    <Link
                        href="/contact"
                        className="hidden sm:block text-sm sm:text-lg font-medium text-gray-600 dark:text-white/80 hover:text-blue-600 dark:hover:text-indigo-400 transition-colors duration-200"
                    >
                        Contact
                    </Link>
                </div>
            </div>
        </nav>
    );
}