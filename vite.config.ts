import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Reproduz localmente o mesmo encaminhamento usado pelo netlify.toml em produção.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/backend': {
        target: 'http://52.67.144.140',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/backend(?=\/|$)/, '/transmassa-api')
      },
      '/api': {
        target: 'http://52.67.144.140',
        changeOrigin: true,
        rewrite: path => `/transmassa-api${path}`
      }
    }
  }
})
