'use client';

import Link from 'next/link';
import { Orbitron } from 'next/font/google';
import { useState, useEffect } from 'react';
import Logo from './Logo';

const orbitron = Orbitron({ subsets: ['latin'], weight: ['700'] });

// Empty TopNavigation for backward compatibility
export function TopNavigation() {
    return null;
}

// Redesigned Sticky Navbar - Always visible with consistent styling
export default function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => {
            setIsScrolled(window.scrollY > 0);
        };

        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-shadow duration-300 ${
            isScrolled 
                ? 'shadow-lg shadow-black/10 dark:shadow-black/30' 
                : ''
        }`}>
            <div className="bg-white/70 dark:bg-[rgb(var(--background-rgb))]/70 backdrop-blur-md">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
                    <div className="flex justify-between items-center">
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
            </div>
        </nav>
    );
}