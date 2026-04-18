/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
        ui: ['Space Mono', 'monospace'],
      },
      colors: {
        'kv-bg-base': 'var(--bg-base)',
        'kv-bg-surface': 'var(--bg-surface)',
        'kv-bg-card': 'var(--bg-card)',
        'kv-text-primary': 'var(--text-primary)',
        'kv-text-secondary': 'var(--text-secondary)',
        'kv-accent': 'var(--accent)',
      },
    },
  },
  plugins: [],
};
