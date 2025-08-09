// Manejo de favoritos en la interfaz de usuario
if (typeof FavoritesManager === "undefined") {
  class FavoritesManager {
    constructor() {
      // Estado de inicialización
      this.isInitialized = false;
      this._initialLoadComplete = false;
      this._initializationPromise = null;

      // Autenticación
      this.isAuthenticated =
        document.body.getAttribute("data-user-id") !== null;

      // Almacenamiento de favoritos
      this.favoriteProducts = new Set();
      this.favoriteButtons = [];
      this._lastSavedFavorites = [];
      this._lastSaveTimestamp = 0;

      // Sincronización
      this.syncTimeout = null;
      this.syncQueue = Promise.resolve();
      this.syncInProgress = false;
      this.pendingSync = false;
      this._syncInterval = null;
      this._handleVisibilityChange = null;

      // Eventos
      this._eventListenersInitialized = false;
      this.boundHandleFavoriteClick = null;

      // Configuración
      this.STORAGE_KEY = "user_favorites";
      this.CACHE_TTL = 60 * 60 * 1000; // 1 hora en milisegundos

      // Verificar autenticación al inicializar
      this.isAuthenticated =
        document.body.getAttribute("data-user-id") !== null;

      // Si no está autenticado, limpiar favoritos locales
      if (!this.isAuthenticated) {
        localStorage.removeItem(this.STORAGE_KEY);
      }

      // Inicializar
      this.initialize();
    }

    /**
     * Obtiene el valor de una cookie por su nombre
     * @param {string} name - Nombre de la cookie a buscar
     * @returns {string|null} - Valor de la cookie o null si no se encuentra
     */
    getCookie(name) {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(";").shift();
      return null;
    }

    /**
     * Inicializa el gestor de favoritos
     * @returns {Promise<void>}
     */
    async initialize() {
      // Evitar múltiples inicializaciones simultáneas
      if (this._initializationPromise) {
        return this._initializationPromise;
      }

      // Crear una promesa de inicialización que se resolverá cuando todo esté listo
      this._initializationPromise = (async () => {
        try {
          this.isInitialized = false;
          this.authModalTimeout = null;
          this._initialLoadComplete = false;

          // Inicializar eventos
          this.initializeEventListeners();

          // Cargar favoritos locales primero para una respuesta rápida
          const hasLocalData = this.loadLocalFavorites();

          // Marcar como inicializado para que otros métodos puedan usarlo
          this.isInitialized = true;

          // Disparar evento de inicialización con los favoritos locales
          document.dispatchEvent(
            new CustomEvent("favorites:initialized", {
              detail: {
                favorites: Array.from(this.favoriteProducts),
                fromCache: hasLocalData,
              },
            })
          );

          // Si el usuario está autenticado, sincronizar con el servidor
          if (this.isAuthenticated) {
            try {
              // Cargar favoritos del servidor en segundo plano
              await this.loadServerFavorites();
              console.log("Favoritos del servidor cargados correctamente");
            } catch (error) {
              console.error("Error al cargar favoritos del servidor:", error);
              // Mostrar notificación solo si no hay datos locales
              if (this.favoriteProducts.size === 0) {
                this.showNotification(
                  "No se pudieron cargar los favoritos. Verifica tu conexión e intenta recargar la página.",
                  "error"
                );
              }
            }
          }

          // Actualizar la UI con los datos más recientes
          this.updateAllFavoriteButtons();
          this.updateFavoritesCounter();

          // Programar sincronización periódica (cada 5 minutos)
          if (this.isAuthenticated) {
            this._syncInterval = setInterval(() => {
              if (document.visibilityState === "visible") {
                this.enqueueSync();
              }
            }, 5 * 60 * 1000); // 5 minutos

            // Sincronizar cuando la pestaña vuelve a estar visible
            document.addEventListener(
              "visibilitychange",
              (this._handleVisibilityChange = () => {
                if (
                  document.visibilityState === "visible" &&
                  this.isAuthenticated
                ) {
                  this.enqueueSync();
                }
              })
            );
          }

          return true;
        } catch (error) {
          console.error("Error durante la inicialización de favoritos:", error);
          throw error;
        } finally {
          this._initialLoadComplete = true;

          // Disparar evento de carga completa
          document.dispatchEvent(
            new CustomEvent("favorites:loadComplete", {
              detail: { success: true },
            })
          );
        }
      })();

      return this._initializationPromise;
    }

    /**
     * Limpia los recursos utilizados por el gestor de favoritos
     * Útil cuando se destruye el componente o se cierra la sesión
     */
    destroy() {
      // Limpiar intervalos
      if (this._syncInterval) {
        clearInterval(this._syncInterval);
        this._syncInterval = null;
      }

      // Eliminar event listeners
      if (this._handleVisibilityChange) {
        document.removeEventListener(
          "visibilitychange",
          this._handleVisibilityChange
        );
        this._handleVisibilityChange = null;
      }

      // Limpiar timeouts
      if (this.syncTimeout) {
        clearTimeout(this.syncTimeout);
        this.syncTimeout = null;
      }

      // Limpiar referencias
      this.favoriteProducts.clear();
      this.favoriteButtons = [];
      this.isInitialized = false;
      this._initialLoadComplete = false;
      this._initializationPromise = null;
      this.syncInProgress = false;
      this.pendingSync = false;

      console.log("Gestor de favoritos destruido correctamente");
    }

    // Actualizar todos los botones de favoritos en la página
    updateAllFavoriteButtons() {
      document.querySelectorAll(".favorite-btn").forEach((button) => {
        const productId = button.getAttribute("data-product-id");
        if (productId) {
          const isFavorite = this.favoriteProducts.has(parseInt(productId));
          this.updateFavoriteButton(button, isFavorite);
        }
      });
    }

    // Actualizar la apariencia de un botón de favorito
    updateFavoriteButton(button, isFavorite) {
      if (!button) return;

      const svg = button.querySelector("svg");
      if (!svg) return;

      if (isFavorite) {
        button.classList.add("text-red-500");
        button.classList.remove("text-gray-400");
        button.setAttribute("aria-label", "Eliminar de favoritos");
        button.setAttribute("title", "Eliminar de favoritos");

        // Cambiar el ícono a corazón lleno
        svg.innerHTML = `
        <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" fill="currentColor"/>
      `;
      } else {
        button.classList.remove("text-red-500");
        button.classList.add("text-gray-400");
        button.setAttribute("aria-label", "Añadir a favoritos");
        button.setAttribute("title", "Añadir a favoritos");

        // Cambiar el ícono a corazón vacío
        svg.innerHTML = `
        <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" fill="none" stroke="currentColor" stroke-width="1.5"/>
      `;
      }
    }

    initializeEventListeners() {
      // Si ya está inicializado, no hacer nada
      if (this._eventListenersInitialized) return;

      // Remover cualquier listener previo para evitar duplicados
      document.removeEventListener(
        "click",
        this.boundHandleFavoriteClick,
        true
      );

      // Crear un manejador de eventos con el contexto correcto
      this.boundHandleFavoriteClick = this.handleFavoriteClick.bind(this);

      // Usar captura para asegurar que se ejecute primero y solo una vez
      document.addEventListener("click", this.boundHandleFavoriteClick, {
        capture: true,
        once: false,
        passive: false,
      });

      // Marcar como inicializado
      this._eventListenersInitialized = true;

      // Escuchar eventos de inicialización de productos
      document.addEventListener("product:rendered", () => {
        this.updateAllFavoriteButtons();
      });

      // Manejar autenticación exitosa
      document.addEventListener("auth:success", () => {
        this.isAuthenticated = true;
        this.loadFavorites();
      });

      // Actualizar contador cuando se añade/elimina un favorito
      document.addEventListener("favorites:updated", () => {
        this.updateFavoritesCounter();
      });
    }

    // Manejador de eventos para clics en botones de favoritos
    handleFavoriteClick(event) {
      const favoriteBtn = event.target.closest(".favorite-btn");
      if (!favoriteBtn) return;

      // Detener la propagación del evento
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      // Si ya hay un procesamiento en curso, ignorar nuevos clics
      if (favoriteBtn.getAttribute("data-processing") === "true") {
        return false;
      }

      // Verificar autenticación
      if (!this.isAuthenticated) {
        // Mostrar mensaje de autenticación
        this.showAuthNotification(
          "Inicia sesión para guardar productos en favoritos"
        );

        // Disparar evento para mostrar el modal de login
        const loginEvent = new CustomEvent("show:login", {
          detail: {
            message: "Inicia sesión para guardar productos en favoritos",
            redirectAfterLogin: window.location.pathname,
          },
        });
        document.dispatchEvent(loginEvent);
        return false;
      }

      // Llamar a toggleFavorite con el botón
      this.toggleFavorite(event, favoriteBtn);

      // Prevenir clics adicionales durante 500ms
      favoriteBtn.setAttribute("data-processing", "true");
      setTimeout(() => {
        favoriteBtn.removeAttribute("data-processing");
      }, 500);

      return false;
    }

    // Mostrar notificación de autenticación
    showAuthNotification(message) {
      // Intentar usar el sistema de notificaciones si está disponible
      if (window.showNotification) {
        window.showNotification(message, "info", 3000);
      }
      // Si no, usar el sistema de notificaciones de toast si está disponible
      else if (window.toast && typeof window.toast.info === "function") {
        window.toast.info(message, 3000);
      }
      // Si no hay sistema de notificaciones, usar un alert
      else {
        alert(message);
      }
    }

    /**
     * Alterna el estado de favorito de un producto
     * @param {Event} event - Evento de clic (opcional)
     * @param {HTMLElement|string} button - Elemento del botón o ID del producto
     * @returns {Promise<boolean>} - True si la operación fue exitosa
     */
    async toggleFavorite(event, button) {
      // Si se proporciona un evento, prevenir el comportamiento por defecto
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      // Obtener el ID del producto del botón o del parámetro
      let productId, buttonElement;
      
      if (typeof button === 'string') {
        productId = button;
        buttonElement = document.querySelector(`[data-product-id="${productId}"]`);
      } else if (button && button.nodeType === Node.ELEMENT_NODE) {
        buttonElement = button;
        productId = buttonElement.getAttribute('data-product-id');
      } else if (event && event.currentTarget) {
        buttonElement = event.currentTarget;
        productId = buttonElement.getAttribute('data-product-id');
      } else {
        console.error('Error: No se pudo determinar el producto');
        return false;
      }

      // Verificar si ya hay una operación en curso para este botón
      if (buttonElement && buttonElement.hasAttribute('data-processing')) {
        console.log('Operación de favorito ya en curso para este producto');
        return false;
      }

      // Marcar el botón como procesando
      if (buttonElement) buttonElement.setAttribute('data-processing', 'true');

      // Convertir el ID a número para consistencia
      const productIdNum = parseInt(productId, 10);
      if (isNaN(productIdNum)) {
        console.error('Error: ID de producto no válido');
        if (buttonElement) buttonElement.removeAttribute('data-processing');
        return false;
      }

      // Determinar el nuevo estado (si no está en favoritos, el nuevo estado es true)
      const newState = !this.favoriteProducts.has(productIdNum);
      console.log(
        `Alternando favorito para producto ${productIdNum}, nuevo estado: ${newState}`
      );

      // 1. Actualizar estado local inmediatamente
      if (newState) {
        this.favoriteProducts.add(productIdNum);
      } else {
        this.favoriteProducts.delete(productIdNum);
      }

      // 2. Actualizar interfaz de usuario inmediatamente
      this.updateFavoriteButton(buttonElement, newState);
      this.updateFavoritesCounter();
      this.saveLocalFavorites();

      // Mostrar notificación inmediata
      await this._showNotification(
        `Producto ${newState ? 'agregado a' : 'eliminado de'} favoritos`,
        'success'
      );

      // Si no está autenticado, mostrar mensaje y salir
      if (!this.isAuthenticated) {
        this.showAuthModal("Debes iniciar sesión para guardar favoritos");
        if (buttonElement) buttonElement.removeAttribute("data-processing");
        return false;
      }

      // 3. Sincronizar con el servidor en segundo plano
      this._syncWithServerInBackground(buttonElement, productIdNum, newState);
      
      return true;
    }

    // Sincroniza los cambios con el servidor en segundo plano
    async _syncWithServerInBackground(buttonElement, productIdNum, newState) {
      try {
        // Obtener el token de autenticación
        const token = window.auth?.getAuthToken?.() || this.getCookie("access_token");
        if (!token) {
          throw new Error("No se encontró el token de autenticación");
        }

        // Usar el endpoint unificado con el método POST
        const response = await fetch(`/api/favoritos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({
            producto_id: productIdNum,
            accion: newState ? "agregar" : "eliminar",
          }),
        });

        // Si hay un error en la respuesta, lanzar excepción
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
            `Error al ${newState ? "agregar a" : "eliminar de"} favoritos: ${response.statusText}`
          );
        }

        const result = await response.json();

        // Verificar si la operación fue exitosa
        if (!result.success) {
          throw new Error(result.message || "Error al actualizar favoritos");
        }

        // Si estamos en la página de favoritos y estamos eliminando, animar la eliminación
        const isOnFavoritesPage = window.location.pathname.includes("favoritos");
        const productCard = buttonElement?.closest?.(".product-card, .bg-white, .favorite-item");

        if (!newState && isOnFavoritesPage && productCard) {
          productCard.style.transform = "translateX(-100%)";
          productCard.style.opacity = "0";
          productCard.style.transition = "transform 0.3s ease, opacity 0.3s ease";

          // Eliminar el elemento después de la animación
          setTimeout(() => {
            productCard.remove();
            this.updateFavoritesCounter();
          }, 300);
        }
      } catch (error) {
        console.error("Error en sincronización en segundo plano:", error);
        
        // Revertir cambios locales solo si el error es de autenticación
        if (error.message.includes('autenticación') || error.message.includes('token')) {
          if (newState) {
            this.favoriteProducts.delete(productIdNum);
          } else {
            this.favoriteProducts.add(productIdNum);
          }
          this.updateFavoriteButton(buttonElement, !newState);
          this.updateFavoritesCounter();
          this.saveLocalFavorites();
          
          // Mostrar notificación de error de autenticación
          this._showNotification(
            "Sesión expirada. Por favor, inicia sesión nuevamente.",
            "error"
          );
        } else {
          // Para otros errores, mostrar notificación pero mantener los cambios locales
          this._showNotification(
            "Los cambios se guardarán localmente y se sincronizarán más tarde.",
            "warning"
          );
        }
        return false;
      } finally {
        // Asegurarse de desbloquear el botón
        if (buttonElement) {
          buttonElement.removeAttribute("data-processing");
        }
      }
    }

    async syncWithServer(force = false) {
      console.log("🔄 Iniciando sincronización con el servidor", { force });

      if (!this.isAuthenticated) {
        console.log("⏭️ Usuario no autenticado, omitiendo sincronización");
        return { success: false, synced: false, reason: "No autenticado" };
      }

      // Si ya hay una sincronización en curso, encolar esta solicitud
      if (this.syncInProgress) {
        console.log("⏳ Sincronización ya en curso, encolando solicitud");
        this.pendingSync = true;
        return { success: true, synced: false, queued: true };
      }

      // Marcar que hay una sincronización en curso
      this.syncInProgress = true;

      try {
        // Obtener acciones pendientes de sincronización
        const pendingActions = this._getPendingSyncActions();
        console.log(
          `📋 Acciones pendientes: ${pendingActions.length}`,
          pendingActions
        );

        // Verificar si hay cambios recientes
        const hasRecentChanges =
          Date.now() - this._lastSaveTimestamp < 5 * 60 * 1000;

        // Si no hay cambios y no es un forzado, verificar estado
        if (
          !force &&
          pendingActions.length === 0 &&
          this._lastSaveTimestamp > 0 &&
          hasRecentChanges
        ) {
          console.log(
            "🔍 No hay cambios pendientes, verificando estado de sincronización..."
          );

          try {
            const isSynced = await this._checkServerSyncStatus();

            if (isSynced) {
              console.log(
                "✅ Los datos ya están sincronizados con el servidor"
              );

              // Limpiar caché local ya que los datos están actualizados
              const cleanupSuccess = await this._cleanupLocalData(true);

              if (cleanupSuccess) {
                this.showNotification(
                  "✅ Tus favoritos están actualizados y la caché ha sido limpiada",
                  "success",
                  3000
                );
              }

              return {
                success: true,
                synced: false,
                reason: "Already synced",
                cleanedCache: cleanupSuccess,
              };
            } else {
              console.log("ℹ️ Se requieren cambios de sincronización");
            }
          } catch (syncError) {
            console.error("⚠️ Error al verificar sincronización:", syncError);
            // Continuar con la sincronización normal si hay error en la verificación
          }
        }

        // Mostrar indicador de sincronización
        this._showSyncIndicator(true);

        console.log("🔄 Enviando datos al servidor para sincronización...");

        // Preparar datos para la sincronización
        const syncData = {
          favoritos_locales: Array.from(this.favoriteProducts),
          timestamp: this._lastSaveTimestamp || 0,
          acciones: pendingActions,
        };

        console.log(
          "📤 Datos de sincronización:",
          JSON.parse(JSON.stringify(syncData))
        );

        // Realizar la solicitud de sincronización con timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos de timeout

        const response = await fetch("/api/favoritos/sincronizar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            Accept: "application/json",
          },
          body: JSON.stringify(syncData),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ Error en la respuesta del servidor:", {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          });

          throw new Error(
            `Error ${response.status}: ${
              response.statusText || "Error al sincronizar favoritos"
            }`
          );
        }

        const data = await response.json();
        console.log("📥 Respuesta del servidor:", data);

        if (data.success) {
          // Verificar si los datos ya estaban sincronizados
          const wasAlreadySynced =
            !data.needs_sync && pendingActions.length === 0;

          // Actualizar la lista local de favoritos con los datos del servidor
          this.favoriteProducts = new Set(data.favoritos_actualizados || []);
          this._lastSaveTimestamp =
            data.server_timestamp || data.timestamp || Date.now();

          // Limpiar acciones sincronizadas
          this._clearSyncedActions(pendingActions);

          // Actualizar la UI
          this.updateAllFavoriteButtons();
          this.updateFavoritesCounter();

          // Guardar en localStorage con los datos actualizados
          const newState = {
            favoritos: data.favoritos_actualizados || [],
            timestamp: this._lastSaveTimestamp,
          };
          this.saveLocalFavorites(newState);

          // Mostrar notificación de éxito
          if (wasAlreadySynced) {
            console.log(
              "ℹ️ Los datos ya estaban sincronizados con el servidor"
            );
            this.showNotification(
              "✅ Tus favoritos ya están sincronizados con el servidor",
              "success",
              3000
            );

            // Limpiar datos locales ya que ya están en el servidor
            const cleanupSuccess = await this._cleanupLocalData(false);
            if (cleanupSuccess) {
              console.log("✅ Caché local limpiada exitosamente");
            }
          } else if (data.removed && data.removed.length > 0) {
            console.log(
              `ℹ️ Se eliminaron ${data.removed.length} favoritos no disponibles`
            );
            this.showNotification(
              `ℹ️ Se eliminaron ${data.removed.length} favoritos que ya no están disponibles`,
              "info",
              4000
            );
          } else if (pendingActions.length > 0) {
            console.log("✅ Sincronización completada exitosamente");
            this.showNotification(
              "✅ Tus favoritos se han sincronizado correctamente",
              "success",
              3000
            );
          }

          return {
            success: true,
            synced: true,
            data,
            wasAlreadySynced,
            cleanedCache: wasAlreadySynced,
          };
        } else {
          console.error(
            "❌ El servidor reportó un error:",
            data.error || "Error desconocido"
          );
          return {
            success: false,
            synced: false,
            error: data.error || "Error en el servidor",
            serverResponse: data,
          };
        }
      } catch (error) {
        console.error("Error al sincronizar favoritos:", error);
        this.showNotification(
          "Error al sincronizar favoritos. Se reintentará más tarde.",
          "error"
        );
        return { success: false, synced: false, error: error.message };
      } finally {
        // Ocultar indicador de sincronización
        this._showSyncIndicator(false);

        // Marcar que la sincronización ha terminado
        this.syncInProgress = false;

        // Si hay sincronizaciones pendientes, procesarlas
        if (this.pendingSync) {
          this.pendingSync = false;
          this.syncWithServer(true);
        }
      }
    }

    // Actualizar la UI de los botones de favoritos
    updateFavoritesUI() {
      // Obtener todos los botones de favoritos
      this.favoriteButtons = Array.from(
        document.querySelectorAll(".favorite-btn")
      );

      // Actualizar cada botón
      this.favoriteButtons.forEach((button) => {
        const productId = parseInt(button.getAttribute("data-product-id"));
        if (isNaN(productId)) return;

        // Verificar si el producto está en favoritos
        const isFavorite = this.favoriteProducts.has(String(productId));
        const icon = button.querySelector("svg");

        // Si el usuario no está autenticado, mostrar el botón en gris
        if (!this.isAuthenticated) {
          button.classList.remove("text-red-500");
          button.classList.add("text-gray-300");
          button.setAttribute("aria-pressed", "false");
          button.setAttribute(
            "title",
            "Inicia sesión para guardar en favoritos"
          );

          if (icon) {
            icon.classList.remove("fill-current");
            icon.innerHTML =
              '<path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/>';
          }
          return;
        }

        // Usuario autenticado - mostrar estado normal del favorito
        button.classList.toggle("text-red-500", isFavorite);
        button.classList.toggle("text-gray-400", !isFavorite);
        button.setAttribute("aria-pressed", isFavorite ? "true" : "false");
        button.setAttribute(
          "title",
          isFavorite ? "Eliminar de favoritos" : "Agregar a favoritos"
        );

        // Actualizar icono
        if (icon) {
          icon.classList.toggle("fill-current", isFavorite);

          // Cambiar el ícono según si está en favoritos o no
          icon.innerHTML = isFavorite
            ? '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>'
            : '<path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/>';
        }
      });
    }

    updateFavoritesCounter() {
      // Actualizar el contador en el menú
      const counters = document.querySelectorAll("#favorites-counter");
      const count = this.favoriteProducts.size;

      counters.forEach((counter) => {
        if (counter) {
          // Actualizar el texto del contador
          counter.textContent = count > 0 ? (count > 9 ? "9+" : count) : "";

          // Actualizar la visibilidad y animación del contador
          if (count > 0) {
            counter.style.transform = "scale(1)";
            counter.style.opacity = "1";
            counter.style.transform = "scale(1.1)";
            setTimeout(() => {
              counter.style.transform = "scale(1)";
            }, 150);
          } else {
            counter.style.transform = "scale(0)";
            counter.style.opacity = "0";
          }

          // Actualizar el atributo aria-label para accesibilidad
          counter.setAttribute(
            "aria-label",
            `${count} favorito${count !== 1 ? "s" : ""}`
          );
        } else {
          counter.style.transform = "scale(0)";
          counter.style.opacity = "0";
          counter.setAttribute("aria-label", "0 favoritos");
        }
      });

      // Disparar evento personalizado para que otros componentes se actualicen
      document.dispatchEvent(
        new CustomEvent("favorites:countUpdated", {
          detail: { count },
        })
      );

      console.log(`Contador de favoritos actualizado: ${count} productos`);
    }

    async loadFavorites() {
      if (!this.isAuthenticated) {
        console.log("Usuario no autenticado, no se pueden cargar favoritos");
        return;
      }

      try {
        console.log("Cargando favoritos...");
        // Obtener el token JWT de las cookies
        const getCookie = (name) => {
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop().split(";").shift();
        };
        const token = getCookie("access_token");

        const headers = {
          "Content-Type": "application/json",
        };

        // Si hay un token, lo añadimos al encabezado de autorización
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        // 3. Hacer la petición al servidor para obtener los favoritos
        const response = await fetch("/api/favoritos", {
          headers: headers,
        });

        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && Array.isArray(data.favoritos)) {
          // Actualizar los favoritos con los datos del servidor
          this.favoriteProducts = new Set(
            data.favoritos.map((fav) => fav.producto_id || fav.id)
          );

          // Guardar en localStorage para caché
          this.saveLocalFavorites();

          console.log(
            "Favoritos cargados del servidor:",
            this.favoriteProducts
          );
        } else {
          console.warn(
            "La respuesta del servidor no contiene datos de favoritos válidos"
          );
        }

        // 4. Actualizar la UI con los datos cargados
        this.updateFavoritesUI();
        this.updateFavoritesCounter();

        // 5. Si estamos en la página de favoritos y no hay favoritos, mostrar estado vacío
        if (
          window.location.pathname.includes("favoritos") &&
          this.favoriteProducts.size === 0
        ) {
          this.showEmptyState();
        }
      } catch (error) {
        console.error("Error al cargar favoritos:", error);
        // Intentar cargar desde caché local si hay un error del servidor
        this.loadLocalFavorites();
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
        // Obtener el token JWT de las cookies
        const getCookie = (name) => {
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop().split(";").shift();
        };
        const token = getCookie("access_token");

        const headers = {};

        // Si hay un token, lo añadimos al encabezado de autorización
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch("/api/favoritos", {
          headers: headers,
          credentials: "include", // Importante para enviar las cookies
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

    _showNotification(message, type = "info") {
      // Mostrar notificación inmediatamente sin esperar la respuesta del servidor
      if (window.toast) {
        const duration = type === "error" ? 5000 : 3000;
        
        // Usar el método de notificación sin animación personalizada
        // para evitar errores con animaciones no definidas
        window.toast[type](message, duration);
        
        // Forzar el renderizado del navegador para mejor rendimiento
        requestAnimationFrame(() => {
          document.body.clientWidth; // Forzar reflow
        });
      } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
      }
      
      // Devolver una promesa resuelta para permitir encadenamiento
      return Promise.resolve();
    }

    // Este método ya no es necesario, se reemplaza por el sistema de notificaciones
    // Se mantiene por compatibilidad con código existente
    /**
     * Muestra un modal de autenticación con opciones de login/registro
     * @param {string} message - Mensaje personalizado a mostrar
     */
    showAuthModal(
      message = "Debes iniciar sesión para guardar productos en favoritos"
    ) {
      // Usar el sistema de notificaciones si está disponible
      if (window.toast) {
        window.toast.warning(message, 5000, {
          action: {
            text: "Iniciar sesión",
            onClick: () => {
              const event = new CustomEvent("show:login", {
                detail: {
                  message: "Inicia sesión para continuar",
                  redirectAfterLogin: window.location.pathname,
                },
              });
              document.dispatchEvent(event);
            },
          },
        });
      } else {
        // Fallback a un confirm estándar
        if (confirm(`${message}\n\n¿Deseas iniciar sesión ahora?`)) {
          window.location.href =
            "/login?next=" + encodeURIComponent(window.location.pathname);
        }
      }
    }

    showEmptyState() {
      // Mostrar estado vacío en la página de favoritos
      const productsGrid = document.querySelector(".grid");
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

    /**
     * Carga los favoritos desde el almacenamiento local
     * @param {boolean} force - Forzar la carga incluso si está desactualizado
     * @returns {boolean} - True si se cargaron los favoritos desde el caché local
     */
    loadLocalFavorites(force = false) {
      // No cargar favoritos locales si el usuario no está autenticado
      if (!this.isAuthenticated) {
        console.log("Usuario no autenticado, limpiando favoritos locales");
        this.favoriteProducts = new Set();
        try {
          localStorage.removeItem(this.STORAGE_KEY);
          localStorage.removeItem(`${this.STORAGE_KEY}_lastSync`);
        } catch (e) {
          console.warn("Error al limpiar caché local:", e);
        }
        return false;
      }

      try {
        const cachedData = localStorage.getItem(this.STORAGE_KEY);
        if (!cachedData) {
          console.log("No se encontraron favoritos en caché local");
          return false;
        }

        const { favorites, timestamp, version = 1 } = JSON.parse(cachedData);

        // Verificar versión de la caché (para futuras actualizaciones)
        if (version < 1) {
          console.warn("Versión de caché desactualizada, forzando recarga");
          return false;
        }

        // Verificar si los datos no están muy viejos (más de 1 hora por defecto)
        const maxAge = 60 * 60 * 1000; // 1 hora
        const isStale = Date.now() - timestamp > maxAge;

        if (!force && isStale) {
          console.log(
            "La caché local está desactualizada, se requiere sincronización"
          );
          return false;
        }

        // Cargar los favoritos desde el caché
        if (Array.isArray(favorites)) {
          this.favoriteProducts = new Set(favorites);
          console.log(
            `Favoritos cargados desde caché local (${this.favoriteProducts.size} items)`
          );

          // Si los datos están desactualizados, iniciar sincronización en segundo plano
          if (isStale) {
            console.log("Iniciando sincronización en segundo plano...");
            this.enqueueSync().catch((error) => {
              console.error(
                "Error durante la sincronización en segundo plano:",
                error
              );
            });
          }

          return true;
        } else {
          console.warn("Formato de caché inválido, ignorando...");
          return false;
        }
      } catch (e) {
        console.error("Error al cargar favoritos del caché local:", e);
        // En caso de error, limpiar la caché corrupta
        try {
          localStorage.removeItem(this.STORAGE_KEY);
        } catch (cleanupError) {
          console.error("Error al limpiar caché corrupta:", cleanupError);
        }
        return false;
      }
    }

    /**
     * Limpia la caché antigua para liberar espacio
     * @private
     */
    _cleanupOldCache() {
      try {
        // Obtener todas las claves de localStorage
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          // Buscar claves relacionadas con favoritos que no sean las actuales
          if (key.startsWith("user_favorites") && key !== this.STORAGE_KEY) {
            keys.push(key);
          }
        }

        // Ordenar por timestamp (más antiguos primero)
        keys.sort((a, b) => {
          try {
            const dataA = JSON.parse(localStorage.getItem(a));
            const dataB = JSON.parse(localStorage.getItem(b));
            return (dataA.timestamp || 0) - (dataB.timestamp || 0);
          } catch (e) {
            return 0;
          }
        });

        // Eliminar la mitad más antigua
        const toRemove = Math.ceil(keys.length / 2);
        let removed = 0;

        for (let i = 0; i < toRemove && i < keys.length; i++) {
          localStorage.removeItem(keys[i]);
          removed++;
        }

        console.log(`Se eliminaron ${removed} entradas antiguas de la caché`);
      } catch (e) {
        console.error("Error al limpiar caché antigua:", e);
        throw e; // Relanzar para manejarlo en el método que lo llamó
      }
    }

    /**
     * Guarda los favoritos actuales en el almacenamiento local
     * @param {boolean} updateTimestamp - Actualizar la marca de tiempo (por defecto: true)
     * @returns {boolean} - True si se guardó correctamente
     */
    saveLocalFavorites(serverState = null) {
      if (!this.isAuthenticated) return;

      const now = Date.now();
      const favoritesData = {
        favorites: Array.from(this.favoriteProducts),
        timestamp: serverState?.timestamp || now,
        serverTimestamp: serverState?.timestamp || now,
        lastSynced: now,
        version: "2.0",
        _meta: {
          updatedAt: now,
          source: serverState ? "server" : "local",
        },
      };

      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(favoritesData));
      } catch (e) {
        console.error("Error al guardar en localStorage:", e);
        // Si hay un error de cuota, limpiar datos antiguos
        if (e.name === "QuotaExceededError") {
          this._cleanupOldFavoritesData();
          // Intentar de nuevo
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(favoritesData));
        }
      }
    }

    /**
     * Carga los favoritos desde el servidor con soporte para paginación
     * @param {number} page - Página a cargar (por defecto: 1)
     * @param {number} perPage - Número de elementos por página (por defecto: 50, máximo: 100)
     * @param {boolean} forceRefresh - Forzar la recarga ignorando la caché local
     * @returns {Promise<Set>} - Conjunto de IDs de productos favoritos
     */
    async loadServerFavorites(page = 1, perPage = 50, forceRefresh = false) {
      // Validar parámetros
      page = Math.max(1, parseInt(page) || 1);
      perPage = Math.min(100, Math.max(1, parseInt(perPage) || 50));

      if (!this.isAuthenticated) {
        console.log(
          "Usuario no autenticado, omitiendo carga de favoritos del servidor"
        );
        return this.favoriteProducts;
      }

      // Si no es forzado y ya tenemos favoritos cargados, devolver los existentes
      if (!forceRefresh && this.favoriteProducts.size > 0 && page === 1) {
        console.log("Usando favoritos ya cargados");
        return this.favoriteProducts;
      }

      try {
        console.log(
          `Cargando favoritos desde el servidor (página ${page}, ${perPage} por página)...`
        );

        // Obtener el token de autenticación
        const token =
          window.auth?.getAuthToken?.() || this.getCookie("access_token");
        if (!token) {
          throw new Error("No se encontró el token de autenticación");
        }

        // Construir la URL con parámetros de consulta
        const url = new URL("/api/favoritos", window.location.origin);
        url.searchParams.append("page", page);
        url.searchParams.append("per_page", perPage);
        url.searchParams.append("ids_only", "true"); // Solo necesitamos los IDs

        // Si no es la primera página, forzar la recarga para evitar caché del navegador
        const cacheBuster = page > 1 ? `_=${Date.now()}` : "";
        if (cacheBuster) {
          url.searchParams.append("_", Date.now());
        }

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            "X-Requested-With": "XMLHttpRequest",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
          credentials: "include",
        });

        // Manejar errores de autenticación
        if (response.status === 401) {
          window.auth?.logout?.();
          throw new Error(
            "Sesión expirada. Por favor, inicia sesión nuevamente."
          );
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              `Error en la respuesta del servidor: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();
        console.log("Respuesta del servidor:", data);

        // Verificar el formato de la respuesta
        if (!data || !Array.isArray(data.items)) {
          console.warn("Formato de respuesta inesperado del servidor:", data);
          return this.favoriteProducts;
        }

        // Procesar los IDs de los productos favoritos
        const serverFavorites = new Set(data.items);
        console.log(
          `Favoritos recibidos (página ${page} de ${data.pages || 1}):`,
          Array.from(serverFavorites)
        );

        // Si es la primera página, reemplazar los favoritos existentes
        // Si no, combinar con los existentes
        if (page === 1) {
          this.favoriteProducts = new Set(serverFavorites);
        } else {
          serverFavorites.forEach((id) => this.favoriteProducts.add(id));
        }

        // Si hay más páginas, cargarlas recursivamente
        if (data.pages > page) {
          console.log(`Cargando página ${page + 1} de ${data.pages}...`);
          return this.loadServerFavorites(page + 1, perPage, true);
        }

        // Guardar en localStorage solo cuando se hayan cargado todos los favoritos
        this.saveLocalFavorites();

        // Actualizar la UI
        this.updateFavoritesUI();
        this.updateFavoritesCounter();
        this.updateAllFavoriteButtons();

        console.log(
          "Favoritos cargados correctamente. Total:",
          this.favoriteProducts.size
        );

        return this.favoriteProducts;
      } catch (error) {
        console.error("Error al cargar favoritos del servidor:", error);

        // Mostrar notificación de error al usuario
        if (error.message.includes("Sesión expirada")) {
          this.showAuthModal(error.message);
        } else {
          this.showNotification(
            "Error al cargar tus favoritos. Intenta recargar la página.",
            "error"
          );
        }

        return this.favoriteProducts;
      }
    }

    // Método para encolar sincronizaciones
    enqueueSync() {
      if (this.syncInProgress) {
        this.pendingSync = true;
        return;
      }

      this.syncInProgress = true;
      this.syncQueue = this.syncQueue
        .then(() => this.syncWithServer())
        .finally(() => {
          this.syncInProgress = false;
          if (this.pendingSync) {
            this.pendingSync = false;
            this.enqueueSync();
          }
        });
    }

    // Método para programar sincronización con el servidor (mantenido por compatibilidad)
    scheduleSync() {
      if (this.syncTimeout) {
        clearTimeout(this.syncTimeout);
      }

      this.syncTimeout = setTimeout(() => {
        this.enqueueSync();
      }, this.SYNC_DELAY);
    }

    /**
     * Sincroniza los favoritos locales con el servidor
     * @returns {Promise<boolean>} - True si la sincronización fue exitosa
     */
    async syncWithServer() {
      // Verificar autenticación
      if (!this.isAuthenticated) {
        console.log("Usuario no autenticado, omitiendo sincronización");
        return false;
      }

      // Si ya hay una sincronización en curso, encolarla
      if (this.syncInProgress) {
        console.log("Sincronización ya en curso, encolando solicitud");
        this.pendingSync = true;
        return false;
      }

      // Obtener el token de autenticación
      const token =
        window.auth?.getAuthToken?.() || this.getCookie("access_token");
      if (!token) {
        console.error("No se encontró el token de autenticación");
        this.showAuthModal(
          "Tu sesión ha expirado. Por favor, inicia sesión nuevamente."
        );
        return false;
      }

      // Marcar que hay una sincronización en curso
      this.syncInProgress = true;
      this.pendingSync = false;

      try {
        // Hacer una copia de los favoritos actuales para evitar problemas de concurrencia
        const currentFavorites = new Set(this.favoriteProducts);

        if (currentFavorites.size === 0) {
          console.log("No hay favoritos para sincronizar");
          return true;
        }

        console.log("Iniciando sincronización de favoritos con el servidor...");

        // Obtener la marca de tiempo del último cambio
        const lastSync =
          localStorage.getItem(`${this.STORAGE_KEY}_lastSync`) || 0;

        // Configurar la petición
        const response = await fetch("/api/favoritos/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-Requested-With": "XMLHttpRequest",
            "X-Last-Sync": lastSync,
          },
          credentials: "include",
          body: JSON.stringify({
            favorites: Array.from(currentFavorites)
              .map((id) => parseInt(id))
              .filter((id) => !isNaN(id)),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            "Error en la respuesta del servidor:",
            response.status,
            errorText
          );
          throw new Error("Error al sincronizar favoritos");
        }

        const data = await response.json();
        console.log("Respuesta de sincronización:", data);

        if (data.success) {
          console.log("Favoritos sincronizados correctamente");

          // Si el servidor devolvió una lista de favoritos actualizada, usarla
          if (
            data.favorites &&
            Array.isArray(data.favorites) &&
            data.favorites.length > 0
          ) {
            const serverFavorites = new Set(
              data.favorites
                .map((fav) => fav.id)
                .filter((id) => id !== undefined)
            );

            // Actualizar solo si hay cambios
            const currentFavoritesStr = JSON.stringify(
              Array.from(this.favoriteProducts).sort()
            );
            const serverFavoritesStr = JSON.stringify(
              Array.from(serverFavorites).sort()
            );

            if (currentFavoritesStr !== serverFavoritesStr) {
              console.log(
                "Actualizando favoritos locales con datos del servidor"
              );
              this.favoriteProducts = serverFavorites;
              this.saveLocalFavorites();
              this.updateFavoritesUI();
              this.updateFavoritesCounter();
            }
          }

          return true;
        }
        return false;
      } catch (error) {
        console.error("Error al sincronizar favoritos:", error);
        // Reintentar después de un tiempo
        setTimeout(() => this.enqueueSync(), 5000);
        return false;
      } finally {
        this.syncInProgress = false;
      }
    }

    // Obtener acciones pendientes de sincronización
    _getPendingSyncActions() {
      try {
        const actionsStr = localStorage.getItem("pending_favorite_actions");

        if (!actionsStr) {
          console.log(
            "ℹ️ No hay acciones pendientes en el almacenamiento local"
          );
          return [];
        }

        const actions = JSON.parse(actionsStr);

        if (!Array.isArray(actions)) {
          console.warn(
            "⚠️ Las acciones pendientes no son un array, reiniciando...",
            actions
          );
          // Limpiar el valor inválido
          localStorage.removeItem("pending_favorite_actions");
          return [];
        }

        const now = Date.now();
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

        // Filtrar acciones válidas y recientes
        const validActions = actions.filter((action) => {
          // Verificar que la acción tenga la estructura esperada
          if (!action || typeof action !== "object") return false;
          if (
            !("producto_id" in action) ||
            !("action" in action) ||
            !("timestamp" in action)
          ) {
            return false;
          }

          // Verificar que la acción sea válida
          if (action.action !== "add" && action.action !== "remove")
            return false;

          // Verificar que el timestamp sea reciente (menos de 7 días)
          return action.timestamp > oneWeekAgo;
        });

        // Si hay diferencias, actualizar el localStorage
        if (validActions.length !== actions.length) {
          console.log(
            `🔄 Se filtraron ${
              actions.length - validActions.length
            } acciones inválidas o antiguas`
          );

          if (validActions.length > 0) {
            localStorage.setItem(
              "pending_favorite_actions",
              JSON.stringify(validActions)
            );
          } else {
            localStorage.removeItem("pending_favorite_actions");
          }
        }

        console.log(
          `📋 ${validActions.length} acciones pendientes de sincronización`
        );
        return validActions;
      } catch (error) {
        console.error("❌ Error al obtener acciones pendientes:", error);
        // En caso de error, limpiar las acciones para evitar problemas
        localStorage.removeItem("pending_favorite_actions");
        return [];
      }
    }

    // Limpiar acciones ya sincronizadas
    _clearSyncedActions(syncedActions) {
      if (!syncedActions || syncedActions.length === 0) return;

      const pendingActions = JSON.parse(
        localStorage.getItem("pending_favorite_actions") || "[]"
      );
      const syncedIds = new Set(
        syncedActions.map((a) => `${a.producto_id}_${a.timestamp}`)
      );

      // Filtrar acciones ya sincronizadas
      const remainingActions = pendingActions.filter(
        (action) => !syncedIds.has(`${action.producto_id}_${action.timestamp}`)
      );

      localStorage.setItem(
        "pending_favorite_actions",
        JSON.stringify(remainingActions)
      );
    }

    // Mostrar/ocultar indicador de sincronización
    _showSyncIndicator(show) {
      const indicators = document.querySelectorAll(".sync-indicator");
      indicators.forEach((indicator) => {
        indicator.style.display = show ? "block" : "none";
      });

      // Actualizar estado de los botones
      document.querySelectorAll(".favorite-btn").forEach((btn) => {
        if (show) {
          btn.setAttribute("disabled", "disabled");
          btn.classList.add("syncing");
        } else {
          btn.removeAttribute("disabled");
          btn.classList.remove("syncing");
        }
      });
    }

    // Verificar el estado de sincronización con el servidor
    async _checkServerSyncStatus() {
      console.log("🔍 Verificando estado de sincronización con el servidor...");

      try {
        const response = await fetch("/api/favoritos", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            Accept: "application/json",
          },
          // Añadimos un timeout para evitar que la verificación tarde demasiado
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `❌ Error en la respuesta del servidor (${response.status}):`,
            errorText
          );
          throw new Error(
            `Error ${response.status} al verificar sincronización`
          );
        }

        const data = await response.json();
        console.log("📊 Datos del servidor recibidos:", data);

        if (data.success && Array.isArray(data.favoritos)) {
          const serverFavorites = new Set(data.favoritos.map((fav) => fav.id));
          const localFavorites = this.favoriteProducts;

          console.log("🔄 Comparando favoritos:", {
            servidor: Array.from(serverFavorites),
            local: Array.from(localFavorites),
          });

          // Verificar si los conjuntos son iguales
          const sizesMatch = serverFavorites.size === localFavorites.size;
          const allMatch = Array.from(serverFavorites).every((id) =>
            localFavorites.has(id)
          );

          if (sizesMatch && allMatch) {
            console.log("✅ Los datos están sincronizados correctamente");
            return true;
          } else {
            console.warn("⚠️ Los datos NO están sincronizados:", {
              motivo: sizesMatch ? "contenido diferente" : "tamaño diferente",
              servidor: serverFavorites.size,
              local: localFavorites.size,
            });
          }
        } else {
          console.warn(
            "⚠️ Formato de respuesta inesperado del servidor:",
            data
          );
        }

        return false; // Los datos no están sincronizados o hubo un error
      } catch (error) {
        if (error.name === "AbortError") {
          console.warn("⏱️ La verificación de sincronización tardó demasiado");
        } else {
          console.error("❌ Error al verificar sincronización:", error);
        }
        return false;
      }
    }

    // Limpiar datos locales de favoritos
    _cleanupLocalData(showNotification = true) {
      try {
        console.log("Iniciando limpieza del localStorage...");

        // Guardar una copia de los favoritos actuales
        const currentFavorites = Array.from(this.favoriteProducts);
        console.log("Favoritos actuales guardados:", currentFavorites);

        // Limpiar el localStorage
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem("pending_favorite_actions");
        console.log("Elementos eliminados del localStorage");

        // Actualizar el estado local
        this.favoriteProducts = new Set(currentFavorites);
        this._lastSaveTimestamp = Date.now();

        // Guardar los favoritos actuales sin datos de caché
        const cleanState = {
          favoritos: currentFavorites,
          timestamp: this._lastSaveTimestamp,
        };

        this.saveLocalFavorites(cleanState);
        console.log("Nuevo estado guardado en localStorage:", cleanState);

        if (showNotification) {
          this.showNotification(
            "✅ Se ha limpiado la caché local correctamente",
            "success",
            3000
          );
        }

        console.log("✅ Caché local limpiada correctamente");
        return true;
      } catch (error) {
        console.error("❌ Error al limpiar la caché local:", error);

        if (showNotification) {
          this.showNotification(
            "❌ Error al limpiar la caché local",
            "error",
            5000
          );
        }

        return false;
      }
    }

    // Limpiar datos antiguos de favoritos
    _cleanupOldFavoritesData() {
      // Limpiar favoritos antiguos (más de 30 días)
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const keysToRemove = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key.startsWith("favorites_") ||
          key === "pending_favorite_actions"
        ) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            const timestamp = data.timestamp || data.lastSynced || 0;
            if (timestamp < cutoff) {
              keysToRemove.push(key);
            }
          } catch (e) {
            // Si hay error al parsear, eliminar la clave
            keysToRemove.push(key);
          }
        }
      }

      // Eliminar claves antiguas
      keysToRemove.forEach((key) => localStorage.removeItem(key));

      console.log(
        `Se eliminaron ${keysToRemove.length} elementos antiguos del caché`
      );

      // Notificar al usuario si se eliminaron elementos
      if (keysToRemove.length > 0) {
        this.showNotification(
          `Se limpiaron ${keysToRemove.length} elementos antiguos de la caché`,
          "info"
        );
      }

      return keysToRemove.length;
    }
  }

  // Hacer la clase accesible globalmente
  window.FavoritesManager = FavoritesManager;
}

// Inicializar el gestor de favoritos cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  if (!window.favoritesManager) {
    window.favoritesManager = new FavoritesManager();
  }

  // Si hay un evento de autenticación exitosa, actualizar el gestor
  document.addEventListener("auth:success", () => {
    if (window.favoritesManager) {
      window.favoritesManager.isAuthenticated = true;
      window.favoritesManager.loadFavorites();
    }
  });
});
