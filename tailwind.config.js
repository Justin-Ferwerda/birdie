/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#d4af37',
          50: '#fdf8e6',
          100: '#fbeec0',
          400: '#e7c84a',
          500: '#d4af37',
          600: '#a3851f',
        },
      },
    },
  },
  plugins: [],
};
