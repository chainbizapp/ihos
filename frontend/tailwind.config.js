/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        // Design system tokens (design.md)
        primary: {
          DEFAULT: '#006874',
          container: '#49b2c1',
        },
        secondary: {
          DEFAULT: '#8c4f00',
          container: '#f7941d',
        },
        tertiary: {
          DEFAULT: '#435d98',
        },
        surface: {
          DEFAULT: '#f8f9ff',
          low: '#f0f4fd',
          lowest: '#ffffff',
        },
        'on-surface': '#171c22',
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.75rem',
        xl: '1.5rem',
        full: '9999px',
      },
      boxShadow: {
        lift: '0px 12px 32px rgba(17, 48, 105, 0.06)',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        body: ['"Be Vietnam Pro"', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
