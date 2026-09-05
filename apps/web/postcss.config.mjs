import legacy from '../../frontend-astro/tailwind.config.mjs';

export default {
  plugins: {
    tailwindcss: {
      ...legacy,
      content: ['../../frontend-astro/src/**/*.{astro,html,js,md,mdx,ts}', './src/**/*.{ts,tsx}'],
    },
  },
};
