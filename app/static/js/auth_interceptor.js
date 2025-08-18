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

    // Si la respuesta es 401 (No autorizado), manejar según el contexto
    if (response.status === 401) {
      // Si la petición es de login o register, no redirigir, solo devolver el error
      if (
        typeof resource === "string" &&
        (resource.includes("/auth/login") || resource.includes("/auth/register"))
      ) {
        return response;
      }
      // Para otras rutas protegidas, mostrar notificación y redirigir
      console.error("Error de autenticación. Redirigiendo al login...");
      if (typeof showNotification === "function") {
        showNotification(
          "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.",
          "error"
        );
      }
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
  // Prioridad: cookie > sessionStorage > localStorage
  const tokenFromCookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith("token="))
    ?.split("=")[1];
  const tokenFromSession = sessionStorage.getItem("token");
  const tokenFromStorage = localStorage.getItem("token");
  return tokenFromCookie || tokenFromSession || tokenFromStorage;
}

// Función para establecer el token de autenticación
function setAuthToken(token) {
  if (token) {
    localStorage.setItem("token", token);
    sessionStorage.setItem("token", token);
    const expires = new Date();
    expires.setTime(expires.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 días
    document.cookie = `token=${token};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  } else {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    // Borrar cookie con los mismos atributos que al setearla
    document.cookie = "token=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax";
  }
}

// Función para cerrar sesión

async function logout() {
  try {
    await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (e) {}
  // Notificar a otras pestañas que se cerró sesión
  localStorage.setItem('logout-event', Date.now().toString());
  setAuthToken(null);
  localStorage.removeItem("user");
  // Forzar recarga sin restaurar sesión
  window.location.replace("/");
}

// Sincronizar logout entre pestañas
window.addEventListener('storage', function(event) {
  if (event.key === 'logout-event') {
    setAuthToken(null);
    localStorage.removeItem("user");
    window.location.href = "/";
  }
});

// Exportar funciones para su uso en otros archivos
window.auth = {
  isAuthenticated,
  getAuthToken,
  setAuthToken,
  logout,
};

// Restaurar sesión automáticamente si hay token válido y la cookie no está vacía
async function restoreSession() {
  // Solo restaurar si hay token en cookie, sessionStorage o localStorage
  const token = getAuthToken();
  // Verificar que la cookie no esté vacía (previene restauración tras logout)
  const cookieToken = document.cookie
    .split('; ')
    .find((row) => row.startsWith('token='))
    ?.split('=')[1];
  if (!token || cookieToken === undefined || cookieToken === "") return;
  try {
    const response = await originalFetch("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "same-origin",
    });
    if (response.ok) {
      const data = await response.json();
      if (data.usuario) {
        localStorage.setItem("user", JSON.stringify(data.usuario));
        window.dispatchEvent(
          new CustomEvent("user-restored", { detail: data.usuario })
        );
      }
    } else {
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
