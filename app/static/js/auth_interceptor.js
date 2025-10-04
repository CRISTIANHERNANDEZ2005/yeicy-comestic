/**
 * Módulo Interceptor de Autenticación del Cliente.
 *
 * Este script intercepta todas las llamadas `fetch` salientes para gestionar de forma
 * centralizada la autenticación del cliente mediante tokens JWT.
 *
 * Funcionalidades Clave:
 * 1.  **Inyección Automática de Token JWT:** Añade el encabezado `Authorization: Bearer <token>`
 *     a las peticiones dirigidas a la API del cliente (`/api/...`), excluyendo las rutas de autenticación.
 * 2.  **Manejo Centralizado de Expiración de Sesión (401):** Detecta respuestas `401 Unauthorized`.
 *     Si el token ha expirado, limpia la sesión del cliente y lo redirige a la página principal.
 *     Ignora los `401` en las rutas de autenticación para permitir el manejo de errores en los formularios.
 * 3.  **Gestión de Cuentas Desactivadas (403):** Captura respuestas `403 Forbidden` con el código
 *     `ACCOUNT_INACTIVE`, muestra una modal informativa y fuerza el cierre de sesión.
 * 4.  **Restauración de Sesión:** Al cargar la página, verifica la validez del token existente
 *     contra el endpoint `/auth/me` para restaurar la sesión del usuario sin que tenga que volver a iniciarla.
 * 5.  **API de Sesión Global (`window.auth`):** Expone un conjunto de funciones (`logout`, `isAuthenticated`, etc.)
 *     para que otros módulos de JavaScript puedan interactuar con el estado de autenticación de forma consistente.
 * 6.  **Sincronización de Cierre de Sesión entre Pestañas:** Utiliza `localStorage` para asegurar que si un
 *     usuario cierra sesión en una pestaña, se cierre automáticamente en todas las demás pestañas abiertas de la aplicación.
 */

// Guardar la función fetch original
const originalFetch = window.fetch;

