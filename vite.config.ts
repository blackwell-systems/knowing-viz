import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  base: '/knowing-viz/',
  plugins: [react()],
  build: { outDir: 'dist' }
})
