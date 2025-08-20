/**
 * @file scripts.js
 * @description Scripts principales para la interfaz de usuario.
 * Contiene la inicialización de componentes, manejadores de eventos globales
 * y la lógica de la interfaz de usuario no asociada a un módulo específico.
 * @author Gemini
 * @version 2.3.0
 */

/**
 * Muestra una notificación simple como fallback si el sistema principal (Toast) no está disponible.
 * @param {string} message - El mensaje a mostrar.
 * @param {string} bgClass - La clase de Tailwind CSS para el color de fondo.
 */
function createSimpleNotification(message, bgClass) {
  const notification = document.createElement("div");
  notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white z-50 ${bgClass} shadow-lg animate-fade-in-up`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add("animate-fade-out-down");
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

/**
 * Inicializa un sistema de notificaciones Toast de fallback si no existe uno global.
 */
function initializeToastFallback() {
  if (window.toast) {
    console.log("✅ Sistema de notificaciones Toast disponible.");
    return;
  }

  console.warn("⚠️ Sistema de notificaciones no encontrado. Usando fallback.");
  window.toast = {
    success: (msg) => {
      console.log(`✅ SUCCESS: ${msg}`);
      createSimpleNotification(msg, "bg-green-500");
    },
    error: (msg) => {
      console.error(`❌ ERROR: ${msg}`);
      createSimpleNotification(msg, "bg-red-500");
    },
    warning: (msg) => {
      console.warn(`⚠️ WARNING: ${msg}`);
      createSimpleNotification(msg, "bg-yellow-500");
    },
    info: (msg) => {
      console.info(`ℹ️ INFO: ${msg}`);
      createSimpleNotification(msg, "bg-blue-500");
    },
  };
}

/**
 * Manejador para el evento 'showAuthModal'. Muestra el modal de autenticación.
 * @param {CustomEvent} event - El evento personalizado.
 */
function handleShowAuthModal(event) {
  const authModal = document.getElementById("auth-modal-bg");
  if (!authModal) return;

  authModal.classList.remove("hidden");
  authModal.classList.add("flex");

  if (event.detail?.message && window.toast?.warning) {
    window.toast.warning(event.detail.message, 4000);
  }
}

/**
 * Manejador para el evento 'favorites:countUpdated'. Actualiza el contador de favoritos en la UI.
 * @param {CustomEvent} event - El evento con el detalle del conteo.
 */
function handleFavoritesCountUpdated(event) {
  const counter = document.getElementById("favorites-counter");
  if (!counter || typeof event.detail?.count !== "number") return;

  const { count } = event.detail;
  counter.textContent = count > 0 ? count : "";
  counter.setAttribute("aria-label", `${count} favoritos`);

  const isVisible = count > 0;
  counter.classList.toggle("scale-100", isVisible);
  counter.classList.toggle("opacity-100", isVisible);
  counter.classList.toggle("scale-0", !isVisible);
  counter.classList.toggle("opacity-0", !isVisible);
}

/**
 * Manejador de clic para el botón de favoritos en la barra de navegación.
 * Si el usuario no está autenticado, previene la navegación y muestra un modal.
 * Si está autenticado, permite que el enlace funcione de forma nativa.
 * @param {MouseEvent} event - El evento de clic.
 */
function handleNavbarFavButtonClick(event) {
  const isDataUserIdPresent = document.body.getAttribute('data-user-id') !== null;
  const isWindowAuthenticated = window.isAuthenticated === true;

  console.log('DEBUG: handleNavbarFavButtonClick - isDataUserIdPresent:', isDataUserIdPresent, 'isWindowAuthenticated:', isWindowAuthenticated);

  // Si el atributo data-user-id está presente O window.isAuthenticated es true, consideramos al usuario autenticado.
  if (isDataUserIdPresent || isWindowAuthenticated) {
    console.log('DEBUG: Usuario autenticado. Permitiendo navegación.');
    return; // Permitir el comportamiento predeterminado del enlace.
  }

  console.log('DEBUG: Usuario NO autenticado. Bloqueando navegación y mostrando modal.');
  event.preventDefault();
  event.stopPropagation();

  const message = "Debes iniciar sesión para ver y gestionar tus favoritos.";

  // Directamente mostrar la modal 'like-auth-modal'
  const modal = document.getElementById("like-auth-modal");
  if (modal) {
    const modalMsg = modal.querySelector("#like-auth-modal-msg");
    if (modalMsg) {
      modalMsg.textContent = message;
    }
    modal.style.display = "flex";
    setTimeout(() => {
      modal.style.display = "none";
    }, 3000);
  }
}

/**
 * Registra todos los manejadores de eventos globales de la aplicación.
 */
function registerGlobalEventListeners() {
  document.addEventListener("showAuthModal", handleShowAuthModal);
  document.addEventListener("favorites:countUpdated", handleFavoritesCountUpdated);

  const favButton = document.getElementById("navbar-fav-btn");
  if (favButton) {
    favButton.addEventListener("click", handleNavbarFavButtonClick);
  }
}

/**
 * Función principal de inicialización que se ejecuta cuando el DOM está listo.
 */
function main() {
  initializeToastFallback();
  registerGlobalEventListeners();
}

// Punto de entrada de la aplicación.
document.addEventListener("DOMContentLoaded", main);