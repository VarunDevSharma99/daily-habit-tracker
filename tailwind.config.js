/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './dashboard/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        crushing: '#22c55e',
        solid: '#3b82f6',
        slipping: '#f59e0b',
        redzone: '#ef4444',
      },
    },
  },
  plugins: [],
};
