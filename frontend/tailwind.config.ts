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
      },
      animation: {
        'block-enter': 'block-enter 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
        'block-exit':  'block-exit 180ms cubic-bezier(0.55, 0, 1, 0.45) forwards',
      },
    },
  },
  plugins: [],
}

export default config
