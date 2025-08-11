/**
 * Interceptor de autenticación para incluir automáticamente el token JWT en las peticiones
 */

// Guardar la función fetch original
const originalFetch = window.fetch;

// Sobrescribir la función fetch global
window.fetch = async function (resource, options = {}) {
  // Configurar los encabezados por defecto
  const headers = new Headers(options.headers || {});

  // Si es una petición a nuestra API y no es una petición de autenticación
  if (
    typeof resource === "string" &&
    resource.startsWith("/api/") &&
    !resource.includes("/auth/")
  ) {
    // Obtener el token del localStorage
    const token = localStorage.getItem("token");

    // Si hay un token, agregarlo al encabezado de autorización
    if (token) {
      if (!headers.has("Authorization")) {
        headers.append("Authorization", `Bearer ${token}`);
      }

      // Asegurarse de que el Content-Type sea application/json para las peticiones POST/PUT
      if (
        (!options.method ||
          options.method.toUpperCase() === "POST" ||
          options.method.toUpperCase() === "PUT") &&
        !headers.has("Content-Type")
      ) {
        headers.append("Content-Type", "application/json");
      }
    }
  }

  // Crear las nuevas opciones de la petición
  const newOptions = {
    ...options,
    headers,
    credentials: "same-origin", // Importante para incluir cookies si las hay
  };

  try {
    const response = await originalFetch(resource, newOptions);

    // Si la respuesta es 401 (No autorizado), redirigir al login
    if (response.status === 401) {
      console.error("Error de autenticación. Redirigiendo al login...");
      // Mostrar mensaje al usuario
      if (typeof showNotification === "function") {
        showNotification(
          "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.",
          "error"
        );
      }

      // Redirigir al login después de un breve retraso
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);

      return Promise.reject(new Error("No autorizado"));
    }

    return response;
  } catch (error) {
    console.error("Error en la petición:", error);
    throw error;
  }
};

// Función para verificar si el usuario está autenticado
function isAuthenticated() {
  return !!getAuthToken();
}

// Función para obtener el token de autenticación
function getAuthToken() {
  // Primero intentar obtener el token de las cookies (para compatibilidad con SSR)
  const tokenFromCookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith("token="))
    ?.split("=")[1];

  // Si no hay token en las cookies, intentar obtenerlo del localStorage
  const tokenFromStorage = localStorage.getItem("token");

  // Devolver el token de las cookies si existe, si no, el del localStorage
  return tokenFromCookie || tokenFromStorage;
}

// Función para establecer el token de autenticación
function setAuthToken(token) {
  if (token) {
    // Guardar en localStorage
    localStorage.setItem("token", token);

    // También guardar en cookies para compatibilidad con SSR
    const expires = new Date();
    expires.setTime(expires.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 días
    document.cookie = `token=${token};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  } else {
    // Eliminar de ambos lugares
    localStorage.removeItem("token");
    document.cookie = "token=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;";
  }
}

// Función para cerrar sesión
function logout() {
  // Eliminar el token del almacenamiento local
  setAuthToken(null);
  localStorage.removeItem("user");

  // Redirigir a la página de inicio
  window.location.href = "/";
}

// Exportar funciones para su uso en otros archivos
window.auth = {
  isAuthenticated,
  getAuthToken,
  setAuthToken,
  logout,
};

// Restaurar sesión automáticamente si hay token válido
async function restoreSession() {
  const token = getAuthToken();
  if (!token) return;
  try {
    const response = await originalFetch("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "same-origin",
    });
    if (response.ok) {
      const data = await response.json();
      if (data.usuario) {
        // Guardar usuario en localStorage para acceso rápido en el frontend
        localStorage.setItem("user", JSON.stringify(data.usuario));
        window.dispatchEvent(
          new CustomEvent("user-restored", { detail: data.usuario })
        );
      }
    } else {
      // Token inválido, limpiar sesión
      setAuthToken(null);
      localStorage.removeItem("user");
    }
  } catch (e) {
    setAuthToken(null);
    localStorage.removeItem("user");
  }
}

// Ejecutar restauración de sesión al cargar la página
document.addEventListener("DOMContentLoaded", restoreSession);

console.log("Interceptor de autenticación cargado correctamente");
