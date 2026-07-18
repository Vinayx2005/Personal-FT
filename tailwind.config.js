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
        '18-orange': '#F37335',
        '18-yellow': '#FFF392',
        '18-charcoal': '#1A1A1A',
        '18-dark-text': '#494949',
        '18-black': '#141414',
        '18-white': '#FFFFFF',
        '18-bg': '#FAFAFA',
        '18-border': '#E8E8E8',
      },
      fontFamily: {
        lato: ['Lato', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
      },
      borderRadius: {
        '18-md': '16px',
        '18-sm': '10px',
      },
      spacing: {
        '18-xs': '4px',
        '18-sm': '8px',
        '18-md': '16px',
        '18-lg': '24px',
        '18-xl': '32px',
        '18-2xl': '48px',
      },
    },
  },
  plugins: [],
};
