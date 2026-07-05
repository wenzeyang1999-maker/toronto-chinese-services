/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        gold: {
          400: '#f5c842',
          500: '#f0b429',
          600: '#d4980f',
        },
        // ── Semantic state tokens ────────────────────────────────────────────
        // Use these for state instead of raw green/red/amber, so success /
        // danger / warning stay one consistent hue (closes the green↔emerald
        // drift). Additive — existing utilities are untouched.
        success: {
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0',
          500: '#10b981', 600: '#059669', 700: '#047857',
        },
        danger: {
          50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca',
          500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
        },
        warning: {
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a',
          500: '#f59e0b', 600: '#d97706', 700: '#b45309',
        },
        info: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe',
          500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      }
    },
  },
  plugins: [],
}
