/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#DA251D",
        secondary: "#8B2F31",
        error: "#5A0F0B",
        success: "#16A34A",
        warning: "#F59E0B",
        glass: 'rgba(255, 255, 255, 0.8)',
        'glass-dark': 'rgba(0, 0, 0, 0.05)',
      },
      textColor: {
        primary: "#DA251D",
        secondary: "#8B2F31",
        error: "#5A0F0B",
      },
      backgroundColor: {
        primary: "#DA251D",
        secondary: "#8B2F31",
        error: "#5A0F0B",
      },
      borderColor: {
        primary: "#DA251D",
        secondary: "#8B2F31",
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
