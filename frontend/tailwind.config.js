/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'shanhai-blue': '#1a5c8a',
        'shanhai-gold': '#c9a84c',
        'shanhai-dark': '#1a2a4a',
        'primary-blue': '#2563EB',
        'secondary-teal': '#00BFA6',
        'bg-light': '#F5F7FB',
        'glass-white': 'rgba(255,255,255,0.88)',
        'text-dark': '#0F172A',
        'text-sec': '#64748B',
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.05)',
        'card': '0 2px 12px rgba(0, 0, 0, 0.04)',
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}