/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        midnight: {
          DEFAULT: '#102B46',
          dark: '#0B1E32',
          light: '#1A3B5C',
          muted: '#2A4D70'
        },
        solar: {
          gold: '#F5B83D',
          'gold-light': '#FEF7E6',
          'gold-dark': '#D99B22',
          green: '#269B70',
          'green-light': '#E9F8F2',
          'green-dark': '#1D7D59'
        },
        sky: {
          accent: '#3A86C8',
          'accent-light': '#EBF3FA'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      }
    },
  },
  plugins: [],
}
