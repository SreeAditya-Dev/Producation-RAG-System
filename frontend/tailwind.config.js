/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#050508',
          secondary: '#0a0a14',
          card: '#0d0d1a',
          hover: '#12121f',
          glass: 'rgba(255,255,255,0.03)',
        },
        accent: {
          purple: '#7c3aed',
          'purple-light': '#a855f7',
          cyan: '#06b6d4',
          'cyan-bright': '#00e5ff',
          green: '#10b981',
          'green-bright': '#00ff88',
          orange: '#f59e0b',
          red: '#ef4444',
          blue: '#3b82f6',
          violet: '#8b5cf6',
        },
        neon: {
          purple: '#b44dff',
          cyan: '#00e5ff',
          green: '#00ff88',
          orange: '#ff9900',
          red: '#ff2d55',
        },
        border: {
          DEFAULT: '#1e1e3a',
          light: '#2a2a50',
          glow: '#3d3d6e',
        },
        text: {
          primary: '#f0f0ff',
          secondary: '#94a3b8',
          muted: '#4a5568',
          dim: '#2d3748',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flow': 'flow 2s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'glow-strong': 'glowStrong 1.5s ease-in-out infinite alternate',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        'shimmer': 'shimmer 2.5s linear infinite',
        'data-flow': 'dataFlow 1.8s linear infinite',
        'orbit': 'orbit 3s linear infinite',
        'orbit-reverse': 'orbitReverse 4s linear infinite',
        'scan': 'scan 4s linear infinite',
        'float': 'float 4s ease-in-out infinite',
        'pulse-dot': 'pulseDot 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'type-cursor': 'typeCursor 1s step-end infinite',
        'gradient-x': 'gradientX 4s ease infinite',
        'spin-slow': 'spin 6s linear infinite',
        'bounce-subtle': 'bounceSubtle 2s ease-in-out infinite',
        'count-up': 'countUp 0.4s ease-out',
        'enter-right': 'enterRight 0.3s ease-out',
        'enter-down': 'enterDown 0.3s ease-out',
        'ping-once': 'pingOnce 0.6s cubic-bezier(0, 0, 0.2, 1) forwards',
        'glow-border': 'glowBorder 2s ease-in-out infinite',
      },
      keyframes: {
        flow: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(124, 58, 237, 0.3)' },
          '100%': { boxShadow: '0 0 25px rgba(124, 58, 237, 0.8), 0 0 50px rgba(124, 58, 237, 0.3)' },
        },
        glowStrong: {
          '0%': { boxShadow: '0 0 10px rgba(0, 229, 255, 0.4)' },
          '100%': { boxShadow: '0 0 40px rgba(0, 229, 255, 0.9), 0 0 80px rgba(0, 229, 255, 0.3)' },
        },
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
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        dataFlow: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
        orbit: {
          '0%': { transform: 'rotate(0deg) translateX(20px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(20px) rotate(-360deg)' },
        },
        orbitReverse: {
          '0%': { transform: 'rotate(0deg) translateX(24px) rotate(0deg)' },
          '100%': { transform: 'rotate(-360deg) translateX(24px) rotate(360deg)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.85)' },
        },
        typeCursor: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        gradientX: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
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
        pingOnce: {
          '75%, 100%': { transform: 'scale(2)', opacity: '0' },
        },
        glowBorder: {
          '0%, 100%': { borderColor: 'rgba(124, 58, 237, 0.4)' },
          '50%': { borderColor: 'rgba(168, 85, 247, 0.9)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'grid-pattern': 'linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)',
        'dot-pattern': 'radial-gradient(circle, rgba(124,58,237,0.15) 1px, transparent 1px)',
        'shimmer-gradient': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
        'neon-gradient': 'linear-gradient(135deg, #7c3aed 0%, #06b6d4 50%, #10b981 100%)',
        'data-stream': 'linear-gradient(90deg, transparent 0%, #00e5ff 50%, transparent 100%)',
        'card-shine': 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 60%)',
      },
      backgroundSize: {
        'grid': '32px 32px',
        'dot': '24px 24px',
        '200': '200% 100%',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'neon-purple': '0 0 20px rgba(124, 58, 237, 0.6), 0 0 40px rgba(124, 58, 237, 0.2)',
        'neon-cyan': '0 0 20px rgba(0, 229, 255, 0.6), 0 0 40px rgba(0, 229, 255, 0.2)',
        'neon-green': '0 0 20px rgba(0, 255, 136, 0.6), 0 0 40px rgba(0, 255, 136, 0.2)',
        'card': '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
        'inner-glow': 'inset 0 0 20px rgba(124, 58, 237, 0.1)',
      },
    },
  },
  plugins: [],
}
