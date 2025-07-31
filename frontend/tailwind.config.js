// frontend/tailwind.config.js
import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // === Premium "Midnight Indigo" Palette ===
        'indigo-primary': '#6366F1',
        'teal-secondary': '#14B8A6',
        'slate-disabled': '#334155',
        'border-dark': '#2E2E3A',
        'silver-text': '#E2E8F0',
        'lilac-accent': '#C4B5FD',
        'warning-gold': '#FBBF24',
        'success-green': '#34D399',
        'background-dark': '#0D0D12',
        'background-deep': '#1A1B2F',
        'surface-glass': 'rgba(255,255,255,0.02)'
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        serif: ['"Playfair Display"', ...defaultTheme.fontFamily.serif],
      },
      boxShadow: {
        'glow-indigo': '0 0 15px rgba(99, 102, 241, 0.5)',
        'soft': '0 4px 12px rgba(0, 0, 0, 0.1)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.37)',
      },
      backgroundImage: {
        'gradient-dark': 'linear-gradient(to bottom right, #0D0D12, #1A1B2F, #2D2A55)',
        'gradient-header': 'linear-gradient(to right, #121217, #1E1E2E)',
        'gradient-button': 'linear-gradient(to right, #6366F1, #14B8A6)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
  ],
}
