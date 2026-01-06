import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // ★ここから下を追加
  server: {
    proxy: {
      "/.netlify/functions": "http://localhost:9999",
    },
  },
  // ★ここまで
})