import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api/forms': {
        target: 'http://forms:8080',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://backend:8080',
        changeOrigin: true,
      }
    }
  },
})
