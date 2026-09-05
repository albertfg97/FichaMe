/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          dark: 'rgb(var(--brand-dark) / <alpha-value>)',
          light: 'rgb(var(--brand-light) / <alpha-value>)',
          muted: 'rgb(var(--brand-muted) / <alpha-value>)',
        },
        paper: {
          DEFAULT: '#FBFAF7',
          soft: '#F4F1EA',
          line: '#E6E1D6',
        },
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(23,30,26,0.04), 0 4px 16px rgba(23,30,26,0.06)',
        lift: '0 8px 30px rgba(23,30,26,0.10)',
      },
    },
  },
  plugins: [],
};
