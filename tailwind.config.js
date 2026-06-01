/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        gold: {
          50: '#fdf9ed',
          100: '#f9edca',
          200: '#f3d98b',
          300: '#ecbf4a',
          400: '#e5a825',
          500: '#c98a12',
          600: '#a36b0d',
          700: '#7d500e',
          800: '#664013',
          900: '#573614',
        },
        obsidian: {
          900: '#0a0806',
          800: '#141009',
          700: '#1e170d',
          600: '#2a2012',
          500: '#3a2d1a',
        }
      }
    }
  },
  plugins: []
}
