/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    '../../apps/web/src/**/*.{js,ts,jsx,tsx}',
    '../../apps/web/app/**/*.{js,ts,jsx,tsx}',
    '../../apps/web/components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          blue: '#00f3ff',
          purple: '#bc13fe',
          gold: '#ffd700'
        },
        glass: {
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          dark: 'rgba(0, 0, 0, 0.35)'
        }
      },
      boxShadow: {
        neon: '0 0 20px rgba(0, 243, 255, 0.35)',
        gold: '0 0 20px rgba(255, 215, 0, 0.35)'
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif']
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        pulseGlow: 'pulseGlow 2s ease-in-out infinite'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0, 243, 255, 0.2)' },
          '50%': { boxShadow: '0 0 25px rgba(0, 243, 255, 0.5)' }
        }
      }
    }
  },
  plugins: []
};
