/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: '#F5F6F7',
        paper: '#ECEEEF',
        ink: '#242628',
        muted: '#62686D',
        line: '#E3E5E7',
        coral: '#C91D20',
        'coral-dark': '#A8171A',
        teal: '#176B68',
        mint: '#E5F1ED',
        success: '#267A4A',
        danger: '#B42318',
        warning: '#A15C10',
      },
      fontFamily: {
        sans: ['Geist_400Regular'],
        medium: ['Geist_500Medium'],
        semibold: ['Geist_600SemiBold'],
        bold: ['Geist_700Bold'],
        extra: ['Geist_800ExtraBold'],
      },
      borderRadius: {
        card: '8px',
      },
    },
  },
  plugins: [],
};
