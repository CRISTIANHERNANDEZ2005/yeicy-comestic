/**
 * @file Módulo Interceptor de Autenticación del Panel de Administración.
 * @description Este script intercepta las llamadas `fetch` para gestionar de forma
 *              centralizada la sesión y los errores de autenticación del administrador.
 *              Su principal responsabilidad es reaccionar a los estados de la sesión
 *              (expirada, cuenta desactivada) para proporcionar una experiencia de
 *              usuario segura y fluida.
 *
 * @funcionalidadesClave
 * 1.  **Manejo de Sesión Expirada (401):** Detecta respuestas `401 Unauthorized` en
 *     rutas del admin y redirige automáticamente a la página de login.
 *
 * 2.  **Gestión de Cuentas Desactivadas (403):** Captura el código de error
 *     `ADMIN_ACCOUNT_INACTIVE` y muestra un modal informativo (`showInactiveAdminModal`)
 *     que explica la situación antes de forzar el cierre de sesión.
 *
 * 3.  **Verificación Proactiva de Sesión:** Al cargar la página, realiza una llamada
 *     a `/admin/me` para validar la sesión actual. Si es inválida o la cuenta
 *     está inactiva, toma acción inmediata (redirige o muestra el modal).
 *
 * 4.  **Logout Centralizado y Seguro:** Proporciona una función `adminLogout` que
 *     notifica al backend para invalidar la sesión del servidor antes de redirigir.
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
      credentials: "same-origin", // Importante para incluir cookies HttpOnly (como el JWT de admin).
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

      // Manejar el caso de cuenta de administrador desactivada (403 Forbidden)
      if (response.status === 403) {
        try {
          const errorData = await clonedResponse.json();
          if (errorData && errorData.code === "ADMIN_ACCOUNT_INACTIVE") {
            console.error(
              "Cuenta de administrador desactivada. Mostrando modal de bloqueo..."
            );
            if (typeof showInactiveAdminModal === "function") {
              showInactiveAdminModal();
              const okBtn = document.getElementById("inactive-admin-ok-btn");
              if (okBtn) {
                // Asegurarse de que el botón existe antes de asignar el evento.
                okBtn.onclick = () => adminLogout(); // Llamar a la función de logout profesional.
              }
              // En lugar de rechazar la promesa (lo que haría que la SPA oculte el overlay),
              // devolvemos una promesa que nunca se resuelve. Esto "congela" la navegación de la SPA,
              // dejando el overlay de carga visible debajo de nuestra modal, lo cual es el comportamiento deseado.
              return new Promise(() => {});
            }
          }
        } catch (e) {
          // No es un JSON esperado, se maneja como un 403 genérico, no hacemos nada especial.
        }
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
        //  Verificar si el error es por cuenta inactiva.
        if (response.status === 401) {
          console.error(
            "No hay sesión de administrador activa. Redirigiendo al login..."
          );
          window.location.href = "/administracion";
        } else if (response.status === 403) {
          const errorData = await response.json();
          if (errorData && errorData.code === "ADMIN_ACCOUNT_INACTIVE") {
            console.error(
              "Cuenta de administrador desactivada detectada en checkAdminSession. Mostrando modal de bloqueo..."
            );
            if (typeof showInactiveAdminModal === "function") {
              showInactiveAdminModal();
              const okBtn = document.getElementById("inactive-admin-ok-btn");
              if (okBtn) okBtn.onclick = () => adminLogout(); // Llamar a la función de logout profesional.
            }
          }
        }
      }
    } catch (error) {
      console.error("Error al verificar la sesión del administrador:", error);
    }
  }

  // Función centralizada para el logout del administrador.
  // Esta función notifica al backend para invalidar el token y luego redirige.
  // MEJORA: Ahora gestiona una modal de confirmación.
  async function adminLogout(force = false) {
    // Si no se fuerza, mostrar la modal de confirmación primero.
    if (!force && typeof openAdminLogoutModal === "function") {
      openAdminLogoutModal();
      return; // Detener la ejecución. La modal se encargará del resto.
    }

    console.log("Iniciando proceso de logout de administrador...");

    // MEJORA: Mostrar estado de carga en el botón de la modal.
    const confirmBtn = document.getElementById("admin-logout-confirm-btn");
    if (confirmBtn) {
      const text = confirmBtn.querySelector(".logout-confirm-text");
      const spinner = confirmBtn.querySelector(".logout-spinner");
      if (text) text.classList.add("hidden");
      if (spinner) spinner.classList.remove("hidden");
      confirmBtn.disabled = true;
    }

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
        console.log(
          "Cookie de sesión de administrador invalidada por el servidor."
        );
      }
    } catch (error) {
      console.error(
        "Error al notificar al servidor sobre el logout del admin:",
        error
      );
    } finally {
      // 2. Redirigir al login después de un breve retardo para que el usuario vea el spinner.
      setTimeout(() => {
        window.location.href = "/administracion";
      }, 500);
    }
  }

  // MEJORA: Funciones para gestionar la nueva modal de logout.
  function initializeAdminLogoutModal() {
    // MEJORA PROFESIONAL: Comprobar si el modal existe antes de continuar.
    // Esto evita errores en páginas como el login que no tienen el modal.
    const modal = document.getElementById("admin-logout-modal");
    if (!modal) {
      console.log(
        "DEBUG: No se encontró el modal de logout. Omitiendo inicialización (normal en la página de login)."
      );
      return;
    }

    const overlay = document.getElementById("admin-logout-overlay");
    const card = document.getElementById("admin-logout-card");
    const confirmBtn = document.getElementById("admin-logout-confirm-btn");
    const cancelBtn = document.getElementById("admin-logout-cancel-btn");

    // DIAGNÓSTICO: Verificar si todos los elementos del modal existen.
    if (!modal || !confirmBtn || !cancelBtn || !overlay || !card) {
      console.error(
        "DEBUG: Faltan uno o más elementos del modal de logout. No se pudo inicializar."
      );
      console.log({ modal, confirmBtn, cancelBtn, overlay, card }); // Muestra qué elemento es nulo.
      return;
    }
    console.log(
      "DEBUG: Modal de logout y sus elementos encontrados correctamente."
    );

    const openModal = () => {
      console.log("DEBUG: Función openModal() llamada. Abriendo modal...");
      modal.classList.remove("hidden");
      document.body.style.overflow = "hidden";
      void modal.offsetWidth; // Forzar reflow
      modal.classList.add("opacity-100");
      card.classList.remove("scale-95", "opacity-0");
    };

    const closeModal = () => {
      console.log("DEBUG: Función closeModal() llamada. Cerrando modal...");
      modal.classList.remove("opacity-100");
      card.classList.add("scale-95", "opacity-0");
      setTimeout(() => {
        modal.classList.add("hidden");
        document.body.style.overflow = "";
        // Resetear el botón de confirmación por si se vuelve a abrir
        if (confirmBtn) {
          const text = confirmBtn.querySelector(".logout-confirm-text");
          const spinner = confirmBtn.querySelector(".logout-spinner");
          if (text) text.classList.remove("hidden");
          if (spinner) spinner.classList.add("hidden");
          confirmBtn.disabled = false;
        }
      }, 300);
    };

    // Exponer la función para abrir la modal globalmente.
    window.openAdminLogoutModal = openModal;
    console.log("DEBUG: `window.openAdminLogoutModal` ha sido definida.");

    cancelBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", closeModal);
    confirmBtn.addEventListener("click", () => adminLogout(true)); // Forzar logout al confirmar.
  }

  // --- MEJORA PROFESIONAL: Punto de Entrada Único ---
  // Se consolida toda la lógica de inicialización en un solo listener para garantizar el orden de ejecución.
  document.addEventListener("DOMContentLoaded", function () {
    console.log(
      "DEBUG: DOM cargado. Iniciando secuencia de inicialización del interceptor."
    );

    // 1. Verificar la sesión del administrador.
    checkAdminSession();

    // 2. Inicializar la lógica del modal de logout. Esto define `window.openAdminLogoutModal`.
    initializeAdminLogoutModal();

    // 3. Asignar los eventos a los botones de logout SOLO SI el modal fue inicializado.
    //    Esto evita el error "Fallo crítico" en la página de login.
    if (typeof openAdminLogoutModal === "function") {
      const logoutButtonDesktop = document.getElementById(
        "logout-button-desktop"
      );
      const logoutButtonMobile = document.getElementById(
        "logout-button-mobile"
      );

      if (logoutButtonDesktop)
        logoutButtonDesktop.addEventListener("click", openAdminLogoutModal);
      if (logoutButtonMobile)
        logoutButtonMobile.addEventListener("click", openAdminLogoutModal);
      console.log("DEBUG: Eventos de click asignados a los botones de logout.");
    } else {
      // Este caso ahora es normal en la página de login.
      console.log(
        "DEBUG: No se asignarán eventos de logout ya que el modal no está presente en esta página."
      );
    }
  });

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
