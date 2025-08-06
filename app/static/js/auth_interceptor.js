/**
 * Interceptor de autenticación para incluir automáticamente el token JWT en las peticiones
 */

// Guardar la función fetch original
const originalFetch = window.fetch;

// Sobrescribir la función fetch global
window.fetch = async function(resource, options = {}) {
    // Configurar los encabezados por defecto
    const headers = new Headers(options.headers || {});
    
    // Si es una petición a nuestra API y no es una petición de autenticación
    if (typeof resource === 'string' && 
        resource.startsWith('/api/') && 
        !resource.includes('/auth/')) {
        
        // Obtener el token del localStorage
        const token = localStorage.getItem('token');
        
        // Si hay un token, agregarlo al encabezado de autorización
        if (token) {
            if (!headers.has('Authorization')) {
                headers.append('Authorization', `Bearer ${token}`);
            }
            
            // Asegurarse de que el Content-Type sea application/json para las peticiones POST/PUT
            if ((!options.method || options.method.toUpperCase() === 'POST' || options.method.toUpperCase() === 'PUT') && 
                !headers.has('Content-Type')) {
                headers.append('Content-Type', 'application/json');
            }
        }
    }
    
    // Crear las nuevas opciones de la petición
    const newOptions = {
        ...options,
        headers,
        credentials: 'same-origin' // Importante para incluir cookies si las hay
    };
    
    try {
        const response = await originalFetch(resource, newOptions);
        
        // Si la respuesta es 401 (No autorizado), redirigir al login
        if (response.status === 401) {
            console.error('Error de autenticación. Redirigiendo al login...');
            // Mostrar mensaje al usuario
            if (typeof showNotification === 'function') {
                showNotification('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', 'error');
            }
            
            // Redirigir al login después de un breve retraso
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
            
            return Promise.reject(new Error('No autorizado'));
        }
        
        return response;
    } catch (error) {
        console.error('Error en la petición:', error);
        throw error;
    }
};

// Función para verificar si el usuario está autenticado
function isAuthenticated() {
    return !!localStorage.getItem('token');
}

// Función para obtener el token de autenticación
function getAuthToken() {
    return localStorage.getItem('token');
}

// Función para establecer el token de autenticación
function setAuthToken(token) {
    if (token) {
        localStorage.setItem('token', token);
    } else {
        localStorage.removeItem('token');
    }
}

// Función para cerrar sesión
function logout() {
    // Eliminar el token del almacenamiento local
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Redirigir a la página de inicio
    window.location.href = '/';
}

// Exportar funciones para su uso en otros archivos
window.auth = {
    isAuthenticated,
    getAuthToken,
    setAuthToken,
    logout
};

console.log('Interceptor de autenticación cargado correctamente');
