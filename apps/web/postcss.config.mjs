import legacy from './tailwind.config.mjs';

export default {
  plugins: {
    tailwindcss: {
      ...legacy,
      content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
    },
  },
};
