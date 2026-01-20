import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        hyper: {
          bg: '#0B0F14',
          panel: '#0F1520',
          panelHover: '#121A27',
          border: '#1D2A3A',
          textPrimary: '#E6EDF6',
          textSecondary: '#9AA7B2',
          muted: '#6B7785',
          accent: '#2DD4BF',
          positive: '#22C55E',
          negative: '#EF4444',
          warning: '#F59E0B',
        },
      },
    },
  },
  plugins: [],
  safelist: [
    'bg-hyper-bg',
    'bg-hyper-panel',
    'bg-hyper-panelHover',
    'bg-hyper-border',
    'text-hyper-textPrimary',
    'text-hyper-textSecondary',
    'text-hyper-muted',
    'text-hyper-accent',
    'text-hyper-positive',
    'text-hyper-negative',
    'text-hyper-warning',
    'border-hyper-border',
    'border-hyper-accent',
    'hover:bg-hyper-panelHover',
    'hover:bg-hyper-border',
  ],
}
export default config
