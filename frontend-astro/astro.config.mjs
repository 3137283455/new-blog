import mdx from '@astrojs/mdx'
import node from '@astrojs/node'
import tailwind from '@astrojs/tailwind'
import { defineConfig } from 'astro/config'

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  devToolbar: {
    enabled: false,
  },
  security: {
    checkOrigin: false,
  },
  integrations: [
    mdx(),
    tailwind({
      configFile: './tailwind.config.mjs',
    }),
  ],
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
  },
})
