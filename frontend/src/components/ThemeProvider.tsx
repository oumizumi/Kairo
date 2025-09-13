"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    actualTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

interface ThemeProviderProps {
    children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>('system');
    const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('dark');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        
        // Load theme from localStorage on mount
        const savedTheme = localStorage.getItem('kairo-theme') as Theme;
        if (savedTheme) {
            setTheme(savedTheme);
        } else {
            // If no saved theme, default to system preference
            setTheme('system');
        }
    }, []);

    useEffect(() => {
        if (!mounted) return;
        
        // Save theme to localStorage whenever it changes
        localStorage.setItem('kairo-theme', theme);

        // Calculate actual theme based on theme setting
        let newActualTheme: 'light' | 'dark' = 'dark';

        if (theme === 'light') {
            newActualTheme = 'light';
        } else if (theme === 'dark') {
            newActualTheme = 'dark';
        } else if (theme === 'system') {
            // Check system preference
            if (typeof window !== 'undefined') {
                newActualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
        }

        setActualTheme(newActualTheme);

        // Apply theme class to document element
        if (typeof document !== 'undefined') {
            const root = document.documentElement;
            root.classList.remove('light', 'dark');
            root.classList.add(newActualTheme);
        }
    }, [theme, mounted]);

    // Listen for system theme changes when theme is set to 'system'
    useEffect(() => {
        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = () => {
                const newActualTheme = mediaQuery.matches ? 'dark' : 'light';
                setActualTheme(newActualTheme);

                if (typeof document !== 'undefined') {
                    const root = document.documentElement;
                    root.classList.remove('light', 'dark');
                    root.classList.add(newActualTheme);
                }
            };

            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, actualTheme }}>
            {children}
        </ThemeContext.Provider>
    );
} 