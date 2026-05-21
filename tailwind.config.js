/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './index.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        premium: {
          bg: '#000000',
          surface: 'rgba(24, 24, 27, 0.72)',
          'surface-light': 'rgba(255, 255, 255, 0.72)',
          border: 'rgba(255, 255, 255, 0.1)',
          'border-light': 'rgba(0, 0, 0, 0.08)',
          accent: '#6366F1',
          'accent-muted': 'rgba(99, 102, 241, 0.12)',
        },
      },
      borderRadius: {
        '4xl': '2rem',
        phone: '2.5rem',
      },
      boxShadow: {
        premium: '0 25px 50px -12px rgba(0, 0, 0, 0.55)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.24)',
      },
      transitionDuration: {
        premium: '300ms',
      },
    },
  },
  plugins: [],
};
