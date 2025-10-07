/**
 * @file scripts.js
 * @description Scripts principales para la interfaz de usuario.
 * Contiene la inicialización de componentes, manejadores de eventos globales
 * y la lógica de la interfaz de usuario no asociada a un módulo específico.
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
  if (window.toast) return;

  window.toast = {
    success: (msg) => createSimpleNotification(msg, "bg-green-500"),
    error: (msg) => createSimpleNotification(msg, "bg-red-500"),
    warning: (msg) => createSimpleNotification(msg, "bg-yellow-500"),
    info: (msg) => createSimpleNotification(msg, "bg-blue-500"),
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
 * @param {CustomEvent} event - El evento con el detalle del contenido.
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

  if (isDataUserIdPresent || isWindowAuthenticated) return; // Permitir el comportamiento predeterminado del enlace.

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
 * Genera el HTML para las estrellas de calificación.
 * @param {number} rating - La calificación (de 1 a 5).
 * @returns {string} El HTML de las estrellas.
 */
function generateStarsHTML(rating) {
  let stars = "";
  const roundedRating = Math.round(rating);
  for (let i = 1; i <= 5; i++) {
    stars += `<svg class="w-5 h-5 ${i <= roundedRating ? 'text-yellow-400' : 'text-gray-300'}" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`;
  }
  return stars;
}

/**
 * Actualiza la visualización de la calificación de un producto en toda la página.
 * @param {string} productId - El ID del producto.
 * @param {number} averageRating - La nueva calificación promedio.
 * @param {number} totalReviewsCount - El nuevo número total de reseñas.
 */
function updateProductRatingDisplay(productId, averageRating, totalReviewsCount) {
  // Actualizar estrellas
  const starContainers = document.querySelectorAll(`[data-rating-stars="${productId}"]`);
  starContainers.forEach(container => {
    container.innerHTML = generateStarsHTML(averageRating);
  });

  // Actualizar el valor numérico del promedio
  const ratingValueElements = document.querySelectorAll(`[data-rating-value="${productId}"]`);
  ratingValueElements.forEach(el => {
    el.textContent = (averageRating || 0).toFixed(1);
  });

  // Actualizar el contador de reseñas
  const reviewCountElements = document.querySelectorAll(`[data-rating-count="${productId}"]`);
  reviewCountElements.forEach(el => {
    el.textContent = `${totalReviewsCount} reseña(s)`;
  });
}

/**
 * Inicializa el comportamiento "inteligente" de la barra de navegación principal.
 * La barra se oculta al hacer scroll hacia abajo y aparece al hacer scroll hacia arriba.
 */
function initializeSmartNavbar() {
  const navbarContainer = document.getElementById("navbar-container");
  if (!navbarContainer) return;

  let lastScrollY = window.scrollY;
  const hideThreshold = 200; // Píxeles desde la parte superior para empezar a ocultar
  const scrollDelta = 5; // Un pequeño delta para evitar que se active con movimientos mínimos

  window.addEventListener(
    "scroll",
    () => {
      const currentScrollY = window.scrollY;

      // MEJORA PROFESIONAL: Si el navbar está "bloqueado", ignorar el evento de scroll.
      if (navbarContainer.classList.contains("navbar-locked")) return;

      // No hacer nada si el cambio en el scroll es menor que el delta
      if (Math.abs(lastScrollY - currentScrollY) <= scrollDelta) return;

      // Si se está bajando la página Y se ha pasado el umbral, ocultar la barra.
      if (currentScrollY > lastScrollY && currentScrollY > hideThreshold) {
        navbarContainer.classList.add("-translate-y-full");
      } else {
        // Si se está subiendo la página O se está cerca de la parte superior, mostrar la barra.
        navbarContainer.classList.remove("-translate-y-full");
      }

      // Actualizar la última posición de scroll para la siguiente comparación.
      lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
    },
    { passive: true }
  ); // Usar passive: true para un mejor rendimiento de scroll
}

/**
 * Gestiona la modal de confirmación de cierre de sesión.
 */
function initializeLogoutModal() {
  const modal = document.getElementById("logout-confirmation-modal");
  const overlay = document.getElementById("logout-modal-overlay");
  const card = document.getElementById("logout-modal-card");
  const confirmBtn = document.getElementById("logout-confirm-btn");
  const cancelBtn = document.getElementById("logout-cancel-btn");

  if (!modal || !confirmBtn || !cancelBtn || !overlay || !card) return;

  const openLogoutModal = () => {
    // SOLUCIÓN: Asegurarse de que las clases de centrado estén presentes y la modal sea visible.
    // Esto corrige cualquier estado inconsistente y garantiza el centrado.
    modal.classList.remove("hidden");
    modal.classList.add("flex", "items-center", "justify-center");

    document.body.style.overflow = "hidden";
    // Forzar reflow para que las transiciones se apliquen
    void modal.offsetWidth;
    modal.classList.add("opacity-100");
    card.classList.remove("scale-95", "opacity-0");
  };

  const closeLogoutModal = () => {
    modal.classList.remove("opacity-100");
    card.classList.add("scale-95", "opacity-0");
    setTimeout(() => {
      modal.classList.add("hidden");
      document.body.style.overflow = "";
      // Resetear el botón de confirmación
      const text = confirmBtn.querySelector('.logout-confirm-text');
      const spinner = confirmBtn.querySelector('.logout-spinner');
      if (text) text.classList.remove('hidden');
      if (spinner) spinner.classList.add('hidden');
      confirmBtn.disabled = false;
    }, 300); // Coincidir con la duración de la transición
  };

  // Asignar la función de abrir al objeto global para que sea accesible desde el HTML
  window.openLogoutModal = openLogoutModal;

  cancelBtn.addEventListener("click", closeLogoutModal);
  overlay.addEventListener("click", closeLogoutModal);

  confirmBtn.addEventListener("click", () => {
    if (window.auth && typeof window.auth.logout === "function") {
      // Mostrar spinner y deshabilitar botón
      const text = confirmBtn.querySelector('.logout-confirm-text');
      const spinner = confirmBtn.querySelector('.logout-spinner');
      if (text) text.classList.add('hidden');
      if (spinner) spinner.classList.remove('hidden');
      confirmBtn.disabled = true;
      
      // Llamar a logout con el parámetro 'force' a true para saltar la modal.
      window.auth.logout(true);
    }
  });
}

/**
 * Función principal de inicialización que se ejecuta cuando el DOM está listo.
 */
function main() {
  initializeToastFallback();
  registerGlobalEventListeners();
  initializeSmartNavbar();
  initializeLogoutModal();
}

// Punto de entrada de la aplicación.
document.addEventListener("DOMContentLoaded", main);
