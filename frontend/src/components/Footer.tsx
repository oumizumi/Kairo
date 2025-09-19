"use client";

import { useTheme } from './ThemeProvider';

export default function Footer() {
    const { theme, setTheme, actualTheme, seasonalTheme, setSeasonalTheme } = useTheme();
    
    const nextExplicitTheme = actualTheme === 'dark' ? 'light' : 'dark';

    const toggleTheme = () => {
        // If currently using system, flip relative to actualTheme and set explicit theme
        if (theme === 'system') {
            setTheme(nextExplicitTheme);
            return;
        }
        setTheme(nextExplicitTheme);
    };

    const handleSeasonalToggle = () => {
        const order: Array<'default' | 'christmas'> = ['default', 'christmas'];
        const idx = order.indexOf(seasonalTheme as 'default' | 'christmas');
        const next = order[(idx + 1) % order.length];
        setSeasonalTheme(next);
    };

    const isDark = actualTheme === 'dark';

    return (
        <footer className="border-t border-gray-200 dark:border-gray-800/40">
            <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between text-sm">
                <div className="text-gray-600 dark:text-white/60">© Kairo</div>
                <div className="flex items-center gap-3">
                    <a
                        href="https://github.com/oumizumi/Kairo.git"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white transition-colors p-2 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 shadow-lg backdrop-blur-sm bg-white/80 dark:bg-white/10 border border-gray-300 dark:border-gray-700"
                        aria-label="GitHub Repository"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                    </a>
                    <button
                        type="button"
                        onClick={toggleTheme}
                        aria-pressed={isDark}
                        className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 shadow-lg backdrop-blur-sm bg-white/80 dark:bg-white/10"
                    >
                    {isDark ? (
                        // Moon for dark mode
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="opacity-90 text-gray-300">
                            <path fill="currentColor" d="M21.64 13a1 1 0 0 0-1.05-.14A8 8 0 0 1 11.1 3.41a1 1 0 0 0-1.19-1.3A10 10 0 1 0 22 14a1 1 0 0 0-.36-1Z"/>
                        </svg>
                    ) : (
                        // Sun for light mode
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="opacity-90 text-amber-500">
                            <path fill="currentColor" d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0 4a1 1 0 0 1-1-1v-1a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1Zm0-18a1 1 0 0 1-1-1V2a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1Zm10 9a1 1 0 0 1-1 1h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1ZM4 12a1 1 0 0 1-1 1H2a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1Zm13.66 6.66a1 1 0 0 1-1.41 0l-.71-.71a1 1 0 1 1 1.41-1.41l.71.71a1 1 0 0 1 0 1.41ZM7.05 6.05a1 1 0 0 1-1.41 0l-.71-.71A1 1 0 1 1 6.34 3.93l.71.71a1 1 0 0 1 0 1.41Zm11.31-1.41a1 1 0 0 1 0 1.41l-.71.71A1 1 0 1 1 16.24 5l.71-.71a1 1 0 0 1 1.41 0ZM6.34 17.66a1 1 0 0 1-1.41 0l-.71-.71a1 1 0 1 1 1.41-1.41l.71.71a1 1 0 0 1 0 1.41Z"/>
                        </svg>
                    )}
                        <span className="sr-only">Toggle theme</span>
                        <span className="w-9 text-center">{isDark ? 'Dark' : 'Light'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleSeasonalToggle}
                        className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 shadow-lg backdrop-blur-sm bg-white/80 dark:bg-white/10"
                        aria-label="Toggle seasonal theme"
                        title="Seasonal theme"
                    >
                        {seasonalTheme === 'christmas' ? (
                            <span className="text-emerald-500" aria-hidden="true">❄️</span>
                        ) : (
                            <span className="text-gray-500" aria-hidden="true">✨</span>
                        )}
                        <span className="w-16 text-center capitalize">{seasonalTheme}</span>
                    </button>
                </div>
            </div>
        </footer>
    );
} 