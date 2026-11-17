import { defineConfig } from 'vite'
export default defineConfig({
  server: {
    proxy: { '/api/media': 'http://127.0.0.1:13701', '/media/published': 'http://127.0.0.1:13701' },
  },
  resolve: {
    alias: {
      '@wysiwygkit/core': '/packages/core/src/index.ts',
      '@wysiwygkit/react': '/packages/react/src/index.tsx',
    },
  },
  build: {
    rollupOptions: {
      input: [
        'index.html',
        'demos/web/index.html',
        'demos/react/index.html',
        'demos/media/index.html',
        'demos/media-react/index.html',
      ],
    },
  },
})
