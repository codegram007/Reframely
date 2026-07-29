import type { Config } from 'tailwindcss';

/**
 * Vibestudio theme. All palette values are driven by CSS custom
 * properties defined in src/styles/theme.css so light/dark is a single
 * class swap on <html>. Tailwind consumes them via hsl(var(--token)).
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        // Semantic surfaces
        canvas: 'hsl(var(--canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'hsl(var(--surface) / <alpha-value>)',
          raised: 'hsl(var(--surface-raised) / <alpha-value>)',
          sunken: 'hsl(var(--surface-sunken) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'hsl(var(--border) / <alpha-value>)',
          strong: 'hsl(var(--border-strong) / <alpha-value>)',
        },
        foreground: {
          DEFAULT: 'hsl(var(--foreground) / <alpha-value>)',
          muted: 'hsl(var(--foreground-muted) / <alpha-value>)',
          subtle: 'hsl(var(--foreground-subtle) / <alpha-value>)',
        },
        // Brand accent (electric violet)
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          hover: 'hsl(var(--accent-hover) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
          subtle: 'hsl(var(--accent-subtle) / <alpha-value>)',
        },
        ring: 'hsl(var(--ring) / <alpha-value>)',
        // Status
        success: 'hsl(var(--success) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
        danger: 'hsl(var(--danger) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Deliberate typographic scale (1.20 minor-third), tight tracking
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
        xs: ['0.75rem', { lineHeight: '1.125rem', letterSpacing: '0.005em' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.4rem' }],
        md: ['0.9375rem', { lineHeight: '1.5rem' }],
        lg: ['1.0625rem', { lineHeight: '1.6rem', letterSpacing: '-0.01em' }],
        xl: ['1.3125rem', { lineHeight: '1.75rem', letterSpacing: '-0.015em' }],
        '2xl': ['1.625rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],
        '3xl': ['2.0625rem', { lineHeight: '2.375rem', letterSpacing: '-0.025em' }],
        '4xl': ['2.625rem', { lineHeight: '2.875rem', letterSpacing: '-0.03em' }],
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
      boxShadow: {
        // Soft, layered elevation — not the harsh default drop shadows
        xs: '0 1px 2px 0 hsl(var(--shadow) / 0.05)',
        sm: '0 1px 3px 0 hsl(var(--shadow) / 0.08), 0 1px 2px -1px hsl(var(--shadow) / 0.06)',
        md: '0 4px 12px -2px hsl(var(--shadow) / 0.1), 0 2px 6px -2px hsl(var(--shadow) / 0.06)',
        lg: '0 12px 32px -8px hsl(var(--shadow) / 0.16), 0 4px 12px -4px hsl(var(--shadow) / 0.08)',
        glow: '0 0 0 1px hsl(var(--accent) / 0.4), 0 4px 20px -4px hsl(var(--accent) / 0.35)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'hero-float': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-10px) rotate(0.4deg)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        'orb-drift-a': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(4%, -6%) scale(1.05)' },
          '66%': { transform: 'translate(-5%, 3%) scale(0.96)' },
        },
        'orb-drift-b': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '40%': { transform: 'translate(-6%, 5%) scale(1.08)' },
          '70%': { transform: 'translate(5%, -4%) scale(0.94)' },
        },
        'shine-sweep': {
          '0%': { transform: 'translateX(-120%) skewX(-12deg)' },
          '100%': { transform: 'translateX(220%) skewX(-12deg)' },
        },
        'border-glow': {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.85' },
        },
        'float-y': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'translateY(20px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'hero-float': 'hero-float 7s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        'orb-drift-a': 'orb-drift-a 18s ease-in-out infinite',
        'orb-drift-b': 'orb-drift-b 22s ease-in-out infinite',
        'shine-sweep': 'shine-sweep 2.2s ease-in-out infinite',
        'border-glow': 'border-glow 3.5s ease-in-out infinite',
        'float-y': 'float-y 5s ease-in-out infinite',
        'scale-in': 'scale-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
} satisfies Config;
