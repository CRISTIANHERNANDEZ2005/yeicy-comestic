// Configuración base de la API para peticiones HTTP
import axios from 'axios';

// SOLO para desarrollo local, asegúrate de que el backend esté corriendo en 127.0.0.1:8000
// Usa VITE_API_URL para trabajar tanto local como en producción. Ejemplo en .env:
// VITE_API_URL=http://127.0.0.1:8000/api (local)
// VITE_API_URL=https://midominio.com/api (producción)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;