/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        'xs': '480px',
      },
      colors: {
        bg: {
          primary: '#131315',
          secondary: '#131315',
          card: '#131315',
          hover: 'rgba(244, 131, 31, 0.1)',
          glass: 'rgba(244, 131, 31, 0.05)',
        },
        accent: {
          primary: '#F4831F',
          light: 'rgba(244, 131, 31, 0.8)',
          dark: 'rgba(244, 131, 31, 0.6)',
        },
        border: {
          DEFAULT: 'rgba(244, 131, 31, 0.2)',
          light: 'rgba(244, 131, 31, 0.3)',
          strong: '#F4831F',
        },
        text: {
          primary: '#ffffff',
          secondary: 'rgba(255, 255, 255, 0.7)',
          muted: 'rgba(255, 255, 255, 0.5)',
          dim: 'rgba(255, 255, 255, 0.3)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        'float': 'float 4s ease-in-out infinite',
        'spin-slow': 'spin 6s linear infinite',
        'count-up': 'countUp 0.4s ease-out',
        'enter-right': 'enterRight 0.3s ease-out',
        'enter-down': 'enterDown 0.3s ease-out',
        'pop-in': 'popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-12px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        countUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        enterRight: {
          '0%': { transform: 'translateX(16px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        enterDown: {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        popIn: {
          '0%': { transform: 'scale(0.75)', opacity: '0' },
          '70%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      backgroundSize: {
        '200': '200% 100%',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0,0,0,0.5)',
        'card-hover': '0 4px 16px rgba(244, 131, 31, 0.3)',
      },
    },
  },
  plugins: [],
}
