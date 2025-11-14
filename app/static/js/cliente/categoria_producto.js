/**
 * Módulo de Página de Categoría Principal.
 *
 * Este script gestiona la lógica interactiva de la página de listado de productos
 * para una categoría principal específica. Permite a los usuarios explorar, filtrar y
 * ordenar productos de manera dinámica y eficiente.
 *
 * Funcionalidades Clave:
 * 1.  **Gestión de Estado de Filtros:** Mantiene un objeto `currentFilters` para rastrear
 *     las selecciones del usuario en subcategorías, pseudocategorías, marcas, rango de
 *     precios y ordenamiento.
 * 2.  **Filtros Dinámicos y Contextuales:** Carga de forma asíncrona las opciones de filtro
 *     (subcategorías, marcas, etc.) desde el backend, asegurando que solo se muestren
 *     las opciones relevantes para la selección actual.
 * 3.  **Renderizado Asíncrono de Productos:** Utiliza `fetch` para obtener y mostrar
 *     productos que coinciden con los filtros seleccionados sin necesidad de recargar la página.
 * 4.  **Control de UI Avanzado:**
 *     - Gestiona un panel de filtros deslizable ("drawer") para una experiencia de usuario
 *       limpia en dispositivos móviles y de escritorio.
 *     - Actualiza dinámicamente el título de la página, la descripción y los "breadcrumbs"
 *       para reflejar el contexto de navegación actual.
 *     - Muestra etiquetas de "filtros aplicados" que permiten al usuario eliminar
 *       filtros individualmente.
 * 5.  **Paginación "Cargar Más":** Implementa un sistema de paginación simple y efectivo
 *     que permite al usuario cargar más productos bajo demanda.
 * 6.  **Optimización de Rendimiento:** Utiliza una función `debounce` para los filtros de
 *     rango de precios, evitando peticiones excesivas a la API mientras el usuario ajusta los valores.
 */
