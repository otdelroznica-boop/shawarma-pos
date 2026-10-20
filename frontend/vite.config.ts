import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// mode "demo" — сборка для GitHub Pages: API эмулируется в браузере (.env.demo)
export default defineConfig(({ mode }) => ({
  base: mode === 'demo' ? '/shawarma-pos/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000'
    }
  }
}))
