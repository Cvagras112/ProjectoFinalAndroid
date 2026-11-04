
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    outDir: 'dist-admin',
    emptyOutDir: true,
    rolldownOptions: {
      input: resolve(import.meta.dirname, 'admin-preview.html')
    }
  }
})
