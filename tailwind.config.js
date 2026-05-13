/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)'],
        ui: ['var(--font-ui)'],
        mono: ['var(--font-mono)'],
      },
      colors: {
        'kv-bg-base': 'var(--bg-base)',
        'kv-bg-surface': 'var(--bg-surface)',
        'kv-bg-card': 'var(--bg-card)',
        'kv-bg-elevated': 'var(--bg-elevated)',
        'kv-bg-hover': 'var(--bg-hover)',
        'kv-border': 'var(--border)',
        'kv-border-light': 'var(--border-light)',
        'kv-text-primary': 'var(--text-primary)',
        'kv-text-secondary': 'var(--text-secondary)',
        'kv-text-muted': 'var(--text-muted)',
        'kv-accent': 'var(--accent)',
        'kv-accent2': 'var(--accent2)',
        'kv-accent-hover': 'var(--accent-hover)',
        'kv-accent-glow': 'var(--accent-glow)',
      },
      borderRadius: {
        'kv': 'var(--radius)',
        'kv-lg': 'var(--radius-lg)',
      },
      boxShadow: {
        'kv': 'var(--shadow)',
        'kv-lg': 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
};
