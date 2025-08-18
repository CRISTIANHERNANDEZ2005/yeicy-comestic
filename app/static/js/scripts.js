// Manejador para mostrar el modal de autenticación
document.addEventListener("showAuthModal", function (e) {
  const authModal = document.getElementById("auth-modal-bg");
  if (authModal) {
    // Mostrar el modal
    authModal.classList.remove("hidden");
    authModal.classList.add("flex");

    // Mostrar mensaje si está presente
    if (e.detail && e.detail.message) {
      // Usar el sistema de notificaciones si está disponible
      if (window.toast) {
        window.toast.warning(e.detail.message, 4000);
      } else {
        // Fallback básico
        const message = document.createElement("div");
        message.className =
          "fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-pink-600 text-white px-6 py-3 rounded-lg shadow-lg z-[99999] flex items-center";
        message.innerHTML = `
                        <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        ${e.detail.message}
                    `;
        document.body.appendChild(message);

        // Eliminar el mensaje después de 4 segundos
        setTimeout(() => {
          if (message.parentNode) {
            message.parentNode.removeChild(message);
          }
        }, 4000);
      }
    }
  }
});

document.addEventListener("DOMContentLoaded", function () {
  // Verificar disponibilidad del sistema Toast
  if (window.toast) {
    console.log("✅ Sistema de notificaciones Toast disponible");
  } else {
    console.warn(
      "⚠️ Sistema de notificaciones no encontrado - usando fallback"
    );

    // Fallback básico
    window.toast = {
      success: (msg) => {
        console.log(`✅ ${msg}`);
        // Crear notificación visual simple si no hay Toast
        createSimpleNotification(msg, "bg-green-500");
      },
      error: (msg) => {
        console.log(`❌ ${msg}`);
        createSimpleNotification(msg, "bg-red-500");
      },
      warning: (msg) => {
        console.log(`⚠️ ${msg}`);
        createSimpleNotification(msg, "bg-yellow-500");
      },
      info: (msg) => {
        console.log(`ℹ️ ${msg}`);
        createSimpleNotification(msg, "bg-blue-500");
      },
    };
  }

  // Función auxiliar para notificaciones simples
  function createSimpleNotification(message, bgClass) {
    const notification = document.createElement("div");
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white z-50 ${bgClass} shadow-lg animate-fade-in-up`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add("animate-fade-out-down");
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
});

document.addEventListener("favorites:countUpdated", (e) => {
  const counter = document.getElementById("favorites-counter");
  if (e.detail && typeof e.detail.count === "number") {
    if (e.detail.count > 0) {
      counter.textContent = e.detail.count;
      counter.setAttribute("aria-label", `${e.detail.count} favoritos`);
      counter.classList.remove("scale-0", "opacity-0");
      counter.classList.add("scale-100", "opacity-100");
      counter.style.transform = "scale(1)";
      counter.style.opacity = "1";
    } else {
      counter.textContent = "";
      counter.setAttribute("aria-label", "0 favoritos");
      counter.classList.remove("scale-100", "opacity-100");
      counter.classList.add("scale-0", "opacity-0");
      counter.style.transform = "scale(0)";
      counter.style.opacity = "0";
    }
  }
});

// Manejar clic en el botón de favoritos
document.addEventListener("DOMContentLoaded", function () {
  const favButton = document.getElementById("navbar-fav-btn");
  if (favButton) {
    favButton.addEventListener("click", function (e) {
      // Usar window.isAuthenticated, que se define en base.html
      const isAuthenticated = window.isAuthenticated === true || window.isAuthenticated === 'true';

      if (!isAuthenticated) {
        e.preventDefault();
        e.stopPropagation();
        // Mostrar la modal solo si NO está autenticado
        if (window.favoritesManager && typeof window.favoritesManager.showAuthModal === 'function') {
          window.favoritesManager.showAuthModal();
        } else {
          const modal = document.getElementById("like-auth-modal");
          const modalInner = document.getElementById("like-auth-modal-inner");
          const modalMsg = document.getElementById("like-auth-modal-msg");
          if (modal && modalInner && modalMsg) {
            modalMsg.textContent = "Debes iniciar sesión para ver tus productos favoritos.";
            modal.style.display = "flex";
            modalInner.style.animation = "modalFadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards";
            setTimeout(() => {
              modalInner.style.animation = "modalFadeOutDown 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards";
              setTimeout(() => {
                modal.style.display = "none";
              }, 350);
            }, 5000);
          }
        }
        return false;
      }
      // Si está autenticado, navegar a la página de favoritos
      window.location.href = favButton.getAttribute("href") || "/favoritos";
    });
  }
});
