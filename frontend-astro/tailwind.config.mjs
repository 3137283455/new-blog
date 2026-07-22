import typography from '@tailwindcss/typography'
import daisyUI from 'daisyui'
import tailwindcssAnimate from 'tailwindcss-animate'

export default {
  content: ['./src/**/*.{astro,html,js,md,mdx,ts}'],
  theme: {
    extend: {
      colors: {
        'neu-base': 'var(--neu-base)',
        'neu-text': 'var(--neu-text)',
        'neu-accent': 'var(--neu-accent)',
        'neu-border': 'var(--neu-border)',
        'neu-btn-bg': 'var(--neu-btn-bg)',
        'neu-btn-text': 'var(--neu-btn-text)',
        'neu-text-muted': 'var(--neu-text-muted)',
      },
      boxShadow: {
        'neu-out': 'var(--shadow-neu-out)',
        'neu-in': 'var(--shadow-neu-in)',
      },
      fontFamily: {
        sans: ['"M PLUS Rounded 1c"', '"Nunito"', '"Noto Sans SC"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [daisyUI, typography, tailwindcssAnimate],
  daisyui: {
    themes: [
      {
        'boke-night': {
          primary: '#60a5fa',
          'primary-content': '#08111f',
          secondary: '#a78bfa',
          'secondary-content': '#120a24',
          accent: '#22d3ee',
          'accent-content': '#06252d',
          neutral: '#111827',
          'neutral-content': '#e5e7eb',
          'base-100': '#0b1120',
          'base-200': '#111827',
          'base-300': '#1f2937',
          'base-content': '#e5e7eb',
          info: '#38bdf8',
          success: '#34d399',
          warning: '#fbbf24',
          error: '#fb7185',
        },
      },
      {
        'boke-punk': {
          primary: '#d946ef',
          'primary-content': '#fff7ff',
          secondary: '#7c3aed',
          'secondary-content': '#f5f3ff',
          accent: '#06b6d4',
          'accent-content': '#ecfeff',
          neutral: '#21112f',
          'neutral-content': '#f5e8ff',
          'base-100': '#1a0b23',
          'base-200': '#241033',
          'base-300': '#33144a',
          'base-content': '#f6eaff',
          info: '#38bdf8',
          success: '#2dd4bf',
          warning: '#facc15',
          error: '#fb7185',
        },
      },
      {
        'boke-green': {
          primary: '#16a34a',
          'primary-content': '#f0fdf4',
          secondary: '#0f766e',
          'secondary-content': '#ecfeff',
          accent: '#84cc16',
          'accent-content': '#132a06',
          neutral: '#244034',
          'neutral-content': '#f3faf6',
          'base-100': '#f8fff9',
          'base-200': '#eef8ef',
          'base-300': '#dbeee0',
          'base-content': '#1f3529',
          info: '#0284c7',
          success: '#16a34a',
          warning: '#ca8a04',
          error: '#dc2626',
        },
      },
    ],
    darkTheme: 'boke-night',
    logs: false,
  },
}
