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
        paper:    '#F7F6F2', // page ground (warm off-white)
        paper2:   '#FBFAF7', // alternating band, slightly lighter
        card:     '#FFFFFF',
        ink:      '#111110', // primary text
        ink2:     '#3A3A38', // body text
        muted:    '#7A7A74', // labels, captions
        line:     '#E4E1D8', // borders
        amber:    '#E7B84B', // accent dot / underline
        note:     '#F4EED2', // sticky note
        sage:     '#E3EDE0', // CTA banner
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        hand: ['Caveat', 'Segoe Script', 'cursive'],
      },
    },
  },
  plugins: [],
};
