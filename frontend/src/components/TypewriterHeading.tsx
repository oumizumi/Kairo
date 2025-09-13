"use client";

import { useEffect, useState } from "react";
import { Orbitron } from 'next/font/google';

const orbitron = Orbitron({ subsets: ['latin'], weight: ['700'], variable: '--font-orbitron' });

interface TypewriterHeadingProps {
    text: string;
    delay?: number;
}

export default function TypewriterHeading({ text, delay = 50 }: TypewriterHeadingProps) {
    const [displayText, setDisplayText] = useState("");
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (currentIndex < text.length) {
            const timeout = setTimeout(() => {
                setDisplayText(prev => prev + text[currentIndex]);
                setCurrentIndex(prev => prev + 1);
            }, delay);

            return () => clearTimeout(timeout);
        }
    }, [currentIndex, delay, text]);

    return (
        <h1 className={`${orbitron.className} ${orbitron.variable} typewriter-heading text-3xl sm:text-4xl md:text-5xl 13inch:text-6xl font-extrabold mb-4 13inch:mb-6 tracking-wide min-h-[2.5rem] sm:min-h-[3rem] md:min-h-[3.5rem] 13inch:min-h-[4rem] text-black dark:text-[rgb(var(--text-primary))] dark:text-glow-purple-blue`}>
            {displayText}
            <span className="animate-pulse">|</span>
        </h1>
    );
} 