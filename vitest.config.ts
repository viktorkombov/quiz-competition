import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Vitest config is kept separate from vite.config.ts so the build config stays
// on pure Vite types (avoids the dual-Vite Plugin type clash between vite and
// vitest's bundled vite). No React plugin is needed here — esbuild's automatic
// JSX runtime is enough to transform components for tests.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
