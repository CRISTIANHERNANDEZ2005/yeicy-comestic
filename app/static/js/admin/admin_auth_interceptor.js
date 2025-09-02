/**
 * Interceptor de autenticación para incluir automáticamente el token JWT de administrador en las peticiones
 */

// Guardar la función fetch original
const originalFetchAdmin = window.fetch;

// Sobrescribir la función fetch global para rutas de admin
window.fetch = async function (resource, options = {}) {
  // Configurar los encabezados por defecto
  const headers = new Headers(options.headers || {});

  

  // Crear las nuevas opciones de la petición
  const newOptions = {
    ...options,
    headers,
    credentials: "same-origin", // Importante para incluir cookies si las hay
  };

  try {
    const response = await originalFetchAdmin(resource, newOptions);

    // Si la respuesta es 401 (No autorizado) para una ruta de admin, redirigir al login de admin
    if (response.status === 401 && typeof resource === "string" && resource.startsWith("/admin/")) {
      console.error("Error de autenticación de administrador. Redirigiendo al login...");
      // Redirigir al login de admin
      window.location.href = "/administracion"; // Asumiendo que esta es la ruta de login de admin
      return Promise.reject(new Error("No autorizado como administrador"));
    }

    return response;
  } catch (error) {
    console.error("Error en la petición de administrador:", error);
    throw error;
  }
};

console.log("Interceptor de autenticación de administrador cargado correctamente");
