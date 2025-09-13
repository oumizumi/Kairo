import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: 'class',
    content: [
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/config/**/*.{js,ts,jsx,tsx,mdx}', // include theme definitions so JIT picks dynamic classes
    ],
    safelist: [
        'bg-white',
        'dark:bg-black',
        'text-black',
        'dark:text-white',
        // ensure dynamic theme classes are not purged
        'bg-purple-400/60','bg-indigo-400/60','bg-pink-400/60','bg-blue-400/60','bg-rose-400/60','bg-slate-400/60','bg-neutral-400/60','bg-violet-400/60','bg-amber-400/60','bg-sky-400/60','bg-cyan-400/60','bg-red-400/60','bg-emerald-400/60','bg-orange-400/60','bg-lime-400/60','bg-teal-400/60',
        'bg-amber-300/60','bg-indigo-300/60','bg-orange-300/60','bg-lime-500/40',
        'border-white/10',
        'text-black','dark:text-white',
        {
            pattern: /(bg|text|border)-(primary|secondary|dark|light|gray|red|sky|violet|indigo|pink|blue|rose|slate|neutral|amber|cyan|emerald|orange|lime|teal)-(50|100|200|300|400|500|600|700|800|900|950)\/?(10|20|25|30|40|50|60|70|80)?/,
        },
    ],
    theme: {
        extend: {
            screens: {
                '13inch': '1024px', // Specific breakpoint for 13-inch screens and above
                // This ensures consistent styling for all 13"+ screens
            },
            fontFamily: {
                'futuristic': ['Zen Dots', 'Orbitron', 'sans-serif'],
                'sans': ['Inter', 'system-ui', 'sans-serif'],
                'mono': ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', '"Courier New"', 'monospace'],
            },
            colors: {
                primary: {
                    50: '#fef2f2',
                    100: '#fee2e2',
                    200: '#fecaca',
                    300: '#fca5a5',
                    400: '#f87171',
                    500: '#ef4444',
                    600: '#dc2626',
                    700: '#b91c1c',
                    800: '#991b1b',
                    900: '#7f1d1d',
                    950: '#450a0a',
                },
                dark: {
                    bg: '#000000',
                    card: '#262626',
                    border: '#404040',
                },
                light: {
                    bg: '#ffffff',
                    card: '#ffffff',
                    border: '#e5e7eb',
                }
            },
            typography: {
                DEFAULT: {
                    css: {
                        maxWidth: '100ch',
                        color: 'inherit',
                        a: {
                            color: 'inherit',
                            opacity: 0.75,
                            fontWeight: '500',
                            textDecoration: 'underline',
                            '&:hover': {
                                opacity: 1,
                                color: 'var(--tw-prose-links)',
                            },
                        },
                        b: { color: 'inherit' },
                        strong: { color: 'inherit' },
                        em: { color: 'inherit' },
                        h1: { color: 'inherit' },
                        h2: { color: 'inherit' },
                        h3: { color: 'inherit' },
                        h4: { color: 'inherit' },
                        code: { color: 'inherit' },
                    },
                },
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/typography'),
        require('tailwind-scrollbar'),
    ],
    future: {
        hoverOnlyWhenSupported: true,
    },
}

export default config 