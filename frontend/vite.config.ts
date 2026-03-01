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
    allowedHosts: [
      'baknusdrive.smkbn666.sch.id'
    ],
    proxy: {
      '/api/forms': {
        target: 'http://forms:8080',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://backend:8080',
        changeOrigin: true,
      },
      '/office': {
        target: 'http://onlyoffice-ds:80',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/office/, '')
      }
    }
  },
})
