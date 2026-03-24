/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'hrms-dark': '#0d1117',
        'hrms-card': '#161b22',
        'hrms-blue': '#58a6ff',
      }
    },
  },
  plugins: [],
}
