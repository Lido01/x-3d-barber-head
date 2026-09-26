import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const proxy = {
  "/api": "http://127.0.0.1:8000",
  "/media": "http://127.0.0.1:8000",
}

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    proxy,
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
})
