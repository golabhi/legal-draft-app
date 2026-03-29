/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c0d3ff',
          300: '#91b0ff',
          400: '#5a84ff',
          500: '#2d59f5',
          600: '#1a3ce8',
          700: '#142db5',
          800: '#162690',
          900: '#172272',
          950: '#0f1545',
        },
      },
    },
  },
  plugins: [],
}