document.addEventListener("DOMContentLoaded", function () {
  // Estado inicial de los filtros
  let currentFilters = {
    categoria_principal: window.appData.categoriaPrincipal.nombre,
    subcategoria: 'all',
    pseudocategoria: 'all',
    marca: 'all',
    min_price: '',
    max_price: '',
    genero: 'all',
    funcion: 'all',
    ingrediente_clave: 'all',
    resistente_al_agua: 'all',
    ordenar_por: 'newest'
  };

  // Elementos del DOM
  const productGrid = document.getElementById("product-grid");
  const productGridLoader = document.getElementById("product-grid-loader");
  const productListingContainer = document.getElementById("product-listing-container");
  const noResultsMessage = document.getElementById("no-results-message");
  const categoryTitle = document.getElementById("category-title");
  const categoryDescription = document.getElementById("category-description");
  const breadcrumbs = document.getElementById("breadcrumbs");
  const productCount = document.getElementById("product-count");
  const totalProductCount = document.getElementById("total-product-count");
  
  // Filtros
  const subcategoryFilters = document.getElementById("subcategory-filters-content");
  const pseudocategoryFilters = document.getElementById("pseudocategory-filters-content");
  const brandFilters = document.getElementById("brand-filters-content");
  const genderFilterSection = document.getElementById("gender-filter-section");
  const genderFilters = document.getElementById("gender-filters-content");
  const functionFilterSection = document.getElementById("function-filter-section");
  const functionFilters = document.getElementById("function-filters-content");
  const ingredientFilterSection = document.getElementById("ingredient-filter-section");
  const ingredientFilters = document.getElementById("ingredient-filters-content");
  const waterproofFilterSection = document.getElementById("waterproof-filter-section");
  const waterproofFilters = document.getElementById("waterproof-filters-content");
  const sortSelect = document.getElementById("sort-select");
  const minPriceInput = document.getElementById("min-price");
  const maxPriceInput = document.getElementById("max-price");
  const minPriceLabel = document.getElementById("min-price-label");
  const maxPriceLabel = document.getElementById("max-price-label");
  
  // Botones
  const clearFiltersBtn = document.getElementById("clear-filters");
  const resetFiltersBtn = document.getElementById("reset-filters");
  const loadMoreBtn = document.getElementById("load-more-btn");
  const showLessBtn = document.getElementById("show-less-btn");
  
  // Drawer
  const filterDrawer = document.getElementById("filter-drawer");
  const filterBtn = document.getElementById("filter-btn");
  const closeFilterBtn = document.getElementById("close-filter-btn");
  const applyFiltersBtn = document.getElementById("apply-filters");
  const filterModalOverlay = document.getElementById("filter-modal-overlay");

  // Contenedor de etiquetas de filtros aplicados
  const appliedFiltersContainer = document.getElementById("applied-filters");
  
  let allProducts = [];
  const productsPerPage = 12;
  let currentDisplayedProducts = 0;
  let isFetching = false;
  let isUpdatingFilters = false; // Nueva bandera para evitar actualizaciones simultáneas

  // Inicialización
  async function init() {
    // Configurar event listeners
    setupEventListeners();
    // Mostrar filtros de especificaciones si aplican
    initializeSpecificationFilters();
    
    // Cargar datos iniciales
    await updateAllFilters();
    await fetchProductsWithFilters();
    await fetchAndSetPriceRange();
  }

  function setupEventListeners() {
    // Toggle para los filtros del drawer
    document.querySelectorAll(".filter-toggle").forEach((header) => {
      header.addEventListener("click", () => {
        const targetId = header.dataset.target;
        const content = document.getElementById(targetId);
        const icon = header.querySelector("i");

        if (content.classList.contains("hidden")) {
          content.classList.remove("hidden");
          icon.classList.remove("rotate-0");
          icon.classList.add("rotate-180");
        } else {
          content.classList.add("hidden");
          icon.classList.remove("rotate-180");
          icon.classList.add("rotate-0");
        }
      });
    });

    // Event listeners para el drawer de filtros
    if (filterBtn) filterBtn.addEventListener("click", () => toggleFilterDrawer(true));
    if (closeFilterBtn) closeFilterBtn.addEventListener("click", () => toggleFilterDrawer(false));
    if (filterModalOverlay) filterModalOverlay.addEventListener("click", () => toggleFilterDrawer(false));
    if (filterDrawer) filterDrawer.addEventListener("click", (event) => event.stopPropagation());

    // Event listener para aplicar filtros desde el drawer
    if (applyFiltersBtn) {
      applyFiltersBtn.addEventListener("click", () => {
        // Obtener valores seleccionados en el drawer
        currentFilters.subcategoria = filterDrawer.querySelector('input[name="subcategory"]:checked')?.value || "all";
        currentFilters.pseudocategoria = filterDrawer.querySelector('input[name="pseudocategory"]:checked')?.value || "all";
        currentFilters.marca = filterDrawer.querySelector('input[name="brand"]:checked')?.value || "all";
        currentFilters.genero = filterDrawer.querySelector('input[name="gender"]:checked')?.value || "all";
        currentFilters.funcion = filterDrawer.querySelector('input[name="function"]:checked')?.value || "all";
        currentFilters.ingrediente_clave = filterDrawer.querySelector('input[name="ingredient"]:checked')?.value || "all";
        currentFilters.resistente_al_agua = filterDrawer.querySelector('input[name="waterproof"]:checked')?.value || "all";
        
        // Aplicar los cambios
        applyFilters();
        toggleFilterDrawer(false);
      });
    }

    // Event listener para restablecer filtros desde el drawer
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener("click", () => {
        resetAllFilters();
        toggleFilterDrawer(false);
      });
    }

    // Event listeners para los inputs de precio
    if (minPriceInput) {
      minPriceInput.addEventListener("change", () => {
        updatePriceLabels();
        applyFilters();
      });
    }
    
    if (maxPriceInput) {
      maxPriceInput.addEventListener("change", () => {
        updatePriceLabels();
        applyFilters();
      });
    }

    // Event listener para el ordenamiento
    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        currentFilters.ordenar_por = sortSelect.value;
        fetchProductsWithFilters();
      });
    }

    // Event listener para limpiar filtros
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", resetAllFilters);
    }

    // Load More / Show Less functionality
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", loadMoreProducts);
    }

    if (showLessBtn) {
      showLessBtn.addEventListener("click", showLessProducts);
    }

    // Event listener para el botón de limpiar búsqueda en no resultados
    const clearSearchBtn = document.getElementById("clear-search-btn");
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener("click", resetAllFilters);
    }
  }

  // Función para abrir/cerrar el drawer de filtros
  function toggleFilterDrawer(forceOpen = null) {
    const isOpen = filterDrawer.classList.contains("open");
    const shouldOpen = forceOpen !== null ? forceOpen : !isOpen;

    if (shouldOpen) {
      filterModalOverlay.classList.remove("hidden");
      if (filterDrawer.classList.contains("hidden")) {
        filterDrawer.classList.remove("hidden");
        void filterDrawer.offsetWidth;
      }
      filterDrawer.classList.add("open");
      syncFiltersWithCurrentValues();
    } else {
      filterDrawer.classList.remove("open");
      filterModalOverlay.classList.add("hidden");
    }
  }

  // Sincronizar los filtros del drawer con los valores actuales
  function syncFiltersWithCurrentValues() {
    // Sincronizar subcategorías
    const subcategoryInput = filterDrawer.querySelector(`input[name="subcategory"][value="${currentFilters.subcategoria}"]`);
    if (subcategoryInput) subcategoryInput.checked = true;
    
    // Sincronizar pseudocategorías
    const pseudocategoryInput = filterDrawer.querySelector(`input[name="pseudocategory"][value="${currentFilters.pseudocategoria}"]`);
    if (pseudocategoryInput) pseudocategoryInput.checked = true;

    // Sincronizar marcas
    const brandInput = filterDrawer.querySelector(`input[name="brand"][value="${currentFilters.marca}"]`);
    if (brandInput) brandInput.checked = true;

    // Sincronizar género
    const genderInput = filterDrawer.querySelector(`input[name="gender"][value="${currentFilters.genero}"]`);
    if (genderInput) genderInput.checked = true;

    // Sincronizar función
    const functionInput = filterDrawer.querySelector(`input[name="function"][value="${currentFilters.funcion}"]`);
    if (functionInput) functionInput.checked = true;

    // Sincronizar ingrediente clave
    const ingredientInput = filterDrawer.querySelector(`input[name="ingredient"][value="${currentFilters.ingrediente_clave}"]`);
    if (ingredientInput) ingredientInput.checked = true;

    // Sincronizar resistente al agua
    const waterproofInput = filterDrawer.querySelector(`input[name="waterproof"][value="${currentFilters.resistente_al_agua}"]`);
    if (waterproofInput) waterproofInput.checked = true;
    
    // Sincronizar precios
    minPriceInput.value = currentFilters.min_price || '';
    maxPriceInput.value = currentFilters.max_price || '';
    
    // Actualizar etiquetas de precio
    updatePriceLabels();
  }

  // Actualizar etiquetas de precio
  function updatePriceLabels() {
    minPriceLabel.textContent = minPriceInput.value ? `$${minPriceInput.value}` : '$0';
    maxPriceLabel.textContent = maxPriceInput.value ? `$${maxPriceInput.value}` : '$0';
  }

  // Función para mostrar los filtros de especificaciones si hay opciones
  function initializeSpecificationFilters() {
    if (window.appData.generos && window.appData.generos.length > 0) {
      genderFilterSection.classList.remove('hidden');
    }
    if (window.appData.funciones && window.appData.funciones.length > 0) {
      functionFilterSection.classList.remove('hidden');
      // Como las funciones se cargan dinámicamente, las poblamos aquí
      updateFunctionFilters();
    }
    if (window.appData.ingredientes_clave && window.appData.ingredientes_clave.length > 0) {
      ingredientFilterSection.classList.remove('hidden');
      // Poblamos los ingredientes clave
      updateIngredientFilters();
    }
    if (window.appData.resistente_al_agua && window.appData.resistente_al_agua.length > 0) {
      waterproofFilterSection.classList.remove('hidden');
      // Poblamos las opciones de resistencia al agua
      updateWaterproofFilters();
    }
  }


  // Función para actualizar todos los filtros (subcategorías, seudocategorías, marcas)
  async function updateAllFilters() {
    if (isUpdatingFilters) return;
    isUpdatingFilters = true;
    
    try {
      await Promise.all([
        updateSubcategoryFilters(),
        updatePseudocategoryFilters(),
        updateBrandFilters(),
        updateGenderFilters(),
        updateFunctionFilters(),
        updateIngredientFilters(),
        updateWaterproofFilters()
      ]);
      updateAppliedFiltersTags();
    } catch (error) {
      console.error('Error al actualizar filtros:', error);
    } finally {
      isUpdatingFilters = false;
    }
  }

  // Función para actualizar las opciones de subcategoría
  async function updateSubcategoryFilters() {
    try {
      const params = new URLSearchParams();
      if (currentFilters.categoria_principal) params.append('categoria_principal', currentFilters.categoria_principal);
      if (currentFilters.marca && currentFilters.marca !== 'all') params.append('marca', currentFilters.marca);
      if (currentFilters.genero && currentFilters.genero !== 'all') params.append('genero', currentFilters.genero);
      if (currentFilters.funcion && currentFilters.funcion !== 'all') params.append('funcion', currentFilters.funcion);
      if (currentFilters.ingrediente_clave && currentFilters.ingrediente_clave !== 'all') params.append('ingrediente_clave', currentFilters.ingrediente_clave);
      if (currentFilters.resistente_al_agua && currentFilters.resistente_al_agua !== 'all') params.append('resistente_al_agua', currentFilters.resistente_al_agua);
      if (currentFilters.pseudocategoria && currentFilters.pseudocategoria !== 'all') params.append('seudocategoria', currentFilters.pseudocategoria);
      
      const response = await fetch(`/api/filtros/subcategorias?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const subcategorias = await response.json();
      
      const targetElement = subcategoryFilters;
      targetElement.innerHTML = "";

      const allOptionHtml = `
        <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
          <input
            type="radio"
            name="subcategory"
            value="all"
            class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300"
            ${currentFilters.subcategoria === 'all' ? 'checked' : ''}
          />
          <span class="ml-3 text-gray-700 font-medium">Todas las subcategorías</span>
        </label>
      `;
      targetElement.insertAdjacentHTML("beforeend", allOptionHtml);

      subcategorias.forEach((sub) => {
        const subcategoryHtml = `
          <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
            <input
              type="radio"
              name="subcategory"
              value="${sub.nombre}"
              class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300"
              ${currentFilters.subcategoria === sub.nombre ? 'checked' : ''}
            />
            <span class="ml-3 text-gray-700">${sub.nombre}</span>
          </label>
        `;
        targetElement.insertAdjacentHTML("beforeend", subcategoryHtml);
      });

      // Agregar event listeners a los nuevos inputs
      targetElement.querySelectorAll('input[name="subcategory"]').forEach(input => {
        input.addEventListener('change', (e) => {
          currentFilters.subcategoria = e.target.value;
          applyFilters();
        });
      });
    } catch (error) {
      console.error('Error al actualizar subcategorías:', error);
      // En caso de error, mostrar todas las subcategorías disponibles
      showAllSubcategories();
    }
  }

  // Función para mostrar todas las subcategorías disponibles
  function showAllSubcategories() {
    const targetElement = subcategoryFilters;
    targetElement.innerHTML = "";

    const allOptionHtml = `
      <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
        <input
          type="radio"
          name="subcategory"
          value="all"
          class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300"
          ${currentFilters.subcategoria === 'all' ? 'checked' : ''}
        />
        <span class="ml-3 text-gray-700 font-medium">Todas las subcategorías</span>
      </label>
    `;
    targetElement.insertAdjacentHTML("beforeend", allOptionHtml);

    // Mostrar todas las subcategorías disponibles en window.appData
    if (window.appData.subcategorias) {
      window.appData.subcategorias.forEach((sub) => {
        const subcategoryHtml = `
          <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
            <input
              type="radio"
              name="subcategory"
              value="${sub.nombre}"
              class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300"
              ${currentFilters.subcategoria === sub.nombre ? 'checked' : ''}
            />
            <span class="ml-3 text-gray-700">${sub.nombre}</span>
          </label>
        `;
        targetElement.insertAdjacentHTML("beforeend", subcategoryHtml);
      });

      // Agregar event listeners a los nuevos inputs
      targetElement.querySelectorAll('input[name="subcategory"]').forEach(input => {
        input.addEventListener('change', (e) => {
          currentFilters.subcategoria = e.target.value;
          applyFilters();
        });
      });
    }
  }

  // Función para actualizar las opciones de seudocategoría
  async function updatePseudocategoryFilters() {
    try {
      const params = new URLSearchParams();
      if (currentFilters.categoria_principal) params.append('categoria_principal', currentFilters.categoria_principal);
      if (currentFilters.subcategoria && currentFilters.subcategoria !== 'all') params.append('subcategoria', currentFilters.subcategoria);
      if (currentFilters.genero && currentFilters.genero !== 'all') params.append('genero', currentFilters.genero);
      if (currentFilters.funcion && currentFilters.funcion !== 'all') params.append('funcion', currentFilters.funcion);
      if (currentFilters.ingrediente_clave && currentFilters.ingrediente_clave !== 'all') params.append('ingrediente_clave', currentFilters.ingrediente_clave);
      if (currentFilters.resistente_al_agua && currentFilters.resistente_al_agua !== 'all') params.append('resistente_al_agua', currentFilters.resistente_al_agua);
      if (currentFilters.marca && currentFilters.marca !== 'all') params.append('marca', currentFilters.marca);
      
      const response = await fetch(`/api/filtros/seudocategorias?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const seudocategorias = await response.json();
      
      const targetElement = pseudocategoryFilters;
      targetElement.innerHTML = "";

      const allOptionHtml = `
        <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
          <input
            type="radio"
            name="pseudocategory"
            value="all"
            class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300"
            ${currentFilters.pseudocategoria === 'all' ? 'checked' : ''}
          />
          <span class="ml-3 text-gray-700 font-medium">Todas las pseudocategorías</span>
        </label>
      `;
      targetElement.insertAdjacentHTML("beforeend", allOptionHtml);

      seudocategorias.forEach((pseudo) => {
        const pseudocategoryHtml = `
          <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
            <input
              type="radio"
              name="pseudocategory"
              value="${pseudo.nombre}"
              class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300"
              ${currentFilters.pseudocategoria === pseudo.nombre ? 'checked' : ''}
            />
            <span class="ml-3 text-gray-700">${pseudo.nombre}</span>
          </label>
        `;
        targetElement.insertAdjacentHTML("beforeend", pseudocategoryHtml);
      });

      // Agregar event listeners a los nuevos inputs
      targetElement.querySelectorAll('input[name="pseudocategory"]').forEach(input => {
        input.addEventListener('change', (e) => {
          currentFilters.pseudocategoria = e.target.value;
          applyFilters();
        });
      });
    } catch (error) {
      console.error('Error al actualizar seudocategorías:', error);
      // En caso de error, mostrar todas las seudocategorías disponibles
      showAllPseudocategories();
    }
  }

  // Función para mostrar todas las seudocategorías disponibles
  function showAllPseudocategories() {
    const targetElement = pseudocategoryFilters;
    targetElement.innerHTML = "";

    const allOptionHtml = `
      <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
        <input
          type="radio"
          name="pseudocategory"
          value="all"
          class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300"
          ${currentFilters.pseudocategoria === 'all' ? 'checked' : ''}
        />
        <span class="ml-3 text-gray-700 font-medium">Todas las pseudocategorías</span>
      </label>
    `;
    targetElement.insertAdjacentHTML("beforeend", allOptionHtml);

    // Mostrar todas las seudocategorías disponibles en window.appData
    if (window.appData.seudocategorias) {
      window.appData.seudocategorias.forEach((pseudo) => {
        const pseudocategoryHtml = `
          <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
            <input
              type="radio"
              name="pseudocategory"
              value="${pseudo.nombre}"
              class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300"
              ${currentFilters.pseudocategoria === pseudo.nombre ? 'checked' : ''}
            />
            <span class="ml-3 text-gray-700">${pseudo.nombre}</span>
          </label>
        `;
        targetElement.insertAdjacentHTML("beforeend", pseudocategoryHtml);
      });

      // Agregar event listeners a los nuevos inputs
      targetElement.querySelectorAll('input[name="pseudocategory"]').forEach(input => {
        input.addEventListener('change', (e) => {
          currentFilters.pseudocategoria = e.target.value;
          applyFilters();
        });
      });
    }
  }

  // Función para actualizar las opciones de marcas
  async function updateBrandFilters() {
    try {
      const params = new URLSearchParams();
      if (currentFilters.categoria_principal) params.append('categoria_principal', currentFilters.categoria_principal);
      if (currentFilters.subcategoria && currentFilters.subcategoria !== 'all') params.append('subcategoria', currentFilters.subcategoria);
      if (currentFilters.genero && currentFilters.genero !== 'all') params.append('genero', currentFilters.genero);
      if (currentFilters.funcion && currentFilters.funcion !== 'all') params.append('funcion', currentFilters.funcion);
      if (currentFilters.ingrediente_clave && currentFilters.ingrediente_clave !== 'all') params.append('ingrediente_clave', currentFilters.ingrediente_clave);
      if (currentFilters.resistente_al_agua && currentFilters.resistente_al_agua !== 'all') params.append('resistente_al_agua', currentFilters.resistente_al_agua);
      if (currentFilters.pseudocategoria && currentFilters.pseudocategoria !== 'all') params.append('seudocategoria', currentFilters.pseudocategoria);
      
      const response = await fetch(`/api/filtros/marcas?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const marcas = await response.json();
      
      const targetElement = brandFilters;
      targetElement.innerHTML = "";

      const allOptionHtml = `
        <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
          <input
            type="radio"
            name="brand"
            value="all"
            class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300"
            ${currentFilters.marca === 'all' ? 'checked' : ''}
          />
          <span class="ml-3 text-gray-700 font-medium">Todas las marcas</span>
        </label>
      `;
      targetElement.insertAdjacentHTML("beforeend", allOptionHtml);

      marcas.forEach((marca) => {
        const brandHtml = `
          <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
            <input
              type="radio"
              name="brand"
              value="${marca}"
              class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300"
              ${currentFilters.marca === marca ? 'checked' : ''}
            />
            <span class="ml-3 text-gray-700">${marca}</span>
          </label>
        `;
        targetElement.insertAdjacentHTML("beforeend", brandHtml);
      });

      // Agregar event listeners a los nuevos inputs
      targetElement.querySelectorAll('input[name="brand"]').forEach(input => {
        input.addEventListener('change', (e) => {
          currentFilters.marca = e.target.value;
          applyFilters();
        });
      });
    } catch (error) {
      console.error('Error al actualizar marcas:', error);
      // En caso de error, mostrar todas las marcas disponibles
      showAllBrands();
    }
  }

  // Función para mostrar todas las marcas disponibles
  function showAllBrands() {
    const targetElement = brandFilters;
    targetElement.innerHTML = "";

    const allOptionHtml = `
      <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
        <input
          type="radio"
          name="brand"
          value="all"
          class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300"
          ${currentFilters.marca === 'all' ? 'checked' : ''}
        />
        <span class="ml-3 text-gray-700 font-medium">Todas las marcas</span>
      </label>
    `;
    targetElement.insertAdjacentHTML("beforeend", allOptionHtml);

    // Mostrar todas las marcas disponibles en window.appData
    if (window.appData.marcas) {
      window.appData.marcas.forEach((marca) => {
        const brandHtml = `
          <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
            <input
              type="radio"
              name="brand"
              value="${marca}"
              class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300"
              ${currentFilters.marca === marca ? 'checked' : ''}
            />
            <span class="ml-3 text-gray-700">${marca}</span>
          </label>
        `;
        targetElement.insertAdjacentHTML("beforeend", brandHtml);
      });

      // Agregar event listeners a los nuevos inputs
      targetElement.querySelectorAll('input[name="brand"]').forEach(input => {
        input.addEventListener('change', (e) => {
          currentFilters.marca = e.target.value;
          applyFilters();
        });
      });
    }
  }

  // Función para actualizar las opciones de género
  async function updateGenderFilters() {
    try {
      const params = new URLSearchParams();
      if (currentFilters.categoria_principal) params.append('categoria_principal', currentFilters.categoria_principal);
      if (currentFilters.subcategoria && currentFilters.subcategoria !== 'all') params.append('subcategoria', currentFilters.subcategoria);
      if (currentFilters.pseudocategoria && currentFilters.pseudocategoria !== 'all') params.append('seudocategoria', currentFilters.pseudocategoria);
      if (currentFilters.marca && currentFilters.marca !== 'all') params.append('marca', currentFilters.marca);
      if (currentFilters.funcion && currentFilters.funcion !== 'all') params.append('funcion', currentFilters.funcion);
      if (currentFilters.ingrediente_clave && currentFilters.ingrediente_clave !== 'all') params.append('ingrediente_clave', currentFilters.ingrediente_clave);
      if (currentFilters.resistente_al_agua && currentFilters.resistente_al_agua !== 'all') params.append('resistente_al_agua', currentFilters.resistente_al_agua);

      const response = await fetch(`/api/filtros/generos?${params.toString()}`);
      if (!response.ok) throw new Error(`Error ${response.status}`);
      
      const generos = await response.json();
      
      if (generos.length > 0) {
        genderFilterSection.classList.remove('hidden');
      } else {
        genderFilterSection.classList.add('hidden');
      }

      genderFilters.innerHTML = `
        <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
          <input type="radio" name="gender" value="all" class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300" ${currentFilters.genero === 'all' ? 'checked' : ''}>
          <span class="ml-3 text-gray-700 font-medium">Todos los géneros</span>
        </label>
      `;

      generos.forEach((genero) => {
        const genderHtml = `
          <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
            <input type="radio" name="gender" value="${genero}" class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300" ${currentFilters.genero === genero ? 'checked' : ''}>
            <span class="ml-3 text-gray-700">${genero.charAt(0).toUpperCase() + genero.slice(1)}</span>
          </label>
        `;
        genderFilters.insertAdjacentHTML("beforeend", genderHtml);
      });

      genderFilters.querySelectorAll('input[name="gender"]').forEach(input => {
        input.addEventListener('change', (e) => {
          currentFilters.genero = e.target.value;
          applyFilters();
        });
      });

    } catch (error) {
      console.error('Error al actualizar géneros:', error);
      genderFilterSection.classList.add('hidden');
    }
  }

  // Función para actualizar las opciones de función
  async function updateFunctionFilters() {
    try {
      const params = new URLSearchParams();
      if (currentFilters.categoria_principal) params.append('categoria_principal', currentFilters.categoria_principal);
      if (currentFilters.subcategoria && currentFilters.subcategoria !== 'all') params.append('subcategoria', currentFilters.subcategoria);
      if (currentFilters.pseudocategoria && currentFilters.pseudocategoria !== 'all') params.append('seudocategoria', currentFilters.pseudocategoria);
      if (currentFilters.marca && currentFilters.marca !== 'all') params.append('marca', currentFilters.marca);
      if (currentFilters.genero && currentFilters.genero !== 'all') params.append('genero', currentFilters.genero);
      if (currentFilters.ingrediente_clave && currentFilters.ingrediente_clave !== 'all') params.append('ingrediente_clave', currentFilters.ingrediente_clave);
      if (currentFilters.resistente_al_agua && currentFilters.resistente_al_agua !== 'all') params.append('resistente_al_agua', currentFilters.resistente_al_agua);

      const response = await fetch(`/api/filtros/funciones?${params.toString()}`);
      if (!response.ok) throw new Error(`Error ${response.status}`);

      const funciones = await response.json();

      if (funciones.length > 0) {
        functionFilterSection.classList.remove('hidden');
      } else {
        functionFilterSection.classList.add('hidden');
      }

      functionFilters.innerHTML = `
        <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
          <input type="radio" name="function" value="all" class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300" ${currentFilters.funcion === 'all' ? 'checked' : ''}>
          <span class="ml-3 text-gray-700 font-medium">Todas las funciones</span>
        </label>
      `;

      funciones.forEach((funcion) => {
        const functionHtml = `
          <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
            <input type="radio" name="function" value="${funcion}" class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300" ${currentFilters.funcion === funcion ? 'checked' : ''}>
            <span class="ml-3 text-gray-700">${funcion.charAt(0).toUpperCase() + funcion.slice(1)}</span>
          </label>
        `;
        functionFilters.insertAdjacentHTML("beforeend", functionHtml);
      });

      functionFilters.querySelectorAll('input[name="function"]').forEach(input => {
        input.addEventListener('change', (e) => {
          currentFilters.funcion = e.target.value;
          applyFilters();
        });
      });

    } catch (error) {
      console.error('Error al actualizar funciones:', error);
      functionFilterSection.classList.add('hidden');
    }
  }

  // Función para actualizar las opciones de ingrediente clave
  async function updateIngredientFilters() {
    try {
      const params = new URLSearchParams();
      if (currentFilters.categoria_principal) params.append('categoria_principal', currentFilters.categoria_principal);
      if (currentFilters.subcategoria && currentFilters.subcategoria !== 'all') params.append('subcategoria', currentFilters.subcategoria);
      if (currentFilters.pseudocategoria && currentFilters.pseudocategoria !== 'all') params.append('seudocategoria', currentFilters.pseudocategoria);
      if (currentFilters.marca && currentFilters.marca !== 'all') params.append('marca', currentFilters.marca);
      if (currentFilters.genero && currentFilters.genero !== 'all') params.append('genero', currentFilters.genero);
      if (currentFilters.funcion && currentFilters.funcion !== 'all') params.append('funcion', currentFilters.funcion);
      if (currentFilters.resistente_al_agua && currentFilters.resistente_al_agua !== 'all') params.append('resistente_al_agua', currentFilters.resistente_al_agua);

      const response = await fetch(`/api/filtros/ingredientes_clave?${params.toString()}`);
      if (!response.ok) throw new Error(`Error ${response.status}`);

      const ingredientes = await response.json();

      if (ingredientes.length > 0) {
        ingredientFilterSection.classList.remove('hidden');
      } else {
        ingredientFilterSection.classList.add('hidden');
      }

      ingredientFilters.innerHTML = `
        <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
          <input type="radio" name="ingredient" value="all" class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300" ${currentFilters.ingrediente_clave === 'all' ? 'checked' : ''}>
          <span class="ml-3 text-gray-700 font-medium">Todos los ingredientes</span>
        </label>
      `;

      ingredientes.forEach((ingrediente) => {
        const ingredientHtml = `
          <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
            <input type="radio" name="ingredient" value="${ingrediente}" class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300" ${currentFilters.ingrediente_clave === ingrediente ? 'checked' : ''}>
            <span class="ml-3 text-gray-700">${ingrediente.charAt(0).toUpperCase() + ingrediente.slice(1)}</span>
          </label>
        `;
        ingredientFilters.insertAdjacentHTML("beforeend", ingredientHtml);
      });

      ingredientFilters.querySelectorAll('input[name="ingredient"]').forEach(input => {
        input.addEventListener('change', (e) => {
          currentFilters.ingrediente_clave = e.target.value;
          applyFilters();
        });
      });

    } catch (error) {
      console.error('Error al actualizar ingredientes clave:', error);
      ingredientFilterSection.classList.add('hidden');
    }
  }

  // Función para actualizar las opciones de resistente al agua
  async function updateWaterproofFilters() {
    try {
      const params = new URLSearchParams();
      if (currentFilters.categoria_principal) params.append('categoria_principal', currentFilters.categoria_principal);
      if (currentFilters.subcategoria && currentFilters.subcategoria !== 'all') params.append('subcategoria', currentFilters.subcategoria);
      if (currentFilters.pseudocategoria && currentFilters.pseudocategoria !== 'all') params.append('seudocategoria', currentFilters.pseudocategoria);
      if (currentFilters.marca && currentFilters.marca !== 'all') params.append('marca', currentFilters.marca);
      if (currentFilters.genero && currentFilters.genero !== 'all') params.append('genero', currentFilters.genero);
      if (currentFilters.funcion && currentFilters.funcion !== 'all') params.append('funcion', currentFilters.funcion);
      if (currentFilters.ingrediente_clave && currentFilters.ingrediente_clave !== 'all') params.append('ingrediente_clave', currentFilters.ingrediente_clave);

      const response = await fetch(`/api/filtros/resistente_al_agua?${params.toString()}`);
      if (!response.ok) throw new Error(`Error ${response.status}`);

      const opciones = await response.json();

      if (opciones.length > 0) {
        waterproofFilterSection.classList.remove('hidden');
      } else {
        waterproofFilterSection.classList.add('hidden');
      }

      waterproofFilters.innerHTML = `
        <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
          <input type="radio" name="waterproof" value="all" class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300" ${currentFilters.resistente_al_agua === 'all' ? 'checked' : ''}>
          <span class="ml-3 text-gray-700 font-medium">Todos</span>
        </label>
      `;

      opciones.forEach((opcion) => {
        const waterproofHtml = `
          <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
            <input type="radio" name="waterproof" value="${opcion}" class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300" ${currentFilters.resistente_al_agua === opcion ? 'checked' : ''}>
            <span class="ml-3 text-gray-700">${opcion.charAt(0).toUpperCase() + opcion.slice(1)}</span>
          </label>
        `;
        waterproofFilters.insertAdjacentHTML("beforeend", waterproofHtml);
      });

      waterproofFilters.querySelectorAll('input[name="waterproof"]').forEach(input => {
        input.addEventListener('change', (e) => {
          currentFilters.resistente_al_agua = e.target.value;
          applyFilters();
        });
      });

    } catch (error) {
      console.error('Error al actualizar opciones de resistente al agua:', error);
      waterproofFilterSection.classList.add('hidden');
    }
  }

  // Función para actualizar las etiquetas de filtros aplicados
  function updateAppliedFiltersTags() {
    if (!appliedFiltersContainer) return;
    
    appliedFiltersContainer.innerHTML = '';
    
    // Función para crear una etiqueta de filtro
    const createFilterTag = (key, value, displayValue) => {
      if (value === 'all' || value === '') return null;
      
      const tag = document.createElement('div');
      tag.className = 'inline-flex items-center bg-pink-100 text-pink-800 rounded-full px-3 py-1 text-sm font-medium mr-2 mb-2';
      tag.innerHTML = `
        ${displayValue}
        <button class="ml-2 text-pink-600 hover:text-pink-900 focus:outline-none" data-filter="${key}">
          <i class="fas fa-times"></i>
        </button>
      `;
      
      // Event listener para quitar el filtro
      tag.querySelector('button').addEventListener('click', () => {
        removeFilter(key);
      });
      
      return tag;
    };
    
    // Crear etiquetas para cada filtro
    const tags = [];
    
    if (currentFilters.subcategoria !== 'all') {
      tags.push(createFilterTag('subcategoria', currentFilters.subcategoria, currentFilters.subcategoria));
    }
    
    if (currentFilters.pseudocategoria !== 'all') {
      tags.push(createFilterTag('seudocategoria', currentFilters.pseudocategoria, currentFilters.pseudocategoria));
    }
    
    if (currentFilters.marca !== 'all') {
      tags.push(createFilterTag('marca', currentFilters.marca, currentFilters.marca));
    }
    
    if (currentFilters.genero !== 'all') {
      tags.push(createFilterTag('genero', currentFilters.genero, `Género: ${currentFilters.genero}`));
    }

    if (currentFilters.funcion !== 'all') {
      tags.push(createFilterTag('funcion', currentFilters.funcion, `Función: ${currentFilters.funcion}`));
    }

    if (currentFilters.ingrediente_clave !== 'all') {
      tags.push(createFilterTag('ingrediente_clave', currentFilters.ingrediente_clave, `Ingrediente: ${currentFilters.ingrediente_clave}`));
    }

    if (currentFilters.resistente_al_agua !== 'all') {
      tags.push(createFilterTag('resistente_al_agua', currentFilters.resistente_al_agua, `Resistente al agua: ${currentFilters.resistente_al_agua}`));
    }

    if (currentFilters.min_price !== '') {
      tags.push(createFilterTag('min_price', currentFilters.min_price, `Min: $${currentFilters.min_price}`));
    }
    
    if (currentFilters.max_price !== '') {
      tags.push(createFilterTag('max_price', currentFilters.max_price, `Max: $${currentFilters.max_price}`));
    }
    
    // Agregar las etiquetas al contenedor
    tags.forEach(tag => {
      if (tag) appliedFiltersContainer.appendChild(tag);
    });
    
    // Mostrar u ocultar el contenedor
    if (tags.some(tag => tag !== null)) {
      appliedFiltersContainer.classList.remove('hidden');
    } else {
      appliedFiltersContainer.classList.add('hidden');
    }
  }

  // Función para quitar un filtro específico
  function removeFilter(filterKey) {
    switch (filterKey) {
      case 'subcategoria':
        currentFilters.subcategoria = 'all';
        break;
      case 'seudocategoria':
        currentFilters.pseudocategoria = 'all';
        break;
      case 'marca':
        currentFilters.marca = 'all';
        break;
      case 'genero':
        currentFilters.genero = 'all';
        break;
      case 'funcion':
        currentFilters.funcion = 'all';
        break;
      case 'ingrediente_clave':
        currentFilters.ingrediente_clave = 'all';
        break;
      case 'resistente_al_agua':
        currentFilters.resistente_al_agua = 'all';
        break;
      case 'min_price':
        currentFilters.min_price = '';
        minPriceInput.value = '';
        break;
      case 'max_price':
        currentFilters.max_price = '';
        maxPriceInput.value = '';
        break;
    }
    
    updatePriceLabels();
    applyFilters();
  }

  // Función para aplicar los filtros
  async function applyFilters() {
    // Actualizar los valores de los inputs de precio
    currentFilters.min_price = minPriceInput.value;
    currentFilters.max_price = maxPriceInput.value;
    
    // Actualizar los filtros disponibles
    await updateAllFilters();
    
    // Obtener los productos filtrados
    await fetchProductsWithFilters();
  }

  // Función para restablecer todos los filtros
  function resetAllFilters() {
    currentFilters = {
      categoria_principal: window.appData.categoriaPrincipal.nombre,
      subcategoria: 'all',
      pseudocategoria: 'all',
      marca: 'all',
      min_price: '',
      max_price: '',
      genero: 'all',
      funcion: 'all',
      ingrediente_clave: 'all',
      resistente_al_agua: 'all',
      ordenar_por: 'newest'
    };
    
    // Restablecer los inputs de precio
    minPriceInput.value = '';
    maxPriceInput.value = '';
    updatePriceLabels();
    
    // Restablecer el ordenamiento
    sortSelect.value = 'newest';
    
    // Aplicar los cambios
    applyFilters();
  }

  // Función para obtener y establecer el rango de precios
  async function fetchAndSetPriceRange() {
    try {
      const categoriaPrincipalNombre = window.appData.categoriaPrincipal.nombre;
      const params = new URLSearchParams();
      if (categoriaPrincipalNombre) {
        params.append("categoria_principal", categoriaPrincipalNombre);
      }
      const url = `/api/productos/precios_rango?${params.toString()}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Error al obtener el rango de precios');
      }
      const data = await response.json();
      
      if (minPriceInput) {
        // MEJORA: No establecer el valor, sino el placeholder para evitar el filtrado automático.
        minPriceInput.placeholder = data.min_price ? `Mín. ${data.min_price}` : 'Mín. 0';
      }
      if (maxPriceInput) {
        // MEJORA: No establecer el valor, sino el placeholder.
        maxPriceInput.placeholder = data.max_price ? `Máx. ${data.max_price}` : 'Máx. 1000';
      }
    } catch (error) {
      console.error('Error al cargar el rango de precios:', error);
    }
  }

  // Función para cargar productos con filtros
  async function fetchProductsWithFilters() {
    if (isFetching) return;
    isFetching = true;

    showLoader();
    await new Promise(resolve => setTimeout(resolve, 300));

    const params = new URLSearchParams();
    
    // Agregar todos los filtros actuales
    Object.keys(currentFilters).forEach(key => {
      if (currentFilters[key] !== 'all' && currentFilters[key] !== '') {
        params.append(key, currentFilters[key]);
      }
    });

    const url = `/api/productos/filtrar?${params.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Error al cargar los productos");
      }
      const products = await response.json();
      allProducts = products;
      
      hideLoader();
      if (products.length === 0) {
        displayDynamicNoResultsMessage();
      } else {
        renderProducts(allProducts.slice(0, productsPerPage), true);
        updateCategoryInfo();
      }
    } catch (error) {
      console.error(error);
      hideLoader();
      productListingContainer.classList.add("hidden");
      noResultsMessage.classList.remove("hidden");
    } finally {
      isFetching = false;
    }
  }

  // Función para mostrar el mensaje de no resultados
  function displayDynamicNoResultsMessage() {
    const titleEl = document.getElementById('no-results-title');
    const suggestionEl = document.getElementById('no-results-suggestion');
    const clearBtn = document.getElementById('clear-search-btn');

    if (!titleEl || !suggestionEl || !clearBtn) return;

    const activeFilters = [];
    if (currentFilters.marca && currentFilters.marca !== 'all') activeFilters.push(`de la marca <strong>"${currentFilters.marca}"</strong>`);
    if (currentFilters.pseudocategoria && currentFilters.pseudocategoria !== 'all') activeFilters.push(`en <strong>"${currentFilters.pseudocategoria}"</strong>`);
    else if (currentFilters.subcategoria && currentFilters.subcategoria !== 'all') activeFilters.push(`en la subcategoría <strong>"${currentFilters.subcategoria}"</strong>`);

    if (currentFilters.min_price && currentFilters.max_price) {
        activeFilters.push(`con precios entre <strong>$${currentFilters.min_price}</strong> y <strong>$${currentFilters.max_price}</strong>`);
    } else if (currentFilters.min_price) {
        activeFilters.push(`con precio mayor a <strong>$${currentFilters.min_price}</strong>`);
    } else if (currentFilters.max_price) {
        activeFilters.push(`con precio menor a <strong>$${currentFilters.max_price}</strong>`);
    }

    if (activeFilters.length > 0) {
        titleEl.textContent = 'No se encontraron productos con tu selección';
        let suggestionText = `Dentro de <strong>${window.appData.categoriaPrincipal.nombre}</strong>, no hemos podido encontrar productos `;
        suggestionText += activeFilters.join(' y ');
        suggestionText += '.<br><br><strong>Sugerencia:</strong> Intenta ajustar o eliminar algunos filtros para ver más resultados.';
        suggestionEl.innerHTML = suggestionText;
        clearBtn.classList.remove('hidden');
    } else {
        titleEl.textContent = '¡Vaya! No encontramos productos';
        suggestionEl.innerHTML = `Parece que no hay productos disponibles en la categoría <strong>${window.appData.categoriaPrincipal.nombre}</strong> en este momento. Vuelve a intentarlo más tarde.`;
        clearBtn.classList.add('hidden');
    }

    productListingContainer.classList.add("hidden");
    noResultsMessage.classList.remove("hidden");
  }

  // Función para actualizar el título y breadcrumbs
  function updateCategoryInfo() {
    const categoriaPrincipal = window.appData.categoriaPrincipal;
    let title = categoriaPrincipal.nombre;
    let description = categoriaPrincipal.descripcion || `Productos de la categoría ${categoriaPrincipal.nombre}.`;
    let breadcrumbsHtml = `
      <a href="/" class="text-pink-600 hover:text-pink-800 transition-colors duration-200 flex items-center">
        <i class="fas fa-home mr-1.5 text-sm"></i> Inicio
      </a>
      <span class="text-gray-300">/</span>
      <span class="text-gray-700 font-medium">${categoriaPrincipal.nombre}</span>
    `;

    if (currentFilters.subcategoria && currentFilters.subcategoria !== "all") {
      const subcategoriaObj = window.appData.subcategorias.find(s => s.nombre === currentFilters.subcategoria);
      title = currentFilters.subcategoria;
      if (subcategoriaObj && subcategoriaObj.descripcion) {
        description = subcategoriaObj.descripcion;
      } else {
        description = `Descubre la variedad en la subcategoría ${currentFilters.subcategoria}.`;
      }
      breadcrumbsHtml = `
        <a href="/" class="text-pink-600 hover:text-pink-800 transition-colors duration-200 flex items-center">
          <i class="fas fa-home mr-1.5 text-sm"></i> Inicio
        </a>
        <span class="text-gray-300">/</span>
        <a href="/${categoriaPrincipal.slug}" class="text-pink-600 hover:text-pink-800 transition-colors">${categoriaPrincipal.nombre}</a>
        <span class="text-gray-300">/</span>
        <span class="text-gray-700 font-medium">${currentFilters.subcategoria}</span>
      `;
    }

    if (currentFilters.pseudocategoria && currentFilters.pseudocategoria !== "all") {
      const pseudocategoriaObj = window.appData.seudocategorias.find(p => p.nombre === currentFilters.pseudocategoria);
      title = currentFilters.pseudocategoria;
      if (pseudocategoriaObj && pseudocategoriaObj.descripcion) {
        description = pseudocategoriaObj.descripcion;
      } else {
        description = `Encuentra lo mejor en ${currentFilters.pseudocategoria}.`;
      }
      // Asume que la subcategoría ya está en el breadcrumb
      breadcrumbsHtml += `
        <span class="text-gray-300">/</span>
        <span class="text-gray-700 font-medium">${currentFilters.pseudocategoria}</span>
      `;
    }

    categoryTitle.textContent = title;
    categoryDescription.textContent = description;
    breadcrumbs.innerHTML = breadcrumbsHtml;
  }

  // Función para mostrar el loader
  function showLoader() {
    productListingContainer.classList.remove("hidden");
    productGrid.style.display = "none";
    noResultsMessage.classList.add("hidden");
    productGridLoader.style.display = "grid";
    
    if (loadMoreBtn) loadMoreBtn.style.display = "none";
    if (showLessBtn) showLessBtn.style.display = "none";
  }

  // Función para ocultar el loader
  function hideLoader() {
    productGridLoader.style.display = "none";
  }

  // Función para renderizar los productos
  function renderProducts(productsToRender, isInitialRender = false) {
    if (isInitialRender) {
      productGrid.innerHTML = "";
    }
    productListingContainer.classList.remove("hidden");
    noResultsMessage.classList.add("hidden");
    productGrid.style.display = "grid";

    productsToRender.forEach((product, index) => {
      const productCard = renderProductCard(product);
      if (isInitialRender) {
        productCard.classList.add("card-enter");
        productCard.style.animationDelay = `${index * 50}ms`;
      }
      productGrid.appendChild(productCard);
    });

    currentDisplayedProducts = productGrid.children.length;
    productCount.textContent = currentDisplayedProducts;
    totalProductCount.textContent = allProducts.length;

    loadMoreBtn.style.display = currentDisplayedProducts < allProducts.length ? "block" : "none";
    showLessBtn.style.display = currentDisplayedProducts > productsPerPage ? "block" : "none";
  }

  // Función para cargar más productos
  function loadMoreProducts() {
    const nextBatch = allProducts.slice(
      currentDisplayedProducts,
      currentDisplayedProducts + productsPerPage
    );
    // Con la nueva función renderProducts, pasar 'false' significa que no es un render inicial,
    // por lo que los productos se añadirán en lugar de reemplazar.
    renderProducts(nextBatch, false); 
  }

  // Función para mostrar menos productos
  function showLessProducts() {
    renderProducts(allProducts.slice(0, productsPerPage), true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Iniciar la aplicación
  init();
});