/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Onest Variable"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Тёплая графитовая база + шафрановый акцент
        ink: {
          50: '#f7f6f4',
          100: '#efedea',
          200: '#e2ded8',
          300: '#c9c3ba',
          400: '#9c958a',
          500: '#767066',
          600: '#5a554d',
          700: '#3f3b36',
          800: '#2a2724',
          900: '#1c1a18',
          950: '#121110',
        },
        brand: {
          50: '#fff6ed',
          100: '#ffead4',
          200: '#ffd0a8',
          300: '#ffae70',
          400: '#ff8537',
          500: '#f76510',
          600: '#e04d07',
          700: '#b93a09',
          800: '#932f10',
          900: '#772910',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,26,24,.06), 0 1px 1px rgba(28,26,24,.04)',
        lift: '0 8px 24px -8px rgba(28,26,24,.18)',
      },
      keyframes: {
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(.96) translateY(4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'flash': {
          '0%, 100%': { backgroundColor: 'rgb(255 246 237)' },
          '50%': { backgroundColor: 'rgb(255 208 168)' },
        },
      },
      animation: {
        'pop-in': 'pop-in .16s ease-out',
        'slide-up': 'slide-up .22s ease-out',
        'flash': 'flash 1s ease-in-out 3',
      },
    },
  },
  plugins: [],
};
