/**
 * Interceptor de autenticación para incluir automáticamente el token JWT de administrador en las peticiones
 */

// Verificar si el interceptor ya ha sido cargado para evitar redeclaraciones
if (!window.adminAuthInterceptorLoaded) {
  // Guardar la función fetch original
  const originalFetchAdmin = window.fetch;

  // Función para obtener el token CSRF
  function getCsrfToken() {
    const tokenElement = document.querySelector('meta[name="csrf-token"]');
    return tokenElement ? tokenElement.getAttribute("content") : "";
  }

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

      // Clonar la respuesta para poder leer el cuerpo dos veces (una para verificar el mensaje, otra para pasarla)
      const clonedResponse = response.clone();

      // Si la respuesta es 401 (No autorizado) para una ruta de admin
      if (
        response.status === 401 &&
        typeof resource === "string" &&
        (resource.startsWith("/admin/") || resource.startsWith("/me"))
      ) {
        try {
          const errorData = await clonedResponse.json();
          if (errorData && errorData.msg === "Token has expired") {
            console.error(
              "Token de administrador expirado. Redirigiendo al login..."
            );
            window.location.href = "/administracion";
            return Promise.reject(new Error("Token de administrador expirado"));
          }
        } catch (e) {
          // No es un JSON o no contiene el mensaje esperado, manejar como un 401 genérico
          console.error(
            "Error de autenticación de administrador (401 genérico). Redirigiendo al login..."
          );
          window.location.href = "/administracion";
          return Promise.reject(new Error("No autorizado como administrador"));
        }
        // Si no es un token expirado pero sigue siendo un 401, redirigir también
        console.error(
          "Error de autenticación de administrador (401 genérico). Redirigiendo al login..."
        );
        window.location.href = "/administracion";
        return Promise.reject(new Error("No autorizado como administrador"));
      }

      // MEJORA PROFESIONAL: Manejar el caso de cuenta de administrador desactivada (403 Forbidden)
      if (response.status === 403) {
        try {
          const errorData = await clonedResponse.json();
          if (errorData && errorData.code === 'ADMIN_ACCOUNT_INACTIVE') {
            console.error("Cuenta de administrador desactivada. Mostrando modal de bloqueo...");
            if (typeof showInactiveAdminModal === 'function') {
              showInactiveAdminModal();
              const okBtn = document.getElementById('inactive-admin-ok-btn');
              if (okBtn) {
                okBtn.onclick = () => adminLogout(); // MEJORA: Llamar a la función de logout profesional.
              }
              // En lugar de rechazar la promesa (lo que haría que la SPA oculte el overlay),
              // devolvemos una promesa que nunca se resuelve. Esto "congela" la navegación de la SPA,
              // dejando el overlay de carga visible debajo de nuestra modal, lo cual es el comportamiento deseado.
              return new Promise(() => {});
            }
          }
        } catch (e) { /* No es un JSON esperado, se maneja como un 403 genérico */ }
      }

      return response;
    } catch (error) {
      console.error("Error en la petición de administrador:", error);
      throw error;
    }
  };

  // Función para verificar la sesión del administrador al cargar la página
  async function checkAdminSession() {
    // No ejecutar en la página de login
    if (window.location.pathname === "/administracion") {
      return;
    }

    try {
      const response = await window.fetch("/admin/me", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        credentials: "same-origin",
      });

      if (response.ok) {
        const admin = await response.json();
        console.log("Sesión de administrador activa para:", admin.nombre);
        // Aquí se podría actualizar la UI para mostrar que el admin está logueado
      } else {
        // MEJORA PROFESIONAL: Verificar si el error es por cuenta inactiva.
        if (response.status === 401) {
          console.error(
            "No hay sesión de administrador activa. Redirigiendo al login..."
          );
          window.location.href = "/administracion";
        } else if (response.status === 403) {
            const errorData = await response.json();
            if (errorData && errorData.code === 'ADMIN_ACCOUNT_INACTIVE') {
                console.error("Cuenta de administrador desactivada detectada en checkAdminSession. Mostrando modal...");
                if (typeof showInactiveAdminModal === 'function') {
                    showInactiveAdminModal();
                    const okBtn = document.getElementById('inactive-admin-ok-btn');
                    if (okBtn) okBtn.onclick = () => adminLogout(); // MEJORA: Llamar a la función de logout profesional.
                }
            }
        }
      }
    } catch (error) {
      console.error("Error al verificar la sesión del administrador:", error);
    }
  }

  // MEJORA PROFESIONAL: Función centralizada para el logout del administrador.
  // Esta función notifica al backend para invalidar el token y luego redirige.
  async function adminLogout() {
    console.log("Iniciando proceso de logout de administrador...");
    try {
      // 1. Notificar al servidor para que invalide la cookie JWT.
      const response = await originalFetchAdmin("/admin/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
      });
      if (response.ok) {
        console.log("Cookie de sesión de administrador invalidada por el servidor.");
      }
    } catch (error) {
      console.error("Error al notificar al servidor sobre el logout del admin:", error);
    } finally {
      // 2. Redirigir al login, independientemente del resultado del fetch.
      window.location.href = "/administracion";
    }
  }

  // Verificar la sesión en cuanto el DOM esté listo
  document.addEventListener("DOMContentLoaded", checkAdminSession);

  // Marcar el interceptor como cargado
  window.adminAuthInterceptorLoaded = true;
  console.log(
    "Interceptor de autenticación de administrador cargado correctamente"
  );
} else {
  console.log(
    "El interceptor de autenticación de administrador ya estaba cargado."
  );
}
