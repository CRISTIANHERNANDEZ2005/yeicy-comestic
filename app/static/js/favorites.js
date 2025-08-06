// Manejo de favoritos en la interfaz de usuario
class FavoritesManager {
  constructor() {
    this.isInitialized = false;
    this.isAuthenticated = document.body.getAttribute('data-user-id') !== null;
    this.favoriteProducts = new Set();
    this.favoriteButtons = [];
    this.favoritesCounter = document.getElementById('favorites-counter');
    this.favoritesMenuLink = document.querySelector('a[href*="favoritos"]');

    // Inicializar eventos
    this.initializeEventListeners();
    this.isInitialized = true;

    // Cargar favoritos si está autenticado
    if (this.isAuthenticated) {
      this.loadFavorites();
    }
  }

  initializeEventListeners() {
    // Delegación de eventos para manejar botones dinámicos
    document.addEventListener("click", (event) => {
      const favoriteBtn = event.target.closest(".favorite-btn");
      if (favoriteBtn) {
        this.toggleFavorite(event, favoriteBtn);
      }
    });

    // Manejar autenticación exitosa
    document.addEventListener("auth:success", () => {
      this.isAuthenticated = true;
      this.loadFavorites();
    });

    // Actualizar contador cuando se añade/elimina un favorito
    document.addEventListener('favorites:updated', () => {
      this.updateFavoritesCounter();
    });
  }

