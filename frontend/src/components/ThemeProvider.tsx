"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
type SeasonalTheme = 'default' | 'halloween' | 'christmas';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    actualTheme: 'light' | 'dark';
    seasonalTheme: SeasonalTheme;
    setSeasonalTheme: (theme: SeasonalTheme) => void;
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
    const [seasonalTheme, setSeasonalTheme] = useState<SeasonalTheme>('default');

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

        // Load seasonal theme
        const savedSeasonal = localStorage.getItem('kairo-seasonal-theme') as SeasonalTheme;
        if (savedSeasonal) {
            setSeasonalTheme(savedSeasonal);
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

        // Apply theme class to document element, also update seasonal class
        if (typeof document !== 'undefined') {
            const root = document.documentElement;
            root.classList.remove('light', 'dark');
            root.classList.add(newActualTheme);

            // Handle seasonal classes
            root.classList.remove('seasonal-halloween', 'seasonal-christmas');
            if (seasonalTheme === 'halloween') {
                root.classList.add('seasonal-halloween');
            } else if (seasonalTheme === 'christmas') {
                root.classList.add('seasonal-christmas');
            }
        }
    }, [theme, mounted, seasonalTheme]);

    // Persist seasonal theme and update seasonal classes when it changes
    useEffect(() => {
        if (!mounted) return;
        localStorage.setItem('kairo-seasonal-theme', seasonalTheme);
        if (typeof document !== 'undefined') {
            const root = document.documentElement;
            root.classList.remove('seasonal-halloween', 'seasonal-christmas');
            if (seasonalTheme === 'halloween') {
                root.classList.add('seasonal-halloween');
            } else if (seasonalTheme === 'christmas') {
                root.classList.add('seasonal-christmas');
            }
        }
    }, [seasonalTheme, mounted]);

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
        <ThemeContext.Provider value={{ theme, setTheme, actualTheme, seasonalTheme, setSeasonalTheme }}>
            {children}
        </ThemeContext.Provider>
    );
} 