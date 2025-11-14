/**
 * @file Módulo de Gestión de Favoritos (FavoritesManager).
 * @description Este script encapsula la lógica para gestionar la "lista de deseos" o
 *              "favoritos" de un usuario, proporcionando una experiencia de usuario
 *              optimista y una sincronización de datos robusta.
 *
 * @class FavoritesManager
 *
 * @funcionalidadesClave
 * 1.  **UI Optimista:** La interfaz de usuario (botones de corazón, contadores) se
 *     actualiza instantáneamente al hacer clic, proporcionando una respuesta inmediata
 *     mientras la sincronización con el servidor ocurre en segundo plano.
 *
 * 2.  **Gestión de Estado Dual (Local + Servidor):**
 *     - **Caché Local:** Utiliza `localStorage` para persistir los favoritos en el
 *       cliente, permitiendo una carga rápida y acceso sin conexión.
 *     - **Sincronización con Backend:** Para usuarios autenticados, los cambios se
 *       sincronizan con la base de datos para garantizar la consistencia entre dispositivos.
 *
 * 3.  **Sincronización Inteligente y Tolerante a Fallos:**
 *     - **Debounce y Encolado:** Agrupa múltiples acciones rápidas del usuario para
 *       enviar una única petición al servidor, optimizando el uso de la red.
 *     - **Manejo de Fallos:** Si una sincronización falla (p. ej., por pérdida de conexión),
 *       el cambio local se mantiene y se reintentará la sincronización más tarde.
 *     - **Sincronización en Segundo Plano:** Sincroniza periódicamente y cuando la pestaña
 *       del navegador vuelve a estar visible.
 *
 * 4.  **Manejo de Autenticación:**
 *     - **Usuarios Invitados:** Muestra notificaciones no intrusivas para iniciar sesión
 *       si un usuario no autenticado intenta guardar un favorito.
 *     - **Transición de Sesión:** Gestiona los eventos de inicio y cierre de sesión para cargar o limpiar los datos.
 */
