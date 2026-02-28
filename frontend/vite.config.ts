import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['baknusdrive.smkbn666.sch.id'],
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api/forms': {
        target: 'http://forms:8080',
        changeOrigin: true,
      },
      '/f/': {
        target: 'http://forms:8080',
        changeOrigin: true,
        rewrite: (path) => '/api/forms' + path,
      },
      '/api': {
        target: 'http://backend:8080',
        changeOrigin: true,
      }
    }
  },
})
