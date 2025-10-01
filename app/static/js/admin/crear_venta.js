/**
 * @file Módulo Reutilizable para el Formulario de Creación de Ventas.
 * @description Este script encapsula la lógica del modal para crear ventas directas.
 *              Está diseñado para ser un componente independiente que puede ser invocado
 *              desde la página de gestión de ventas.
 *
 * @funcionalidadesClave
 * 1.  **Búsqueda Asíncrona:** Busca clientes y productos en tiempo real para añadirlos a la venta.
 * 2.  **Gestión de Carrito Interno:** Mantiene una lista de productos seleccionados.
 * 3.  **Cálculo de Totales:** Actualiza el total del pedido/venta dinámicamente.
 * 4.  **Modos de Operación:** Funciona en modo "creación" y "edición".
 * 5.  **Flexibilidad de Envío:** La URL de envío (`submitUrl`) es configurable, permitiendo
 *     que el mismo modal cree pedidos (`/admin/api/pedidos`) o ventas (`/admin/api/ventas`).
 */
window.crearVentaApp = {
  venta: {
    usuario_id: null,
    productos: [],
  },

  elements: {},
  isEditMode: false,
  editingVentaId: null,
  submitUrl: '/admin/api/ventas', // La URL siempre será para crear ventas.
  isInitialized: false, // Flag para el ciclo de vida del SPA

  init: function () {
    // Guardia de contexto para SPA: no inicializar si el modal no está en el DOM.
    if (!document.getElementById("crearVentaModal")) {
      // console.log("Venta modal not found. Skipping init."); // Silenciado para no llenar la consola.
      return;
    }
    if (this.isInitialized) return;

    this.cacheElements();
    this.setupEventListeners();
    this.isInitialized = true;
    console.log("crearVentaApp initialized.");
  },

  destroy: function() {
    if (!this.isInitialized) return;
    // Aquí se removerían listeners si no se usara delegación o si hubiera timers.
    this.isInitialized = false;
    console.log("crearVentaApp destroyed.");
  },

  cacheElements: function () {
    this.elements.modal = document.getElementById("crearVentaModal");
    this.elements.modalContent = this.elements.modal.querySelector(".bg-white");
    this.elements.customerSearchInput = document.getElementById(
      "ventaCustomerSearchInput"
    );
    this.elements.customerSearchResults = document.getElementById(
      "ventaCustomerSearchResults"
    );
    this.elements.selectedCustomer =
      document.getElementById("ventaSelectedCustomer");
    this.elements.selectedCustomerName = document.getElementById(
      "ventaSelectedCustomerName"
    );
    this.elements.selectedCustomerId =
      document.getElementById("ventaSelectedCustomerId");
    this.elements.removeSelectedCustomer = document.getElementById(
      "ventaRemoveSelectedCustomer"
    );
    this.elements.productSearchInput =
      document.getElementById("ventaProductSearchInput");
    this.elements.productSearchResults = document.getElementById(
      "ventaProductSearchResults"
    );
    this.elements.pedidoItemsTableBody = document.getElementById(
      "ventaItemsTableBody"
    );
    this.elements.noItemsRow = document.getElementById("ventaNoItemsRow");
    this.elements.pedidoTotal = document.getElementById("crearVentaTotal");
    this.elements.pedidoForm = document.getElementById("ventaForm");
    this.elements.savePedidoBtn = document.getElementById("saveVentaBtn");
    this.elements.cancelPedidoBtn = document.getElementById("cancelVentaBtn");
    this.elements.closePedidoModalBtn = document.getElementById(
      "closeVentaModalBtn"
    );
    this.elements.pedidoModalTitle =
      document.getElementById("ventaModalTitle");
  },

  setupEventListeners: function () {
    this.elements.customerSearchInput?.addEventListener(
      "input",
      this.debounce(this.searchCustomers.bind(this), 300)
    );
    this.elements.customerSearchResults?.addEventListener(
      "click",
      this.selectCustomer.bind(this)
    );
    this.elements.removeSelectedCustomer?.addEventListener(
      "click",
      this.removeSelectedCustomer.bind(this)
    );
    this.elements.productSearchInput?.addEventListener(
      "input",
      this.debounce(this.searchProducts.bind(this), 300)
    );
    this.elements.productSearchResults?.addEventListener(
      "click",
      this.selectProduct.bind(this)
    );
    this.elements.pedidoForm?.addEventListener(
      "submit",
      this.submitPedido.bind(this)
    );
    this.elements.cancelPedidoBtn?.addEventListener(
      "click",
      this.closeModal.bind(this)
    );
    this.elements.closePedidoModalBtn?.addEventListener(
      "click",
      this.closeModal.bind(this)
    );
    this.elements.modal?.addEventListener("click", (e) => {
      if (e.target === this.elements.modal) {
        this.closeModal();
      }
    });
    // Usar un listener con nombre para poder removerlo si es necesario en destroy()
    this.outsideClickHandler = this.handleOutsideClick.bind(this);
    document.addEventListener("click", this.outsideClickHandler);
  },

  handleOutsideClick: function (event) {
    if (
      !this.elements.customerSearchInput.contains(event.target) &&
      !this.elements.customerSearchResults.contains(event.target)
    ) {
      this.elements.customerSearchResults.classList.add("hidden");
    }

    if (
      !this.elements.productSearchInput.contains(event.target) &&
      !this.elements.productSearchResults.contains(event.target)
    ) {
      this.elements.productSearchResults.classList.add("hidden");
    }
  },

  openModal: function () {
    this.isEditMode = false;
    this.editingVentaId = null;

    this.venta = {
      usuario_id: null,
      productos: [],
    };
    this.elements.customerSearchInput.value = "";
    this.elements.productSearchInput.value = "";
    this.elements.selectedCustomer.classList.add("hidden");
    this.renderPedidoItems();
    this.updateTotal();

    this.elements.pedidoModalTitle.textContent = "Crear Nueva Venta";
    this.elements.savePedidoBtn.textContent = "Guardar Venta";

    this.elements.modal.classList.remove("hidden");
  },

  openModalForEdit: function (pedido) {
    this.isEditMode = true;
    this.editingVentaId = pedido.id;

    this.venta.usuario_id = pedido.usuario.id;
    this.elements.selectedCustomerId.value = pedido.usuario.id;
    this.elements.selectedCustomerName.textContent = pedido.usuario
      ? pedido.usuario.nombre + " " + pedido.usuario.apellido
      : "N/A";
    this.elements.selectedCustomer.classList.remove("hidden");

    this.venta.productos = [];
    if (pedido.productos && pedido.productos.length > 0) {
      pedido.productos.forEach((item) => {
        this.venta.productos.push({
          id: item.producto_id,
          nombre: item.producto_nombre,
          precio: item.precio_unitario,
          existencia: item.producto_existencia || 0,
          cantidad: item.cantidad,
        });
      });
    }

    this.renderPedidoItems();
    this.updateTotal();

    this.elements.pedidoModalTitle.textContent = "Editar Venta";
    this.elements.savePedidoBtn.textContent = "Actualizar Venta";

    this.elements.modal.classList.remove("hidden");
  },

  searchCustomers: function () {
    const query = this.elements.customerSearchInput.value.trim();
    if (query.length < 2) {
      this.elements.customerSearchResults.classList.add("hidden");
      return;
    }

    fetch(`/admin/api/usuarios-registrados?q=${encodeURIComponent(query)}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success && data.usuarios) {
          this.renderCustomerResults(data.usuarios);
        } else {
          this.showNoResultsMessage(
            this.elements.customerSearchResults,
            "No se encontraron clientes que coincidan con la búsqueda"
          );
        }
      })
      .catch((error) => {
        console.error("Error al buscar clientes:", error);
        this.showNoResultsMessage(
          this.elements.customerSearchResults,
          "Error al buscar clientes"
        );
      });
  },

  renderCustomerResults: function (usuarios) {
    if (!usuarios || usuarios.length === 0) {
      this.showNoResultsMessage(
        this.elements.customerSearchResults,
        "No se encontraron clientes que coincidan con la búsqueda"
      );
      return;
    }

    let html = "";
    usuarios.forEach((usuario) => {
      // MEJORA PROFESIONAL: Se utiliza una estructura de HTML más rica, idéntica a la del modal de pedidos,
      // para un diseño consistente y profesional en los resultados de búsqueda.
      html += `
                <div class="customer-result-item flex items-center p-3 hover:bg-gray-100 cursor-pointer" data-id="${usuario.id}" data-name="${usuario.nombre} ${usuario.apellido}">
                    <div class="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span class="text-blue-600 font-semibold">${usuario.nombre.charAt(0).toUpperCase()}</span>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${usuario.nombre} ${usuario.apellido}</div>
                        <div class="text-xs text-gray-500">${usuario.numero}</div>
                    </div>
                </div>
            `;
    });

    this.elements.customerSearchResults.innerHTML = html;
    this.elements.customerSearchResults.classList.remove("hidden");
  },

  showNoResultsMessage: function (container, message) {
    container.innerHTML = `<div class="p-4 text-center text-sm text-gray-500">${message}</div>`;
    container.classList.remove("hidden");
  },

  selectCustomer: function (event) {
    const item = event.target.closest(".customer-result-item");
    if (!item) return;

    const id = item.getAttribute("data-id");
    const name = item.getAttribute("data-name");

    this.venta.usuario_id = id;
    this.elements.selectedCustomerId.value = id;
    this.elements.selectedCustomerName.textContent = name;
    this.elements.selectedCustomer.classList.remove("hidden");
    this.elements.customerSearchResults.classList.add("hidden");
    this.elements.customerSearchInput.value = "";
  },

  removeSelectedCustomer: function () {
    this.venta.usuario_id = null;
    this.elements.selectedCustomerId.value = "";
    this.elements.selectedCustomer.classList.add("hidden");
  },

  searchProducts: function () {
    const query = this.elements.productSearchInput.value.trim();
    if (query.length < 2) {
      this.elements.productSearchResults.classList.add("hidden");
      return;
    }

    let url = `/admin/api/productos/search?q=${encodeURIComponent(query)}`;
    if (this.isEditMode && this.editingVentaId) {
      url += `&pedido_id=${this.editingVentaId}`;
    }

    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        if (data.success && data.productos) {
          this.renderProductResults(data.productos);
        } else {
          this.showNoResultsMessage(
            this.elements.productSearchResults,
            "No se encontraron productos que coincidan con la búsqueda"
          );
        }
      })
      .catch((error) => {
        console.error("Error al buscar productos:", error);
        this.showNoResultsMessage(
          this.elements.productSearchResults,
          "Error al buscar productos"
        );
      });
  },

  renderProductResults: function (productos) {
    if (!productos || productos.length === 0) {
      this.showNoResultsMessage(
        this.elements.productSearchResults,
        "No se encontraron productos que coincidan con la búsqueda"
      );
      return;
    }

    let html = "";
    productos.forEach((producto) => {
      // MEJORA PROFESIONAL: Se utiliza una estructura de HTML más rica, idéntica a la del modal de pedidos,
      // para un diseño consistente y profesional en los resultados de búsqueda.
      html += `
                <div class="product-result-item flex items-center p-3 hover:bg-gray-100 cursor-pointer" 
                     data-id="${producto.id}" 
                     data-nombre="${producto.nombre}" 
                     data-precio="${producto.precio}"
                     data-existencia="${producto.existencia || 0}"
                     data-imagen="${producto.imagen_url || ""}">
                    <div class="flex-shrink-0 h-10 w-10">
                        ${
                          producto.imagen_url
                            ? `<img class="h-10 w-10 rounded-full object-cover" src="${producto.imagen_url}" alt="${producto.nombre}">`
                            : '<div class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center"><span class="text-xs text-gray-500">IMG</span></div>'
                        }
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${producto.nombre}</div>
                        <div class="text-xs text-gray-500">$ ${producto.precio.toLocaleString()} - Stock: ${producto.existencia || 0}</div>
                    </div>
                </div>
            `;
    });

    this.elements.productSearchResults.innerHTML = html;
    this.elements.productSearchResults.classList.remove("hidden");
  },

  selectProduct: function (event) {
    const item = event.target.closest(".product-result-item");
    if (!item) return;

    const id = item.getAttribute("data-id");
    const nombre = item.getAttribute("data-nombre");
    const precio = parseFloat(item.getAttribute("data-precio"));
    const existencia = parseInt(item.getAttribute("data-existencia")) || 0;

    const existingItem = this.venta.productos.find((p) => p.id === id);
    if (existingItem) {
      existingItem.cantidad = Math.min(existingItem.cantidad + 1, existencia);
    } else {
      this.venta.productos.push({
        id: id,
        nombre: nombre,
        precio: precio,
        existencia: existencia,
        cantidad: 1,
      });
    }

    this.renderPedidoItems();
    this.updateTotal();
    this.elements.productSearchResults.classList.add("hidden");
    this.elements.productSearchInput.value = "";
  },

  renderPedidoItems: function () {
    if (this.venta.productos.length === 0) {
      this.elements.noItemsRow.classList.remove("hidden");
      const rows = this.elements.pedidoItemsTableBody.querySelectorAll(
        "tr:not(#noItemsRow)"
      );
      rows.forEach((row) => row.remove());
    } else {
      this.elements.noItemsRow.classList.add("hidden");

      const rows = this.elements.pedidoItemsTableBody.querySelectorAll(
        "tr:not(#noItemsRow)"
      );
      rows.forEach((row) => row.remove());

      this.venta.productos.forEach((producto, index) => {
        const subtotal = producto.precio * producto.cantidad;
        const row = document.createElement("tr");
        row.innerHTML = `
                    <td class="px-4 py-3">
                        <div class="font-medium">${producto.nombre}</div>
                        <div class="text-xs text-gray-500">Stock disponible: ${
                          producto.existencia
                        }</div>
                    </td>
                    <td class="px-4 py-3">
                        $ ${producto.precio.toLocaleString()}
                    </td>
                    <td class="px-4 py-3">
                        <input type="number" min="1" max="${
                          producto.existencia
                        }" value="${producto.cantidad}" 
                               class="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                               data-index="${index}" onchange="crearPedidoApp.updateCantidad(${index}, this.value)">
                    </td>
                    <td class="px-4 py-3">
                        $ ${subtotal.toLocaleString()}
                    </td>
                    <td class="px-4 py-3 text-right">
                        <button type="button" class="text-red-500 hover:text-red-700" onclick="window.crearVentaApp.removeProducto(${index})">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                `;
        this.elements.pedidoItemsTableBody.appendChild(row);
      });
    }

    this.updateTotal();
  },

  updateCantidad: function (index, newCantidad) {
    const cantidad = parseInt(newCantidad);
    const producto = this.venta.productos[index];
    
    if (isNaN(cantidad) || cantidad < 1) {
      this.renderPedidoItems();
      return;
    }

    if (cantidad > producto.existencia) {
      producto.cantidad = producto.existencia;
      window.toast.warning(
        `La cantidad máxima disponible para ${producto.nombre} es ${producto.existencia}`
      );
    } else {
      producto.cantidad = cantidad;
    } 

    this.renderPedidoItems();
    this.updateTotal();
  },

  removeProducto: function (index) {
    this.venta.productos.splice(index, 1);
    this.renderPedidoItems();
    this.updateTotal();
  },

  updateTotal: function () {
    const total = this.venta.productos.reduce((sum, producto) => {
      return sum + producto.precio * producto.cantidad;
    }, 0);

    if (this.elements.pedidoTotal) {
      this.elements.pedidoTotal.textContent = `$ ${total.toLocaleString()}`;
    }
  },

  submitPedido: function (event) {
    event.preventDefault();

    if (!this.venta.usuario_id) {
      window.toast.error("Por favor, selecciona un cliente");
      return;
    }

    if (this.venta.productos.length === 0) {
      window.toast.error("Por favor, agrega al menos un producto");
      return;
    }

    const data = {
      usuario_id: this.venta.usuario_id,
      productos: this.venta.productos.map((p) => ({
        id: p.id,
        cantidad: p.cantidad,
        precio: p.precio,
      })),
    };

    let url = this.submitUrl; // Usar la URL configurable
    let method = "POST";
    let successMessage = "Venta creada exitosamente";

    if (this.isEditMode) {
      url = `/admin/api/ventas/${this.editingVentaId}`; // URL para editar ventas (si se implementa)
      method = "PUT";
      successMessage = "Venta actualizada exitosamente";
    }

    fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken":
          document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content") || "",
      },
      body: JSON.stringify(data),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          window.toast.success(successMessage);
          this.closeModal();
          // MEJORA PROFESIONAL: Recargar el módulo de ventas.
          if (window.VentasPageModule) {
            window.VentasPageModule.loadEstadisticas(); // Actualiza solo las estadísticas y el gráfico.
            window.VentasPageModule.loadVentas(1, window.VentasPageModule.currentPerPage, true); // Actualiza la tabla de ventas.
          } else {
            window.location.reload();
          }
        } else {
          window.toast.error(data.message || "Error al procesar el pedido");
        }
      })
      .catch((error) => {
        console.error("Error al procesar el pedido:", error);
        window.toast.error("Error al procesar el pedido");
      });
  },

  closeModal: function () {
    this.elements.modal.classList.add("hidden");
    this.isEditMode = false;
    this.editingVentaId = null;
    this.venta = {
      usuario_id: null,
      productos: [],
    };
    this.elements.customerSearchInput.value = "";
    this.elements.productSearchInput.value = "";
    this.elements.selectedCustomer.classList.add("hidden");
    this.renderPedidoItems();
    this.updateTotal();
  },

  debounce: function (func, wait) {
    let timeout;
    return function (...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  },
};

// --- MEJORA PROFESIONAL: GESTIÓN DEL CICLO DE VIDA SPA ---
const runCrearVentaInitialization = () => {
  // La función `init` ya tiene una guardia de contexto, por lo que es seguro llamarla.
  if (window.crearVentaApp) {
    window.crearVentaApp.init();
  }
};

const destroyCrearVentaModule = () => {
    if (window.crearVentaApp && window.crearVentaApp.isInitialized) {
        window.crearVentaApp.destroy();
    }
};

document.addEventListener("content-loaded", runCrearVentaInitialization);
document.addEventListener("content-will-load", destroyCrearVentaModule);

// Para la carga inicial de la página (no SPA).
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runCrearVentaInitialization);
} else {
  runCrearVentaInitialization();
}