/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        'dark-purple': '#300A0A',
        'deep-purple': '#1A0000',
        'blood-red': '#8B0000',
        'orange-red': '#FF4500',
        'coral': '#FF7F50',
        'tomato': '#FF6347',
      },
      fontFamily: {
        'orbitron': ['Orbitron', 'sans-serif'],
        'exo': ['Exo 2', 'sans-serif'],
        'syncopate': ['Syncopate', 'sans-serif'],
      },
      boxShadow: {
        'orange-red': '0 0 10px #FF4500, 0 0 20px #FF4500',
        'blood-red': '0 0 10px #8B0000, 0 0 20px #8B0000',
        'coral': '0 0 10px #FF7F50, 0 0 20px #FF7F50',
      },
      backgroundImage: {
        'retro-grid': "url('/assets/textures/retro-grid.png')",
        'synthwave-gradient': 'linear-gradient(to bottom, #000000, #1A0000, #300A0A)',
      },
    },
  },
  plugins: [],
} 