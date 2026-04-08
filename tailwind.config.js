/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#B91C1C",
        secondary: "#7F1D1D",
        error: "#5A0F0B",
        success: "#16A34A",
        warning: "#F59E0B",
        glass: 'rgba(255, 255, 255, 0.8)',
        'glass-dark': 'rgba(0, 0, 0, 0.05)',
      },
      textColor: {
        primary: "#B91C1C",
        secondary: "#7F1D1D",
        error: "#5A0F0B",
      },
      backgroundColor: {
        primary: "#B91C1C",
        secondary: "#7F1D1D",
        error: "#5A0F0B",
      },
      borderColor: {
        primary: "#B91C1C",
        secondary: "#7F1D1D",
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
