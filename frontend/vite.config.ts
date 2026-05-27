/// <reference types="vitest/config" />
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

const isTest = process.env.VITEST === 'true'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: isTest ? [] : [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test-setup.ts',
        'src/vite-env.d.ts',
        'wailsjs/**',
      ],
    },
  },
})