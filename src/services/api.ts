// Configuración base de la API para peticiones HTTP
import axios from 'axios';

// API_BASE_URL se obtiene de variables de entorno definidas en .env
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Configuración de axios con interceptores para optimización
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Sistema de caché profesional con localStorage
class CacheService {
  private static instance: CacheService;
  private cachePrefix = 'yecy_cache_';
  private defaultTTL = 2 * 60 * 60 * 1000; // 2 horas en milisegundos

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private getKey(key: string): string {
    return `${this.cachePrefix}${key}`;
  }

  set(key: string, data: any, ttl: number = this.defaultTTL): void {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        ttl,
        expiresAt: Date.now() + ttl
      };
      localStorage.setItem(this.getKey(key), JSON.stringify(cacheData));
      console.log(`[Cache] Datos guardados para: ${key}`);
    } catch (error) {
      console.warn(`[Cache] Error guardando en localStorage:`, error);
    }
  }

  get(key: string): any | null {
    try {
      const cached = localStorage.getItem(this.getKey(key));
      if (!cached) {
        console.log(`[Cache] No hay datos en caché para: ${key}`);
        return null;
      }

      const cacheData = JSON.parse(cached);
      const now = Date.now();

      if (now > cacheData.expiresAt) {
        console.log(`[Cache] Datos expirados para: ${key}`);
        this.remove(key);
        return null;
      }

      console.log(`[Cache] Datos recuperados de caché para: ${key}`);
      return cacheData.data;
    } catch (error) {
      console.warn(`[Cache] Error leyendo de localStorage:`, error);
      this.remove(key);
      return null;
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.getKey(key));
      console.log(`[Cache] Datos eliminados para: ${key}`);
    } catch (error) {
      console.warn(`[Cache] Error eliminando de localStorage:`, error);
    }
  }

  clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.cachePrefix)) {
          localStorage.removeItem(key);
        }
      });
      console.log('[Cache] Caché limpiado completamente');
    } catch (error) {
      console.warn(`[Cache] Error limpiando caché:`, error);
    }
  }

  isExpired(key: string): boolean {
    try {
      const cached = localStorage.getItem(this.getKey(key));
      if (!cached) return true;

      const cacheData = JSON.parse(cached);
      return Date.now() > cacheData.expiresAt;
    } catch {
      return true;
    }
  }
}

// Instancia global del servicio de caché
const cacheService = CacheService.getInstance();

// Interceptor para cache de respuestas HTTP
const responseCache = new Map();

api.interceptors.request.use(
  (config) => {
    // Agregar timestamp para evitar cache del navegador
    if (config.method === 'get') {
      config.params = { ...config.params, _t: Date.now() };
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    // Cache de respuestas exitosas por 5 minutos
    if (response.config.method === 'get' && response.status === 200) {
      const cacheKey = `${response.config.url}${JSON.stringify(response.config.params || {})}`;
      responseCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now(),
        ttl: 5 * 60 * 1000 // 5 minutos
      });
    }
    return response;
  },
  (error) => {
    // Intentar usar cache si la petición falla
    if (error.config?.method === 'get') {
      const cacheKey = `${error.config.url}${JSON.stringify(error.config.params || {})}`;
      const cached = responseCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        console.log('[API] Usando caché de respuesta debido a error HTTP');
        return Promise.resolve({ data: cached.data, fromCache: true });
      }
    }
    return Promise.reject(error);
  }
);

// Prefijo profesional para rutas de cliente
const CLIENTE_API_PREFIX = '/api/cliente';

// Función helper para manejar errores de manera profesional
const getErrorMessage = (error: any, resource: string): string => {
  if (error.response) {
    // Error de respuesta del servidor
    const status = error.response.status;
    if (status === 50) {
      return `Error interno del servidor al cargar ${resource}. Intenta más tarde.`;
    } else if (status === 44) {
      return `${resource.charAt(0).toUpperCase() + resource.slice(1)} no encontrados.`;
    } else if (status === 43) {
      return `No tienes permisos para acceder a ${resource}.`;
    } else {
      return `Error ${status} al cargar ${resource}.`;
    }
  } else if (error.request) {
    // Error de red
    if (error.code === 'ECONNABORTED') {
      return `Tiempo de espera agotado al cargar ${resource}. Verifica tu conexión.`;
    } else {
      return `Error de conexión al cargar ${resource}. Verifica tu internet.`;
    }
  } else {
    // Otro tipo de error
    return `Error inesperado al cargar ${resource}.`;
  }
};

