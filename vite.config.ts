import { defineConfig } from 'vite'
export default defineConfig({
  resolve: {
    alias: {
      '@wysiwygkit/core': '/packages/core/src/index.ts',
      '@wysiwygkit/react': '/packages/react/src/index.tsx',
    },
  },
  build: {
    rollupOptions: { input: ['index.html', 'demos/web/index.html', 'demos/react/index.html'] },
  },
})
