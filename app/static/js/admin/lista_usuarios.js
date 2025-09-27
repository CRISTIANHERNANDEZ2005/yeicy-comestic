// Este script se ejecutará cada vez que se cargue la vista
// y es compatible con el sistema SPA

//  Usar un patrón de módulo que se autogestione en el ciclo de vida del SPA.
// Esto evita duplicación de listeners y fugas de memoria.
if (!window.usuariosApp) {
  // La clase solo se define una vez.
  class UsuariosApp {
    constructor() {
      // Global variables
      this.currentTab = "clientes";
      this.currentPageClientes = 1;
      this.currentPageAdmins = 1;
      this.itemsPerPageClientes = 10;
      this.itemsPerPageAdmins = 10;
      // Aislar los filtros por pestaña para evitar conflictos.
      this.filters = {
        clientes: {
          search: "",
          status: "",
          sort: "recientes",
        },
        admins: {
          search: "",
          status: "",
          sort: "recientes",
        },
      };

      // Control de estado para SPA
      this.isInitialized = false;
      this.eventListeners = []; // Para limpiar listeners
      this.activeTimers = []; // Para limpiar timers (setInterval/setTimeout)
      this.isInitialOpen = false; // SOLUCIÓN: Bandera para controlar la validación inicial.
      this.csrfToken = null; //  Cachear el token CSRF
      this.authenticatedAdminId = null; // ID del admin autenticado
      // DOM Elements
      this.viewContainer = null;
      this.clientesSection = null;
      this.administradoresSection = null;
      this.clientesTab = null;
      this.administradoresTab = null;
      this.addUserBtn = null;

      // Elementos Modal Cliente
      this.clienteModal = null;
      this.clienteForm = null;
      this.clienteModalTitle = null;
      this.clienteIdInput = null;
      this.clienteNameInput = null;
      this.clienteLastnameInput = null;
      this.clientePhoneInput = null;
      this.clientePasswordInput = null;
      this.clienteSaveButton = null;

      // Elementos Modal Admin
      this.adminModal = null;
      this.adminForm = null;
      this.adminModalTitle = null;
      this.adminIdInput = null;
      this.adminNameInput = null;
      this.adminLastnameInput = null;
      this.adminIdentificationInput = null;
      this.adminPhoneInput = null;
      this.adminPasswordInput = null;
      this.adminSaveButton = null;

      //  Constantes para validación
      this.validationPatterns = {
        phone: /^[0-9]{10}$/,
        cedula: /^[0-9]{7,10}$/,
      };

      // Bind methods to maintain 'this' context
      this.init = this.init.bind(this);
      this.setupDOMElements = this.setupDOMElements.bind(this);
      this.setupEventListeners = this.setupEventListeners.bind(this);
      this.loadInitialData = this.loadInitialData.bind(this);
      this.switchTab = this.switchTab.bind(this);
      this.applyFilters = this.applyFilters.bind(this);
      this.changePage = this.changePage.bind(this);
      this.loadClientes = this.loadClientes.bind(this);
      this.loadAdministradores = this.loadAdministradores.bind(this);
      this.loadStats = this.loadStats.bind(this);
      this.saveCliente = this.saveCliente.bind(this);
      this.toggleAdminStatus = this.toggleAdminStatus.bind(this);
      this.saveAdministrador = this.saveAdministrador.bind(this);
      this.toggleClienteStatus = this.toggleClienteStatus.bind(this);
      this.showTableLoading = this.showTableLoading.bind(this);
      this.showTableError = this.showTableError.bind(this);
      this.renderClientesTable = this.renderClientesTable.bind(this);
      this.renderAdministradoresTable =
        this.renderAdministradoresTable.bind(this);
      this.renderPagination = this.renderPagination.bind(this);
      this.openClienteModal = this.openClienteModal.bind(this);
      this.openAdminModal = this.openAdminModal.bind(this);
      this.closeModal = this.closeModal.bind(this);
      this.handleFormSubmit = this.handleFormSubmit.bind(this); // showNotification se elimina
      this.getCsrfToken = this.getCsrfToken.bind(this);
      this.debounce = this.debounce.bind(this);
      this.editCliente = this.editCliente.bind(this);
      this.editAdministrador = this.editAdministrador.bind(this);
      this.togglePasswordVisibility = this.togglePasswordVisibility.bind(this);
      this.cleanup = this.cleanup.bind(this);
      this.updatePasswordHelperText = this.updatePasswordHelperText.bind(this);
      this.validateField = this.validateField.bind(this);
      this.setFieldError = this.setFieldError.bind(this);
      this.clearFieldError = this.clearFieldError.bind(this);
      this.handleActionClick = this.handleActionClick.bind(this);
    }

    init() {
      console.log("UsuariosApp.init() called");
      if (this.isInitialized) {
        console.log("UsuariosApp already initialized. Skipping.");
        return;
      }
      try {
        this.setupDOMElements();
        this.setupEventListeners();
        this.csrfToken = this.getCsrfToken(); // Obtener el token una sola vez.
        this.loadInitialData();
        this.isInitialized = true;
      } catch (error) {
        // Manejo de errores más robusto.
        // Si la inicialización falla, lo mostramos en la consola para no causar
        // errores secundarios si 'toast' aún no está listo.
        console.error("Error fatal al inicializar UsuariosApp:", error);
        // Opcional: Mostrar un mensaje de error visible para el usuario en la propia vista.
        this.viewContainer.innerHTML = `<div class="p-8 text-center text-red-500"><h2>Error Crítico</h2><p>No se pudo cargar el módulo de gestión de usuarios. Por favor, recarga la página.</p></div>`;
      }
    }

    setupDOMElements() {
      console.log("Setting up DOM elements");
      this.viewContainer = document.getElementById("usuarios-view");
      if (!this.viewContainer)
        throw new Error("Main view container #usuarios-view not found.");
      this.authenticatedAdminId = this.viewContainer.dataset.authenticatedAdminId;

      this.clientesSection =
        this.viewContainer.querySelector("#clientes-section");
      this.administradoresSection = this.viewContainer.querySelector(
        "#administradores-section"
      );
      this.clientesTab = this.viewContainer.querySelector("#clientes-tab");
      this.administradoresTab = this.viewContainer.querySelector(
        "#administradores-tab"
      );
      // SOLUCIÓN: El botón de agregar es global, no está dentro de la vista.
      this.addUserBtn = document.getElementById("add-user-btn");

      // Cachear elementos del modal de CLIENTE
      this.clienteModal = document.getElementById("cliente-modal");
      this.clienteForm = document.getElementById("cliente-form");
      this.clienteModalTitle = document.getElementById("cliente-modal-title");
      this.clienteIdInput = document.getElementById("cliente-id");
      this.clienteNameInput = document.getElementById("cliente-name");
      this.clienteLastnameInput = document.getElementById("cliente-lastname");
      this.clientePhoneInput = document.getElementById("cliente-phone");
      this.clientePasswordInput = document.getElementById("cliente-password");
      this.clienteSaveButton = document.getElementById("save-cliente-btn");

      // Cachear elementos del modal de ADMIN
      this.adminModal = document.getElementById("admin-modal");
      this.adminForm = document.getElementById("admin-form");
      this.adminModalTitle = document.getElementById("admin-modal-title");
      this.adminIdInput = document.getElementById("admin-id");
      this.adminNameInput = document.getElementById("admin-name");
      this.adminLastnameInput = document.getElementById("admin-lastname");
      this.adminIdentificationInput = document.getElementById("admin-identification");
      this.adminPhoneInput = document.getElementById("admin-phone");
      this.adminPasswordInput = document.getElementById("admin-password");
      this.adminSaveButton = document.getElementById("save-admin-btn");

      if (!this.clientesSection)
        console.error("clientes-section element not found");
      if (!this.administradoresSection)
        console.error("administradores-section element not found");
      if (!this.clientesTab) console.error("clientes-tab element not found");
      if (!this.administradoresTab)
        console.error("administradores-tab element not found");
    }

    // Helper para registrar y limpiar listeners
    _addEventListener(element, type, listener) {
      if (!element) {
        console.warn(
          `Attempted to add listener to a null element for event type: ${type}`
        );
        return;
      }
      element.addEventListener(type, listener);
      this.eventListeners.push({ element, type, listener });
    }

    setupEventListeners() {
      console.log("Setting up event listeners");

      // Tab switching
      this._addEventListener(this.clientesTab, "click", () =>
        this.switchTab("clientes")
      );
      this._addEventListener(this.administradoresTab, "click", () =>

        this.switchTab("administradores")
      );

      // Modal controls
      this._addEventListener(this.addUserBtn, "click", () => {
        if (this.currentTab === 'clientes') {
          this.openClienteModal();
        } else {
          this.openAdminModal();
        }
      });

      // Listeners para cerrar CADA modal
      this._addEventListener(
        document.getElementById("close-cliente-modal"),
        "click",
        this.closeModal
      );
      this._addEventListener(
        document.getElementById("cancel-cliente-btn"),
        "click",
        this.closeModal
      );
      this._addEventListener(document.getElementById("close-admin-modal"), "click", this.closeModal);
      this._addEventListener(document.getElementById("cancel-admin-btn"), "click", this.closeModal);

      //  Separamos los listeners de submit para cada formulario
      this._addEventListener(this.clienteForm, "submit", (e) => this.handleFormSubmit(e, 'cliente'));
      this._addEventListener(this.adminForm, "submit", (e) => this.handleFormSubmit(e, 'admin'));


      const searchInput = this.viewContainer.querySelector("#search-input");
      this._addEventListener(
        searchInput,
        "input",
        this.debounce(e => {
            const activeFilters = this.currentTab === 'clientes' ? this.filters.clientes : this.filters.admins;
            activeFilters.search = e.target.value;
            this.currentPageClientes = 1;
            this.currentPageAdmins = 1;
            this.applyFilters();
        }, 300)
      );

      // Declarar las variables de filtro al principio de la función.
      const statusFilter = this.viewContainer.querySelector("#status-filter");
      const sortFilter = this.viewContainer.querySelector("#sort-filter");

      this._addEventListener(statusFilter, "change", e => {
        const activeFilters = this.currentTab === 'clientes' ? this.filters.clientes : this.filters.admins;
        activeFilters.status = e.target.value;
        this.currentPageClientes = 1;
        this.currentPageAdmins = 1;
        this.applyFilters();
      });

      //  Listener para el selector de items por página.
      const itemsPerPageSelect = this.viewContainer.querySelector("#items-per-page-select");
      this._addEventListener(itemsPerPageSelect, "change", e => {
          this.itemsPerPageClientes = parseInt(e.target.value, 10);
          this.currentPageClientes = 1;
          this.applyFilters();
      });

      //  Listener para el nuevo selector de items por página de administradores.
      const itemsPerPageSelectAdmins = this.viewContainer.querySelector("#items-per-page-select-admins");
      this._addEventListener(itemsPerPageSelectAdmins, "change", e => {
          this.itemsPerPageAdmins = parseInt(e.target.value, 10);
          this.currentPageAdmins = 1;
          this.applyFilters();
      });

      // Listener para el selector de ordenamiento.
      this._addEventListener(sortFilter, "change", e => {
        const activeFilters = this.currentTab === 'clientes' ? this.filters.clientes : this.filters.admins;
        activeFilters.sort = e.target.value;
        this.currentPageClientes = 1;
        this.currentPageAdmins = 1;
        this.applyFilters();
      });

      // Pagination
      this._addEventListener(
        this.viewContainer,
        "click",
        this.handleActionClick
      );

      // Password visibility toggle
      this._addEventListener(
        document.getElementById("toggle-cliente-password"),
        "click",
        () => this.togglePasswordVisibility('cliente')
      );
      this._addEventListener(
        document.getElementById("toggle-admin-password"),
        "click",
        () => this.togglePasswordVisibility('admin')
      );

      // Listeners de validación en tiempo real para el formulario
      this.clienteForm.querySelectorAll("input").forEach((input) => {
        this._addEventListener(input, "blur", () => this.validateField(input));
        this._addEventListener(
          input,
          "input",
          this.debounce(() => this.validateField(input), 500)
        );
        if (input.name === "nombre" || input.name === "numero") {
          this._addEventListener(
            input,
            "input",
            this.debounce(() => this.updatePasswordHelperText('cliente'), 300)
          );
        }
        if (input.name === "contraseña") {
          this._addEventListener(input, "input", this.debounce(() => this.updatePasswordHelperText('cliente'), 300));
        }
      });
      this.adminForm.querySelectorAll("input").forEach((input) => {
        this._addEventListener(input, "blur", () => this.validateField(input));
        this._addEventListener(input, "input", this.debounce(() => this.validateField(input), 500));
        if (input.name === "nombre" || input.name === "numero") {
          this._addEventListener(
            input,
            "input",
            this.debounce(() => this.updatePasswordHelperText('admin'), 300)
          );
        }
        // Ocultar/mostrar el helper de la contraseña al escribir en el campo.
        if (input.name === "contraseña") {
          this._addEventListener(
            input,
            "input",
            this.debounce(() => this.updatePasswordHelperText('admin'), 300)
          );
        }
      });
    }

    // Limpiar todos los event listeners para evitar fugas de memoria en el SPA.
    cleanup() {
      console.log("Cleaning up UsuariosApp listeners.");
      this.eventListeners.forEach(({ element, type, listener }) => {
        // Asegurarse de que el elemento todavía existe antes de remover el listener.
        if (element) {
          element.removeEventListener(type, listener);
        }
      });
      this.eventListeners = [];
      //  Limpiar también todos los temporizadores activos.
      this.activeTimers.forEach((timerId) => clearInterval(timerId));
      this.activeTimers = []; // Limpiar el array

      this.isInitialized = false;
      console.log("Cleanup complete.");
    }

    loadInitialData() {
      console.log("Loading initial data");
      // Load initial data for both tabs
      this.loadClientes();
      this.loadAdministradores();
      this.loadStats();
    }

    switchTab(tab) {
      console.log(`Switching to tab: ${tab}`);
      this.currentTab = tab;

      //  Reiniciar la paginación de la pestaña activa.
      //  Limpiar los campos de filtro en la UI y reiniciar el estado de los filtros al cambiar de pestaña.
      const searchInput = this.viewContainer.querySelector("#search-input");
      const statusFilter = this.viewContainer.querySelector("#status-filter");
      const sortFilter = this.viewContainer.querySelector("#sort-filter");
      
      if (searchInput) searchInput.value = "";
      if (statusFilter) statusFilter.value = "";
      if (sortFilter) sortFilter.value = "recientes";
      
      // Reiniciar el estado de los filtros para ambas pestañas.
      this.filters.clientes = { search: "", status: "", sort: "recientes" };
      this.filters.admins = { search: "", status: "", sort: "recientes" };


      if (tab === 'clientes') {
          this.currentPageClientes = 1;
      } else {
          this.currentPageAdmins = 1;
      }

      if (tab === "clientes") {
        if (this.clientesSection && this.administradoresSection) {
          this.clientesSection.classList.remove("hidden");
          this.administradoresSection.classList.add("hidden");
        }

        if (this.clientesTab && this.administradoresTab) {
          this.clientesTab.classList.add(
            "bg-blue-600",
            "text-white",
            "shadow-md"
          );
          this.clientesTab.classList.remove("text-gray-600", "bg-white");
          this.administradoresTab.classList.add("text-gray-600", "bg-white");
          this.administradoresTab.classList.remove(
            "bg-blue-600",
            "text-white",
            "shadow-md"
          );
        }
      } else {
        if (this.administradoresSection && this.clientesSection) {
          this.administradoresSection.classList.remove("hidden");
          this.clientesSection.classList.add("hidden");
        }

        if (this.administradoresTab && this.clientesTab) {
          this.administradoresTab.classList.add(
            "bg-blue-600",
            "text-white",
            "shadow-md"
          );
          this.administradoresTab.classList.remove("text-gray-600", "bg-white");
          this.clientesTab.classList.add("text-gray-600", "bg-white");
          this.clientesTab.classList.remove(
            "bg-blue-600",
            "text-white",
            "shadow-md"
          );
        }
      }
      // El filtro de estado ahora es visible para ambas pestañas.
      if (statusFilter) statusFilter.classList.remove("hidden");

      // Cargar los datos de la nueva pestaña inmediatamente.
      // Se mueve aquí para que se ejecute para AMBAS pestañas.
      this.applyFilters();
    }

    applyFilters() {
      console.log("Applying filters");
      if (this.currentTab === "clientes") {
        this.loadClientes();
      } else {
        this.loadAdministradores();
      }
    }

    handleActionClick(e) {
      // Hacer el manejador de eventos más específico y eficiente.
      const actionButton = e.target.closest("button[data-action]");
      if (!actionButton) return;

      e.preventDefault(); // Prevenir comportamiento por defecto

      const action = actionButton.dataset.action;
      const id = actionButton.dataset.id;
      const page = actionButton.dataset.page;
      const type = actionButton.dataset.type;

      switch (action) {
        case "toggle-status":
          if (id) this.toggleClienteStatus(id);
          break;
        case "toggle-admin-status":
          if (id) this.toggleAdminStatus(id);
          break;
        case "edit-cliente":
          this.editCliente(id);
          break;
        case "edit-admin":
          this.editAdministrador(id);
          break;
        case "change-page":
          if (type && page) this.changePage(type, parseInt(page));
      }
    }

    changePage(tab, page) {
      console.log(`Changing page to: ${tab}, ${page}`);
      if (tab === "clientes") {
        if (page < 1 || page > (this.lastPaginationClientes?.pages || 1)) return;
        this.currentPageClientes = page;
        this.loadClientes();
      } else {
        if (page < 1 || page > (this.lastPaginationAdmins?.pages || 1)) return;
        this.currentPageAdmins = page;
        this.loadAdministradores();
      }
    }

    // API Functions
    loadClientes() {
      console.log("Loading clientes");
      this.showTableLoading("clientes");

      const activeFilters = this.filters.clientes;
      const queryParams = new URLSearchParams({
        page: this.currentPageClientes,
        per_page: this.itemsPerPageClientes,
        search: activeFilters.search,
        status: activeFilters.status,
        sort: activeFilters.sort,
      });

      fetch(`/api/usuarios?${queryParams}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          console.log("Clientes data received:", data);
          if (data.success) {
            this.renderClientesTable(data.usuarios);
            this.lastPaginationClientes = data.pagination;
            this.renderPagination("clientes", data.pagination);
          } else {
            this.showTableError(
              "clientes",
              data.message || "No se pudieron cargar los clientes"
            );
          }
        })
        .catch((error) => {
          console.error("Error loading clientes:", error);
          this.showTableError("clientes", "Error al cargar los clientes");
        });
    }

    loadAdministradores() {
      console.log("Loading administradores");
      this.showTableLoading("administradores");

      const activeFilters = this.filters.admins;
      const queryParams = new URLSearchParams({
        page: this.currentPageAdmins,
        per_page: this.itemsPerPageAdmins,
        search: activeFilters.search,
        status: activeFilters.status,
        sort: activeFilters.sort,
      });

      fetch(`/api/admins?${queryParams}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          console.log("Administradores data received:", data);
          if (data.success) {
            this.renderAdministradoresTable(data.admins);
            this.lastPaginationAdmins = data.pagination;
            this.renderPagination("administradores", data.pagination);
          } else {
            this.showTableError(
              "administradores",
              data.message || "No se pudieron cargar los administradores"
            );
          }
        })
        .catch((error) => {
          console.error("Error loading administradores:", error);
          this.showTableError(
            "administradores",
            "Error al cargar los administradores"
          );
        });
    }

    loadStats() {
      console.log("Loading stats");
      fetch("/api/stats/usuarios")
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          console.log("Stats data received:", data);
          if (data.success) {
            // Actualización estática para una respuesta instantánea.
            const totalClientesEl = this.viewContainer.querySelector("#total-clientes-count");
            if (totalClientesEl) totalClientesEl.textContent = data.total_clientes || 0;

            const activeClientesEl = this.viewContainer.querySelector("#active-clientes-count");
            if (activeClientesEl) activeClientesEl.textContent = data.clientes_activos || 0;

            const totalAdminsEl = this.viewContainer.querySelector("#total-admins-count");
            if (totalAdminsEl) totalAdminsEl.textContent = data.total_admins || 0;

            const activeAdminsEl = this.viewContainer.querySelector("#active-admins-count");
            if (activeAdminsEl) activeAdminsEl.textContent = data.admins_activos || 0;
          }
        })
        .catch((error) => {
          console.error("Error loading stats:", error);
        });
    }

    saveCliente(clienteData) {
      console.log("Saving cliente:", clienteData);
      const isEdit = !!clienteData.id;
      const url = isEdit ? `/api/usuarios/${clienteData.id}` : "/api/usuarios";
      const method = isEdit ? "PUT" : "POST";

      fetch(url, {
        // La intercepción de admin_auth_interceptor.js añade el token
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(clienteData),
      })
        .then((response) =>
          response
            .json()
            .then((data) => ({ status: response.status, body: data }))
        )
        .then((data) => {
          console.log("Save cliente response:", data);
          if (data.status >= 200 && data.status < 300) {
            const message = isEdit ? "Cliente actualizado correctamente." : "Cliente creado correctamente.";
            window.toast.success(message);

            this.loadClientes();
            this.loadStats();
            this.closeModal();
          } else {
            //  Manejo de errores específicos del backend.
            const errorMessage =
              data.body.message || "No se pudo guardar el cliente";
            if (data.status === 409) {
              // 409 Conflict (duplicado)
              if (errorMessage.includes("número de teléfono")) {
                this.setFieldError(this.clientePhoneInput, errorMessage);
              } 
              window.toast.error(errorMessage, 4000);
            } else if (data.status === 400) {
              // 400 Bad Request (datos inválidos)
              window.toast.warning(errorMessage, 4000);
            } else {
              window.toast.error(errorMessage, 4000);
            }
            if (this.clienteSaveButton) this.clienteSaveButton.disabled = false; //  Reactivar botón en error
          }
        })
        .catch((error) => {
          console.error("Error saving cliente:", error);
          window.toast.error("No se pudo guardar el cliente. Error de red.");
          if (this.clienteSaveButton) this.clienteSaveButton.disabled = false; //  Reactivar botón en error
        });
    }

    // ... (el resto de la función saveAdministrador se modifica de forma similar)

    saveAdministrador(adminData) {
      console.log("Saving administrador:", adminData);
      const isEdit = !!adminData.id;
      const url = isEdit ? `/api/admins/${adminData.id}` : "/api/admins";
      const method = isEdit ? "PUT" : "POST";

      fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(adminData),
      })
        .then((response) =>
          response
            .json()
            .then((data) => ({ status: response.status, body: data }))
        )
        .then((data) => {
          console.log("Save administrador response:", data);
          if (data.status >= 200 && data.status < 300) {
            const message = isEdit ? "Administrador actualizado correctamente." : "Administrador creado correctamente.";
            window.toast.success(message);
            this.loadAdministradores();
            this.loadStats();
            this.closeModal();
          } else {
            // Manejo de errores específicos del backend.
            const errorMessage =
              data.body.message || "No se pudo guardar el administrador";
            if (data.status === 409) {
              // 409 Conflict (duplicado)
              if (errorMessage.includes("cédula")) {
                this.setFieldError(this.adminIdentificationInput, errorMessage);
              } else if (errorMessage.includes("teléfono")) {
                this.setFieldError(this.adminPhoneInput, errorMessage);
              }
              window.toast.error(errorMessage, 4000);
            } else {
              window.toast.error(errorMessage, 4000);
            }
            if (this.adminSaveButton) this.adminSaveButton.disabled = false; //  Reactivar botón en error
          }
        })
        .catch((error) => {
          console.error("Error saving administrador:", error);
          window.toast.error("No se pudo guardar el administrador. Error de red.");
          if (this.adminSaveButton) this.adminSaveButton.disabled = false; //  Reactivar botón en error
        });
    }

    toggleClienteStatus(clienteId) {
      console.log("Toggling cliente status for:", clienteId);
      fetch(`/api/usuarios/${clienteId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          // 'X-CSRFToken' no es necesario para PUT
        },
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          console.log("Toggle status response:", data);
          if (data.success) {
            window.toast.success("Estado del cliente actualizado correctamente.");
            this.loadClientes();
            this.loadStats();
          } else {
            window.toast.error(data.message || "No se pudo actualizar el estado del cliente.");
          }
        })
        .catch((error) => {
          console.error("Error toggling cliente status:", error);
          window.toast.error("No se pudo actualizar el estado del cliente. Error de red.");
        });
    }

    toggleAdminStatus(adminId) {
      console.log("Toggling admin status for:", adminId);
      fetch(`/api/admins/${adminId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          console.log("Toggle admin status response:", data);
          if (data.success) {
            window.toast.success("Estado del administrador actualizado correctamente.");
            this.loadAdministradores(); // Recargar la tabla de administradores
            this.loadStats(); // Actualizar estadísticas
          } else {
            window.toast.error(data.message || "No se pudo actualizar el estado del administrador.");
          }
        })
        .catch((error) => {
          console.error("Error toggling admin status:", error);
          window.toast.error("No se pudo actualizar el estado del administrador. Error de red.");
        });
    }

    // Table Rendering Functions
    showTableLoading(type) {
      console.log(`Showing table loading for ${type}`);
      const tbody = this.viewContainer.querySelector(`#${type}-table-body`);
      if (!tbody) {
        console.error(`Table body for ${type} not found`);
        return;
      }
      const colspan = type === "clientes" ? 5 : 6; // Colspan para admin es 6

      tbody.innerHTML = `
                    <tr class="loading-row">
                        <td colspan="${colspan}" class="px-8 py-16 text-center">
                            <div class="flex justify-center">
                                <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
                            </div>
                            <p class="mt-4 text-gray-600">Cargando ${
                              type === "clientes"
                                ? "clientes"
                                : "administradores"
                            }...</p>
                        </td>
                    </tr>
                `;
    }

    showTableError(type, message) {
      console.log(`Showing table error for ${type}: ${message}`);
      const tbody = this.viewContainer.querySelector(`#${type}-table-body`);
      if (!tbody) {
        console.error(`Table body for ${type} not found`);
        return;
      }
      const colspan = type === "clientes" ? 5 : 6; // Colspan para admin es 6

      tbody.innerHTML = `
                    <tr>
                        <td colspan="${colspan}" class="px-8 py-16 text-center">
                            <div class="text-red-500">
                                <i class="fas fa-exclamation-circle text-3xl mb-3"></i>
                                <p class="text-lg font-medium">${message}</p>
                                <button data-action="retry-load" data-type="${type}" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                    Reintentar
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
    }

    renderClientesTable(clientes) {
      console.log("Rendering clientes table");
      const tbody = this.viewContainer.querySelector("#clientes-table-body");
      if (!tbody) {
        console.error("Clientes table body not found");
        return;
      }

      if (!clientes || clientes.length === 0) {
        tbody.innerHTML = `
                        <tr>
                            <td colspan="5" class="px-8 py-16 text-center">
                                <div class="text-gray-500">
                                    <i class="fas fa-users text-3xl mb-3"></i>
                                    <p class="text-lg font-medium">No se encontraron clientes</p>
                                    <p class="mt-1">Intenta ajustar los filtros de búsqueda</p>
                                </div>
                            </td>
                        </tr>
                    `;
        return;
      }

      tbody.innerHTML = clientes
        .map(
          (cliente) => `
                    <tr class="hover:bg-gray-50 transition-all duration-200 card-hover">
                        <td class="px-8 py-5 whitespace-nowrap text-base text-gray-800 font-medium">${
                          cliente.nombre
                        }</td>
                        <td class="px-8 py-5 whitespace-nowrap text-base text-gray-800 font-medium">${
                          cliente.apellido
                        }</td>
                        <td class="px-8 py-5 whitespace-nowrap text-base text-gray-600">${
                          cliente.numero
                        }</td>
                        <td class="px-8 py-5 whitespace-nowrap">
                            <button data-action="toggle-status" data-id="${
                              cliente.id
                            }" class="${
            cliente.estado === "activo" ? "status-active" : "status-inactive"
          }">
                                ${
                                  cliente.estado === "activo"
                                    ? "Activo"
                                    : "Inactivo"
                                }
                            </button>
                        </td>
                        <td class="px-8 py-5 whitespace-nowrap">
                            <button data-action="edit-cliente" data-id="${
                              cliente.id
                            }" class="action-btn text-blue-600 hover:text-blue-800">
                                <i class="fas fa-edit text-lg"></i>
                            </button>
                        </td>
                    </tr>
                `
        )
        .join("");
    }

    renderAdministradoresTable(administradores) {
      console.log("Rendering administradores table");
      const tbody = this.viewContainer.querySelector(
        "#administradores-table-body"
      );
      if (!tbody) {
        console.error("Administradores table body not found");
        return;
      }

      if (!administradores || administradores.length === 0) {
        tbody.innerHTML = `
                        <tr>
                            <td colspan="6" class="px-8 py-16 text-center">
                                <div class="text-gray-500">
                                    <i class="fas fa-user-shield text-3xl mb-3"></i>
                                    <p class="text-lg font-medium">No se encontraron administradores</p>
                                    <p class="mt-1">Intenta ajustar los filtros de búsqueda</p>
                                </div>
                            </td>
                        </tr>
                    `;
        return;
      }

      tbody.innerHTML = administradores
        .map(
          (admin) => {
            const isCurrentUser = admin.id === this.authenticatedAdminId;
            const rowClass = isCurrentUser ? "authenticated-admin-row" : "hover:bg-gray-50 transition-all duration-200 card-hover";
            const adminName = isCurrentUser ? `${admin.nombre} <span class="text-sm font-normal text-blue-600">(Tú)</span>` : admin.nombre;

            return `
                    <tr class="${rowClass}">
                        <td class="px-8 py-5 whitespace-nowrap text-base text-gray-800 font-medium">${adminName}</td>
                        <td class="px-8 py-5 whitespace-nowrap text-base text-gray-800 font-medium">${admin.apellido}</td>
                        <td class="px-8 py-5 whitespace-nowrap text-base text-gray-600 font-mono">${admin.cedula}</td>
                        <td class="px-8 py-5 whitespace-nowrap text-base text-gray-600">${admin.numero_telefono}</td>
                        <td class="px-8 py-5 whitespace-nowrap">
                            <button data-action="toggle-admin-status" data-id="${admin.id}" class="${
            admin.estado === "activo" ? "status-active" : "status-inactive"
          }">
                                ${
                                  admin.estado === "activo"
                                    ? "Activo"
                                    : "Inactivo"
                                }
                            </button>
                        </td>
                        <td class="px-8 py-5 whitespace-nowrap">
                            <button data-action="edit-admin" data-id="${admin.id}" class="action-btn text-blue-600 hover:text-blue-800">
                                <i class="fas fa-edit text-lg"></i>
                            </button>
                        </td>
                    </tr>
                `;
          }
        )
        .join("");
    }

    renderPagination(type, pagination) {
      console.log(`Rendering pagination for ${type}`);
      const paginationContainer = this.viewContainer.querySelector(`#${type}-pagination`);
      const currentRange = this.viewContainer.querySelector(
        `#${type}-current-range`
      );
      const totalSpan = this.viewContainer.querySelector(`#${type}-total`);

      // Asegurar que el contenedor de paginación siempre sea visible
      // para una UI consistente, incluso si solo hay una página.
      if (!paginationContainer || !currentRange || !totalSpan) {
        console.error(`Pagination elements for ${type} not found`);
        return;
      }

      const startIndex =
        pagination.total === 0 ?
        0 :
        (pagination.page - 1) * pagination.per_page + 1;
      const endIndex = Math.min(
        pagination.page * pagination.per_page,
        pagination.total
      );
      currentRange.textContent = `${startIndex}-${endIndex}`;
      totalSpan.textContent = pagination.total;

      // Ocultar el selector de ítems por página si el total es menor o igual a 10.
      const itemsPerPageSelectId = type === 'clientes' ? 'items-per-page-select' : 'items-per-page-select-admins';
      const itemsPerPageSelect = this.viewContainer.querySelector(`#${itemsPerPageSelectId}`);
      if (itemsPerPageSelect) {
        if (pagination.total > 10) {
          itemsPerPageSelect.classList.remove('hidden');
        } else {
          itemsPerPageSelect.classList.add('hidden');
        }
      }

      //  Mostrar los botones de paginación solo si hay más de una página.
      if (pagination.pages > 1) {
        paginationContainer.classList.remove('hidden');
      } else {
        paginationContainer.classList.add('hidden');
      }

      const prevBtn = this.viewContainer.querySelector(`#${type}-prev`);
      const nextBtn = this.viewContainer.querySelector(`#${type}-next`);

      // Si no hay botones (porque están ocultos), no hay nada más que hacer.
      if (!prevBtn || !nextBtn) return;

      if (prevBtn) {
        prevBtn.disabled = pagination.page === 1;
        prevBtn.dataset.action = "change-page";
        prevBtn.dataset.type = type; //  Asegurarse que el tipo esté presente
        prevBtn.dataset.page = pagination.page - 1;
      }
      if (nextBtn) {
        nextBtn.disabled = pagination.page === pagination.pages;
        nextBtn.dataset.action = "change-page";
        nextBtn.dataset.type = type; //  Asegurarse que el tipo esté presente
        nextBtn.dataset.page = pagination.page + 1;
      }

      const pageNumbers = this.viewContainer.querySelector(
        `#${type}-page-numbers`
      );
      if (!pageNumbers) {
        console.error(`Page numbers for ${type} not found`);
        return;
      }

      pageNumbers.innerHTML = "";

      for (let i = 1; i <= pagination.pages; i++) {
        const button = document.createElement("button");
        button.className = `pagination-button w-12 h-12 rounded-xl text-base font-semibold border-2 ${
          i === pagination.page
            ? "active-page border-blue-600"
            : "border-gray-300 text-gray-700 bg-white"
        }`;
        button.textContent = i;
        button.dataset.action = "change-page";
        button.dataset.type = type;
        button.dataset.page = i;
        pageNumbers.appendChild(button);
      }
    }

    // Modal Functions
    openClienteModal(mode = "create", data = null) {
      const isEdit = mode === "edit";
      this.clienteModalTitle.textContent = isEdit ? "Editar Cliente" : "Nuevo Cliente";

      if (!isEdit) {
        this.clienteForm.querySelectorAll("input").forEach(input => {
          input.value = "";
          this.clearFieldError(input);
        });
        this.clienteIdInput.value = "";
      }

      this.clientePasswordInput.value = "";
      this.clientePasswordInput.required = false;


      this.clienteModal.classList.remove("hidden");
      this.clienteModal.classList.add("flex");
      this.isInitialOpen = true;
      this.clienteSaveButton.disabled = false;
      // MEJORA PROFESIONAL: En lugar de un temporizador, desactivar la bandera de validación inicial
      // después de que el modal reciba el foco. Esto es más robusto y evita validaciones prematuras.
      this.clienteModal.focus();
      this.clienteModal.addEventListener('focus', () => {
        this.isInitialOpen = false;
      }, { once: true });

      if (isEdit && data) {
        this.clienteIdInput.value = data.id;
        this.clienteNameInput.value = data.nombre;
        this.clienteLastnameInput.value = data.apellido;
        this.clientePhoneInput.value = data.numero;
      }

      // MEJORA PROFESIONAL: Llamar a la función unificada para actualizar el texto de ayuda
      // inmediatamente al abrir el modal, tanto en modo creación como en edición.
      this.updatePasswordHelperText('cliente');
    }
  

    openAdminModal(mode = "create", data = null) {
      const isEdit = mode === "edit";
      this.adminModalTitle.textContent = isEdit ? "Editar Administrador" : "Nuevo Administrador";

      if (!isEdit) {
        this.adminForm.querySelectorAll("input").forEach(input => {
          input.value = "";
          this.clearFieldError(input);
        });
        this.adminIdInput.value = "";
      }

      this.adminPasswordInput.value = "";
      this.adminPasswordInput.required = false;

      this.adminModal.classList.remove("hidden");
      this.adminModal.classList.add("flex");
      this.isInitialOpen = true;
      this.adminSaveButton.disabled = false;
      // MEJORA PROFESIONAL: En lugar de un temporizador, desactivar la bandera de validación inicial
      // después de que el modal reciba el foco. Esto es más robusto y evita validaciones prematuras.
      this.adminModal.focus();
      this.adminModal.addEventListener('focus', () => {
        this.isInitialOpen = false;
      }, { once: true });

      if (isEdit && data) {
        this.adminIdInput.value = data.id;
        this.adminNameInput.value = data.nombre;
        this.adminLastnameInput.value = data.apellido;
        this.adminIdentificationInput.value = data.cedula;
        this.adminPhoneInput.value = data.numero_telefono;
      }

      // MEJORA PROFESIONAL: Llamar a la función unificada para actualizar el texto de ayuda
      // inmediatamente al abrir el modal, tanto en modo creación como en edición.
      this.updatePasswordHelperText('admin');
    }

    closeModal() {
      console.log("Closing modal");
      if (this.clienteModal) {
        this.clienteModal.classList.add("hidden");
        this.clienteModal.classList.remove("flex");
      }
      if (this.adminModal) {
        this.adminModal.classList.add("hidden");
        this.adminModal.classList.remove("flex");
      }

      // Limpiar todos los errores de validación al cerrar el modal.
      if (this.clienteForm) {
        this.clienteForm.querySelectorAll("input").forEach(this.clearFieldError);
      }
      if (this.adminForm) {
        this.adminForm.querySelectorAll("input").forEach(this.clearFieldError);
      }
    }

    handleFormSubmit(e, type) {
      console.log(`Handling form submit for ${type}`);
      e.preventDefault();

      const form = type === 'cliente' ? this.clienteForm : this.adminForm;
      const idInput = type === 'cliente' ? this.clienteIdInput : this.adminIdInput;
      const passwordInput = type === 'cliente' ? this.clientePasswordInput : this.adminPasswordInput;
      const nameInput = type === 'cliente' ? this.clienteNameInput : this.adminNameInput;
      const phoneInput = type === 'cliente' ? this.clientePhoneInput : this.adminPhoneInput;
      const saveButton = type === 'cliente' ? this.clienteSaveButton : this.adminSaveButton;

      const id = idInput.value;
      const isEdit = !!id;

      if (!isEdit && passwordInput.value.trim() === "") {
        const nombre = nameInput.value.trim();
        const numero = phoneInput.value.trim();

        if (nombre && numero.length >= 2) {
          const nombreBase = nombre.split(" ")[0].charAt(0).toUpperCase() + nombre.split(" ")[0].slice(1).toLowerCase();
          const longitudNombre = nombreBase.length;
          const digitosNecesarios = Math.max(2, 8 - longitudNombre);
          const autoPassword = `${nombreBase}${numero.substring(0, digitosNecesarios)}`;
          passwordInput.value = autoPassword;
          window.toast.info(`Contraseña generada: ${autoPassword}`, 5000);
          return;
        }
      }

      let isFormValid = true;
      form.querySelectorAll("input[required]").forEach((input) => {
        if (!this.validateField(input)) {
          isFormValid = false;
        }
      });

      if (!isFormValid) {
        window.toast.error("Por favor, corrige los campos marcados en rojo.");
        return;
      }

      if (saveButton) saveButton.disabled = true;

      if (type === "cliente") {
        const clienteData = {
          id: id || null,
          nombre: this.clienteNameInput.value,
          apellido: this.clienteLastnameInput.value,
          numero: this.clientePhoneInput.value,
          estado: "activo",
        };
        if (passwordInput.value) clienteData.contraseña = passwordInput.value;
        this.saveCliente(clienteData);
      } else { // admin
        const adminData = {
          id: id || null,
          nombre: this.adminNameInput.value,
          apellido: this.adminLastnameInput.value,
          cedula: this.adminIdentificationInput.value,
          numero_telefono: this.adminPhoneInput.value,
          estado: "activo",
        };
        if (passwordInput.value) adminData.contraseña = passwordInput.value;
        this.saveAdministrador(adminData);
      }
    }

    // --- INICIO: Funciones de Validación Profesional ---
    validateField(input) {
      if (!input) return true;

      if (this.isInitialOpen) return true;

      this.clearFieldError(input);
      const value = input.value.trim();
      const isRequired = input.hasAttribute("required");

      if (isRequired && value === "") {
        this.setFieldError(input, "Este campo es obligatorio.");
        return false;
      }

      if (!isRequired && value === "" && input.type !== "password") {
        return true;
      }

      switch (input.name) {
        case "numero":
          if (!this.validationPatterns.phone.test(value)) {
            this.setFieldError(input, "El teléfono debe tener 10 dígitos.");
            return false;
          }
          break;
        case "cedula":
          if (isRequired && !this.validationPatterns.cedula.test(value)) {
            this.setFieldError(input, "La cédula debe tener entre 7 y 10 dígitos.");
            return false;
          }
          break;
        case "contraseña":
          const isEdit = !!(this.clienteIdInput.value || this.adminIdInput.value);
          if (!isEdit && value === "") {
            // En modo creación, si está vacío, es válido porque se autogenerará.
            return true;
          }
          if (value !== "" && value.length < 8) {
            this.setFieldError(input, "La contraseña debe tener al menos 8 caracteres.");
            return false;
          }
          break;
      }
      return true;
    }

    setFieldError(input, message) {
      input.classList.add("border-red-500", "focus:border-red-500", "focus:ring-red-500/30");
      const errorElement = input.parentElement.querySelector(".error-message") || input.parentElement.parentElement.querySelector(".error-message");
      if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove("hidden");
      }
    }

    clearFieldError(input) {
      if (!input) return;
      input.classList.remove("border-red-500", "focus:border-red-500", "focus:ring-red-500/30");
      const errorElement = input.parentElement.querySelector(".error-message") || input.parentElement.parentElement.querySelector(".error-message");
      if (errorElement) errorElement.classList.add("hidden");
    }
    // --- FIN: Funciones de Validación Profesional ---

    // --- INICIO: Función de UI Profesional para Contraseña ---
    updatePasswordHelperText(type) {
      const idInput = type === 'cliente' ? this.clienteIdInput : this.adminIdInput;
      const nameInput = type === 'cliente' ? this.clienteNameInput : this.adminNameInput;
      const phoneInput = type === 'cliente' ? this.clientePhoneInput : this.adminPhoneInput;
      const passwordInput = type === 'cliente' ? this.clientePasswordInput : this.adminPasswordInput;
      const passwordHelper = document.getElementById(`${type}-password-helper`);

      if (!passwordHelper) return;

      const isEdit = !!idInput.value;
      passwordHelper.classList.remove("hidden");

      if (isEdit) {
        passwordHelper.innerHTML = '<i class="fas fa-info-circle mr-1"></i> Dejar en blanco para no cambiar la contraseña actual.';
      } else {
        // Lógica para modo creación
        if (passwordInput.value.trim() !== "") {
          passwordHelper.classList.add("hidden");
        } else {
          const nombre = nameInput.value.trim();
          const numero = phoneInput.value.trim();
          if (nombre && numero.length >= 2) {
            const nombreBase = nombre.split(" ")[0].charAt(0).toUpperCase() + nombre.split(" ")[0].slice(1).toLowerCase();
            const longitudNombre = nombreBase.length;
            const digitosNecesarios = Math.max(2, 8 - longitudNombre);
            const autoPassword = `${nombreBase}${numero.substring(0, digitosNecesarios)}`;
            passwordHelper.innerHTML = `<i class="fas fa-magic mr-1"></i> Se generará: <strong class="font-mono">${autoPassword}</strong>`;
          } else {
            passwordHelper.innerHTML = '<i class="fas fa-info-circle mr-1"></i> Dejar en blanco para generar una contraseña segura.';
          }
        }
      }
    }
    // --- FIN: Función de UI Profesional para Contraseña ---

    getCsrfToken() {
      const csrfToken = document.querySelector('input[name="csrf_token"]');
      return csrfToken ? csrfToken.getAttribute("content") : "";
    }

    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    // Functions to handle actions
    editCliente(id) {
      console.log(`Editing cliente with id: ${id}`);
      fetch(`/api/usuarios/${id}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          console.log("Cliente data received:", data);
          if (data.success) {
            const cliente = data.usuario;
            this.openClienteModal("edit", cliente);
          } else {
            window.toast.error(data.message || "No se pudo cargar el cliente.");
          }
        })
        .catch((error) => {
          console.error("Error loading cliente:", error);
          window.toast.error("No se pudo cargar el cliente. Error de red.");
        });
    }

    editAdministrador(id) {
      console.log(`Editing administrador with id: ${id}`);
      fetch(`/api/admins/${id}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          console.log("Administrador data received:", data);
          if (data.success) {
            const admin = data.admin;
            this.openAdminModal("edit", admin);
          } else {
            window.toast.error(data.message || "No se pudo cargar el administrador.");
          }
        })
        .catch((error) => {
          console.error("Error loading administrador:", error);
          window.toast.error("No se pudo cargar el administrador. Error de red.");
        });
    }

    togglePasswordVisibility(type) {
      const passwordInput = document.getElementById(`${type}-password`);
      const toggleButton = document.getElementById(`toggle-${type}-password`);
      const icon = toggleButton.querySelector("i");

      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
      } else {
        passwordInput.type = "password";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
      }
    }
  }

  // Crear una instancia de la clase y asignarla a window.usuariosApp
  window.usuariosApp = new UsuariosApp();
}

//  Lógica de gestión del ciclo de vida del SPA.
const setupUsuariosAppLifecycle = () => {
  const viewId = "usuarios-view";

  const handleContentLoaded = () => {
    // Solo inicializar si el contenedor de esta vista está en el DOM.
    if (document.getElementById(viewId) && window.usuariosApp) {
      console.log("content-loaded event fired, initializing UsuariosApp");
      window.usuariosApp.init();
    }
  };

  const handleContentWillLoad = () => {
    if (window.usuariosApp && window.usuariosApp.isInitialized) {
      console.log("content-will-load event fired, cleaning up UsuariosApp");
      window.usuariosApp.cleanup();
    }
  };

  // Adjuntar los listeners una sola vez.
  document.removeEventListener("content-loaded", handleContentLoaded);
  document.removeEventListener("content-will-load", handleContentWillLoad);
  document.addEventListener("content-loaded", handleContentLoaded);
  document.addEventListener("content-will-load", handleContentWillLoad);

  // Inicialización para la carga inicial de la página (no SPA).
  handleContentLoaded();
};

setupUsuariosAppLifecycle();