/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          base: '#0a0e17',
          surface: '#111726',
          elevated: '#172033',
          border: '#1e293b',
          'border-subtle': '#162235',
          muted: '#64748b',
        },
        brand: {
          green: '#10b981',
          'green-light': '#34d399',
          'green-dark': '#059669',
          'green-dim': 'rgba(16, 185, 129, 0.1)',
          'green-glow': 'rgba(16, 185, 129, 0.2)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