// Sobrescribir la función fetch global
window.fetch = async function (resource, options = {}) {
  // Configurar los encabezados por defecto.
  const headers = new Headers(options.headers || {});

  // Si es una petición a nuestra API y no es una petición de autenticación
  // MEJORA: Permitir que /auth/me reciba el token para la validación de sesión.
  if (
    typeof resource === "string" &&
    (resource.startsWith("/api/") || resource.startsWith("/auth/me")) &&
    !resource.includes("/auth/login") && !resource.includes("/auth/register")
  ) {
    // Obtener el token del localStorage.
    const token = localStorage.getItem("token");

    // Si hay un token, agregarlo al encabezado de autorización.
    if (token) {
      if (!headers.has("Authorization")) {
        headers.append("Authorization", `Bearer ${token}`);
      }

      // Asegurarse de que el Content-Type sea application/json para las peticiones POST/PUT.
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

  // Crear las nuevas opciones de la petición.
  const newOptions = {
    ...options,
    headers,
    credentials: "same-origin", // Importante para incluir cookies si las hay.
  };

  try {
    const response = await originalFetch(resource, newOptions);

    // Clonar la respuesta para poder leer el cuerpo dos veces.
    const clonedResponse = response.clone();

    // Si la respuesta es 401 (No autorizado), manejar según el contexto.
    // Si la petición es a cualquier endpoint de autenticación,
    // no redirigir. Dejar que el script que hizo la llamada (ej: auth_modals.js) maneje el error.
    if (response.status === 401) {
      if (
        typeof resource === "string" &&
        (resource.includes("/auth/login") || resource.includes("/auth/register") || resource.includes("/auth/request-reset") || resource.includes("/auth/verify-reset-code"))
      ) {
        return response;
      }

      try {
        const errorData = await clonedResponse.json();
        if (errorData && errorData.msg === "Token has expired") {
          console.error("Token de cliente expirado. Redirigiendo a la página principal..."); // Limpiar token y datos de usuario antes de redirigir.
          if (window.auth && typeof window.auth.setAuthToken === 'function') {
            window.auth.setAuthToken(null);
          }
          localStorage.removeItem("user");
          window.location.href = "/"; // Redirigir a la página principal.
          return Promise.reject(new Error("Token de cliente expirado"));
        }
      } catch (e) {
        // No es un JSON o no contiene el mensaje esperado, manejar como un 401 genérico.
        console.error("Error de autenticación (401 genérico). Redirigiendo a la página principal..."); // Limpiar token y datos de usuario antes de redirigir.
        if (window.auth && typeof window.auth.setAuthToken === 'function') {
          window.auth.setAuthToken(null);
        }
        localStorage.removeItem("user");
        window.location.href = "/"; // Redirigir a la página principal.
        return Promise.reject(new Error("No autorizado"));
      }

      // Si no es un token expirado pero sigue siendo un 401, redirigir también.
      console.error("Error de autenticación (401 genérico). Redirigiendo a la página principal..."); // Limpiar token y datos de usuario antes de redirigir.
      if (window.auth && typeof window.auth.setAuthToken === 'function') {
        window.auth.setAuthToken(null);
      }
      localStorage.removeItem("user");
      window.location.href = "/"; // Redirigir a la página principal.
      return Promise.reject(new Error("No autorizado"));
    }

    // Manejar el caso de cuenta desactivada (403 Forbidden).
    if (response.status === 403) {
      try {
        const errorData = await clonedResponse.json();
        if (errorData && errorData.code === 'ACCOUNT_INACTIVE') {
          console.error("Cuenta de cliente desactivada. Forzando logout...");
          // MEJORA PROFESIONAL: En lugar de hacer logout directamente, mostramos la modal de cuenta inactiva.
          // El botón de la modal se encargará de llamar a logout(true).
          if (typeof showInactiveAccountModal === 'function') {
            showInactiveAccountModal();
            const okBtn = document.getElementById('inactive-account-ok-btn');
            if (okBtn) {
              okBtn.onclick = () => logout(true);
            }
          } else {
            // Fallback si la función de la modal no existe.
            await logout(true);
          }
          return Promise.reject(new Error("Cuenta desactivada"));
        }
      } catch (e) {
        // El cuerpo no es JSON o no tiene el código esperado, se maneja como un 403 genérico.
        console.error("Error 403 genérico.", e);
      }
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
  // Prioridad: cookie > sessionStorage > localStorage.
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
    // Borrar cookie con los mismos atributos que al setearla.
    document.cookie = "token=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax";
  }
}

/**
 * MEJORA PROFESIONAL: Función de Cierre de Sesión con Confirmación.
 * @param {boolean} force - Si es `true`, cierra la sesión directamente. Si es `false` o no se define, muestra la modal de confirmación.
 * @param {boolean} isDeactivated - Indica si el logout es forzado por cuenta inactiva.
 */
async function logout(force = false, isDeactivated = false) {
  // Si no se está forzando el logout, mostrar la modal de confirmación primero.
  if (!force && window.openLogoutModal && typeof window.openLogoutModal === 'function') {
    console.log("Solicitud de logout recibida. Abriendo modal de confirmación...");
    window.openLogoutModal();
    return; // Detener la ejecución aquí. La modal se encargará del resto.
  }
  
  // 1. Limpiar estado del cliente PRIMERO.
  try {
    // Limpiar el carrito local.
    if (window.cart && typeof window.cart.clearCartOnLogout === 'function') {
      window.cart.clearCartOnLogout();
      console.log("Función clearCartOnLogout() llamada exitosamente.");
    } else {
      console.warn("No se encontró window.cart.clearCartOnLogout() para llamar.");
    }

    // Limpiar tokens y datos de usuario.
    setAuthToken(null);
    localStorage.removeItem("user");

    // Notificar a otras pestañas para que cierren sesión también.
    localStorage.setItem('logout-event', Date.now().toString());

  } catch (error) {
    console.error("Error durante la limpieza del cliente en logout:", error);
  }

  // 2. Notificar al servidor.
  try {
    await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log("Notificación de logout enviada al servidor.");
  } catch (e) {
    console.error("Error al notificar al servidor sobre el logout. La limpieza del cliente ya se realizó.", e);
  }

  // 3. Redirigir.
  // MEJORA: Añadir un pequeño retardo antes de redirigir para que el usuario
  // pueda ver el mensaje de "Cerrando sesión...".
  setTimeout(() => {
    console.log("Redirigiendo a la página principal...");
    window.location.replace("/");
  }, 500); // 500ms de retardo
}

/**
 * MEJORA PROFESIONAL: Wrapper público para el cierre de sesión.
 * Esta es la función que se debe llamar desde la UI. En lugar de cerrar la sesión
 * directamente, abre la modal de confirmación. La modal se encargará de llamar
 * a la función `_performLogout` si el usuario confirma la acción.
 * Esto centraliza el flujo y asegura que la confirmación siempre se muestre.
 */
function safeLogout() {
  if (window.openLogoutModal && typeof window.openLogoutModal === 'function') {
    window.openLogoutModal();
  } else {
    console.error("La función openLogoutModal no está definida. Realizando logout directo como fallback.");
    logout(true); // Forzar logout si la modal no existe.
  }
}

// Sincronizar logout entre pestañas.
window.addEventListener('storage', function(event) {
  if (event.key === 'logout-event') {
    setAuthToken(null);
    localStorage.removeItem("user");
    window.location.href = "/";
  }
});
// Exportar funciones para su uso en otros archivos.
window.auth = {
  isAuthenticated,
  getAuthToken,
  setAuthToken,
  logout, // Dejamos la función original, pero ahora es más inteligente.
};

// Restaurar sesión automáticamente si hay token válido y la cookie no está vacía.
async function restoreSession() {
  // Solo restaurar si hay token en cookie, sessionStorage o localStorage.
  const token = getAuthToken();
  // Verificar que la cookie no esté vacía (previene restauración tras logout).
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
        // Establecer el userId global para la sincronización del carrito.
        window.userId = data.usuario.id;
        // Disparar la sincronización del carrito inmediatamente después de restaurar la sesión.
        if (window.cart) {
          window.cart.hydrateCartFromServer();
        }
        window.dispatchEvent(
          new CustomEvent("user-restored", { detail: data.usuario })
        );
      }
    } else {
      // Si /me falla, podría ser por cuenta inactiva.
      if (response.status === 403) {
        const errorData = await response.json();
        if (errorData.code === 'ACCOUNT_INACTIVE') {
          // MEJORA PROFESIONAL: Mostrar la modal de cuenta inactiva en lugar de hacer logout directo.
          if (typeof showInactiveAccountModal === 'function') {
            showInactiveAccountModal();
            const okBtn = document.getElementById('inactive-account-ok-btn');
            if (okBtn) okBtn.onclick = () => logout(true, true);
          }
          return;
        }
      }
      setAuthToken(null);
      localStorage.removeItem("user");
    }
  } catch (e) {
    setAuthToken(null);
    localStorage.removeItem("user");
  }
}

// Ejecutar restauración de sesión al cargar la página.
document.addEventListener("DOMContentLoaded", async () => {
  await restoreSession();
});

console.log("Interceptor de autenticación cargado correctamente");
