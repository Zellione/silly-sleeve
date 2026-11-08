/// <reference types="vitest/config" />
/// <reference types="vite/client" />
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

// Vite loads this config as ESM ("type": "module"), where __dirname does not
// exist; derive the src directory from the module URL instead.
const srcDir = new URL('./src', import.meta.url).pathname

const isTest = (mode: string) => mode === 'test'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Vitest loads the config in mode "test" (no --mode needed): skip the React
  // plugin so the compiler/transform doesn't run twice in test runs.
  plugins: isTest(mode) ? [] : [react()],
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test-setup.ts',
        'src/vite-env.d.ts',
        'src/main.tsx',
      ],
    },
  },
}))