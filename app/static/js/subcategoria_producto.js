document.addEventListener("DOMContentLoaded", function () {
  // Estado inicial de los filtros
  let currentFilters = {
    categoria_principal: window.appData.categoriaPrincipal.nombre,
    subcategoria: window.appData.subcategoriaActual.nombre, // Fijo
    pseudocategoria: 'all',
    marca: 'all',
    genero: 'all',
    color: 'all',
    funcion: 'all',
    ingrediente_clave: 'all',
    resistente_al_agua: 'all',
    min_price: '',
    max_price: '',
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
  const pseudocategoryFilters = document.getElementById("pseudocategory-filters-content");
  const brandFilters = document.getElementById("brand-filters-content");
  const genderFilterSection = document.getElementById("gender-filter-section");
  const genderFilters = document.getElementById("gender-filters-content");
  const colorFilterSection = document.getElementById("color-filter-section");
  const colorFilters = document.getElementById("color-filters-content");
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
  const filterModalOverlay = document.getElementById("filter-modal-overlay");

  // Contenedor de etiquetas de filtros aplicados
  const appliedFiltersContainer = document.getElementById("applied-filters");
  
  let allProducts = [];
  const productsPerPage = 12;
  let currentDisplayedProducts = 0;
  let isFetching = false;
  let isUpdatingFilters = false;

  // Inicialización
  async function init() {
    // Leer parámetros de la URL para pre-filtrar
    const urlParams = new URLSearchParams(window.location.search);
    const seudoFromUrl = urlParams.get('seudocategoria');
    if (seudoFromUrl) {
        // Decodificar el nombre de la seudocategoría desde la URL
        currentFilters.pseudocategoria = decodeURIComponent(seudoFromUrl);
    }

    setupEventListeners();
    // Mostrar filtros de especificaciones si aplican
    initializeSpecificationFilters();
    await updateAllFilters();
    await fetchProductsWithFilters();
    await fetchAndSetPriceRange();
  }

  function setupEventListeners() {
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

    if (filterBtn) filterBtn.addEventListener("click", () => toggleFilterDrawer(true));
    if (closeFilterBtn) closeFilterBtn.addEventListener("click", () => toggleFilterDrawer(false));
    if (filterModalOverlay) filterModalOverlay.addEventListener("click", () => toggleFilterDrawer(false));
    if (filterDrawer) filterDrawer.addEventListener("click", (event) => event.stopPropagation());

    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener("click", () => {
        resetAllFilters();
        toggleFilterDrawer(false);
      });
    }

    if (minPriceInput) {
      minPriceInput.addEventListener("input", () => {
        updatePriceLabels();
        debounceFilterProducts();
      });
    }
    
    if (maxPriceInput) {
      maxPriceInput.addEventListener("input", () => {
        updatePriceLabels();
        debounceFilterProducts();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        currentFilters.ordenar_por = sortSelect.value;
        fetchProductsWithFilters();
      });
    }

    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", resetAllFilters);
    }

    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", loadMoreProducts);
    }

    if (showLessBtn) {
      showLessBtn.addEventListener("click", showLessProducts);
    }

    const clearSearchBtn = document.getElementById("clear-search-btn");
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener("click", resetAllFilters);
    }
  }

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

  function syncFiltersWithCurrentValues() {
    const pseudocategoryInput = filterDrawer.querySelector(`input[name="pseudocategory"][value="${currentFilters.pseudocategoria}"]`);
    if (pseudocategoryInput) pseudocategoryInput.checked = true;

    const brandInput = filterDrawer.querySelector(`input[name="brand"][value="${currentFilters.marca}"]`);
    if (brandInput) brandInput.checked = true;

    // Sincronizar género
    const genderInput = filterDrawer.querySelector(`input[name="gender"][value="${currentFilters.genero}"]`);
    if (genderInput) genderInput.checked = true;

    // Sincronizar color
    const colorInput = filterDrawer.querySelector(`input[name="color"][value="${currentFilters.color}"]`);
    if (colorInput) colorInput.checked = true;

    // Sincronizar función
    const functionInput = filterDrawer.querySelector(`input[name="function"][value="${currentFilters.funcion}"]`);
    if (functionInput) functionInput.checked = true;

    // Sincronizar ingrediente clave
    const ingredientInput = filterDrawer.querySelector(`input[name="ingredient"][value="${currentFilters.ingrediente_clave}"]`);
    if (ingredientInput) ingredientInput.checked = true;

    // Sincronizar resistente al agua
    const waterproofInput = filterDrawer.querySelector(`input[name="waterproof"][value="${currentFilters.resistente_al_agua}"]`);
    if (waterproofInput) waterproofInput.checked = true;
    
    minPriceInput.value = currentFilters.min_price || '';
    maxPriceInput.value = currentFilters.max_price || '';
    
    updatePriceLabels();
  }

  function updatePriceLabels() {
    minPriceLabel.textContent = minPriceInput.value ? `$${minPriceInput.value}` : '$0';
    maxPriceLabel.textContent = maxPriceInput.value ? `$${maxPriceInput.value}` : '$0';
  }

  // Función para mostrar los filtros de especificaciones si hay opciones
  function initializeSpecificationFilters() {
    if (window.appData.generos && window.appData.generos.length > 0) {
      genderFilterSection.classList.remove('hidden');
    }
    if (window.appData.colores && window.appData.colores.length > 0) {
      colorFilterSection.classList.remove('hidden');
    }
    if (window.appData.funciones && window.appData.funciones.length > 0) {
      functionFilterSection.classList.remove('hidden');
    }
    if (window.appData.ingredientes_clave && window.appData.ingredientes_clave.length > 0) {
      ingredientFilterSection.classList.remove('hidden');
    }
    if (window.appData.resistente_al_agua && window.appData.resistente_al_agua.length > 0) {
      waterproofFilterSection.classList.remove('hidden');
    }
  }

  async function updateAllFilters() {
    if (isUpdatingFilters) return;
    isUpdatingFilters = true;
    
    try {
      await Promise.all([
        updatePseudocategoryFilters(),
        updateBrandFilters(),
        updateGenderFilters(),
        updateColorFilters(),
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

  async function updatePseudocategoryFilters() {
    try {
      const params = new URLSearchParams();
      if (currentFilters.categoria_principal) params.append('categoria_principal', currentFilters.categoria_principal);
      if (currentFilters.subcategoria && currentFilters.subcategoria !== 'all') params.append('subcategoria', currentFilters.subcategoria);
      if (currentFilters.genero && currentFilters.genero !== 'all') params.append('genero', currentFilters.genero);
      if (currentFilters.color && currentFilters.color !== 'all') params.append('color', currentFilters.color);
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

      targetElement.querySelectorAll('input[name="pseudocategory"]').forEach(input => {
        input.addEventListener('change', (e) => {
          currentFilters.pseudocategoria = e.target.value;
          applyFilters();
        });
      });
    } catch (error) {
      console.error('Error al actualizar seudocategorías:', error);
      showAllPseudocategories();
    }
  }

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

      targetElement.querySelectorAll('input[name="pseudocategory"]').forEach(input => {
        input.addEventListener('change', (e) => {
          currentFilters.pseudocategoria = e.target.value;
          applyFilters();
        });
      });
    }
  }

  async function updateBrandFilters() {
    try {
      const params = new URLSearchParams();
      if (currentFilters.categoria_principal) params.append('categoria_principal', currentFilters.categoria_principal);
      if (currentFilters.subcategoria && currentFilters.subcategoria !== 'all') params.append('subcategoria', currentFilters.subcategoria);
      if (currentFilters.color && currentFilters.color !== 'all') params.append('color', currentFilters.color);
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

      targetElement.querySelectorAll('input[name="brand"]').forEach(input => {
        input.addEventListener('change', (e) => {
          currentFilters.marca = e.target.value;
          applyFilters();
        });
      });
    } catch (error) {
      console.error('Error al actualizar marcas:', error);
      showAllBrands();
    }
  }

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
      if (currentFilters.color && currentFilters.color !== 'all') params.append('color', currentFilters.color);
      if (currentFilters.funcion && currentFilters.funcion !== 'all') params.append('funcion', currentFilters.funcion);
      if (currentFilters.ingrediente_clave && currentFilters.ingrediente_clave !== 'all') params.append('ingrediente_clave', currentFilters.ingrediente_clave);
      if (currentFilters.resistente_al_agua && currentFilters.resistente_al_agua !== 'all') params.append('resistente_al_agua', currentFilters.resistente_al_agua);

      const response = await fetch(`/api/filtros/generos?${params.toString()}`);
      if (!response.ok) throw new Error(`Error ${response.status}`);
      
      const generos = await response.json();
      
      genderFilterSection.classList.toggle('hidden', generos.length === 0);

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

  // Función para actualizar las opciones de color
  async function updateColorFilters() {
    try {
      const params = new URLSearchParams();
      if (currentFilters.categoria_principal) params.append('categoria_principal', currentFilters.categoria_principal);
      if (currentFilters.subcategoria && currentFilters.subcategoria !== 'all') params.append('subcategoria', currentFilters.subcategoria);
      if (currentFilters.pseudocategoria && currentFilters.pseudocategoria !== 'all') params.append('seudocategoria', currentFilters.pseudocategoria);
      if (currentFilters.marca && currentFilters.marca !== 'all') params.append('marca', currentFilters.marca);
      if (currentFilters.genero && currentFilters.genero !== 'all') params.append('genero', currentFilters.genero);
      if (currentFilters.funcion && currentFilters.funcion !== 'all') params.append('funcion', currentFilters.funcion);
      if (currentFilters.ingrediente_clave && currentFilters.ingrediente_clave !== 'all') params.append('ingrediente_clave', currentFilters.ingrediente_clave);
      if (currentFilters.resistente_al_agua && currentFilters.resistente_al_agua !== 'all') params.append('resistente_al_agua', currentFilters.resistente_al_agua);

      const response = await fetch(`/api/filtros/colores?${params.toString()}`);
      if (!response.ok) throw new Error(`Error ${response.status}`);
      
      const colores = await response.json();
      
      colorFilterSection.classList.toggle('hidden', colores.length === 0);

      colorFilters.innerHTML = `
        <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
          <input type="radio" name="color" value="all" class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300" ${currentFilters.color === 'all' ? 'checked' : ''}>
          <span class="ml-3 text-gray-700 font-medium">Todos los colores</span>
        </label>
      `;

      colores.forEach((color) => {
        const colorHtml = `
          <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
            <input type="radio" name="color" value="${color}" class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300" ${currentFilters.color === color ? 'checked' : ''}>
            <span class="ml-3 text-gray-700">${color.charAt(0).toUpperCase() + color.slice(1)}</span>
          </label>
        `;
        colorFilters.insertAdjacentHTML("beforeend", colorHtml);
      });

      colorFilters.querySelectorAll('input[name="color"]').forEach(input => {
        input.addEventListener('change', (e) => {
          currentFilters.color = e.target.value;
          applyFilters();
        });
      });

    } catch (error) {
      console.error('Error al actualizar colores:', error);
      colorFilterSection.classList.add('hidden');
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
      if (currentFilters.color && currentFilters.color !== 'all') params.append('color', currentFilters.color);
      if (currentFilters.ingrediente_clave && currentFilters.ingrediente_clave !== 'all') params.append('ingrediente_clave', currentFilters.ingrediente_clave);
      if (currentFilters.resistente_al_agua && currentFilters.resistente_al_agua !== 'all') params.append('resistente_al_agua', currentFilters.resistente_al_agua);

      const response = await fetch(`/api/filtros/funciones?${params.toString()}`);
      if (!response.ok) throw new Error(`Error ${response.status}`);

      const funciones = await response.json();

      functionFilterSection.classList.toggle('hidden', funciones.length === 0);

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
      if (currentFilters.color && currentFilters.color !== 'all') params.append('color', currentFilters.color);
      if (currentFilters.funcion && currentFilters.funcion !== 'all') params.append('funcion', currentFilters.funcion);
      if (currentFilters.resistente_al_agua && currentFilters.resistente_al_agua !== 'all') params.append('resistente_al_agua', currentFilters.resistente_al_agua);

      const response = await fetch(`/api/filtros/ingredientes_clave?${params.toString()}`);
      if (!response.ok) throw new Error(`Error ${response.status}`);

      const ingredientes = await response.json();

      ingredientFilterSection.classList.toggle('hidden', ingredientes.length === 0);

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
      if (currentFilters.color && currentFilters.color !== 'all') params.append('color', currentFilters.color);
      if (currentFilters.funcion && currentFilters.funcion !== 'all') params.append('funcion', currentFilters.funcion);
      if (currentFilters.ingrediente_clave && currentFilters.ingrediente_clave !== 'all') params.append('ingrediente_clave', currentFilters.ingrediente_clave);

      const response = await fetch(`/api/filtros/resistente_al_agua?${params.toString()}`);
      if (!response.ok) throw new Error(`Error ${response.status}`);

      const opciones = await response.json();

      waterproofFilterSection.classList.toggle('hidden', opciones.length === 0);

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

  function updateAppliedFiltersTags() {
    if (!appliedFiltersContainer) return;
    
    appliedFiltersContainer.innerHTML = '';
    
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
      
      tag.querySelector('button').addEventListener('click', () => {
        removeFilter(key);
      });
      
      return tag;
    };
    
    const tags = [];
    
    if (currentFilters.pseudocategoria !== 'all') {
      tags.push(createFilterTag('pseudocategoria', currentFilters.pseudocategoria, currentFilters.pseudocategoria));
    }
    
    if (currentFilters.marca !== 'all') {
      tags.push(createFilterTag('marca', currentFilters.marca, currentFilters.marca));
    }
    
    if (currentFilters.genero !== 'all') {
      tags.push(createFilterTag('genero', currentFilters.genero, `Género: ${currentFilters.genero}`));
    }

    if (currentFilters.color !== 'all') {
      tags.push(createFilterTag('color', currentFilters.color, `Color: ${currentFilters.color}`));
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
    
    tags.forEach(tag => {
      if (tag) appliedFiltersContainer.appendChild(tag);
    });
    
    if (tags.some(tag => tag !== null)) {
      appliedFiltersContainer.classList.remove('hidden');
    } else {
      appliedFiltersContainer.classList.add('hidden');
    }
  }

  function removeFilter(filterKey) {
    switch (filterKey) {
      case 'pseudocategoria':
        currentFilters.pseudocategoria = 'all';
        break;
      case 'marca':
        currentFilters.marca = 'all';
        break;
      case 'genero':
        currentFilters.genero = 'all';
        break;
      case 'color':
        currentFilters.color = 'all';
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

  async function applyFilters() {
    currentFilters.min_price = minPriceInput.value;
    currentFilters.max_price = maxPriceInput.value;
    
    await updateAllFilters();
    await fetchProductsWithFilters();
  }

  function resetAllFilters() {
    currentFilters = {
      categoria_principal: window.appData.categoriaPrincipal.nombre,
      subcategoria: window.appData.subcategoriaActual.nombre,
      pseudocategoria: 'all',
      marca: 'all',
      genero: 'all',
      color: 'all',
      funcion: 'all',
      ingrediente_clave: 'all',
      resistente_al_agua: 'all',
      min_price: '',
      max_price: '',
      ordenar_por: 'newest'
    };
    
    minPriceInput.value = '';
    maxPriceInput.value = '';
    updatePriceLabels();
    
    sortSelect.value = 'newest';
    
    applyFilters();
  }

  async function fetchAndSetPriceRange() {
    try {
      const categoriaPrincipalNombre = window.appData.categoriaPrincipal.nombre;
      const subcategoriaNombre = window.appData.subcategoriaActual.nombre;
      const params = new URLSearchParams();
      if (categoriaPrincipalNombre) {
        params.append("categoria_principal", categoriaPrincipalNombre);
      }
      if (subcategoriaNombre) {
        params.append("subcategoria", subcategoriaNombre);
      }
      const url = `/api/productos/precios_rango?${params.toString()}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Error al obtener el rango de precios');
      }
      const data = await response.json();
      
      if (minPriceInput) {
        minPriceInput.placeholder = data.min_price ? `Mín. ${data.min_price}` : 'Mín. 0';
      }
      if (maxPriceInput) {
        maxPriceInput.placeholder = data.max_price ? `Máx. ${data.max_price}` : 'Máx. 1000';
      }
      updatePriceLabels();
    } catch (error) {
      console.error('Error al cargar el rango de precios:', error);
    }
  }

  async function fetchProductsWithFilters() {
    if (isFetching) return;
    isFetching = true;

    showLoader();
    await new Promise(resolve => setTimeout(resolve, 300));

    const params = new URLSearchParams();
    
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

  function displayDynamicNoResultsMessage() {
    const titleEl = document.getElementById('no-results-title');
    const suggestionEl = document.getElementById('no-results-suggestion');
    const clearBtn = document.getElementById('clear-search-btn');

    if (!titleEl || !suggestionEl || !clearBtn) return;

    const activeFilters = [];
    if (currentFilters.marca && currentFilters.marca !== 'all') activeFilters.push(`de la marca <strong>"${currentFilters.marca}"</strong>`);
    if (currentFilters.pseudocategoria && currentFilters.pseudocategoria !== 'all') activeFilters.push(`en <strong>"${currentFilters.pseudocategoria}"</strong>`);
    if (currentFilters.genero && currentFilters.genero !== 'all') activeFilters.push(`para <strong>"${currentFilters.genero}"</strong>`);
    if (currentFilters.color && currentFilters.color !== 'all') activeFilters.push(`de color <strong>"${currentFilters.color}"</strong>`);
    if (currentFilters.funcion && currentFilters.funcion !== 'all') activeFilters.push(`con función <strong>"${currentFilters.funcion}"</strong>`);
    if (currentFilters.ingrediente_clave && currentFilters.ingrediente_clave !== 'all') activeFilters.push(`con ingrediente <strong>"${currentFilters.ingrediente_clave}"</strong>`);
    if (currentFilters.resistente_al_agua && currentFilters.resistente_al_agua !== 'all') activeFilters.push(`que sea <strong>"${currentFilters.resistente_al_agua}"</strong> al agua`);

    if (currentFilters.min_price && currentFilters.max_price) {
        activeFilters.push(`con precios entre <strong>$${currentFilters.min_price}</strong> y <strong>$${currentFilters.max_price}</strong>`);
    } else if (currentFilters.min_price) {
        activeFilters.push(`con precio mayor a <strong>$${currentFilters.min_price}</strong>`);
    } else if (currentFilters.max_price) {
        activeFilters.push(`con precio menor a <strong>$${currentFilters.max_price}</strong>`);
    }

    if (activeFilters.length > 0) {
        titleEl.textContent = 'No se encontraron productos con tu selección';
        let suggestionText = `Dentro de <strong>${window.appData.subcategoriaActual.nombre}</strong>, no hemos podido encontrar productos `;
        suggestionText += activeFilters.join(' y ');
        suggestionText += '.<br><br><strong>Sugerencia:</strong> Intenta ajustar o eliminar algunos filtros para ver más resultados.';
        suggestionEl.innerHTML = suggestionText;
        clearBtn.classList.remove('hidden');
    } else {
        titleEl.textContent = '¡Vaya! No encontramos productos';
        suggestionEl.innerHTML = `Parece que no hay productos disponibles en la subcategoría <strong>${window.appData.subcategoriaActual.nombre}</strong> en este momento. Vuelve a intentarlo más tarde.`;
        clearBtn.classList.add('hidden');
    }

    productListingContainer.classList.add("hidden");
    noResultsMessage.classList.remove("hidden");
  }

  function updateCategoryInfo() {
    const categoriaPrincipal = window.appData.categoriaPrincipal;
    const subcategoriaActual = window.appData.subcategoriaActual;
    let title = subcategoriaActual.nombre;
    let description = subcategoriaActual.descripcion || `Productos de la subcategoría ${subcategoriaActual.nombre}.`;
    let breadcrumbsHtml = `
      <a href="/" class="text-pink-600 hover:text-pink-800 transition-colors duration-200 flex items-center">
        <i class="fas fa-home mr-1.5 text-sm"></i> Inicio
      </a>
      <span class="text-gray-300">/</span>
      <a href="/${categoriaPrincipal.slug}" class="text-pink-600 hover:text-pink-800 transition-colors">${categoriaPrincipal.nombre}</a>
      <span class="text-gray-300">/</span>
      <span class="text-gray-700 font-medium">${subcategoriaActual.nombre}</span>
    `;

    if (currentFilters.pseudocategoria && currentFilters.pseudocategoria !== "all") {
      const pseudocategoriaObj = window.appData.seudocategorias.find(p => p.nombre === currentFilters.pseudocategoria);
      title = currentFilters.pseudocategoria;
      if (pseudocategoriaObj && pseudocategoriaObj.descripcion) {
        description = pseudocategoriaObj.descripcion;
      } else {
        description = `Encuentra lo mejor en ${currentFilters.pseudocategoria}.`;
      }
      breadcrumbsHtml += `
        <span class="text-gray-300">/</span>
        <span class="text-gray-700 font-medium">${currentFilters.pseudocategoria}</span>
      `;
    }

    categoryTitle.textContent = title;
    categoryDescription.textContent = description;
    breadcrumbs.innerHTML = breadcrumbsHtml;
  }

  function showLoader() {
    productListingContainer.classList.remove("hidden");
    productGrid.style.display = "none";
    noResultsMessage.classList.add("hidden");
    productGridLoader.style.display = "grid";
    
    if (loadMoreBtn) loadMoreBtn.style.display = "none";
    if (showLessBtn) showLessBtn.style.display = "none";
  }

  function hideLoader() {
    productGridLoader.style.display = "none";
  }

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

  function loadMoreProducts() {
    const nextBatch = allProducts.slice(
      currentDisplayedProducts,
      currentDisplayedProducts + productsPerPage
    );
    renderProducts(nextBatch, false); 
  }

  function showLessProducts() {
    renderProducts(allProducts.slice(0, productsPerPage), true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  let debounceTimeout;
  function debounceFilterProducts() {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      applyFilters();
    }, 500);
  }

  init();
});