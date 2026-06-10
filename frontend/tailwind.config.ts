import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        garnet: {
          DEFAULT: '#8f001a',
          dark: '#6e0014',
        },
        polar: '#f2f2f2',
        charcoal: '#2d2d2c',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      keyframes: {
        'block-enter': {
          '0%':   { opacity: '0', transform: 'translateX(-14px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        'block-exit': {
          '0%':   { opacity: '1', transform: 'translateX(0) scale(1)' },
          '100%': { opacity: '0', transform: 'translateX(14px) scale(0.95)' },
        },
        'hp-drain': {
          '0%':   { width: 'var(--hp-from)' },
          '100%': { width: 'var(--hp-to)' },
        },
        'bird-fly': {
          '0%':   { transform: 'translateX(-20vw)' },
          '100%': { transform: 'translateX(120vw)' },
        },
        'bird-bob': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'screen-enter': {
          '0%':   { opacity: '0', transform: 'scale(1.045)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'page-enter': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'block-enter':  'block-enter 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
        'block-exit':   'block-exit 180ms cubic-bezier(0.55, 0, 1, 0.45) forwards',
        'hp-drain':     'hp-drain 1200ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'bird-fly':     'bird-fly 40s linear infinite',
        'bird-bob':     'bird-bob 4s ease-in-out infinite',
        'fade-up':      'fade-up 500ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'screen-enter': 'screen-enter 550ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'page-enter':   'page-enter 400ms ease-out both',
      },
    },
  },
  plugins: [],
}

export default config
