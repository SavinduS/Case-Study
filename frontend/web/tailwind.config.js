/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        park: { 900: '#0c2b21', 800: '#123a2d', 700: '#1d4a38', 100: '#e3efe7', 50: '#f2f6f2' },
        sand: { 100: '#f5f3ec', 200: '#e9e6da' },
        clay: { 500: '#b4552d', 100: '#fbe9d7' },
        moss: { 500: '#2e7d4f' },
        gold: { 500: '#a67c00', 100: '#faf0cd' }
      }
    }
  },
  plugins: []
};

