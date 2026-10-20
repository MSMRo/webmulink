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
        simulink: {
          bg: '#f8fafc',
          canvas: '#ffffff',
          grid: '#e2e8f0',
          border: '#334155',
          header: '#0f172a',
          accent: '#0284c7',
          portIn: '#22c55e',
          portOut: '#3b82f6',
          wire: '#1e293b',
          wireActive: '#0284c7'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['Fira Code', 'JetBrains Mono', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}
