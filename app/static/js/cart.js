// static/js/cart.js - Versión Ultra Profesional con Contador de Productos Únicos
if (typeof ShoppingCart === "undefined") {
  class ShoppingCart {
    constructor() {
      this.cartCounter = document.getElementById("cartCounter");
      this.cartItems = [];
      this.isUpdating = false;
      this.isDeleting = false;
      this.currentItemToDelete = null;
      this.storageKey = "ye_cy_cart";
      this.syncEndpoint = "/api/sync_cart"; // Endpoint para enviar cambios locales
      this.loadEndpoint = "/api/load_cart"; // Nuevo endpoint para cargar el carrito desde la BD
      this.autoOpenOnNewItem = true;
      this.preventAutoClose = false;
      this.originalOverflow = "";
      this.activeButtons = new Map();

      // 🔢 NUEVO: Cache para optimizar cálculos
      this.cache = {
        uniqueCount: 0,
        totalQuantity: 0,
        totalPrice: 0,
      };

      this.init();
    }

    init() {
      this.loadCartFromStorage();
      this.bindEvents();
      this.setupCartModal();
      this.setupDeleteModal();
      // Al iniciar, si el usuario está logueado, hidratar el carrito desde el servidor
      if (window.userId) {
        this.hydrateCartFromServer();
      }
    }

    loadCartFromStorage() {
      try {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
          this.cartItems = JSON.parse(saved);
          this.updateCache(); // 🔢 Actualizar cache
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
        this.updateCache(); // 🔢 Actualizar cache después de guardar
      } catch (error) {
        console.error("Error saving to storage:", error);
        this.showToast("Error al guardar el carrito", "error");
      }
    }

    clearStorage() {
      localStorage.removeItem(this.storageKey);
      this.updateCache(); // 🔢 Limpiar cache
    }

    // 🔢 NUEVO: Método para actualizar cache
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

    // 🔢 NUEVO: Función para formatear moneda COP
    formatCurrencyCOP(value) {
      if (value === null || value === undefined) {
        return "$ 0";
      }
      // Ensure value is a number
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
        const previousCartItems = JSON.parse(JSON.stringify(this.cartItems)); // Deep copy

        try {
          const response = await fetch(this.syncEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cart_items: this.cartItems }),
          });

          const data = await response.json();
          if (data.success) {
            // Removed: this.updateCartItemsFromBackend(data.items);
            this.saveToStorage();

            // Only update UI if the cart state actually changed after backend sync
            // This comparison is now less relevant as we're not updating from backend response
            // but keeping it for consistency if other parts of the code modify cartItems
            if (
              JSON.stringify(previousCartItems) !==
              JSON.stringify(this.cartItems)
            ) {
              this.updateCartCounter();
              this.refreshCartModal();
            }
            // Handle warnings from the backend
            if (data.warnings && data.warnings.length > 0) {
              data.warnings.forEach((warningMsg) => {
                this.showToast(warningMsg, "warning");
              });
            }
          } else {
            // If sync fails, revert to previous local state
            this.cartItems = previousCartItems;
            this.saveToStorage();
            this.updateCartCounter();
            this.refreshCartModal();
            // Use the specific message from the backend if available, otherwise a generic one
            this.showToast(
              data.message ||
                "Error al sincronizar el carrito con el servidor.",
              "error"
            );
          }
        } catch (error) {
          console.error("Error syncing local changes with backend:", error);
          // If connection error, revert to previous local state
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
            console.log("Local cart merged with server cart.");
            // Handle warnings from the backend
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
        // If there's no local cart, just load the server cart
        this.hydrateCartFromServer();
      }
    }

    updateCartItemsFromBackend(backendItems) {
      const newCartItems = [];
      const backendMapById = new Map(); // Map backend items by their actual database ID
      const backendMapByProductId = new Map(); // Map backend items by product_id for temp ID matching

      backendItems.forEach((item) => {
        backendMapById.set(item.id, item);
        backendMapByProductId.set(item.product_id, item);
      });

      // Iterate through current local cart items
      this.cartItems.forEach((localItem) => {
        let matchedBackendItem = null;

        if (localItem.id.startsWith("temp_")) {
          // For temporary items, try to find a match in backend by product_id
          matchedBackendItem = backendMapByProductId.get(localItem.product_id);
        } else {
          // For items with real IDs, try to find a match in backend by real ID
          matchedBackendItem = backendMapById.get(localItem.id);
        }

        if (matchedBackendItem) {
          // Update local item with backend data (especially the ID)
          newCartItems.push({
            ...localItem,
            id: matchedBackendItem.id, // Use the backend-generated ID
            // Only update quantity if backend quantity is different AND
            // either the local item was temporary (just added)
            // or the backend quantity is explicitly different (e.g., stock adjustment)
            quantity:
              localItem.id.startsWith("temp_") ||
              localItem.quantity !== matchedBackendItem.quantity
                ? matchedBackendItem.quantity
                : localItem.quantity,
            subtotal: matchedBackendItem.subtotal, // Subtotal should always come from backend or be recalculated based on backend quantity
            product: matchedBackendItem.product || localItem.product, // Use backend product data if available
          });
          // Remove from maps to avoid processing again
          backendMapById.delete(matchedBackendItem.id);
          backendMapByProductId.delete(matchedBackendItem.product_id); // Also remove from product_id map
        }
        // If no match, it means this local item was deleted from backend, so don't add it to newCartItems
        // Or it's a temporary item that wasn't successfully added to backend (error case)
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
            console.log("Carrito hidratado desde el servidor.");
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
            } else {
              this.showToast("Cantidad actualizada en el carrito", "success");
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

    // 🔢 MEJORADO: Contador de productos únicos
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

      // 🔢 Actualizar también el contador en el modal
      this.updateModalCounters();
    }

    // 🔢 NUEVO: Método para actualizar todos los contadores del modal
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

    updateCartModal() {
      const container = document.getElementById("cartItemsContainer");
      const emptyState = document.getElementById("emptyCartState");
      const itemCount = document.getElementById("cartItemCount");
      const subtotalElement = document.getElementById("cartSubtotal");
      const totalElement = document.getElementById("cartTotal");

      if (this.cartItems.length === 0) {
        container.innerHTML = "";
        emptyState.classList.remove("hidden");
        emptyState.classList.add("flex");
        itemCount.textContent = "0 productos";
        subtotalElement.textContent = "$0.00";
        totalElement.textContent = "$0.00";
        return;
      }

      emptyState.classList.add("hidden");
      emptyState.classList.remove("flex");

      // 🔢 Usar valores cacheados para mejor rendimiento
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

    clearCartOnLogout() {
      this.cartItems = [];
      this.saveToStorage();
      this.updateCartCounter();
      console.log("Carrito local limpiado por cierre de sesión.");
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
        this.showToast("Cantidad actualizada", "success");

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

      let message = `¡Hola! 👋 Quiero realizar este pedido:\n\n`;
      this.cartItems.forEach((item) => {
        message += `• ${item.product.nombre} (x${
          item.quantity
        }) - ${this.formatCurrencyCOP(item.subtotal)}\n`;
      });
      message += `
*Total: ${this.formatCurrencyCOP(total)}*\n\n¿Podrían confirmar disponibilidad?`;

      const encodedMessage = encodeURIComponent(message);
      const phoneNumber = "3044931438";
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
      // Use the global window.toast if it exists, otherwise log to console.
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
  }

  // Hacer la clase accesible globalmente
  window.ShoppingCart = ShoppingCart;
}

// Inicialización mejorada
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