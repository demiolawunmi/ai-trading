import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Bundle domain from TS source so ESM named exports resolve (CJS dist breaks Rollup).
      '@ai-trading/domain': path.join(workspaceRoot, 'packages/domain/src/index.ts'),
    },
  },
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:4000', changeOrigin: true },
    },
  },
})