if (typeof FavoritesManager === "undefined") {
  class FavoritesManager {
    /**
     * Realiza un fetch con timeout para evitar congelamientos
     * @param {string} url
     * @param {object} options
     * @param {number} timeoutMs
     */
    async fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
      return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout de red")), timeoutMs)
        ),
      ]);
    }
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
      this.pendingSyncs = new Map();
      this.syncInProgress = false;
      this.pendingSync = false;
      this._syncInterval = null;
      this._handleVisibilityChange = null;
      this._lastVisibilitySync = 0;
      this._maxSyncRetries = 3;
      this._currentSyncRetries = 0;
      this._maxTotalSyncFailures = 5;
      this._totalSyncFailures = 0;
      this._lastSyncTimeoutId = null;

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
      this._handleVisibilityChange = null;
      this._handleVisibilityHide = null;
      this._handleVisibilityShow = null;
      this._syncIntervalActive = false;
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
          // Refuerzo: actualizar botones tras carga local
          this.updateAllFavoriteButtons();

          // Si el usuario está autenticado, sincronizar con el servidor
          if (this.isAuthenticated) {
            try {
              // Cargar favoritos del servidor en segundo plano
              await this.loadServerFavorites();
              // console.log("Favoritos del servidor cargados correctamente");
            } catch (error) {
              console.error("Error al cargar favoritos del servidor:", error);
              // Mostrar notificación solo si no hay datos locales
              if (this.favoriteProducts.size === 0) {
                this._showNotification(
                  "No se pudieron cargar los favoritos. Verifica tu conexión e intenta recargar la página.",
                  "error"
                );
              }
            }
            // Refuerzo: actualizar botones tras carga del servidor
            this.updateAllFavoriteButtons();
          }

          // Actualizar la UI con los datos más recientes
          this.updateAllFavoriteButtons();
          this.updateFavoritesCounter();

          // Programar sincronización periódica (cada 5 minutos) solo si está autenticado
          if (this.isAuthenticated) {
            // Evitar duplicados
            // Unificar y reforzar el control de intervalos y visibilidad
            this._clearSyncInterval = () => {
              if (this._syncInterval) {
                clearInterval(this._syncInterval);
                this._syncInterval = null;
                this._syncIntervalActive = false;
              }
            };
            this._startSyncInterval = () => {
              if (!this._syncIntervalActive) {
                this._syncInterval = setInterval(() => {
                  if (
                    document.visibilityState === "visible" &&
                    !this.syncInProgress
                  ) {
                    this.enqueueSync();
                  }
                }, 5 * 60 * 1000);
                this._syncIntervalActive = true;
                // console.log(
                  // "[Favoritos] Intervalo de sincronización restaurado"
                // );
              }
            };
            this._handleVisibilityChange = () => {
              try {
                if (document.visibilityState === "hidden") {
                  this._clearSyncInterval();
                  if (this.syncTimeout) {
                    clearTimeout(this.syncTimeout);
                    this.syncTimeout = null;
                  }
                  if (this._activeSyncTimeout) {
                    clearTimeout(this._activeSyncTimeout);
                    this._activeSyncTimeout = null;
                  }
                  this.syncInProgress = false;
                  this._activeSyncPromise = null;
                  this.pendingSync = false;
                  // console.log(
                    // "[Favoritos] Recursos liberados al ocultar pestaña y flags limpiados"
                  // );
                } else if (document.visibilityState === "visible") {
                  this._startSyncInterval();
                  const now = Date.now();
                  if (
                    this.isAuthenticated &&
                    (!this._lastVisibilitySync ||
                      now - this._lastVisibilitySync > 2000)
                  ) {
                    this._lastVisibilitySync = now;
                    // Si syncInProgress está atascado por más de 15s, forzar reset
                    if (
                      this.syncInProgress &&
                      this._activeSyncPromise &&
                      this._activeSyncTimeout
                    ) {
                      const elapsed = now - (this._lastSyncStartTime || 0);
                      if (elapsed > 15000) {
                        this.syncInProgress = false;
                        this._activeSyncPromise = null;
                        clearTimeout(this._activeSyncTimeout);
                        this._activeSyncTimeout = null;
                        this.pendingSync = false;
                        console.warn(
                          "[Favoritos] Flags de sincronización forzados a reset tras restaurar pestaña (timeout)"
                        );
                      }
                    }
                    if (!this.syncInProgress && !this._syncRestorePending) {
                      this._syncRestorePending = true;
                      setTimeout(() => {
                        this.enqueueSync();
                        this._syncRestorePending = false;
                        // console.log(
                          // "[Favoritos] Sincronización lanzada al restaurar pestaña"
                        // );
                      }, 100);
                    } else {
                      // console.log(
                        // "[Favoritos] Sincronización ya en curso al restaurar pestaña"
                      // );
                    }
                  }
                }
              } catch (err) {
                console.error(
                  "Error en el listener de visibilitychange de favoritos:",
                  err
                );
              }
            };
            // Limpieza previa
            this._clearSyncInterval();
            this._startSyncInterval();
            if (this._handleVisibilityChangeListener) {
              document.removeEventListener(
                "visibilitychange",
                this._handleVisibilityChangeListener
              );
            }
            this._handleVisibilityChangeListener = this._handleVisibilityChange;
            document.addEventListener(
              "visibilitychange",
              this._handleVisibilityChangeListener
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

      if (this._activeSyncTimeout) {
        clearTimeout(this._activeSyncTimeout);
        this._activeSyncTimeout = null;
      }

      // Limpiar referencias
      this._activeSyncPromise = null;
      this.favoriteProducts.clear();
      this.favoriteButtons = [];
      this.isInitialized = false;
      this._initialLoadComplete = false;
      this._initializationPromise = null;
      this.syncInProgress = false;
      this.pendingSync = false;

      // console.log("Gestor de favoritos destruido correctamente");
    }

    // Actualizar todos los botones de favoritos en la página
    updateAllFavoriteButtons() {
      // Depuración profesional: mostrar IDs en el Set y en los botones
      // console.log(
        // "[Favoritos] IDs en favoriteProducts:",
        // Array.from(this.favoriteProducts)
      // );
      document.querySelectorAll(".favorite-btn").forEach((button) => {
        const productId = String(button.getAttribute("data-product-id"));
        if (!productId) return;
        const isFavorite = this.favoriteProducts.has(productId);
        // console.log(
          // `[Favoritos] Botón data-product-id: ${productId}, isFavorite: ${isFavorite}`
        // );
        this.updateFavoriteButton(button, isFavorite);
      });
    }

    // Actualizar la apariencia de un botón de favorito
    updateFavoriteButton(button, isFavorite) {
      if (!button) return;

      const svg = button.querySelector("svg");
      const favoriteText = button.querySelector(".favorite-text");

      // Remove all potential color classes from both button and SVG
      const colorClassesToRemove = [
        "text-red-500",
        "text-gray-300",
        "text-gray-400",
        "text-gray-700",
        "border-red-500",
        "border-gray-300",
        "border-pink-500",
      ];
      button.classList.remove(...colorClassesToRemove);
      if (svg) {
        svg.classList.remove(...colorClassesToRemove);
      }

      if (isFavorite) {
        button.classList.add("text-red-500", "border-red-500");
        if (svg) {
          svg.classList.add("text-red-500");
        }
        button.setAttribute("aria-label", "Eliminar de favoritos");
        button.setAttribute("title", "Eliminar de favoritos");

        if (svg) {
          // Cambiar el ícono a corazón lleno
          svg.innerHTML = `
            <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" fill="currentColor"/>
          `;
        }
        if (favoriteText) {
          favoriteText.textContent = "Añadido";
        }
      } else {
        button.classList.add("text-gray-400", "border-gray-300");
        if (svg) {
          svg.classList.add("text-gray-400");
        }
        button.setAttribute("aria-label", "Añadir a favoritos");
        button.setAttribute("title", "Añadir a favoritos");

        if (svg) {
          // Cambiar el ícono a corazón vacío
          svg.innerHTML = `
            <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" fill="none" stroke="currentColor" stroke-width="1.5"/>
          `;
        }
        if (favoriteText) {
          favoriteText.textContent = "Guardar";
        }
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
        // Refuerzo: actualizar botones cada vez que se renderizan productos
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

      // Detener la propagación del evento para evitar comportamientos no deseados
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      // Verificar autenticación antes de continuar
      if (!this.isAuthenticated) {
        this.showAuthNotification(
          "Inicia sesión para guardar productos en favoritos"
        );
        const loginEvent = new CustomEvent("show:login", {
          detail: {
            message: "Inicia sesión para guardar productos en favoritos",
            redirectAfterLogin: window.location.pathname,
          },
        });
        document.dispatchEvent(loginEvent);
        return false;
      }

      // La UI se siente instantánea, la lógica de debounce se maneja en toggleFavorite
      this.toggleFavorite(event, favoriteBtn);

      return false;
    }

    // Mostrar notificación de autenticación
    showAuthNotification(message) {
      // Intentar usar el sistema de notificaciones si está disponible
      if (window.showNotification) {
        window.showNotification(message, "info", 3000);
      } else if (window.toast && typeof window.toast.info === "function") {
        window.toast.info(message, 3000);
      } else {
        alert(message);
      }
    }

    /**
     * Alterna el estado de favorito de un producto con debounce para la sincronización.
     * @param {Event} event - Evento de clic (opcional)
     * @param {HTMLElement|string} button - Elemento del botón o ID del producto
     * @returns {Promise<boolean>} - True si la operación fue exitosa
     */
    async toggleFavorite(event, button) {
      let productId, buttonElement;

      if (typeof button === "string") {
        productId = button;
        buttonElement = document.querySelector(
          `[data-product-id="${productId}"]`
        );
      } else {
        buttonElement = button;
        productId = buttonElement.getAttribute("data-product-id");
      }

      if (!productId || typeof productId !== "string") {
        console.error("Error: ID de producto no válido.");
        return false;
      }

      // 1. Actualizar estado y UI localmente de forma optimista
      const newState = !this.favoriteProducts.has(productId);
      if (newState) {
        this.favoriteProducts.add(productId);
      } else {
        this.favoriteProducts.delete(productId);
      }
      this.updateFavoriteButton(buttonElement, newState);
      this.updateFavoritesCounter();
      this.saveLocalFavorites();
      this.updateAllFavoriteButtons();

      // INICIO: Cambio para opacidad en página de favoritos
      // Si estamos en la página de favoritos, aplicamos un efecto visual a la tarjeta del producto.
      const isOnFavoritesPage = window.location.pathname.includes("favoritos");
      if (isOnFavoritesPage && buttonElement) {
        const productCard = buttonElement.closest(".product-card");
        if (productCard) {
          // Si el producto se añade a favoritos, se quita el estado opaco.
          // Si se elimina, se añade el estado opaco.
          productCard.classList.toggle("favorite-removed-state", !newState);

          // Update category counter
          // const categoryName = productCard.getAttribute("data-category-name");
          // this.updateCategoryCounter(categoryName, newState);
        }
      }
      // FIN: Cambio para opacidad en página de favoritos

      // Notificación instantánea para el usuario
      await this._showNotification(
        `Producto ${newState ? "agregado a" : "eliminado de"} favoritos`,
        "success"
      );

      // 2. Debounce de la sincronización con el servidor
      // Si ya hay una sincronización pendiente para este producto, se cancela para reemplazarla por la nueva.
      if (this.pendingSyncs.has(productId)) {
        clearTimeout(this.pendingSyncs.get(productId).timeoutId);
        // console.log(`Acción de favorito para ${productId} consolidada.`);
      }

      // Se programa una nueva sincronización para dentro de 1.5 segundos.
      const timeoutId = setTimeout(() => {
        // console.log(
          // `Iniciando sincronización para producto ${productId} con estado final: ${newState}`
        // );
        // La sincronización real se encola para no sobrecargar el servidor
        this._syncWithServerInBackground(buttonElement, productId, newState);
        this.pendingSyncs.delete(productId); // Limpiar del mapa una vez ejecutado
      }, 1500);

      // Guardar el timeout y el estado final para el debounce
      this.pendingSyncs.set(productId, { timeoutId, state: newState });

      return true;
    }

    async _syncWithServerInBackground(buttonElement, productIdNum, newState) {
      this.syncQueue = this.syncQueue.then(async () => {
        try {
          const token =
            window.auth?.getAuthToken?.() || this.getCookie("token");
          if (!token)
            throw new Error("No se encontró el token de autenticación");

          const response = await this.fetchWithTimeout(
            `/api/favoritos`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                "X-Requested-With": "XMLHttpRequest",
              },
              body: JSON.stringify({
                producto_id: String(productIdNum),
                accion: newState ? "agregar" : "eliminar",
              }),
            },
            10000
          );

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
              errorData.error ||
                `Error del servidor: ${response.status} ${response.statusText}`
            );
          }

          const result = await response.json();
          if (!result.success) {
            throw new Error(
              result.message || "Error al actualizar favoritos en el servidor"
            );
          }

          // console.log(`Sincronización exitosa para producto ${productIdNum}`);
        } catch (error) {
          if (
            error.message.includes("autenticación") ||
            error.message.includes("token") ||
            error.message.includes("401")
          ) {
            console.group(
              `Fallo de autenticación para producto: ${productIdNum}`
            );
            console.error("Error original:", error);
            console.warn(
              `Revertiendo cambio para el producto ${productIdNum}.`
            );
            console.groupEnd();

            if (newState) this.favoriteProducts.delete(productIdNum);
            else this.favoriteProducts.add(productIdNum);

            this.updateFavoriteButton(buttonElement, !newState);
            this.updateFavoritesCounter();
            this.saveLocalFavorites();

            // Revertir el cambio visual si falla la autenticación
            const isOnFavoritesPage =
              window.location.pathname.includes("favoritos");
            if (isOnFavoritesPage && buttonElement) {
              const productCard = buttonElement.closest(".product-card");
              if (productCard) {
                productCard.classList.toggle(
                  "favorite-removed-state",
                  !newState
                );
              }
            }

            this._showNotification(
              "Sesión expirada. Por favor, inicia sesión de nuevo.",
              "error"
            );
          } else {
            console.group(
              `Fallo en sincronización de favorito: ${productIdNum}`
            );
            console.error("Error original:", error);
            console.warn(
              "El cambio se ha guardado localmente y se sincronizará automáticamente más tarde."
            );
            console.groupEnd();
          }
        } finally {
          if (buttonElement) buttonElement.removeAttribute("data-processing");
        }
      });

      try {
        await this.syncQueue;
      } catch (queueError) {
        console.error(
          "Error en la cola de sincronización de favoritos:",
          queueError
        );
      }
    }

    // Control de promesa activa para evitar deadlocks
    _activeSyncPromise = null;
    _activeSyncTimeout = null;

    async syncWithServer(force = false) {
      this._lastSyncStartTime = Date.now();
      // console.log("🔄 Iniciando sincronización con el servidor", { force });

      if (!this.isAuthenticated) {
        // console.log("⏭️ Usuario no autenticado, omitiendo sincronización");
        return { success: false, synced: false, reason: "No autenticado" };
      }

      // Si ya hay una sincronización en curso, no hacer nada
      if (this.syncInProgress) {
        console.warn("⏳ Sincronización ya en curso, syncWithServer ignorado");
        return { success: false, synced: false, reason: "En curso" };
      }
      this.syncInProgress = true;
      try {
        // Obtener acciones pendientes de sincronización
        const pendingActions = this._getPendingSyncActions();
        // console.log(
          // `📋 Acciones pendientes: ${pendingActions.length}`,
          // pendingActions
        // );

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
          // console.log(
            // "🔍 No hay cambios pendientes, verificando estado de sincronización..."
          // );
          try {
            const isSynced = await this._checkServerSyncStatus();
            if (isSynced) {
              // console.log(
                // "✅ Los datos ya están sincronizados con el servidor"
              // );
              this.syncInProgress = false;
              this._showSyncIndicator(false);
              return { success: true, synced: true };
            }
          } catch (e) {
            // Si falla el check, seguimos con la sync
            console.warn(
              "No se pudo verificar estado de sincronización, forzando sync"
            );
          }
        }

        // Aquí va la lógica real de sincronización (ejemplo: fetch con timeout)
        await this.fetchWithTimeout(
          "/api/favoritos/sincronizar",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Requested-With": "XMLHttpRequest",
              Accept: "application/json",
            },
            body: JSON.stringify({
              favoritos_locales: Array.from(this.favoriteProducts),
              timestamp: this._lastSaveTimestamp || 0,
              acciones: pendingActions,
            }),
          },
          10000
        );
        // console.log("✅ Sincronización de favoritos exitosa");
        this.syncInProgress = false;
        this._showSyncIndicator(false);
        return { success: true, synced: true };
      } catch (error) {
        this.syncInProgress = false;
        this._showSyncIndicator(false);
        console.error("Error durante la sincronización de favoritos:", error);
        return { success: false, synced: false, error };
      }
    }

    // Actualizar la UI de los botones de favoritos
    updateFavoritesUI() {
      // Obtener todos los botones de favoritos
      this.updateAllFavoriteButtons();
    }

    updateFavoritesCounter() {
      const count = Array.from(this.favoriteProducts).filter(
        (id) => typeof id === "string" && id.length > 0
      ).length;

      const counters = document.querySelectorAll("#favorites-counter");
      counters.forEach((counter) => {
        if (counter) {
          counter.textContent = count;
          counter.classList.toggle("hidden", count === 0);
        }
      });

      const pageCounter = document.getElementById("favorites-page-counter");
      if (pageCounter) {
        pageCounter.textContent = `${count} ${
          count === 1 ? "producto guardado" : "productos guardados"
        }`; // Esto ahora reemplaza todo el contenido, lo cual es correcto.
      }

      document.dispatchEvent(
        new CustomEvent("favorites:countUpdated", {
          detail: { count },
        })
      );

      // console.log(`Contador de favoritos actualizado: ${count} productos`);
    }

    slugify(text) {
      if (!text) return '';
      return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
    }

    async loadFavorites() {
      if (!this.isAuthenticated) {
        // console.log("Usuario no autenticado, no se pueden cargar favoritos");
        this.favoriteProducts.clear();
        this.updateFavoritesUI();
        this.updateFavoritesCounter();
        return;
      }

      try {
        // console.log("Cargando favoritos...");
        // Obtener el token JWT de las cookies
        const getCookie = (name) => {
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop().split(";").shift();
        };
        const token = getCookie("token");

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

        // Limpiar favoritos antes de actualizar
        this.favoriteProducts.clear();
        if (data.success && Array.isArray(data.favoritos)) {
          // Si la respuesta es una lista de objetos, extraer el id correctamente
          data.favoritos.forEach((fav) => {
            if (typeof fav === "string" && fav.length > 0) {
              this.favoriteProducts.add(fav);
            } else if (fav && typeof fav === "object" && fav.id) {
              this.favoriteProducts.add(String(fav.id));
            }
          });
        } else {
          this.favoriteProducts.clear();
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
        this.favoriteProducts.clear();
        this.updateFavoritesUI();
        this.updateFavoritesCounter();
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
        const token = getCookie("token");

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
        // console.log(`[${type.toUpperCase()}] ${message}`);
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
        productsGrid.innerHTML =
          `
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
        // console.log("Usuario no autenticado, limpiando favoritos locales");
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
          // console.log("No se encontraron favoritos en caché local");
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
          // console.log(
            // "La caché local está desactualizada, se requiere sincronización"
          // );
          return false;
        }

        // Cargar los favoritos desde el caché
        if (Array.isArray(favorites)) {
          this.favoriteProducts = new Set(favorites);
          // console.log(
            // `Favoritos cargados desde caché local (${this.favoriteProducts.size} items)`
          // );

          // Si los datos están desactualizados, iniciar sincronización en segundo plano
          if (isStale) {
            // console.log("Iniciando sincronización en segundo plano...");
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

        // console.log(`Se eliminaron ${removed} entradas antiguas de la caché`);
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
        // console.log(
          // "Usuario no autenticado, omitiendo carga de favoritos del servidor"
        // );
        return this.favoriteProducts;
      }

      // Si no es forzado y ya tenemos favoritos cargados, devolver los existentes
      if (!forceRefresh && this.favoriteProducts.size > 0 && page === 1) {
        // console.log("Usando favoritos ya cargados");
        return this.favoriteProducts;
      }

      try {
        // console.log(
          // `Cargando favoritos desde el servidor (página ${page}, ${perPage} por página)...`
        // );

        // Obtener el token de autenticación
        const token =
          window.auth?.getAuthToken?.() || this.getCookie("token");
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
        // console.log("Respuesta del servidor:", data);

        // Verificar el formato de la respuesta y aceptar varios formatos
        let ids = [];
        if (data && Array.isArray(data.favoritos)) {
          ids = data.favoritos;
        } else if (data && Array.isArray(data.ids)) {
          ids = data.ids;
        } else if (data && Array.isArray(data.items)) {
          ids = data.items;
        } else {
          console.warn("Formato de respuesta inesperado del servidor:", data);
          return this.favoriteProducts;
        }

        const serverFavorites = new Set(ids.map(String));
        // console.log(
          // `Favoritos recibidos (página ${page}):`,
          // Array.from(serverFavorites)
        // );

        // Si es la primera página, reemplazar los favoritos existentes
        // Si no, combinar con los existentes
        if (page === 1) {
          this.favoriteProducts = new Set(serverFavorites);
        } else {
          serverFavorites.forEach((id) => this.favoriteProducts.add(id));
        }

        // Guardar en localStorage solo cuando se hayan cargado todos los favoritos
        this.saveLocalFavorites();

        // Actualizar la UI
        this.updateFavoritesUI();
        this.updateFavoritesCounter();
        this.updateAllFavoriteButtons();

        // console.log(
          // "Favoritos cargados correctamente. Total:",
          // this.favoriteProducts.size
        // );

        return this.favoriteProducts;
      } catch (error) {
        console.error("Error al cargar favoritos del servidor:", error);

        // Mostrar notificación de error al usuario
        if (error.message.includes("Sesión expirada")) {
          this.showAuthModal(error.message);
        } else {
          this._showNotification(
            "Error al cargar tus favoritos. Intenta recargar la página.",
            "error"
          );
        }

        return this.favoriteProducts;
      }
    }

    // Método para encolar sincronizaciones
    enqueueSync() {
      // Si ya hay una sincronización en curso, no hacer nada
      if (this.syncInProgress) {
        console.warn(
          "[Favoritos] Sincronización ya en curso, enqueueSync ignorado"
        );
        return;
      }
      this.syncWithServer();
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

    // Obtener acciones pendientes de sincronización
    _getPendingSyncActions() {
      try {
        const actionsStr = localStorage.getItem("pending_favorite_actions");

        if (!actionsStr) {
          // console.log(
            // "ℹ️ No hay acciones pendientes en el almacenamiento local"
          // );
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
          // console.log(
            // `🔄 Se filtraron ${
              // actions.length - validActions.length
            // } acciones inválidas o antiguas`
          // );

          if (validActions.length > 0) {
            localStorage.setItem(
              "pending_favorite_actions",
              JSON.stringify(validActions)
            );
          } else {
            localStorage.removeItem("pending_favorite_actions");
          }
        }

        // console.log(
          // `📋 ${validActions.length} acciones pendientes de sincronización`
        // );
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
      // console.log("🔍 Verificando estado de sincronización con el servidor...");

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
        // console.log("📊 Datos del servidor recibidos:", data);

        if (data.success && Array.isArray(data.favoritos)) {
          const serverFavorites = new Set(data.favoritos.map((fav) => fav.id));
          const localFavorites = this.favoriteProducts;

          // console.log("🔄 Comparando favoritos:", {
            // servidor: Array.from(serverFavorites),
            // local: Array.from(localFavorites),
          // });

          // Verificar si los conjuntos son iguales
          const sizesMatch = serverFavorites.size === localFavorites.size;
          const allMatch = Array.from(serverFavorites).every((id) =>
            localFavorites.has(id)
          );

          if (sizesMatch && allMatch) {
            // console.log("✅ Los datos están sincronizados correctamente");
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
        // console.log("Iniciando limpieza del localStorage...");

        // Guardar una copia de los favoritos actuales
        const currentFavorites = Array.from(this.favoriteProducts);
        // console.log("Favoritos actuales guardados:", currentFavorites);

        // Limpiar el localStorage
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem("pending_favorite_actions");
        // console.log("Elementos eliminados del localStorage");

        // Actualizar el estado local
        this.favoriteProducts = new Set(currentFavorites);
        this._lastSaveTimestamp = Date.now();

        // Guardar los favoritos actuales sin datos de caché
        const cleanState = {
          favoritos: currentFavorites,
          timestamp: this._lastSaveTimestamp,
        };

        this.saveLocalFavorites(cleanState);
        // console.log("Nuevo estado guardado en localStorage:", cleanState);

        if (showNotification) {
          this._showNotification(
            "✅ Se ha limpiado la caché local correctamente",
            "success",
            3000
          );
        }

        // console.log("✅ Caché local limpiada correctamente");
        return true;
      } catch (error) {
        console.error("❌ Error al limpiar la caché local:", error);

        if (showNotification) {
          this._showNotification(
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

      // console.log(
        // `Se eliminaron ${keysToRemove.length} elementos antiguos del caché`
      // );

      // Notificar al usuario si se eliminaron elementos
      if (keysToRemove.length > 0) {
        this._showNotification(
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
});