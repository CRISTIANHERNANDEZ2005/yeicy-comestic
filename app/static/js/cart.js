/**
 * @file Módulo del Carrito de Compras del Cliente (ShoppingCart).
 * @description Este script encapsula toda la lógica del carrito de compras en una clase `ShoppingCart`.
 *              Gestiona el estado, la interfaz de usuario y la sincronización con el backend.
 *
 * @class ShoppingCart
 *
 * @funcionalidadesClave
 * 1.  **Gestión de Estado Dual:**
 *     - Mantiene el estado del carrito en `localStorage` para persistencia entre sesiones.
 *     - Sincroniza el estado con la base de datos para usuarios autenticados.
 *
 * 2.  **Sincronización Inteligente con Backend:**
 *     - **Hidratación:** Al cargar la página, si el usuario está autenticado, carga el carrito desde el servidor.
 *     - **Fusión Post-Login:** Al iniciar sesión, fusiona el carrito local (de sesión anónima) con el del servidor.
 *     - **Sincronización en Segundo Plano:** Los cambios locales (añadir, eliminar, actualizar) se envían al backend de forma asíncrona.
 *
 * 3.  **Interfaz de Usuario (UI) Reactiva y Optimista:**
 *     - **Modal de Carrito:** Controla un modal deslizable que muestra el estado actual del carrito.
 *     - **Actualizaciones Optimistas:** La UI se actualiza instantáneamente, proporcionando una experiencia fluida.
 *     - **Feedback Visual:** Muestra estados de carga, animaciones y notificaciones (toasts) para cada acción.
 *
 * 4.  **Flujo de Compra y Pedido:**
 *     - **Checkout por WhatsApp:** Gestiona la finalización de la compra, creando un pedido en la BD para usuarios autenticados.
 *     - **Generación de Facturas:** Permite al usuario descargar una factura en formato HTML/PDF.
 *
 * 5.  **Optimización de Rendimiento:**
 *     - **Cache Interna:** Utiliza un objeto `cache` para almacenar totales y contadores, evitando recálculos innecesarios.
 *     - **Manejo de Sesión:** Se integra con el sistema de autenticación para limpiar el carrito al cerrar sesión.
 */
