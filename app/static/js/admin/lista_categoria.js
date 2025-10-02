// Objeto global para la aplicación de categorías
window.categoriesApp = {
  currentView: "all",
  currentPage: 1,
  itemsPerPage: 10,
  isLoading: false,
  initialized: false,
  // Elementos del DOM
  elements: {},
  // Inicializar la aplicación
  // Función para inicializar la aplicación
  init: function (initialPaginationData) {
    // Si ya está inicializado, reinicializar sin duplicar eventos
    if (this.initialized) {
      this.reinitialize();
      return;
    }
    // Guardar referencias a elementos del DOM
    this.cacheElements();
    // Inicializar la vista
    this.initializeView();
    // Configurar eventos
    this.setupEventListeners();
    // Marcar como inicializado
    this.initialized = true;
    // Actualizar la información de paginación con los datos iniciales
    if (initialPaginationData) {
      this.updatePaginationInfo({ pagination: initialPaginationData });
    }
  },
  // Función para cachear elementos del DOM
  cacheElements: function () {
    this.elements.hierarchicalView =
      document.getElementById("hierarchicalView");
    this.elements.mainCategoriesTableView = document.getElementById(
      "mainCategoriesTableView"
    );
    this.elements.subCategoriesTableView = document.getElementById(
      "subCategoriesTableView"
    );
    this.elements.pseudoCategoriesTableView = document.getElementById(
      "pseudoCategoriesTableView"
    );
    this.elements.filterFab = document.getElementById("filterFab");
    this.elements.clearFiltersViewBtn = document.getElementById(
      "clearFiltersViewBtn"
    );
    this.elements.categoriesContainer = document.getElementById(
      "categoriesContainer"
    );
    this.elements.mainCategoriesTableBody = document.getElementById(
      "mainCategoriesTableBody"
    );
    this.elements.subCategoriesTableBody = document.getElementById(
      "subCategoriesTableBody"
    );
    this.elements.pseudoCategoriesTableBody = document.getElementById(
      "pseudoCategoriesTableBody"
    );
    this.elements.paginationContainer = document.getElementById(
      "paginationContainer"
    );
    this.elements.showingTo = document.getElementById("pagination-showing-top");
    this.elements.totalItems = document.getElementById("pagination-total-top");
    this.elements.currentPageDisplay = document.getElementById(
      "pagination-current-page"
    );
    this.elements.totalPagesDisplay = document.getElementById(
      "pagination-total-pages"
    );
    this.elements.categoryListLoaderOverlay = document.getElementById(
      "categoryListLoaderOverlay"
    );
    // Campos de filtro
    this.elements.nameFilterField = document.getElementById("nameFilterField");
    this.elements.statusFilterField =
      document.getElementById("statusFilterField");
    this.elements.mainCategoryFilterField = document.getElementById(
      "mainCategoryFilterField"
    );
    this.elements.subCategoryFilterField = document.getElementById(
      "subCategoryFilterField"
    );
    this.elements.sortFilterField = document.getElementById("sortFilterField");
  },
  // Función para reinicializar cuando el contenido se recarga mediante SPA
  reinitialize: function () {
    // Actualizar referencias a elementos del DOM que pueden haber cambiado
    this.cacheElements();
    // Reinicializar la vista
    this.initializeView();
    // Reconfigurar eventos
    this.setupEventListeners();
  },
  // Función para inicializar la vista
  initializeView: function () {
    // Obtener la vista actual de la URL
    const path = window.location.pathname;
    if (path.endsWith("/principales")) {
      this.currentView = "main";
    } else if (path.endsWith("/subcategorias")) {
      this.currentView = "sub";
    } else if (path.endsWith("/seudocategorias")) {
      this.currentView = "pseudo";
    } else {
      this.currentView = "all";
    }
    // También verificar si hay un parámetro de vista en la URL (para compatibilidad o si se usa en otros lugares)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("view")) {
      this.currentView = urlParams.get("view");
    }
    // Establecer el tab activo
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active", "border-blue-500", "text-blue-600");
      btn.classList.add("border-transparent", "text-gray-500");
      if (btn.getAttribute("data-level") === this.currentView) {
        btn.classList.add("active", "border-blue-500", "text-blue-600");
        btn.classList.remove("border-transparent", "text-gray-500");
      }
    });
    // Mostrar la vista correspondiente
    this.showView(this.currentView);
    // Cargar los datos iniciales
    if (this.currentView === "all") {
      // Los datos ya están cargados desde el servidor.
      // Solo necesitamos inicializar los eventos de la vista jerárquica.
      this.initializeHierarchicalView();
    } else if (this.currentView === "main") {
      // Los datos de la tabla principal ya están cargados desde el servidor.
      // No es necesario llamar a loadTableData() en la carga inicial.
    } else {
      this.loadTableData();
    }
  },
  // Función para mostrar la vista correspondiente
  showView: function (viewType) {
    // Ocultar todas las vistas
    if (this.elements.hierarchicalView)
      this.elements.hierarchicalView.classList.add("hidden");

    if (this.elements.mainCategoriesTableView)
      this.elements.mainCategoriesTableView.classList.add("hidden");

    if (this.elements.subCategoriesTableView)
      this.elements.subCategoriesTableView.classList.add("hidden");

    if (this.elements.pseudoCategoriesTableView)
      this.elements.pseudoCategoriesTableView.classList.add("hidden");

    // Controlar la visibilidad de los botones de filtro
    if (viewType === "all") {
      if (this.elements.hierarchicalView)
        this.elements.hierarchicalView.classList.remove("hidden");
      if (this.elements.filterFab)
        this.elements.filterFab.classList.add("hidden-filter");
      if (this.elements.clearFiltersViewBtn)
        this.elements.clearFiltersViewBtn.classList.add("hidden");
    } else {
      if (this.elements.filterFab)
        this.elements.filterFab.classList.remove("hidden-filter");
      if (this.elements.clearFiltersViewBtn)
        this.elements.clearFiltersViewBtn.classList.remove("hidden");

      // Mostrar la tabla y actualizar los campos de filtro correspondientes
      if (viewType === "main") {
        if (this.elements.mainCategoriesTableView)
          this.elements.mainCategoriesTableView.classList.remove("hidden");
        this.updateFilterFields("main");
      } else if (viewType === "sub") {
        if (this.elements.subCategoriesTableView)
          this.elements.subCategoriesTableView.classList.remove("hidden");
        this.updateFilterFields("sub");
      } else if (viewType === "pseudo") {
        if (this.elements.pseudoCategoriesTableView)
          this.elements.pseudoCategoriesTableView.classList.remove("hidden");
        this.updateFilterFields("pseudo");
      }
    }
  },
  // Función para actualizar los campos de filtro según la vista actual
  updateFilterFields: function (viewType) {
    // Mostrar campos comunes
    if (this.elements.nameFilterField)
      this.elements.nameFilterField.classList.remove("hidden");

    if (this.elements.statusFilterField)
      this.elements.statusFilterField.classList.remove("hidden");

    if (this.elements.sortFilterField)
      this.elements.sortFilterField.classList.remove("hidden");

    // Ocultar campos específicos
    if (this.elements.mainCategoryFilterField)
      this.elements.mainCategoryFilterField.classList.add("hidden");

    if (this.elements.subCategoryFilterField)
      this.elements.subCategoryFilterField.classList.add("hidden");

    // Mostrar campos según el tipo de vista
    if (viewType === "sub") {
      // Para subcategorías: mostrar campo de categoría principal
      if (this.elements.mainCategoryFilterField)
        this.elements.mainCategoryFilterField.classList.remove("hidden");

      this.loadMainCategoriesForFilter();
    } else if (viewType === "pseudo") {
      // Para seudocategorías: mostrar campos de categoría principal y subcategoría
      if (this.elements.mainCategoryFilterField)
        this.elements.mainCategoryFilterField.classList.remove("hidden");

      if (this.elements.subCategoryFilterField)
        this.elements.subCategoryFilterField.classList.remove("hidden");

      this.loadMainCategoriesForFilter();
      this.loadSubcategoriesForFilter();
    }
  },
  // Función para cargar categorías principales para el filtro
  loadMainCategoriesForFilter: function () {
    const mainCategoryFilter = document.getElementById("mainCategoryFilter");
    if (!mainCategoryFilter) return;

    // Limpiar opciones actuales
    mainCategoryFilter.innerHTML =
      '<option value="all">Todas las categorías principales</option>';
    // Obtener categorías principales del servidor
    fetch("/admin/api/categorias-principales/filter?per_page=100")
      .then((response) => response.json())
      .then((data) => {
        if (data.success && data.categorias) {
          data.categorias.forEach((category) => {
            const option = document.createElement("option");
            option.value = category.id;
            option.textContent = category.nombre;
            mainCategoryFilter.appendChild(option);
          });
        }
      })
      .catch((error) => {
        console.error("Error al cargar categorías principales:", error);
        this.showNotification(
          "Error al cargar categorías principales",
          "error"
        );
      });
  },
  // Función para cargar subcategorías para el filtro
  loadSubcategoriesForFilter: function (mainCategoryId = null) {
    const subCategorySelect = document.getElementById("subCategoryFilter");
    if (!subCategorySelect) return;

    // Lógica de carga independiente.
    // Determina qué API usar: todas las subcategorías o las de una categoría principal.
    let apiUrl;
    if (mainCategoryId && mainCategoryId !== "all") {
      apiUrl = `/admin/api/categorias-principales/${mainCategoryId}/subcategorias?estado=activo`;
    } else {
      // Si no hay categoría principal, carga TODAS las subcategorías activas.
      apiUrl = `/admin/api/subcategorias/activas`;
    }

    subCategorySelect.innerHTML = '<option value="">Cargando...</option>';

    fetch(apiUrl)
      .then((response) => response.json())
      .then((data) => {
        subCategorySelect.innerHTML =
          '<option value="all">Todas las subcategorías</option>';
        if (data.success && data.subcategorias) {
          // Poblar el select con las opciones obtenidas.
          data.subcategorias.forEach((subcategory) => {
            const option = document.createElement("option");
            option.value = subcategory.id;
            option.textContent = subcategory.nombre;
            subCategorySelect.appendChild(option);
          });
          // El filtro de subcategoría siempre está habilitado.
          subCategorySelect.disabled = false;
        }
      })
      .catch((error) => {
        console.error("Error al cargar subcategorías para el filtro:", error);
        subCategorySelect.innerHTML =
          '<option value="all">Error al cargar</option>';
      });
  },
  // Función para cargar categorías jerárquicas
  loadHierarchicalCategories: function () {
    if (this.isLoading) return;

    this.isLoading = true;
    // Mostrar overlay de carga
    if (this.elements.categoryListLoaderOverlay) {
      this.elements.categoryListLoaderOverlay.classList.remove("hidden");
    }
    // Obtener categorías principales del servidor
    fetch(
      `/admin/api/categorias-principales/filter?page=${this.currentPage}&per_page=${this.itemsPerPage}`
    )
      .then((response) => response.json())
      .then((data) => {
        if (
          data.success &&
          data.categorias &&
          this.elements.categoriesContainer
        ) {
          this.renderHierarchicalCategories(data.categorias);
          // Add pagination update here
          if (data.pagination) {
            this.updatePagination(data.pagination);
            this.updatePaginationInfo(data);
          }
        } else if (this.elements.categoriesContainer) {
          this.elements.categoriesContainer.innerHTML =
            '<p class="text-gray-500 text-center py-4">No se encontraron categorías</p>';
        }
        this.isLoading = false;
        // Ocultar overlay de carga
        if (this.elements.categoryListLoaderOverlay) {
          this.elements.categoryListLoaderOverlay.classList.add("hidden");
        }
      })
      .catch((error) => {
        console.error("Error al cargar categorías jerárquicas:", error);
        if (this.elements.categoriesContainer) {
          this.elements.categoriesContainer.innerHTML =
            '<p class="text-red-500 text-center py-4">Error al cargar categorías</p>';
        }
        this.showNotification("Error al cargar categorías", "error");
        this.isLoading = false;
        // Ocultar overlay de carga
        if (this.elements.categoryListLoaderOverlay) {
          this.elements.categoryListLoaderOverlay.classList.add("hidden");
        }
      });
  },
  // Función para renderizar categorías jerárquicas
  renderHierarchicalCategories: function (categories) {
    if (!this.elements.categoriesContainer) return;

    let html = "";
    if (categories && categories.length > 0) {
      categories.forEach((category) => {
        // Contar subcategorías activas
        const activeSubcategories = category.subcategorias
          ? category.subcategorias.filter((sub) => sub.estado === "activo")
              .length
          : 0;
        // Usar el total de productos ya calculado por el backend
        const totalProducts = category.total_productos || 0;
        html += `
                    <div class="category-card">
                        <div class="category-header">
                            <div class="category-info">
                                <button class="category-toggle" data-target="sub-${
                                  category.id
                                }">
                                    <i class="fas fa-chevron-right"></i>
                                </button>
                                <div class="category-details">
                                    <h4>${category.nombre}</h4>
                                    <p>${category.descripcion}</p>
                                    <div class="category-meta">
                                        <span class="inline-flex items-center mr-3">
                                            <i class="fas fa-folder mr-1"></i> ${activeSubcategories} subcategorías
                                        </span>
                                        <span class="inline-flex items-center">
                                            <i class="fas fa-tag mr-1"></i> ${totalProducts} productos
                                        </span>
                                        <span class="inline-flex items-center ml-3">
                                            <i class="fas fa-clock mr-1"></i> ${this.formatDate(
                                              category.created_at
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div class="category-actions">
                                <label class="toggle-switch">
                                    <input type="checkbox" class="main-category-status" data-id="${
                                      category.id
                                    }"
                                           ${
                                             category.estado === "activo"
                                               ? "checked"
                                               : ""
                                           }>
                                    <span class="toggle-slider"></span>
                                </label>
                                <a href="/admin/categorias-principales/${
                                  category.slug
                                }" class="action-button view" title="Ver detalles">
                                    <i class="fas fa-eye"></i>
                                </a>
                                ${category.estado === 'activo' ? `
                                <button class="action-button edit" title="Editar Categoría" onclick="categoriesApp.editCategory('${category.id}', 'main')">
                                    <i class="fas fa-edit"></i>
                                </button>` : `
                                <button class="action-button edit opacity-50 cursor-not-allowed" title="Para editar, la categoría debe estar activa" onclick="categoriesApp.showInactiveEditMessage()">
                                    <i class="fas fa-edit"></i>
                                </button>`}
                            </div>
                        </div>

                        <!-- Subcategorías -->
                        <div class="subcategory-list" id="sub-${category.id}">
                            <div class="mb-2">
                                <h5 class="font-medium text-gray-700">Subcategorías</h5>
                            </div>

                            <div class="space-y-3 ml-4">
                                ${this.renderSubcategories(
                                  category.subcategorias || [],
                                  category.id
                                )}
                            </div>
                        </div>
                    </div>
                `;
      });
    } else {
      html =
        '<p class="text-gray-500 text-center py-4">No se encontraron categorías</p>';
    }
    this.elements.categoriesContainer.innerHTML = html;
    // Inicializar eventos para la vista jerárquica
    this.initializeHierarchicalView();
  },

  
  // Función para renderizar subcategorías
  renderSubcategories: function (subcategories, mainCategoryId) {
    let html = "";
    if (subcategories && subcategories.length > 0) {
      subcategories.forEach((subcategory) => {
        // Contar seudocategorías activas
        const activePseudocategories = subcategory.seudocategorias
          ? subcategory.seudocategorias.filter(
              (pseudo) => pseudo.estado === "activo"
            ).length
          : 0;
        // Usar el total de productos ya calculado por el backend
        const totalProducts = subcategory.total_productos || 0;
        html += `
                    <div class="subcategory-card">
                        <div class="subcategory-header">
                            <div class="subcategory-info">
                                <button class="subcategory-toggle" data-target="pseudo-${
                                  subcategory.id
                                }">
                                    <i class="fas fa-chevron-right"></i>
                                </button>
                                <div class="subcategory-details">
                                    <h6>${subcategory.nombre}</h6>
                                    <p class="text-xs text-gray-500">${
                                      subcategory.descripcion
                                    }</p>
                                    <div class="subcategory-meta">
                                        <span class="inline-flex items-center mr-3">
                                            <i class="fas fa-folder mr-1"></i> ${activePseudocategories} seudocategorías
                                        </span>
                                        <span class="inline-flex items-center">
                                            <i class="fas fa-tag mr-1"></i> ${totalProducts} productos
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div class="subcategory-actions">
                                <label class="toggle-switch">
                                    <input type="checkbox" class="subcategory-status" data-id="${
                                      subcategory.id
                                    }"
                                           ${
                                             subcategory.estado === "activo"
                                               ? "checked"
                                               : ""
                                           }>
                                    <span class="toggle-slider"></span>
                                </label>
                                ${subcategory.estado === 'activo' ? `
                                <button class="action-button edit" title="Editar Subcategoría" onclick="categoriesApp.editCategory('${subcategory.id}', 'sub')">
                                    <i class="fas fa-edit"></i>
                                </button>` : `
                                <button class="action-button edit opacity-50 cursor-not-allowed" title="Para editar, la subcategoría debe estar activa" onclick="categoriesApp.showInactiveEditMessage()">
                                    <i class="fas fa-edit"></i>
                                </button>`}
                            </div>
                        </div>

                        <!-- Seudocategorías -->
                        <div class="pseudocategory-list" id="pseudo-${
                          subcategory.id
                        }">
                            <div class="mb-2">
                                <h5 class="font-medium text-gray-700 text-sm">Seudocategorías</h5>
                            </div>

                            <div class="space-y-2 ml-4">
                                ${this.renderPseudocategories(
                                  subcategory.seudocategorias || [],
                                  subcategory.id
                                )}
                            </div>
                        </div>
                    </div>
                `;
      });
    } else {
      html =
        '<p class="text-gray-500 text-center py-2">No hay subcategorías</p>';
    }
    return html;
  },
  // Función para renderizar seudocategorías
  renderPseudocategories: function (pseudocategories, subcategoryId) {
    let html = "";
    if (pseudocategories && pseudocategories.length > 0) {
      pseudocategories.forEach((pseudocategory) => {
        // Usar el total de productos ya calculado por el backend
        const totalProducts = pseudocategory.total_productos || 0;
        html += `
                    <div class="pseudocategory-card">
                        <div class="pseudocategory-info">
                            <h6 class="font-medium text-gray-800 text-sm">${
                              pseudocategory.nombre
                            }</h6>
                            <p class="text-xs text-gray-500">${
                              pseudocategory.descripcion
                            }</p>
                            <div class="pseudocategory-meta">
                                <span class="inline-flex items-center">
                                    <i class="fas fa-tag mr-1"></i> ${totalProducts} productos
                                </span>
                            </div>
                        </div>
                        <div class="pseudocategory-actions">
                            <label class="toggle-switch">
                                <input type="checkbox" class="pseudocategory-status" data-id="${
                                  pseudocategory.id
                                }"
                                       ${
                                         pseudocategory.estado === "activo"
                                           ? "checked"
                                           : ""
                                       }>
                                <span class="toggle-slider"></span>
                            </label>
                            ${pseudocategory.estado === 'activo' ? `
                            <button class="action-button edit" title="Editar Seudocategoría" onclick="categoriesApp.editCategory('${pseudocategory.id}', 'pseudo')">
                                <i class="fas fa-edit"></i>
                            </button>` : `
                            <button class="action-button edit opacity-50 cursor-not-allowed" title="Para editar, la seudocategoría debe estar activa" onclick="categoriesApp.showInactiveEditMessage()">
                                <i class="fas fa-edit"></i>
                            </button>`}
                        </div>
                    </div>
                `;
      });
    } else {
      html =
        '<p class="text-gray-500 text-center py-2">No hay seudocategorías</p>';
    }
    return html;
  },
  // Función para inicializar la vista jerárquica
  initializeHierarchicalView: function () {
    // Toggle para expandir/colapsar categorías
    document.querySelectorAll(".category-toggle").forEach((toggle) => {
      toggle.addEventListener("click", function () {
        const targetId = this.getAttribute("data-target");
        const targetElement = document.getElementById(targetId);
        const icon = this.querySelector("i");
        if (targetElement.classList.contains("open")) {
          targetElement.classList.remove("open");
          icon.classList.remove("fa-chevron-down");
          icon.classList.add("fa-chevron-right");
        } else {
          targetElement.classList.add("open");
          icon.classList.remove("fa-chevron-right");
          icon.classList.add("fa-chevron-down");
        }
      });
    });
    // Toggle para expandir/colapsar subcategorías
    document.querySelectorAll(".subcategory-toggle").forEach((toggle) => {
      toggle.addEventListener("click", function () {
        const targetId = this.getAttribute("data-target");
        const targetElement = document.getElementById(targetId);
        const icon = this.querySelector("i");
        if (targetElement.classList.contains("open")) {
          targetElement.classList.remove("open");
          icon.classList.remove("fa-chevron-down");
          icon.classList.add("fa-chevron-right");
        } else {
          targetElement.classList.add("open");
          icon.classList.remove("fa-chevron-right");
          icon.classList.add("fa-chevron-down");
        }
      });
    });
    // Toggle de estado para categorías principales
    document.querySelectorAll(".main-category-status").forEach((toggle) => {
      toggle.addEventListener("change", function () {
        const categoryId = this.getAttribute("data-id");
        const newStatus = this.checked ? "activo" : "inactivo";
        categoriesApp.updateMainCategoryStatus(categoryId, newStatus);
      });
    });
    // Toggle de estado para subcategorías
    document.querySelectorAll(".subcategory-status").forEach((toggle) => {
      toggle.addEventListener("change", function () {
        const subcategoryId = this.getAttribute("data-id");
        const newStatus = this.checked ? "activo" : "inactivo";
        categoriesApp.updateSubcategoryStatus(subcategoryId, newStatus);
      });
    });
    // Toggle de estado para seudocategorías
    document.querySelectorAll(".pseudocategory-status").forEach((toggle) => {
      toggle.addEventListener("change", function () {
        const pseudocategoryId = this.getAttribute("data-id");
        const newStatus = this.checked ? "activo" : "inactivo";
        categoriesApp.updatePseudocategoryStatus(pseudocategoryId, newStatus);
      });
    });
  },
  // Función para cargar datos de tabla
  loadTableData: function (resetPage = true) {
    if (this.isLoading) return;

    this.isLoading = true;
    // Mostrar overlay de carga
    if (this.elements.categoryListLoaderOverlay) {
      this.elements.categoryListLoaderOverlay.classList.remove("hidden");
    }
    if (resetPage) {
      this.currentPage = 1;
    }
    // Obtener parámetros de filtro
    const nameFilter = document.getElementById("nameFilter")?.value || "";
    const statusFilter =
      document.getElementById("statusFilter")?.value || "all";
    const mainCategoryFilter =
      document.getElementById("mainCategoryFilter")?.value || "all";
    const subCategoryFilter =
      document.getElementById("subCategoryFilter")?.value || "all";
    const sortFilter = document.getElementById("sortFilter")?.value || "nombre";
    // Construir URL de la API
    let apiUrl = "";
    let tableBody = null;
    if (this.currentView === "main") {
      apiUrl = `/admin/api/categorias-principales/filter?page=${this.currentPage}&per_page=${this.itemsPerPage}`;
      tableBody = this.elements.mainCategoriesTableBody;
    } else if (this.currentView === "sub") {
      apiUrl = `/admin/api/subcategorias/filter?page=${this.currentPage}&per_page=${this.itemsPerPage}`;
      tableBody = this.elements.subCategoriesTableBody;
    } else if (this.currentView === "pseudo") {
      apiUrl = `/admin/api/seudocategorias/filter?page=${this.currentPage}&per_page=${this.itemsPerPage}`;
      tableBody = this.elements.pseudoCategoriesTableBody;
    }
    if (!tableBody) {
      this.isLoading = false;
      return;
    }
    // Agregar parámetros de filtro
    if (nameFilter) apiUrl += `&nombre=${encodeURIComponent(nameFilter)}`;

    if (statusFilter !== "all") apiUrl += `&estado=${statusFilter}`;

    if (this.currentView === "sub" && mainCategoryFilter !== "all")
      apiUrl += `&categoria_id=${encodeURIComponent(mainCategoryFilter)}`;

    //  Enviar ambos filtros para seudocategorías.
    // El backend priorizará subcategoría sobre categoría principal si ambos están presentes.
    if (this.currentView === "pseudo") {
      if (mainCategoryFilter !== "all") apiUrl += `&categoria_id=${encodeURIComponent(mainCategoryFilter)}`;
      if (subCategoryFilter !== "all") apiUrl += `&subcategoria_id=${encodeURIComponent(subCategoryFilter)}`;
    }
    // Agregar parámetros de ordenamiento
    let sortBy = "nombre";
    let sortOrder = "asc";
    if (sortFilter === "nombre-desc") {
      sortBy = "nombre";
      sortOrder = "desc";
    } else if (sortFilter === "created_at") {
      sortBy = "created_at";
      sortOrder = "desc"; // Recientes = DESC
    } else if (sortFilter === "created_at-desc") {
      sortBy = "created_at";
      sortOrder = "asc"; // Antiguos = ASC
    } else if (sortFilter === "nombre") {
      sortBy = "nombre";
      sortOrder = "asc";
    }
    apiUrl += `&sort_by=${sortBy}&sort_order=${sortOrder}`;

    // Obtener datos del servidor
    fetch(apiUrl)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // Actualizar tabla
          this.updateTable(data, tableBody);
          // Actualizar paginación
          if (data.pagination) {
            this.updatePagination(data.pagination);
            this.updatePaginationInfo(data);
          }
        } else {
          tableBody.innerHTML =
            '<tr><td colspan="6" class="text-center py-4 text-red-500">Error al cargar datos</td></tr>';
          this.showNotification("Error al cargar datos", "error");
        }
        this.isLoading = false;
        // Ocultar overlay de carga
        if (this.elements.categoryListLoaderOverlay) {
          this.elements.categoryListLoaderOverlay.classList.add("hidden");
        }
      })
      .catch((error) => {
        console.error("Error al cargar datos de tabla:", error);
        tableBody.innerHTML =
          '<tr><td colspan="6" class="text-center py-4 text-red-500">Error al cargar datos</td></tr>';
        this.showNotification("Error al cargar datos", "error");
        this.isLoading = false;
      });
  },
  // Función para actualizar la tabla
  updateTable: function (data, tableBody) {
    let html = "";
    if (this.currentView === "main") {
      if (data.categorias && data.categorias.length > 0) {
        data.categorias.forEach((category) => {
          html += `
                        <tr>
                            <td>${category.nombre}</td>
                            <td>${
                              category.subcategorias
                                ? category.subcategorias.length
                                : 0
                            }</td>
                            <td>
                                <div class="flex items-center">
                                    <div class="relative inline-block w-14 h-7 mr-2 align-middle select-none">
                                        <input type="checkbox" id="toggle-main-${
                                          category.id
                                        }" class="sr-only" ${
            category.estado === "activo" ? "checked" : ""
          } onchange="toggleCategoryStatus('${
            category.id
          }', 'main', this.checked)">
                                        <label for="toggle-main-${
                                          category.id
                                        }" class="block h-7 w-14 rounded-full cursor-pointer transition-colors duration-300 ease-in-out ${
            category.estado === "activo"
              ? "bg-gradient-to-r from-green-400 to-emerald-500 shadow-lg"
              : "bg-gray-300"
          }" title="Cambiar estado de la categoría">
                                            <span class="absolute left-1 top-1 bg-white w-5 h-5 rounded-full shadow-md transition-transform duration-300 ease-in-out ${
                                              category.estado === "activo"
                                                ? "transform translate-x-7"
                                                : "transform translate-x-0"
                                            } flex items-center justify-center">
                                                ${
                                                  category.estado === "activo"
                                                    ? `
                                                    <svg class="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                                                    </svg>
                                                `
                                                    : `
                                                    <svg class="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                                                    </svg>
                                                `
                                                }
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </td>
                            <td>${this.formatDate(category.created_at)}</td>
                            <td>
                                <div class="flex">
                                    <a href="/admin/categorias-principales/${
                                      category.slug
                                    }" class="action-button view" title="Ver detalles">
                                        <i class="fas fa-eye"></i>
                                    </a>
                                    ${category.estado === 'activo' ? `
                                    <button class="action-button edit" title="Editar Categoría" onclick="categoriesApp.editCategory('${category.id}', 'main')">
                                        <i class="fas fa-edit"></i>
                                    </button>` : `
                                    <button class="action-button edit opacity-50 cursor-not-allowed" title="Para editar, la categoría debe estar activa" onclick="categoriesApp.showInactiveEditMessage()">
                                        <i class="fas fa-edit"></i>
                                    </button>`
                                    }
                                </div>
                            </td>
                        </tr>
                    `;
        });
      } else {
        html =
          '<tr><td colspan="5" class="text-center py-4 text-gray-500">No se encontraron categorías principales que coincidan con los criterios de búsqueda. Por favor, ajuste los filtros o cree una nueva categoría principal.</td></tr>';
      }
    } else if (this.currentView === "sub") {
      if (data.subcategorias && data.subcategorias.length > 0) {
        data.subcategorias.forEach((subcategory) => {
          html += `
                        <tr>
                            <td>${subcategory.nombre}</td>
                            <td>${
                              subcategory.categoria_principal_nombre || "-"
                            }</td>
                            <td>${
                              subcategory.seudocategorias
                                ? subcategory.seudocategorias.length
                                : 0
                            }</td>
                            <td>
                                <div class="flex items-center">
                                    <div class="relative inline-block w-14 h-7 mr-2 align-middle select-none">
                                        <input type="checkbox" id="toggle-sub-${
                                          subcategory.id
                                        }" class="sr-only" ${
            subcategory.estado === "activo" ? "checked" : ""
          } onchange="toggleCategoryStatus('${
            subcategory.id
          }', 'sub', this.checked)">
                                        <label for="toggle-sub-${
                                          subcategory.id
                                        }" class="block h-7 w-14 rounded-full cursor-pointer transition-colors duration-300 ease-in-out ${
            subcategory.estado === "activo"
              ? "bg-gradient-to-r from-green-400 to-emerald-500 shadow-lg"
              : "bg-gray-300"
          }" title="Cambiar estado de la subcategoría">
                                            <span class="absolute left-1 top-1 bg-white w-5 h-5 rounded-full shadow-md transition-transform duration-300 ease-in-out ${
                                              subcategory.estado === "activo"
                                                ? "transform translate-x-7"
                                                : "transform translate-x-0"
                                            } flex items-center justify-center">
                                                ${
                                                  subcategory.estado ===
                                                  "activo"
                                                    ? `
                                                    <svg class="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                                                    </svg>
                                                `
                                                    : `
                                                    <svg class="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                                                    </svg>
                                                `
                                                }
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </td>
                            <td>${this.formatDate(subcategory.created_at)}</td>
                            <td>
                                <div class="flex">
                                    ${subcategory.estado === 'activo' ?
                                    `<button class="action-button edit" title="Editar Subcategoría" onclick="categoriesApp.editCategory('${subcategory.id}', 'sub')">
                                        <i class="fas fa-edit"></i>
                                    </button>` :
                                    `<button class="action-button edit opacity-50 cursor-not-allowed" title="Para editar, la subcategoría debe estar activa" onclick="categoriesApp.showInactiveEditMessage()">
                                        <i class="fas fa-edit"></i>
                                    </button>`
                                    }
                                </div>
                            </td>
                        </tr>
                    `;
        });
      } else {
        html =
          '<tr><td colspan="6" class="text-center py-4 text-gray-500">No se encontraron subcategorías que coincidan con los criterios de búsqueda. Por favor, ajuste los filtros o cree una nueva subcategoría.</td></tr>';
      }
    } else if (this.currentView === "pseudo") {
      if (data.seudocategorias && data.seudocategorias.length > 0) {
        data.seudocategorias.forEach((pseudocategory) => {
          html += `
                        <tr>
                            <td>${pseudocategory.nombre}</td>
                            <td>${
                              pseudocategory.subcategoria_nombre || "-"
                            }</td>
                            <td>${
                              pseudocategory.categoria_principal_nombre || "-"
                            }</td>
                            <td>
                                <div class="flex items-center">
                                    <div class="relative inline-block w-14 h-7 mr-2 align-middle select-none">
                                        <input type="checkbox" id="toggle-pseudo-${
                                          pseudocategory.id
                                        }" class="sr-only" ${
            pseudocategory.estado === "activo" ? "checked" : ""
          } onchange="toggleCategoryStatus('${
            pseudocategory.id
          }', 'pseudo', this.checked)">
                                        <label for="toggle-pseudo-${
                                          pseudocategory.id
                                        }" class="block h-7 w-14 rounded-full cursor-pointer transition-colors duration-300 ease-in-out ${
            pseudocategory.estado === "activo"
              ? "bg-gradient-to-r from-green-400 to-emerald-500 shadow-lg"
              : "bg-gray-300"
          }" title="Cambiar estado de la seudocategoría">
                                            <span class="absolute left-1 top-1 bg-white w-5 h-5 rounded-full shadow-md transition-transform duration-300 ease-in-out ${
                                              pseudocategory.estado === "activo"
                                                ? "transform translate-x-7"
                                                : "transform translate-x-0"
                                            } flex items-center justify-center">
                                                ${
                                                  pseudocategory.estado ===
                                                  "activo"
                                                    ? `
                                                    <svg class="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                                                    </svg>
                                                `
                                                    : `
                                                    <svg class="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                                                    </svg>
                                                `
                                                }
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </td>
                            <td>${this.formatDate(
                              pseudocategory.created_at
                            )}</td>
                            <td>
                                <div class="flex">
                                    ${pseudocategory.estado === 'activo' ? `
                                    <button class="action-button edit" title="Editar Seudocategoría" onclick="categoriesApp.editCategory('${pseudocategory.id}', 'pseudo')">
                                        <i class="fas fa-edit"></i>
                                    </button>` : `
                                    <button class="action-button edit opacity-50 cursor-not-allowed" title="Para editar, la seudocategoría debe estar activa" onclick="categoriesApp.showInactiveEditMessage()">
                                        <i class="fas fa-edit"></i>
                                    </button>`
                                    }
                                </div>
                            </td>
                        </tr>
                    `;
        });
      } else {
        html =
          '<tr><td colspan="6" class="text-center py-4 text-gray-500">No se encontraron seudocategorías que coincidan con los criterios de búsqueda. Por favor, ajuste los filtros o cree una nueva seudocategoría.</td></tr>';
      }
    }
    tableBody.innerHTML = html;
    tableBody.classList.remove("initial-load");
  },
  // Función para actualizar la paginación
  updatePagination: function (pagination) {
    if (!this.elements.paginationContainer) return;

    let html = "";
    // Botón Anterior
    html += `
            <button class="pagination-nav-button border border-gray-300 text-gray-700 rounded-md ${
              pagination.has_prev ? "" : "disabled"
            }"
                    onclick="categoriesApp.changePage(${
                      pagination.prev_num
                    })" ${!pagination.has_prev ? "disabled" : ""}>
                <i class="fas fa-chevron-left mr-1"></i> Anterior
            </button>
        `;
    // Botones de página
    const maxVisiblePages = 5;
    let startPage = Math.max(
      1,
      pagination.page - Math.floor(maxVisiblePages / 2)
    );
    let endPage = Math.min(pagination.pages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    if (startPage > 1) {
      html += `<button class="pagination-button border border-gray-300 text-gray-700" onclick="categoriesApp.changePage(1)">1</button>`;
      if (startPage > 2) {
        html += `<span class="px-2 text-gray-500">...</span>`;
      }
    }
    for (let i = startPage; i <= endPage; i++) {
      html += `
                <button class="pagination-button border border-gray-300 ${
                  i === pagination.page
                    ? "active bg-blue-600 text-white"
                    : "text-gray-700"
                }"
                        onclick="categoriesApp.changePage(${i})">${i}</button>
            `;
    }
    if (endPage < pagination.pages) {
      if (endPage < pagination.pages - 1) {
        html += `<span class="px-2 text-gray-500">...</span>`;
      }
      html += `<button class="pagination-button border border-gray-300 text-gray-700" onclick="categoriesApp.changePage(${pagination.pages})">${pagination.pages}</button>`;
    }
    // Botón Siguiente
    html += `
            <button class="pagination-nav-button border border-gray-300 text-gray-700 rounded-md ${
              pagination.has_next ? "" : "disabled"
            }"
                    onclick="categoriesApp.changePage(${
                      pagination.next_num
                    })" ${!pagination.has_next ? "disabled" : ""}>
                Siguiente <i class="fas fa-chevron-right ml-1"></i>
            </button>
        `;
    this.elements.paginationContainer.innerHTML = html;
  },
  // Función para actualizar la información de paginación
  updatePaginationInfo: function (data) {
    const pagination = data.pagination;
    // Use total_general for the overall total count
    const totalOverall =
      pagination.total_general !== undefined
        ? pagination.total_general
        : pagination.total;
    const currentPage = pagination.page;
    const perPage = pagination.per_page;
    let itemsDisplayed = 0;
    if (totalOverall > 0) {
      itemsDisplayed = Math.min(currentPage * perPage, totalOverall);
    }
    if (this.elements.showingTo) {
      this.elements.showingTo.textContent = itemsDisplayed;
    }
    if (this.elements.totalItems) {
      this.elements.totalItems.textContent = totalOverall;
    }
    if (this.elements.currentPageDisplay) {
      this.elements.currentPageDisplay.textContent = currentPage;
    }
    if (this.elements.totalPagesDisplay) {
      this.elements.totalPagesDisplay.textContent = pagination.pages;
    }
  },
  // Función para formatear fecha
  formatDate: function (dateString) {
    if (!dateString) return "-";

    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  },
  // Función para mostrar notificación
  showNotification: function (message, type) {
    if (window.toast) {
      window.toast[type](message);
    } else {
      console.warn(
        "window.toast no está disponible. No se puede mostrar la notificación."
      );
    }
  },
  // Función para cambiar de página
  changePage: function (page) {
    this.currentPage = page;
    if (this.currentView === "all") {
      this.loadHierarchicalCategories();
    } else {
      this.loadTableData(false);
    }
  },
  // Función para actualizar el estado de una categoría principal
  updateMainCategoryStatus: function (categoryId, newStatus) {
    fetch(`/admin/api/categorias-principales/${categoryId}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken":
          document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content") || "",
      },
      body: JSON.stringify({ estado: newStatus }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          this.showNotification(data.message, "success");
          this.loadHierarchicalCategories(); // Recargar la vista jerárquica
        } else {
          // Revertir el toggle si hubo un error
          const toggle = document.querySelector(
            `.main-category-status[data-id="${categoryId}"]`
          );
          if (toggle) {
            toggle.checked = newStatus === "inactivo";
          }
          this.showNotification(
            data.message || "Error al actualizar estado",
            "error"
          );
        }
      })
      .catch((error) => {
        console.error(
          "Error al actualizar estado de categoría principal:",
          error
        );
        this.showNotification("Error al actualizar estado", "error");
      });
  },
  // Función para actualizar el estado de una subcategoría
  updateSubcategoryStatus: function (subcategoryId, newStatus) {
    fetch(`/admin/api/subcategorias/${subcategoryId}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken":
          document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content") || "",
      },
      body: JSON.stringify({ estado: newStatus }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          this.showNotification(data.message, "success");
          this.loadHierarchicalCategories(); // Recargar la vista jerárquica
        } else {
          // Revertir el toggle si hubo un error
          const toggle = document.querySelector(
            `.subcategory-status[data-id="${subcategoryId}"]`
          );
          if (toggle) {
            toggle.checked = newStatus === "inactivo";
          }
          this.showNotification(
            data.message || "Error al actualizar estado",
            "error"
          );
        }
      })
      .catch((error) => {
        console.error("Error al actualizar estado de subcategoría:", error);
        this.showNotification("Error al actualizar estado", "error");
      });
  },
  // Función para actualizar el estado de una seudocategoría
  updatePseudocategoryStatus: function (pseudocategoryId, newStatus) {
    fetch(`/admin/api/seudocategorias/${pseudocategoryId}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken":
          document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content") || "",
      },
      body: JSON.stringify({ estado: newStatus }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          this.showNotification(data.message, "success");
          this.loadHierarchicalCategories(); // Recargar la vista jerárquica
        } else {
          // Revertir el toggle si hubo un error
          const toggle = document.querySelector(
            `.pseudocategory-status[data-id="${pseudocategoryId}"]`
          );
          if (toggle) {
            toggle.checked = newStatus === "inactivo";
          }
          this.showNotification(
            data.message || "Error al actualizar estado",
            "error"
          );
        }
      })
      .catch((error) => {
        console.error("Error al actualizar estado de seudocategoría:", error);
        this.showNotification("Error al actualizar estado", "error");
      });
  },
  // Función para ver detalles de una categoría
  viewCategory: function (categoryId, categoryType) {
    // Implementar la lógica para ver detalles
    console.log(`Ver detalles de ${categoryType} con ID: ${categoryId}`);
    this.showNotification(`Ver detalles de ${categoryType}`, "success");
  },
  // Función para editar una categoría
  editCategory: function (categoryId, categoryType) {
    const modal = document.getElementById("editCategoryModal");
    const form = document.getElementById("editCategoryForm");
    const modalTitle = document.getElementById("editModalTitle");
    const nameInput = document.getElementById("editCategoryName");
    const descriptionInput = document.getElementById("editCategoryDescription");
    const levelDisplay = document.getElementById("editCategoryLevelDisplay");
    const dynamicFields = document.getElementById("editDynamicFields");
    if (!modal || !form) return;

    // Reset and show loading state
    form.reset();
    modalTitle.textContent = "Cargando...";
    nameInput.value = "";
    descriptionInput.value = "";
    levelDisplay.innerHTML = "";
    dynamicFields.innerHTML = "";
    modal.classList.remove("hidden");
    // Store data for submission
    form.dataset.categoryId = categoryId;
    form.dataset.categoryType = categoryType;
    // Fetch category data
    fetch(`/admin/api/categoria/${categoryType}/${categoryId}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          const category = data.categoria;
          modalTitle.textContent = `Editar ${category.nivel_display}`;
          nameInput.value = category.nombre;
          descriptionInput.value = category.descripcion;
          // Display level and parent info
          levelDisplay.innerHTML = `<p class="text-sm text-gray-500 mb-2">Nivel: <span class="font-semibold text-gray-800">${category.nivel_display}</span></p>`;
          let parentInfoHtml = "";
          if (category.categoria_principal_nombre) {
            parentInfoHtml += `<p class="text-sm text-gray-500">Categoría Principal: <span class="font-semibold text-gray-800">${category.categoria_principal_nombre}</span></p>`;
          }
          if (category.subcategoria_nombre) {
            parentInfoHtml += `<p class="text-sm text-gray-500">Subcategoría: <span class="font-semibold text-gray-800">${category.subcategoria_nombre}</span></p>`;
          }
          dynamicFields.innerHTML = parentInfoHtml;
        } else {
          this.showNotification(
            data.message || "Error al cargar datos de la categoría",
            "error"
          );
          modal.classList.add("hidden");
        }
      })
      .catch((error) => {
        console.error("Error fetching category details:", error);
        this.showNotification("Error de conexión al cargar datos", "error");
        modal.classList.add("hidden");
      });
  },
  // Función para mostrar un mensaje cuando se intenta editar una categoría inactiva
  showInactiveEditMessage: function () {
    this.showNotification(
      "Para editar, la categoría debe estar activa.",
      "warning"
    );
  },
  //  Función centralizada para limpiar filtros.
  // Esto evita la duplicación de código y hace que el comportamiento sea consistente.
  clearFilters: function () {
    const nameFilter = document.getElementById("nameFilter");
    const statusFilter = document.getElementById("statusFilter");
    const mainCategoryFilter = document.getElementById("mainCategoryFilter");
    const subCategoryFilter = document.getElementById("subCategoryFilter");
    const sortFilter = document.getElementById("sortFilter");

    if (nameFilter) nameFilter.value = "";
    if (statusFilter) statusFilter.value = "all";
    if (mainCategoryFilter) mainCategoryFilter.value = "all";
    if (subCategoryFilter) subCategoryFilter.value = "all";
    // Restablecer al valor por defecto que es 'created_at' (más recientes)
    if (sortFilter) sortFilter.value = "created_at";

    // Si estamos en la vista de seudocategorías, al limpiar, debemos recargar
    // la lista completa de subcategorías en el filtro.
    if (this.currentView === "pseudo") {
      this.loadSubcategoriesForFilter();
    }
  },
  // Configurar event listeners
  setupEventListeners: function () {
    let debounceTimeout;
    const debounceLoadData = () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        this.loadTableData();
      }, 500);
    };
    // Tabs para niveles de categoría
    document.querySelectorAll(".tab-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        const btn = e.currentTarget;
        // Remover clase activa de todos los tabs
        document.querySelectorAll(".tab-btn").forEach((b) => {
          b.classList.remove("active", "border-blue-500", "text-blue-600");
          b.classList.add("border-transparent", "text-gray-500");
        });
        // Añadir clase activa al tab actual
        btn.classList.add("active", "border-blue-500", "text-blue-600");
        btn.classList.remove("border-transparent", "text-gray-500");
        // Actualizar la vista actual
        const previousView = this.currentView;
        this.currentView = btn.getAttribute("data-level");

        // Limpiar filtros si se cambia de una vista de tabla a otra.
        if (previousView !== this.currentView && this.currentView !== 'all') {
            this.clearFilters();
        }

        // Mostrar la vista correspondiente
        this.showView(this.currentView);
        // Actualizar la URL sin recargar la página
        let newPath = "/admin/lista-categorias";
        if (this.currentView === "main") {
          newPath += "/principales";
        } else if (this.currentView === "sub") {
          newPath += "/subcategorias";
        } else if (this.currentView === "pseudo") {
          newPath += "/seudocategorias";
        }
        window.history.pushState({}, "", newPath);
        // Cargar los datos según la vista
        if (this.currentView === "all") {
          this.loadHierarchicalCategories();
        } else {
          this.loadTableData();
        }
      });
    });
    // Selector de elementos por página
    const itemsPerPageSelect = document.getElementById("itemsPerPage");
    if (itemsPerPageSelect) {
      itemsPerPageSelect.addEventListener("change", (e) => {
        this.itemsPerPage = parseInt(e.target.value);
        if (this.currentView === "all") {
          this.loadHierarchicalCategories();
        } else {
          this.loadTableData();
        }
      });
    }
    // --- INICIO: Event Listeners para el NUEVO filtro ---
    const nameFilterInput = document.getElementById("nameFilter");
    if (nameFilterInput) {
      nameFilterInput.addEventListener("keyup", debounceLoadData);
    }
    const statusFilterInput = document.getElementById("statusFilter");
    if (statusFilterInput) {
      statusFilterInput.addEventListener("change", () => this.loadTableData());
    }
    const sortFilterInput = document.getElementById("sortFilter");
    if (sortFilterInput) {
      sortFilterInput.addEventListener("change", () => this.loadTableData());
    }

    //  Lógica interdependiente para filtros de categoría.
    const mainCategoryFilter = document.getElementById("mainCategoryFilter");
    const subCategoryFilter = document.getElementById("subCategoryFilter");

    if (mainCategoryFilter) {
      mainCategoryFilter.addEventListener("change", () => {
        // Este evento ahora solo se dispara cuando el USUARIO cambia manualmente la categoría principal.
        const mainCategoryId = mainCategoryFilter.value;
        if (this.currentView === "pseudo") {
          // Al cambiar la categoría principal, recargar las subcategorías correspondientes.
          this.loadSubcategoriesForFilter(mainCategoryId);
        }
        // Cuando el usuario elige una categoría principal, tiene sentido resetear la subcategoría
        // para evitar un estado de filtro inconsistente.
        if (subCategoryFilter) subCategoryFilter.value = "all";
        // Recargar la tabla con el nuevo filtro principal.
        this.loadTableData();
      });
    }

    if (subCategoryFilter) {
      subCategoryFilter.addEventListener("change", () => {
        const subcategoryId = subCategoryFilter.value;
        if (subcategoryId && subcategoryId !== "all") {
          // Si se selecciona una subcategoría, buscar su padre y seleccionarlo.
          fetch(`/admin/api/subcategorias/${subcategoryId}/detalles-filtro`)
            .then((res) => res.json())
            .then((data) => {
              if (data.success && mainCategoryFilter) {
                // Auto-seleccionar la categoría principal padre.
                // NO se dispara el evento 'change' del mainCategoryFilter.
                mainCategoryFilter.value = data.subcategoria.categoria_principal_id;
              }
            })
            .catch((err) => {
              console.error("Error al obtener detalles del padre:", err);
            })
            .finally(() => this.loadTableData()); // Cargar tabla después de la operación.
        } else {
          // Si se selecciona "Todas", simplemente recargar.
          this.loadTableData();
        }
      });
    }

    const clearFiltersBtn = document.getElementById("clearFilters");
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", () => {
        // Usar la nueva función centralizada
        this.clearFilters();
        this.loadTableData();
      });
    }
    const clearFiltersViewBtn = document.getElementById("clearFiltersViewBtn");
    if (clearFiltersViewBtn) {
      clearFiltersViewBtn.addEventListener("click", () => {
        this.clearFilters();
        this.loadTableData();
      });
    }
    // --- FIN: Event Listeners para el NUEVO filtro ---
    // Modal para añadir/editar categoría
    const modal = document.getElementById("categoryModal");
    const addCategoryBtn = document.getElementById("addCategoryBtn");
    const closeModal = document.getElementById("closeModal");
    const cancelBtn = document.getElementById("cancelBtn");
    const categoryForm = document.getElementById("categoryForm");
    const categoryLevel = document.getElementById("categoryLevel");
    const mainCategoryModalSelect = document.getElementById("mainCategory");

    // Mover el listener del select de categoría principal aquí para que se adjunte una sola vez
    if (mainCategoryModalSelect) {
      mainCategoryModalSelect.addEventListener("change", () => {
        // Solo cargar si el nivel es 'pseudo'
        const level = document.getElementById("categoryLevel")?.value;
        if (level === "pseudo") {
          this.loadSubcategoriesForModal();
        }
      });
    }

    if (addCategoryBtn) {
      addCategoryBtn.addEventListener("click", () => {
        if (modal) {
          modal.classList.remove("hidden");
          const modalTitle = document.getElementById("modalTitle");
          if (modalTitle) modalTitle.textContent = "Agregar Nueva Categoría";

          if (categoryForm) categoryForm.reset();

          this.updateDynamicFields();
        }
      });
    }
    if (closeModal) {
      closeModal.addEventListener("click", () => {
        if (modal) modal.classList.add("hidden");
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        if (modal) modal.classList.add("hidden");
      });
    }
    if (categoryLevel) {
      categoryLevel.addEventListener("change", () =>
        this.updateDynamicFields()
      );
    }
    if (categoryForm) {
      categoryForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById("submitBtn");
        const submitText = submitBtn.querySelector(".submit-text");
        const spinner = submitBtn.querySelector(".loading-spinner");

        // Obtener datos del formulario
        const categoryName = document.getElementById("categoryName");
        const categoryDescription = document.getElementById(
          "categoryDescription"
        );
        const mainCategory = document.getElementById("mainCategory");
        const subCategory = document.getElementById("subCategory");
        const formData = {
          nombre: categoryName ? categoryName.value : "",
          descripcion: categoryDescription ? categoryDescription.value : "",
          nivel: categoryLevel ? categoryLevel.value : "main",
        };
        // Agregar campos según el nivel
        if (formData.nivel === "sub" && mainCategory) {
          formData.categoria_principal_id = mainCategory.value;
        } else if (formData.nivel === "pseudo" && mainCategory && subCategory) {
          formData.categoria_principal_id = mainCategory.value;
          formData.subcategoria_id = subCategory.value;
        }
        // Lógica para guardar la categoría
        let apiUrl = "";
        let successMessage = "";
        let errorMessage = "Error al guardar la categoría";
        if (formData.nivel === "main") {
          apiUrl = "/admin/api/categorias-principales";
          successMessage = "Categoría principal creada correctamente";
        } else if (formData.nivel === "sub") {
          apiUrl = "/admin/api/subcategorias";
          successMessage = "Subcategoría creada correctamente";
        } else if (formData.nivel === "pseudo") {
          apiUrl = "/admin/api/seudocategorias";
          successMessage = "Seudocategoría creada correctamente";
        }
        // Mostrar estado de carga
        submitBtn.disabled = true;
        if (submitText) submitText.classList.add("hidden");
        if (spinner) spinner.classList.remove("hidden");

        fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": document.querySelector('meta[name="csrf-token"]')
              ? document
                  .querySelector('meta[name="csrf-token"]')
                  .getAttribute("content")
              : "",
          },
          body: JSON.stringify(formData),
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.success) {
              this.showNotification(successMessage, "success");
              // Recargar los datos según la vista actual
              if (this.currentView === "all") {
                this.loadHierarchicalCategories();
              } else {
                this.loadTableData();
              }
              // Cerrar modal
              if (modal) modal.classList.add("hidden");
            } else {
              this.showNotification(data.message || errorMessage, "error");
            }
          })
          .catch((error) => {
            console.error("Error al guardar categoría:", error);
            this.showNotification(errorMessage, "error");
          })
          .finally(() => {
            submitBtn.disabled = false;
            if (submitText) submitText.classList.remove("hidden");
            if (spinner) spinner.classList.add("hidden");
          });
      });
    }
    // --- INICIO: Event Listeners para el modal de EDICIÓN ---
    const editModal = document.getElementById("editCategoryModal");
    const editForm = document.getElementById("editCategoryForm");
    const closeEditModalBtn = document.getElementById("closeEditModal");
    const cancelEditBtn = document.getElementById("editCancelBtn");
    if (editModal && editForm && closeEditModalBtn && cancelEditBtn) {
      const closeModal = () => editModal.classList.add("hidden");
      closeEditModalBtn.addEventListener("click", closeModal);
      cancelEditBtn.addEventListener("click", closeModal);
      editForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const categoryId = editForm.dataset.categoryId;
        const categoryType = editForm.dataset.categoryType;
        const nombre = document.getElementById("editCategoryName").value;
        const descripcion = document.getElementById(
          "editCategoryDescription"
        ).value;
        const submitBtn = document.getElementById("editSubmitBtn");
        const submitText = submitBtn.querySelector(".submit-text");
        const spinner = submitBtn.querySelector(".loading-spinner");

        if (!categoryId || !categoryType) return;

        submitBtn.disabled = true;
        submitText.classList.add("hidden");
        spinner.classList.remove("hidden");

        fetch(`/admin/api/categoria/${categoryType}/${categoryId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": document
              .querySelector('meta[name="csrf-token"]')
              .getAttribute("content"),
          },
          body: JSON.stringify({ nombre, descripcion }),
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.success) {
              this.showNotification(data.message, "success");
              closeModal();
              // Refresh data
              if (this.currentView === "all") {
                this.loadHierarchicalCategories();
              } else {
                this.loadTableData();
              }
            } else {
              this.showNotification(
                data.message || "Error al guardar los cambios",
                "error"
              );
            }
          })
          .catch((error) => {
            console.error("Error updating category:", error);
            this.showNotification("Error de conexión al guardar", "error");
          })
          .finally(() => {
            submitBtn.disabled = false;
            submitText.classList.remove("hidden");
            spinner.classList.add("hidden");
          });
      });
    }
    // --- FIN: Event Listeners para el modal de EDICIÓN ---
  },
  // Función para actualizar campos dinámicos
  updateDynamicFields: function () {
    const categoryLevel = document.getElementById("categoryLevel");
    const mainCategoryContainer = document.getElementById(
      "mainCategoryContainer"
    );
    const subCategoryContainer = document.getElementById(
      "subCategoryContainer"
    );
    const mainCategorySelect = document.getElementById("mainCategory");
    const subCategorySelect = document.getElementById("subCategory");

    if (
      !categoryLevel ||
      !mainCategoryContainer ||
      !subCategoryContainer ||
      !mainCategorySelect ||
      !subCategorySelect
    )
      return;

    const level = categoryLevel.value;

    // Reset state
    mainCategoryContainer.classList.add("hidden");
    subCategoryContainer.classList.add("hidden");
    mainCategorySelect.required = false;
    subCategorySelect.required = false;
    subCategorySelect.disabled = true; // Deshabilitar por defecto al cambiar de nivel

    if (level === "sub") {
      // Mostrar campo de categoría principal
      mainCategoryContainer.classList.remove("hidden");
      mainCategoryContainer.classList.add("field-enter");
      mainCategorySelect.required = true;
      this.loadMainCategoriesForModal();
    } else if (level === "pseudo") {
      // Mostrar ambos campos
      mainCategoryContainer.classList.remove("hidden");
      mainCategoryContainer.classList.add("field-enter");
      mainCategorySelect.required = true;

      subCategoryContainer.classList.remove("hidden");
      subCategoryContainer.classList.add("field-enter");
      subCategorySelect.required = true;

      // Mantener el campo de subcategoría deshabilitado y con un mensaje
      subCategorySelect.disabled = true;
      subCategorySelect.innerHTML =
        '<option value="">Seleccione primero una categoría principal</option>';

      this.loadMainCategoriesForModal();
      // El evento 'change' en mainCategorySelect (adjuntado en setupEventListeners) cargará las subcategorías
    }
  },
  // Función para cargar categorías principales para el modal
  loadMainCategoriesForModal: function () {
    const mainCategorySelect = document.getElementById("mainCategory");
    if (!mainCategorySelect) return;

    // Limpiar opciones actuales
    mainCategorySelect.innerHTML =
      '<option value="">Seleccionar categoría principal</option>';
    // Obtener categorías principales del servidor
    fetch("/admin/api/categorias-principales/filter?per_page=100&estado=activo")
      .then((response) => response.json())
      .then((data) => {
        if (data.success && data.categorias) {
          data.categorias.forEach((category) => {
            const option = document.createElement("option");
            option.value = category.id;
            option.textContent = category.nombre;
            mainCategorySelect.appendChild(option);
          });
        }
      })
      .catch((error) => {
        console.error("Error al cargar categorías principales:", error);
        this.showNotification(
          "Error al cargar categorías principales",
          "error"
        );
      });
  },
  // Función para cargar subcategorías para el modal
  loadSubcategoriesForModal: function () {
    const mainCategoryId = document.getElementById("mainCategory")?.value;
    const subCategorySelect = document.getElementById("subCategory");
    if (!subCategorySelect) return;

    // Limpiar opciones actuales
    if (mainCategoryId) {
      // Si se ha seleccionado una categoría principal
      // Habilitar el select y mostrar un estado de carga
      subCategorySelect.disabled = false;
      subCategorySelect.innerHTML = '<option value="">Cargando...</option>';

      // Obtener subcategorías del servidor (solo las activas)
      fetch(
        `/admin/api/categorias-principales/${mainCategoryId}/subcategorias?estado=activo`
      )
        .then((response) => response.json())
        .then((data) => {
          // Limpiar el select antes de poblarlo
          subCategorySelect.innerHTML =
            '<option value="">Seleccionar subcategoría</option>';
          if (
            data.success &&
            data.subcategorias &&
            data.subcategorias.length > 0
          ) {
            data.subcategorias.forEach((subcategory) => {
              const option = document.createElement("option");
              option.value = subcategory.id;
              option.textContent = subcategory.nombre;
              subCategorySelect.appendChild(option);
            });
          } else {
            // Si no hay subcategorías, mostrar un mensaje y deshabilitar
            subCategorySelect.innerHTML =
              '<option value="">No hay subcategorías activas</option>';
            subCategorySelect.disabled = true;
          }
        })
        .catch((error) => {
          console.error("Error al cargar subcategorías:", error);
          this.showNotification("Error al cargar subcategorías", "error");
          subCategorySelect.innerHTML =
            '<option value="">Error al cargar</option>';
          subCategorySelect.disabled = true;
        });
    } else {
      // Si no se ha seleccionado una categoría principal, deshabilitar y mostrar mensaje
      subCategorySelect.disabled = true;
      subCategorySelect.innerHTML =
        '<option value="">Seleccione primero una categoría principal</option>';
    }
  },
};
// Función global para cambiar de página (para compatibilidad con botones generados dinámicamente)
function changePage(page) {
  categoriesApp.changePage(page);
}
// Función para mostrar/ocultar el panel de filtros
function toggleFilters() {
  const panel = document.getElementById("filtersPanel");
  const overlay = document.getElementById("overlay");
  panel.classList.toggle("translate-x-full");
  overlay.classList.toggle("hidden");
  if (!panel.classList.contains("translate-x-full")) {
    document.body.classList.add("overflow-hidden");
  } else {
    document.body.classList.remove("overflow-hidden");
  }
}
