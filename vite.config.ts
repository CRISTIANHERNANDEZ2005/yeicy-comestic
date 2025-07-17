import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv';
dotenv.config();

// https://vite.dev/config/
// Configuración profesional de proxy para Vite
// Usa VITE_API_URL desde .env para enrutar correctamente en desarrollo
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy solo para API REST (sin WebSocket)
      '/api': {
        target: process.env.VITE_API_URL || 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        // ws eliminado: solo HTTP
      },
    },
  },
})
// Para producción, asegúrate de que VITE_API_URL apunte al backend real