if (typeof ShoppingCart === "undefined") {
  class ShoppingCart {
    constructor() {
      this.cartCounter = document.getElementById("cartCounter");
      this.cartItems = [];
      this.isUpdating = false;
      this.isDeleting = false;
      this.currentItemToDelete = null;
      this.storageKey = "ye_cy_cart";
      this.syncEndpoint = "/api/sync_cart"; // Endpoint para enviar cambios locales.
      this.loadEndpoint = "/api/load_cart"; // Endpoint para cargar el carrito desde la BD.
      this.autoOpenOnNewItem = true;
      this.preventAutoClose = false;
      this.originalOverflow = "";
      this.activeButtons = new Map();
      // Cache para optimizar cálculos.
      this.cache = {
        uniqueCount: 0,
        totalQuantity: 0,
        totalPrice: 0,
      };
      this.currentOrderId = null; // Almacena el ID del pedido actual.
      this.init();
    }
    init() {
      this.loadCartFromStorage();
      this.bindEvents();
      this.setupCartModal();
      this.setupDeleteModal();
      this.setupWhatsAppModal();
      this.setupUnauthenticatedWhatsAppModal();
      // Al iniciar, si el usuario está autenticado, hidratar el carrito desde el servidor.
      if (window.userId) {
        this.hydrateCartFromServer();
      }
    }
    loadCartFromStorage() {
      try {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
          this.cartItems = JSON.parse(saved);
          this.updateCache(); // Actualizar cache.
          this.updateCartCounter();
        }
      } catch (error) {
        console.error("Error loading from storage:", error);
        this.showToast("Error al cargar el carrito", "error");
        this.cartItems = [];
      }
    }
    saveToStorage() {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.cartItems));
        this.updateCache(); // Actualizar cache después de guardar.
        // Resetear el ID del pedido actual porque el carrito ha cambiado.
        this.currentOrderId = null;
      } catch (error) {
        console.error("Error saving to storage:", error);
        this.showToast("Error al guardar el carrito", "error");
      }
    }
    clearStorage() {
      localStorage.removeItem(this.storageKey);
      this.updateCache(); // Limpiar cache.
    }
    // Método para actualizar la caché interna.
    updateCache() {
      this.cache.uniqueCount = this.cartItems.length;
      this.cache.totalQuantity = this.cartItems.reduce(
        (sum, item) => sum + item.quantity,
        0
      );
      this.cache.totalPrice = this.cartItems.reduce(
        (sum, item) => sum + item.subtotal,
        0
      );
    }
    // Función para formatear moneda a pesos colombianos (COP).
    formatCurrencyCOP(value) {
      if (value === null || value === undefined) {
        return "$ 0";
      }
      // Asegurarse de que el valor sea un número.
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return "$ 0";
      }
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(numValue);
    }
    async syncLocalChanges() {
      if (window.userId) {
        const previousCartItems = JSON.parse(JSON.stringify(this.cartItems)); // Copia profunda.
        try {
          const response = await fetch(this.syncEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cart_items: this.cartItems }),
          });
          const data = await response.json();
          if (data.success) {
            // Eliminado: this.updateCartItemsFromBackend(data.items);
            this.saveToStorage();
            // Solo actualizar la UI si el estado del carrito realmente cambió después de la sincronización.
            // Esta comparación es ahora menos relevante ya que no estamos actualizando desde la respuesta del backend,
            // but keeping it for consistency if other parts of the code modify cartItems
            if (
              JSON.stringify(previousCartItems) !==
              JSON.stringify(this.cartItems)
            ) {
              this.updateCartCounter();
              this.refreshCartModal();
            }
            // Manejar advertencias del backend.
            if (data.warnings && data.warnings.length > 0) {
              data.warnings.forEach((warningMsg) => {
                this.showToast(warningMsg, "warning");
              });
            }
          } else {
            // Si la sincronización falla, revertir al estado local anterior.
            this.cartItems = previousCartItems;
            this.saveToStorage();
            this.updateCartCounter();
            this.refreshCartModal();
            // Usar el mensaje específico del backend si está disponible, de lo contrario uno genérico.
            this.showToast(
              data.message ||
                "Error al sincronizar el carrito con el servidor.",
              "error"
            );
          }
        } catch (error) {
          console.error("Error syncing local changes with backend:", error);
          // Si hay error de conexión, revertir al estado local anterior.
          this.cartItems = previousCartItems;
          this.saveToStorage();
          this.updateCartCounter();
          this.refreshCartModal();
          this.showToast(
            "Error de conexión al sincronizar el carrito.",
            "error"
          );
        }
      }
    }
    async mergeLocalCartWithServer() {
      if (window.userId && this.cartItems.length > 0) {
        try {
          const response = await fetch(this.syncEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cart_items: this.cartItems,
              merge: true,
            }),
          });
          const data = await response.json();
          if (data.success) {
            this.updateCartItemsFromBackend(data.items);
            this.saveToStorage();
            this.updateCartCounter();
            this.refreshCartModal();
            // console.log("Local cart merged with server cart.");
            // Manejar advertencias del backend.
            if (data.warnings && data.warnings.length > 0) {
              data.warnings.forEach((warningMsg) => {
                this.showToast(warningMsg, "warning");
              });
            }
          } else {
            console.error("Error merging carts:", data.message);
            this.showToast(
              data.message || "Error al fusionar el carrito con el servidor.",
              "error"
            );
          }
        } catch (error) {
          console.error("Connection error while merging carts:", error);
        }
      } else {
        // Si no hay carrito local, simplemente cargar el del servidor.
        this.hydrateCartFromServer();
      }
    }
    updateCartItemsFromBackend(backendItems) {
      const newCartItems = [];
      const backendMapById = new Map(); // Mapear artículos del backend por su ID real de la BD.
      const backendMapByProductId = new Map(); // Mapear artículos del backend por product_id para coincidir con IDs temporales.
      backendItems.forEach((item) => {
        backendMapById.set(item.id, item);
        backendMapByProductId.set(item.product_id, item);
      });
      // Iterar sobre los artículos del carrito local actual.
      this.cartItems.forEach((localItem) => {
        let matchedBackendItem = null;
        if (localItem.id.startsWith("temp_")) {
          // Para artículos temporales, intentar encontrar una coincidencia en el backend por product_id.
          matchedBackendItem = backendMapByProductId.get(localItem.product_id);
        } else {
          // Para artículos con IDs reales, intentar encontrar una coincidencia en el backend por ID real.
          matchedBackendItem = backendMapById.get(localItem.id);
        }
        if (matchedBackendItem) {
          // Actualizar el artículo local con datos del backend (especialmente el ID).
          newCartItems.push({
            ...localItem,
            id: matchedBackendItem.id, // Usar el ID generado por el backend.
            // Solo actualizar la cantidad si la del backend es diferente Y
            // either the local item was temporary (just added)
            // o la cantidad del backend es explícitamente diferente (ej. ajuste de stock).
            quantity:
              localItem.id.startsWith("temp_") ||
              localItem.quantity !== matchedBackendItem.quantity
                ? matchedBackendItem.quantity
                : localItem.quantity,
            subtotal: matchedBackendItem.subtotal, // El subtotal siempre debe venir del backend o ser recalculado.
            product: matchedBackendItem.product || localItem.product, // Usar datos de producto del backend si están disponibles.
          });
          // Eliminar de los mapas para evitar procesar de nuevo.
          backendMapById.delete(matchedBackendItem.id);
          backendMapByProductId.delete(matchedBackendItem.product_id); // También eliminar del mapa de product_id.
        }
        // Si no hay coincidencia, significa que este artículo local fue eliminado del backend, así que no se añade a newCartItems.
        // O es un artículo temporal que no se pudo añadir al backend (caso de error).
      });
      // Add any items that are only in the backend (newly added or from another device)
      backendMapById.forEach((item) => {
        // Iterate over remaining items in backendMapById
        newCartItems.push(item);
      });
      this.cartItems = newCartItems;
    }
    async hydrateCartFromServer() {
      if (window.userId) {
        try {
          const response = await fetch(this.loadEndpoint);
          const data = await response.json();
          if (data.success) {
            this.cartItems = data.items;
            this.saveToStorage();
            this.updateCartCounter();
            this.refreshCartModal();
            // console.log("Carrito hidratado desde el servidor.");
          } else {
            console.error(
              "Error al hidratar el carrito desde el servidor:",
              data.message
            );
            this.showToast("Error al cargar tu carrito.", "error");
          }
        } catch (error) {
          console.error("Error de conexión al hidratar el carrito:", error);
          this.showToast("Error de conexión al cargar tu carrito.", "error");
        }
      }
    }
    bindEvents() {
      document.addEventListener("click", (e) => {
        const addBtn = e.target.closest(".add-to-cart");
        if (addBtn && !addBtn.disabled) {
          e.preventDefault();
          e.stopPropagation();
          this.addToCart(addBtn);
        }
      });
      document.addEventListener("click", (e) => {
        if (e.target.closest("#cartIcon") || e.target.closest(".open-cart")) {
          this.openCartModal();
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          this.closeCartModal();
          this.hideDeleteModal();
          this.hideWhatsAppModal();
          this.hideUnauthenticatedWhatsAppModal();
        }
      });
      window.addEventListener("storage", (e) => {
        if (e.key === "user_authenticated") {
          this.hydrateCartFromServer();
        }
      });
      document.addEventListener("click", (e) => {
        const overlay = document.getElementById("cartOverlay");
        if (e.target === overlay && !this.preventAutoClose) {
          this.closeCartModal();
        }
      });
      document.addEventListener("click", async (e) => {
        const whatsappBtn = e.target.closest("#whatsappCheckout");
        if (whatsappBtn) {
          e.preventDefault();
          if (window.userId) {
            // Usuario autenticado: mostrar modal de confirmación
            this.showWhatsAppModal();
          } else {
            // Usuario no autenticado: mostrar modal de confirmación
            this.showUnauthenticatedWhatsAppModal();
          }
        }
      });
    }
    setupCartModal() {
      const closeBtn = document.getElementById("closeCart");
      const overlay = document.getElementById("cartOverlay");
      closeBtn?.addEventListener("click", () => this.closeCartModal());
      overlay?.addEventListener("click", (e) => {
        if (e.target === overlay) {
          this.closeCartModal();
        }
      });
    }
    setupDeleteModal() {
      document
        .getElementById("cancelDelete")
        ?.addEventListener("click", () => this.hideDeleteModal());
      document
        .getElementById("confirmDelete")
        ?.addEventListener("click", () => this.confirmDelete());
    }
    setupWhatsAppModal() {
      document
        .getElementById("cancelWhatsapp")
        ?.addEventListener("click", () => this.hideWhatsAppModal());
      document
        .getElementById("confirmWhatsapp")
        ?.addEventListener("click", () => this.confirmOrderAndClearCart());
      document
        .getElementById("downloadPdfButton")
        ?.addEventListener("click", () => this.printInvoice());
    }
    showWhatsAppModal() {
      const modal = document.getElementById("whatsappConfirmationModal");
      modal.classList.remove("hidden");
      document.body.style.overflow = "hidden";
    }
    hideWhatsAppModal() {
      const modal = document.getElementById("whatsappConfirmationModal");
      modal.classList.add("hidden");
      document.body.style.overflow = "auto";
    }
    async confirmOrderAndClearCart() {
      try {
        // Asegurarse de que el pedido exista antes de vaciar el carrito.
        if (!this.currentOrderId) {
          const response = await fetch('/api/create_order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            },
          });
          const data = await response.json();
          if (data.success) {
            this.currentOrderId = data.pedido_id;
            this.showToast("Pedido creado exitosamente", "success");
          } else {
            this.showToast(data.message || "Error al crear el pedido", "error");
            this.hideWhatsAppModal();
            return;
          }
        }

        // Ahora que el pedido está asegurado, vaciar el carrito en el backend.
        const clearResponse = await fetch('/api/clear_cart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });
        const clearData = await clearResponse.json();
        if (!clearData.success) {
            this.showToast(clearData.message || "Error al vaciar el carrito", "error");
            this.hideWhatsAppModal();
            return;
        }

        // Si el vaciado en el backend es exitoso, limpiar localmente.
        this.clearCartAndUI();
        this.showToast("Pedido confirmado y carrito vaciado", "success");

        // Obtener el enlace de WhatsApp.
        const whatsappResponse = await fetch(`/api/get_whatsapp_link/${this.currentOrderId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        });
        const whatsappData = await whatsappResponse.json();
        if (whatsappData.success) {
          window.open(whatsappData.whatsapp_link, '_blank');
        } else {
          this.showToast(whatsappData.message || "Error al obtener el enlace de WhatsApp", "error");
        }

      } catch (error) {
        console.error("Error al confirmar el pedido por WhatsApp:", error);
        this.showToast("Error de conexión", "error");
      } finally {
        this.hideWhatsAppModal();
      }
    }
    setupUnauthenticatedWhatsAppModal() {
      document
        .getElementById("cancelUnauthenticatedWhatsapp")
        ?.addEventListener("click", () => this.hideUnauthenticatedWhatsAppModal());
      document
        .getElementById("confirmUnauthenticatedWhatsapp")
        ?.addEventListener("click", () => this.confirmUnauthenticatedWhatsApp());
    }
    showUnauthenticatedWhatsAppModal() {
      const modal = document.getElementById("unauthenticatedWhatsappConfirmationModal");
      modal.classList.remove("hidden");
      document.body.style.overflow = "hidden";
    }
    hideUnauthenticatedWhatsAppModal() {
      const modal = document.getElementById("unauthenticatedWhatsappConfirmationModal");
      modal.classList.add("hidden");
      document.body.style.overflow = "";
    }
    confirmUnauthenticatedWhatsApp() {
      const whatsappBtn = document.getElementById("whatsappCheckout");
      const url = whatsappBtn.href;
      
      if (url && url !== "#") {
        window.open(url, "_blank");
        this.clearCartAndUI();
      }
      
      this.hideUnauthenticatedWhatsAppModal();
    }

    async addToCart(button) {
      if (this.isUpdating) return;
      const productId = button.dataset.productId;
      const quantity = parseInt(button.dataset.quantity || 1);
      if (!productId) {
        this.showToast("Producto no válido", "error");
        return;
      }
      const originalHTML = button.innerHTML;
      const originalClasses = button.className;
      this.showLoadingState(button);
      this.isUpdating = true;
      this.activeButtons.set(button, {
        html: originalHTML,
        classes: originalClasses,
      });
      try {
        const productResponse = await fetch(`/api/product/${productId}`);
        const product = await productResponse.json();
        if (!product || product.existencia < quantity) {
          this.showToast(
            `Stock insuficiente - Solo quedan ${product.existencia || 0} unidades`,
            "warning"
          );
          this.restoreButton(button);
          return;
        }
        const isNewItem = !this.cartItems.find(
          (item) => item.product_id == productId
        );
        const existingItem = this.cartItems.find(
          (item) => item.product_id == productId
        );
        if (existingItem) {
          const oldQuantity = existingItem.quantity;
          const newQuantity = Math.min(oldQuantity + quantity, product.existencia);
          if (oldQuantity === newQuantity) {
            // Quantity did not change, likely already at max stock
            this.showToast(
              `El producto "${product.nombre}" ya está en la cantidad máxima disponible (${product.existencia} unidades).`,
              "warning"
            );
          } else {
            existingItem.quantity = newQuantity;
            existingItem.subtotal = parseFloat(product.precio) * newQuantity;
            if (newQuantity < oldQuantity + quantity) {
              // Quantity was adjusted due to stock
              this.showToast(
                `Cantidad de "${product.nombre}" ajustada a ${newQuantity} debido a la disponibilidad.`,
                "warning"
              );
            }
          }
        } else {
          this.cartItems.push({
            id: `temp_${Date.now()}`,
            product_id: productId,
            quantity: Math.min(quantity, product.existencia),
            product: {
              id: product.id,
              nombre: product.nombre,
              precio: parseFloat(product.precio),
              imagen_url: product.imagen_url,
              marca: product.marca || "",
              existencia: product.existencia,
            },
            subtotal:
              parseFloat(product.precio) * Math.min(quantity, product.existencia),
          });
          this.showToast("Producto agregado al carrito", "success");
        }
        this.saveToStorage();
        this.updateCartCounter();
        this.refreshCartModal();
        this.showSuccessAnimation(button);
        if (isNewItem && this.autoOpenOnNewItem) {
          this.openCartModal();
        }
        if (window.userId) {
          this.syncLocalChanges();
        }
      } catch (error) {
        console.error("Error:", error);
        this.showToast("Error de conexión - Intenta nuevamente", "error");
        this.restoreButton(button);
      } finally {
        setTimeout(() => {
          this.restoreButton(button);
          this.isUpdating = false;
          this.activeButtons.delete(button);
        }, 100);
      }
    }
    restoreButton(button) {
      if (!button) return;
      const savedState = this.activeButtons.get(button);
      if (savedState) {
        button.innerHTML = savedState.html;
        button.className = savedState.classes;
        button.disabled = false;
      } else {
        button.innerHTML =
          '<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>Añadir al carrito';
        button.disabled = false;
      }
    }
    showDeleteModal(itemId) {
      this.currentItemToDelete = itemId;
      const modal = document.getElementById("deleteModal");
      modal.classList.remove("hidden");
      document.body.style.overflow = "hidden";
    }
    hideDeleteModal() {
      this.currentItemToDelete = null;
      document.getElementById("deleteModal").classList.add("hidden");
      document.body.style.overflow = "";
    }
    removeItemWithAnimation(itemId) {
      return new Promise((resolve) => {
          const itemElement = document.querySelector(
              `[data-item-id="${itemId}"]`
          );
          if (itemElement) {
              itemElement.style.transition = "all 0.3s ease-out";
              itemElement.style.transform = "translateX(100%)";
              itemElement.style.opacity = "0";
              setTimeout(() => {
                  this.cartItems = this.cartItems.filter(
                      (item) => item.id !== itemId
                  );
                  this.saveToStorage();
                  this.updateCartModal();
                  this.updateCartCounter();
                  resolve();
              }, 300);
          } else {
              this.cartItems = this.cartItems.filter((item) => item.id !== itemId);
              this.saveToStorage();
              this.updateCartModal();
              this.updateCartCounter();
              resolve();
          }
      });
  }
    async confirmDelete() {
      if (!this.currentItemToDelete || this.isDeleting) return;
      this.isDeleting = true;
      const confirmBtn = document.getElementById("confirmDelete");
      const originalText = confirmBtn.innerHTML;
      confirmBtn.innerHTML =
        '<span class="flex items-center"><svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Eliminando...</span>';
      confirmBtn.disabled = true;
      try {
        await this.removeItemWithAnimation(this.currentItemToDelete);
        this.showToast("Producto eliminado exitosamente", "success");
        if (window.userId) {
          this.syncLocalChanges();
        }
      } catch (error) {
        this.showToast("Error al eliminar el producto", "error");
      } finally {
        confirmBtn.innerHTML = originalText;
        confirmBtn.disabled = false;
        this.hideDeleteModal();
        this.isDeleting = false;
      }
    }
    // Contador de productos únicos.
    updateCartCounter() {
      const uniqueCount = this.cache.uniqueCount;
      if (this.cartCounter) {
        this.cartCounter.textContent = uniqueCount;
        this.cartCounter.classList.toggle("hidden", uniqueCount === 0);
        // Animación mejorada
        if (uniqueCount > 0) {
          this.cartCounter.classList.add("cart-counter-bounce");
          setTimeout(() => {
            this.cartCounter.classList.remove("cart-counter-bounce");
          }, 600);
        }
      }
      // Actualizar también el contador en el modal.
      this.updateModalCounters();
    }
    // Método para actualizar todos los contadores del modal.
    updateModalCounters() {
      const uniqueProductCount = document.getElementById("uniqueProductCount");
      const productText = document.getElementById("productText");
      if (uniqueProductCount) {
        uniqueProductCount.textContent = this.cache.uniqueCount;
        uniqueProductCount.classList.add("changing");
        setTimeout(() => {
          uniqueProductCount.classList.remove("changing");
        }, 300);
      }
      if (productText) {
        productText.textContent =
          this.cache.uniqueCount === 1 ? "producto único" : "productos únicos";
      }
    }
    openCartModal() {
      const modal = document.getElementById("cartModal");
      const panel = document.getElementById("cartPanel");
      if (!modal || !panel) return;
      this.originalOverflow = document.body.style.overflow;
      modal.style.display = "block";
      modal.offsetHeight;
      modal.classList.remove("invisible", "opacity-0");
      panel.classList.remove("translate-x-full");
      document.body.style.overflow = "hidden";
      this.updateCartModal();
      window.dispatchEvent(new CustomEvent("cartOpened"));
    }
    closeCartModal() {
      const modal = document.getElementById("cartModal");
      const panel = document.getElementById("cartPanel");
      if (!modal || !panel) return;
      modal.classList.add("opacity-0");
      panel.classList.add("translate-x-full");
      setTimeout(() => {
        modal.style.display = "none";
        document.body.style.overflow = this.originalOverflow || "auto";
        window.dispatchEvent(new CustomEvent("cartClosed"));
      }, 300);
    }

    // Método actualizado updateCartModal
updateCartModal() {
    const container = document.getElementById("cartItemsContainer");
    const emptyState = document.getElementById("emptyCartState");
    const itemCount = document.getElementById("cartItemCount");
    const subtotalElement = document.getElementById("cartSubtotal");
    const totalElement = document.getElementById("cartTotal");
    const cartFooter = document.getElementById("cartFooter"); // Nuevo elemento
    if (this.cartItems.length === 0) {
        container.innerHTML = "";
        emptyState.classList.remove("hidden");
        emptyState.classList.add("flex");
        itemCount.textContent = "0 productos";
        subtotalElement.textContent = "$0.00";
        totalElement.textContent = "$0.00";
        // Ocultar footer cuando no hay artículos.
        this.animateFooter(false);
        return;
    }
    emptyState.classList.add("hidden");
    emptyState.classList.remove("flex");
    // Mostrar footer cuando hay artículos.
    this.animateFooter(true);
    // Usar valores cacheados para mejor rendimiento.
    const uniqueCount = this.cache.uniqueCount;
    const totalQuantity = this.cache.totalQuantity;
    const totalPrice = this.cache.totalPrice;
    itemCount.textContent = `${totalQuantity} ` +
        (totalQuantity === 1 ? "producto" : "productos");
    subtotalElement.textContent = this.formatCurrencyCOP(totalPrice);
    totalElement.textContent = this.formatCurrencyCOP(totalPrice);
    container.innerHTML = this.cartItems
        .map(
            (item) => `
      <div class="group p-4 hover:bg-gray-50 transition-colors" data-item-id="${ 
        item.id
      }">
        <div class="flex gap-4">
          <div class="relative">
            ${ 
              item.product.imagen_url &&
              item.product.imagen_url.trim() !== "" &&
              !item.product.imagen_url.includes("default")
                ? `<img 
                     src="${item.product.imagen_url}" 
                     alt="${item.product.nombre}" 
                     class="w-20 h-20 rounded-lg object-cover shadow-sm"
                     onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZDhkYWRiIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KPHBhdGggZD0iTTMuMTYgMTguODhMMTUuMTIgNi45M2EuMTYuMTYgMCAwIDEgLjIyIDBsMy4wNiAzLjA2YS4xNi4xNiAwIDAgMSAwIC4yMkw2LjQ0IDIyYTEgMSAwIDAgMS0xLjM5LjA2bC02LjE1LTUuNzlhMS4yNSAxLjI1IDAgMCAxIC4yNi0xLjM5eiIvPgo8cGF0aCBkPSJNMTkgMTlhMiAyIDAgMSAwIDAtNCAyIDIgMCAwIDAgMCA0eiIvPgo8cGF0aCBkPSJNMjIgMTB2OGEyIDIgMCAwIDEtMiAyaC0xM2wtMy4yLTIuN2ExIDEgMCAwIDAtMS42LjRsLTMuMzUgNCIvPgo8cGF0aCBkPSJNMiAxMHYtNGEyIDIgMCAwIDEgMi0yaDZhMSAxIDAgMCAwIC44LS40bDIuNi0zLjQ1YTEgMSAwIDAgMSAuOC0uMzVIMThhMiAyIDAgMCAxIDIgMlYxMCIvPgo8L3N2Zz4='; this.classList.add('p-2', 'opacity-50')">
                `
                : `<div class="w-20 h-20 bg-gray-50 rounded-lg shadow-sm flex items-center justify-center">
                     <svg class="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                     </svg>
                   </div>`
            }
            ${ 
              item.product.existencia < 10
                ? `<span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-2 py-1">¡Últimos!</span>`
                : ""
            }
          </div>
          
          <div class="flex-1">
            <h4 class="font-semibold text-gray-900 line-clamp-1">${ 
              item.product.nombre
            }</h4>
            <p class="text-sm text-gray-500">${item.product.marca || ""}</p>
            <p class="text-pink-600 font-bold text-lg">${ 
              this.formatCurrencyCOP(item.product.precio)
            }</p>
          </div>
          
          <div class="flex flex-col items-end gap-2">
            <button onclick="cart.showDeleteModal('${
              item.id
            }')" class="text-red-500 hover:text-red-700 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
            
            <div class="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button onclick="cart.updateQuantity('${
                item.id
              }', -1)" class="p-2 hover:bg-gray-100 transition-colors disabled:opacity-50"
                ${item.quantity <= 1 ? "disabled" : ""}>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>
                </svg>
              </button>
              
              <span class="px-3 py-1 text-center font-semibold min-w-[3rem]">${ 
                item.quantity
              }</span>
              
              <button onclick="cart.updateQuantity('${
                item.id
              }', 1)" class="p-2 hover:bg-gray-100 transition-colors disabled:opacity-50">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
              </button>
            </div>
            
            <p class="text-sm font-bold text-gray-900">
              ${this.formatCurrencyCOP(item.subtotal)}
            </p>
          </div>
        </div>
      </div>
    `
        )
        .join("");
    this.updateWhatsAppLink(totalPrice);
}
// Método para animar la aparición/desaparición del footer.
animateFooter(show) {
    const cartFooter = document.getElementById("cartFooter");
    if (show) {
        cartFooter.style.display = 'block';
        // Forzar reflow para reiniciar la animación.
        cartFooter.offsetHeight;
        cartFooter.style.opacity = '1';
        cartFooter.style.transform = 'translateY(0)';
    } else {
        cartFooter.style.opacity = '0';
        cartFooter.style.transform = 'translateY(20px)';
        setTimeout(() => {
            cartFooter.style.display = 'none';
        }, 300); // Coincide con la duración de la transición.
    }
}

    clearCartAndUI() {
      this.cartItems = [];
      this.clearStorage(); // Llama a updateCache, que ahora usará un carrito vacío.
      this.updateCartCounter();
      this.refreshCartModal();
    }

    clearCartOnLogout() {
      this.cartItems = [];
      this.saveToStorage();
      this.updateCartCounter();
      // console.log("Carrito local limpiado por cierre de sesión.");
    }
   async updateQuantity(itemId, change) {
    if (this.isUpdating) return;
    const item = this.cartItems.find((i) => i.id === itemId);
    if (!item) return;
    const newQuantity = item.quantity + change;
    if (newQuantity < 1) return;
    if (newQuantity > item.product.existencia) {
        this.showToast("Stock máximo alcanzado", "warning");
        return;
    }
    this.isUpdating = true;
    try {
        item.quantity = newQuantity;
        item.subtotal = item.product.precio * newQuantity;
        this.saveToStorage();
        this.updateCartModal();
        this.updateCartCounter();
        if (window.userId) {
            this.syncLocalChanges();
        }
    } catch (error) {
        console.error("Error:", error);
        this.showToast("Error al actualizar cantidad", "error");
    } finally {
        this.isUpdating = false;
    }
}
    refreshCartModal() {
      if (this.isModalOpen()) {
        this.updateCartModal();
      } else {
        this.updateCartCounter();
      }
    }
    isModalOpen() {
      const modal = document.getElementById("cartModal");
      return modal && modal.style.display === "block";
    }
    updateWhatsAppLink(total) {
      const whatsappBtn = document.getElementById("whatsappCheckout");
      if (!whatsappBtn) return;
      if (this.cartItems.length === 0) {
        whatsappBtn.href = "#";
        whatsappBtn.classList.add("opacity-50", "cursor-not-allowed");
        return;
      }
      whatsappBtn.classList.remove("opacity-50", "cursor-not-allowed");
      let message;
      if (window.userId) {
        // Mensaje para usuarios autenticados.
        message = `¡Hola! 👋 He realizado un nuevo pedido. La factura en PDF se ha descargado en mi dispositivo.`;
      } else {
        // Mensaje para usuarios no autenticados.
        message = `¡Hola! 👋 Quiero realizar este pedido:\n\n`;
        this.cartItems.forEach((item) => {
          message += `• ${item.product.nombre} (x${
            item.quantity
          }) - ${this.formatCurrencyCOP(item.subtotal)}\n`;
        });
        message += `\n*Total: ${this.formatCurrencyCOP(total)}*\n\n¿Podrían confirmar disponibilidad?`;
      }
      const encodedMessage = encodeURIComponent(message);
      const phoneNumber = "3018307170"; // Reemplazar con tu número de WhatsApp.
      whatsappBtn.href = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    }
    showLoadingState(button) {
      if (!button) return;
      button.dataset.originalHTML = button.innerHTML;
      button.dataset.originalDisabled = button.disabled;
      button.innerHTML =
        `
      <span class="flex items-center">
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Procesando...
      </span>
    `;
      button.disabled = true;
    }
    hideLoadingState(button) {
      if (!button || !button.dataset.originalHTML) return;
      button.innerHTML = button.dataset.originalHTML;
      button.disabled = button.dataset.originalDisabled === "true";
      delete button.dataset.originalHTML;
      delete button.dataset.originalDisabled;
    }
    showSuccessAnimation(button) {
      if (!button) return;
      const successHTML =
        `
      <span class="flex items-center">
        <svg class="w-4 h-4 mr-1 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        ¡Agregado!
      </span>
    `;
      button.innerHTML = successHTML;
      button.classList.add("bg-green-600", "border-green-600");
      setTimeout(() => {
        this.hideLoadingState(button);
        button.classList.remove("bg-green-600", "border-green-600");
      }, 2000);
    }
    showToast(message, type = "success", duration = 3000) {
      // Usar el objeto global window.toast si existe, de lo contrario, registrar en consola.
      if (window.toast && typeof window.toast[type] === "function") {
        window.toast[type](message, duration);
      } else {
        console.log(`${type.toUpperCase()}: ${message}`);
      }
    }
    setAutoOpenOnNewItem(enabled) {
      this.autoOpenOnNewItem = enabled;
    }
    setPreventAutoClose(enabled) {
      this.preventAutoClose = enabled;
    }
    async printInvoice() {
        // Si no hay un pedido actual, crearlo.
        if (!this.currentOrderId) {
            try {
                const response = await fetch('/api/create_order', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                    },
                });
                const data = await response.json();
                if (data.success) {
                    this.currentOrderId = data.pedido_id;
                    this.showToast("Pedido creado exitosamente", "success");
                } else {
                    this.showToast(data.message || "Error al crear el pedido", "error");
                    return;
                }
            } catch (error) {
                console.error("Error al crear el pedido:", error);
                this.showToast("Error de conexión al crear el pedido", "error");
                return;
            }
        }

        // Abrir una nueva ventana para imprimir la factura.
        this.showToast("Preparando factura para imprimir...", "info");
        try {
            const printUrl = `/print_invoice/${this.currentOrderId}`;
            const printWindow = window.open(printUrl, '_blank');
            if (printWindow) {
                printWindow.focus();
                this.showToast("Factura lista para imprimir en una nueva ventana. Por favor, imprímela manualmente desde la nueva ventana.", "success");
            } else {
                this.showToast("No se pudo abrir la ventana de impresión. Por favor, permite pop-ups.", "error");
            }
        } catch (error) {
            console.error("Error al abrir la ventana de impresión:", error);
            this.showToast("Error al preparar la impresión de la factura.", "error");
        } finally {
            this.hideWhatsAppModal(); // Cerrar el modal después de intentar imprimir.
        }
    }
  }
  // Hacer la clase accesible globalmente.
  window.ShoppingCart = ShoppingCart;
}
// Inicialización mejorada.
document.addEventListener("DOMContentLoaded", () => {
  if (!window.cart) {
    window.cart = new ShoppingCart();
  }
  window.openCart = () => cart.openCartModal();
  window.closeCart = () => cart.closeCartModal();
});
window.addEventListener("error", (e) => {
  console.error("Error global capturado:", e.error);
  if (window.cart && window.cart.activeButtons) {
    window.cart.activeButtons.forEach((state, button) => {
      if (button && button.disabled) {
        window.cart.restoreButton(button);
      }
    });
  }
});
