"use client";

import React, { useState, useEffect } from 'react';

interface TypewriterTextProps {
    text: string;
    speed?: number;
}

const TypewriterText: React.FC<TypewriterTextProps> = ({ text, speed = 100 }) => {
    const [displayText, setDisplayText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (currentIndex < text.length) {
            const timeout = setTimeout(() => {
                setDisplayText(prev => prev + text[currentIndex]);
                setCurrentIndex(prev => prev + 1);
            }, speed);

            return () => clearTimeout(timeout);
        }
    }, [currentIndex, text, speed]);

    useEffect(() => {
        setDisplayText('');
        setCurrentIndex(0);
    }, [text]);

    return <span>{displayText}</span>;
};

export default TypewriterText;