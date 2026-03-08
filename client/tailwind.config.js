/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        discord: {
          bg: 'var(--dc-bg)',
          sidebar: 'var(--dc-sidebar)',
          channel: 'var(--dc-channel)',
          input: 'var(--dc-input)',
          hover: 'var(--dc-hover)',
          text: 'var(--dc-text)',
          muted: 'var(--dc-muted)',
          accent: 'var(--dc-accent)',
          green: 'var(--dc-green)',
          red: 'var(--dc-red)',
          yellow: 'var(--dc-yellow)',
        }
      },
      keyframes: {
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        slideInLeft: 'slideInLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