// Servicio optimizado para categorías con caché profesional
export const categoriasService = {
  // Obtener categorías con caché inteligente
  async getCategorias(forceRefresh: boolean = false) {
    const cacheKey = 'categorias';
    
    try {
      // Si no se fuerza refresh, intentar usar caché
      if (!forceRefresh) {
        const cachedData = cacheService.get(cacheKey);
        if (cachedData) {
          return cachedData;
        }
      }

      console.log('[API] Obteniendo categorías desde el servidor...');
      const response = await api.get(`${CLIENTE_API_PREFIX}/categorias/`);
      
      // Guardar en caché
      cacheService.set(cacheKey, response.data);
      
      // Sincronización en segundo plano si los datos están próximos a expirar
      if (cacheService.isExpired(cacheKey)) {
        setTimeout(() => {
          categoriasService.getCategorias(true);
        }, 1000);
      }
      
      return response.data;
    } catch (error) {
      console.error('[API] Error obteniendo categorías:', error);
      
      // Intentar usar caché expirado como último recurso
      const cachedData = cacheService.get(cacheKey);
      if (cachedData) {
        console.log('[API] Usando datos expirados de caché como fallback');
        return cachedData;
      }
      
      // Devolver error amigable
      const errorMessage = getErrorMessage(error, 'categorías');
      throw new Error(errorMessage);
    }
  },

  // Obtener subcategorías con caché inteligente
  async getSubcategorias(categoriaId: number, forceRefresh: boolean = false) {
    const cacheKey = `subcategorias_${categoriaId}`;
    
    try {
      // Si no se fuerza refresh, intentar usar caché
      if (!forceRefresh) {
        const cachedData = cacheService.get(cacheKey);
        if (cachedData) {
          return cachedData;
        }
      }

      console.log(`[API] Obteniendo subcategorías para categoría ${categoriaId} desde el servidor...`);
      const response = await api.get(`${CLIENTE_API_PREFIX}/categorias/${categoriaId}/subcategorias/`);
      
      // Guardar en caché
      cacheService.set(cacheKey, response.data);
      
      return response.data;
    } catch (error) {
      console.error(`[API] Error obteniendo subcategorías para categoría ${categoriaId}:`, error);
      
      // Intentar usar caché expirado como último recurso
      const cachedData = cacheService.get(cacheKey);
      if (cachedData) {
        console.log(`[API] Usando datos expirados de caché como fallback para subcategorías ${categoriaId}`);
        return cachedData;
      }
      
      throw error;
    }
  },

  // Limpiar caché de categorías
  clearCache() {
    cacheService.remove('categorias');
    // Limpiar todas las subcategorías
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.includes('subcategorias_')) {
        localStorage.removeItem(key);
      }
    });
    console.log('[Cache] Caché de categorías limpiado');
  }
};

// Servicio optimizado para productos destacados con caché profesional
export const productosDestacadosService = {
  // Obtener productos destacados con caché inteligente
  async getProductosDestacados(forceRefresh: boolean = false) {
    const cacheKey = 'productos_destacados';
    
    try {
      // Si no se fuerza refresh, intentar usar caché
      if (!forceRefresh) {
        const cachedData = cacheService.get(cacheKey);
        if (cachedData) {
          return cachedData;
        }
      }

      console.log('[API] Obteniendo productos destacados desde el servidor...');
      const response = await api.get(`${CLIENTE_API_PREFIX}/productos/destacados/`);
      const data = response.data.results || response.data;
      
      // Guardar en caché
      cacheService.set(cacheKey, data);
      
      // Sincronización en segundo plano si los datos están próximos a expirar
      if (cacheService.isExpired(cacheKey)) {
        setTimeout(() => {
          this.getProductosDestacados(true);
        }, 1000);
      }
      
      return data;
    } catch (error) {
      console.error('[API] Error obteniendo productos destacados:', error);
      
      // Intentar usar caché expirado como último recurso
      const cachedData = cacheService.get(cacheKey);
      if (cachedData) {
        console.log('[API] Usando datos expirados de caché como fallback');
        return cachedData;
      }
      
      throw error;
    }
  },

  // Limpiar caché de productos destacados
  clearCache() {
    cacheService.remove('productos_destacados');
    console.log('[Cache] Caché de productos destacados limpiado');
  }
};

// Utilidades de caché para uso global
export const cacheUtils = {
  // Limpiar todo el caché
  clearAllCache() {
    cacheService.clear();
  },
  
  // Obtener estadísticas del caché
  getCacheStats() {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(key => key.startsWith('yecy_cache_'));
    return {
      totalItems: cacheKeys.length,
      items: cacheKeys.map(key => ({
        key: key.replace('yecy_cache_', ''),
        size: localStorage.getItem(key)?.length || 0,
        expired: cacheService.isExpired(key.replace('yecy_cache_', ''))
      }))
    };
  }
};

export default api;