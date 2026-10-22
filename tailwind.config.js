/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f2',
          100: '#ffe4e6',
          500: '#ff385c',
          600: '#e31c5f',
          700: '#bd1e59',
        },
      },
      boxShadow: {
        card: '0 6px 20px rgba(0,0,0,0.08)',
        search: '0 3px 12px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
};
