import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    include: ['tests/media/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@wysiwygkit/core': new URL('./packages/core/src/index.ts', import.meta.url).pathname,
      '@wysiwygkit/media': new URL('./packages/media/src/index.ts', import.meta.url).pathname,
    },
  },
})