  async toggleFavorite(event, button) {
    event.preventDefault();
    event.stopPropagation();

    const productId = button.getAttribute("data-product-id");
    if (!productId) return;

    // Verificar autenticación
    if (!this.isAuthenticated) {
      this.showAuthModal();
      return;
    }

    const isFavorite = button.classList.contains("text-red-500");
    const productCard = button.closest('.product-card, .bg-white');
    const isOnFavoritesPage = window.location.pathname.includes('favoritos');

    try {
      console.log(`Enviando solicitud para ${isFavorite ? 'eliminar' : 'agregar'} favorito...`);
      const response = await fetch(`/api/favoritos/${productId}`, {
        method: isFavorite ? "DELETE" : "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin'
      });
      
      console.log('Respuesta de la API:', response.status, response.statusText);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Error al actualizar favoritos");
      }

      // Actualizar estado local
      if (isFavorite) {
        this.favoriteProducts.delete(parseInt(productId));
        // Si estamos en la página de favoritos, eliminar el elemento del DOM
        if (isOnFavoritesPage && productCard) {
          productCard.style.opacity = '0';
          setTimeout(() => {
            productCard.remove();
            // Actualizar el contador de productos
            const countElement = document.querySelector('.favorites-count');
            if (countElement) {
              const currentCount = parseInt(countElement.textContent) - 1;
              countElement.textContent = currentCount;
              // Si no quedan productos, mostrar el estado vacío
              if (currentCount === 0) {
                this.showEmptyState();
              }
            }
          }, 300);
        }
      } else {
        this.favoriteProducts.add(parseInt(productId));
      }

      // Actualizar UI
      this.updateFavoritesUI();
      this.updateFavoritesCounter();

      // Disparar evento personalizado para notificar cambios
      document.dispatchEvent(new CustomEvent('favorites:updated', {
        detail: { 
          productId: parseInt(productId),
          isFavorite: !isFavorite,
          totalFavorites: this.favoriteProducts.size
        }
      }));

      // Mostrar notificación
      this.showNotification(
        isFavorite ? "Eliminado de favoritos" : "Agregado a favoritos",
        "success"
      );
    } catch (error) {
      console.error("Error al actualizar favoritos:", error);
      this.showNotification(
        error.message || "Error al actualizar favoritos",
        "error"
      );
    }
  }

  updateFavoritesUI() {
    // Update all favorite buttons
    this.favoriteButtons = Array.from(document.querySelectorAll('.favorite-btn'));
    
    this.favoriteButtons.forEach(button => {
      if (!button) return;
      
      const productId = button.getAttribute('data-product-id');
      if (!productId) return;
      
      const icon = button.querySelector('svg');
      const isFavorite = this.favoriteProducts.has(parseInt(productId));
      
      // Actualizar clases del botón
      button.classList.toggle('text-red-500', isFavorite);
      button.classList.toggle('text-gray-400', !isFavorite);
      button.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
      
      // Actualizar icono
      if (icon) {
        icon.classList.toggle('fill-current', isFavorite);
        
        // Cambiar el ícono según si está en favoritos o no
        if (isFavorite) {
          icon.innerHTML = '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>';
        } else {
          icon.innerHTML = '<path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/>';
        }
      }
    });
  }

  updateFavoritesCounter() {
    // Actualizar el contador en el menú
    const counters = document.querySelectorAll('#favorites-counter');
    const count = this.favoriteProducts.size;
    
    counters.forEach(counter => {
      if (counter) {
        // Actualizar el texto del contador
        counter.textContent = count > 0 ? (count > 9 ? '9+' : count) : '';
        
        // Actualizar la visibilidad y animación del contador
        if (count > 0) {
          counter.style.transform = 'scale(1)';
          counter.style.opacity = '1';
          counter.style.transform = 'scale(1.1)';
          setTimeout(() => {
            counter.style.transform = 'scale(1)';
          }, 150);
        } else {
          counter.style.transform = 'scale(0)';
          counter.style.opacity = '0';
        }
        
        // Actualizar el atributo aria-label para accesibilidad
        counter.setAttribute('aria-label', `${count} favorito${count !== 1 ? 's' : ''}`);
      }
    });
    
    // Disparar evento personalizado para que otros componentes se actualicen
    document.dispatchEvent(new CustomEvent('favorites:countUpdated', { 
      detail: { count } 
    }));
    
    console.log(`Contador de favoritos actualizado: ${count} productos`);
  }

  async loadFavorites() {
    if (!this.isAuthenticated) {
      console.log('Usuario no autenticado, no se pueden cargar favoritos');
      return;
    }
    
    try {
      console.log('Cargando favoritos...');
      const response = await fetch('/api/favoritos', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin'
      });
      
      console.log('Respuesta de la API de favoritos:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        this.favoriteProducts = new Set(data.favoritos.map(fav => fav.id));
        this.updateFavoritesUI();
        this.updateFavoritesCounter();
        
        // Si estamos en la página de favoritos, actualizar el contador
        if (window.location.pathname.includes('favoritos')) {
          const countElement = document.querySelector('.favorites-count');
          if (countElement) {
            countElement.textContent = this.favoriteProducts.size;
          }
          
          // Mostrar estado vacío si no hay favoritos
          if (this.favoriteProducts.size === 0) {
            this.showEmptyState();
          }
        }
      } else {
        console.error('Error al cargar favoritos:', await response.text());
      }
    } catch (error) {
      console.error('Error al cargar favoritos:', error);
    }
  }

  async updateFavoritesCount() {
    const counter = document.getElementById("favorites-counter");
    if (!counter) return;

    if (!this.isAuthenticated) {
      counter.classList.add("hidden");
      return;
    }

    try {
      const response = await fetch("/api/favoritos", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const count = data.favoritos?.length || 0;

        counter.textContent = count;
        counter.classList.toggle("hidden", count === 0);
      }
    } catch (error) {
      console.error("Error al actualizar contador de favoritos:", error);
      counter.classList.add("hidden");
    }
  }

  showNotification(message, type = "info") {
    // Usar el sistema de notificaciones existente si está disponible
    if (window.showToastNotification) {
      window.showToastNotification(message, type);
      return;
    }

    // Fallback básico
    const notification = document.createElement("div");
    notification.className = `fixed top-4 right-4 px-4 py-2 rounded-md shadow-lg ${
      type === "error"
        ? "bg-red-500"
        : type === "success"
        ? "bg-green-500"
        : "bg-blue-500"
    } text-white z-50 transition-all duration-300 transform translate-x-0 opacity-100`;

    notification.textContent = message;
    document.body.appendChild(notification);

    // Animación de entrada
    requestAnimationFrame(() => {
      notification.style.transform = "translateX(0)";
    });

    // Eliminar después de 3 segundos
    setTimeout(() => {
      notification.style.transform = "translateX(120%)";
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  showAuthModal() {
    // Disparar evento para mostrar el modal de autenticación
    const authEvent = new CustomEvent("showAuthModal", {
      detail: { 
        action: "login",
        message: "Inicia sesión para guardar productos en tus favoritos"
      },
    });
    document.dispatchEvent(authEvent);
  }
  
  showEmptyState() {
    // Mostrar estado vacío en la página de favoritos
    const productsGrid = document.querySelector('.grid');
    if (productsGrid) {
      productsGrid.innerHTML = `
        <div class="col-span-full text-center py-16 bg-white rounded-xl shadow-sm">
          <div class="max-w-md mx-auto">
            <div class="w-20 h-20 mx-auto mb-4 text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">No tienes productos favoritos</h3>
            <p class="text-gray-500 mb-6">Guarda tus productos favoritos para encontrarlos fácilmente más tarde</p>
            <a 
              href="/" 
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
            >
              <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              Seguir comprando
            </a>
          </div>
        </div>
      `;
    }
  }
}

// Inicializar el gestor de favoritos cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  window.favoritesManager = new FavoritesManager();

  // Si hay un evento de autenticación exitosa, actualizar el gestor
  document.addEventListener("auth:success", () => {
    if (window.favoritesManager) {
      window.favoritesManager.isAuthenticated = true;
      window.favoritesManager.loadFavorites();
    }
  });
});
