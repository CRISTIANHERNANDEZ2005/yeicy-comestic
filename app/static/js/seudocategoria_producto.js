document.addEventListener("DOMContentLoaded", function () {
  // Estado inicial de los filtros (con contexto fijo)
  let currentFilters = {
    categoria_principal: window.appData.categoriaPrincipal.nombre,
    subcategoria: window.appData.subcategoriaActual.nombre,
    pseudocategoria: window.appData.seudocategoriaActual.nombre, // Fijo
    marca: 'all',
    genero: 'all',
    color: 'all',
    tono: 'all',
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
  const productCount = document.getElementById("product-count");
  const totalProductCount = document.getElementById("total-product-count");
  
  // Filtros
  const brandFilters = document.getElementById("brand-filters-content");
  const genderFilterSection = document.getElementById("gender-filter-section");
  const genderFilters = document.getElementById("gender-filters-content");
  const colorFilterSection = document.getElementById("color-filter-section");
  const colorFilters = document.getElementById("color-filters-content");
  const toneFilterSection = document.getElementById("tone-filter-section");
  const toneFilters = document.getElementById("tone-filters-content");
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
    setupEventListeners();
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
    const brandInput = filterDrawer.querySelector(`input[name="brand"][value="${currentFilters.marca}"]`);
    if (brandInput) brandInput.checked = true;
    
    const genderInput = filterDrawer.querySelector(`input[name="gender"][value="${currentFilters.genero}"]`);
    if (genderInput) genderInput.checked = true;

    const colorInput = filterDrawer.querySelector(`input[name="color"][value="${currentFilters.color}"]`);
    if (colorInput) colorInput.checked = true;

    const toneInput = filterDrawer.querySelector(`input[name="tone"][value="${currentFilters.tono}"]`);
    if (toneInput) toneInput.checked = true;

    const functionInput = filterDrawer.querySelector(`input[name="function"][value="${currentFilters.funcion}"]`);
    if (functionInput) functionInput.checked = true;

    const ingredientInput = filterDrawer.querySelector(`input[name="ingredient"][value="${currentFilters.ingrediente_clave}"]`);
    if (ingredientInput) ingredientInput.checked = true;

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
    if (window.appData.tonos && window.appData.tonos.length > 0) {
      toneFilterSection.classList.remove('hidden');
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
        updateBrandFilters(),
        updateGenderFilters(),
        updateColorFilters(),
        updateToneFilters(),
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

  async function updateBrandFilters() {
    try {
      const params = new URLSearchParams();
      if (currentFilters.categoria_principal) params.append('categoria_principal', currentFilters.categoria_principal);
      if (currentFilters.subcategoria) params.append('subcategoria', currentFilters.subcategoria);
      if (currentFilters.pseudocategoria) params.append('seudocategoria', currentFilters.pseudocategoria);
      if (currentFilters.genero !== 'all') params.append('genero', currentFilters.genero);
      if (currentFilters.color !== 'all') params.append('color', currentFilters.color);
      if (currentFilters.tono !== 'all') params.append('tono', currentFilters.tono);
      if (currentFilters.funcion !== 'all') params.append('funcion', currentFilters.funcion);
      if (currentFilters.ingrediente_clave !== 'all') params.append('ingrediente_clave', currentFilters.ingrediente_clave);
      if (currentFilters.resistente_al_agua !== 'all') params.append('resistente_al_agua', currentFilters.resistente_al_agua);
      
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

  // --- Funciones para actualizar filtros de especificaciones ---

  async function updateDynamicFilter(filterName, filterKey, endpoint, sectionElement, contentElement) {
    try {
      const params = new URLSearchParams();
      // Añadir todos los filtros excepto el que se está actualizando
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (key !== filterKey && value !== 'all' && value !== '') {
          params.append(key, value);
        }
      });

      const response = await fetch(`${endpoint}?${params.toString()}`);
      if (!response.ok) throw new Error(`Error ${response.status}`);
      
      const options = await response.json();
      
      if (options.length > 0) {
        sectionElement.classList.remove('hidden');
      } else {
        sectionElement.classList.add('hidden');
      }

      contentElement.innerHTML = `
        <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
          <input type="radio" name="${filterName}" value="all" class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300" ${currentFilters[filterKey] === 'all' ? 'checked' : ''}>
          <span class="ml-3 text-gray-700 font-medium">Todos</span>
        </label>
      `;

      options.forEach((option) => {
        const optionHtml = `
          <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
            <input type="radio" name="${filterName}" value="${option}" class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300" ${currentFilters[filterKey] === option ? 'checked' : ''}>
            <span class="ml-3 text-gray-700">${option.charAt(0).toUpperCase() + option.slice(1)}</span>
          </label>
        `;
        contentElement.insertAdjacentHTML("beforeend", optionHtml);
      });

      contentElement.querySelectorAll(`input[name="${filterName}"]`).forEach(input => {
        input.addEventListener('change', (e) => {
          currentFilters[filterKey] = e.target.value;
          applyFilters();
        });
      });

    } catch (error) {
      console.error(`Error al actualizar ${filterName}:`, error);
      sectionElement.classList.add('hidden');
    }
  }

  function updateGenderFilters() {
    return updateDynamicFilter('gender', 'genero', '/api/filtros/generos', genderFilterSection, genderFilters);
  }

  function updateColorFilters() {
    return updateDynamicFilter('color', 'color', '/api/filtros/colores', colorFilterSection, colorFilters);
  }

  function updateToneFilters() {
    return updateDynamicFilter('tone', 'tono', '/api/filtros/tonos', toneFilterSection, toneFilters);
  }

  function updateFunctionFilters() {
    return updateDynamicFilter('function', 'funcion', '/api/filtros/funciones', functionFilterSection, functionFilters);
  }

  function updateIngredientFilters() {
    return updateDynamicFilter('ingredient', 'ingrediente_clave', '/api/filtros/ingredientes_clave', ingredientFilterSection, ingredientFilters);
  }

  function updateWaterproofFilters() {
    return updateDynamicFilter('waterproof', 'resistente_al_agua', '/api/filtros/resistente_al_agua', waterproofFilterSection, waterproofFilters);
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
    
    if (currentFilters.marca !== 'all') {
      tags.push(createFilterTag('marca', currentFilters.marca, currentFilters.marca));
    }

    if (currentFilters.genero !== 'all') {
      tags.push(createFilterTag('genero', currentFilters.genero, `Género: ${currentFilters.genero}`));
    }

    if (currentFilters.color !== 'all') {
      tags.push(createFilterTag('color', currentFilters.color, `Color: ${currentFilters.color}`));
    }

    if (currentFilters.tono !== 'all') {
      tags.push(createFilterTag('tono', currentFilters.tono, `Tono: ${currentFilters.tono}`));
    }

    if (currentFilters.funcion !== 'all') {
      tags.push(createFilterTag('funcion', currentFilters.funcion, `Función: ${currentFilters.funcion}`));
    }

    if (currentFilters.ingrediente_clave !== 'all') {
      tags.push(createFilterTag('ingrediente_clave', currentFilters.ingrediente_clave, `Ingrediente: ${currentFilters.ingrediente_clave}`));
    }

    if (currentFilters.resistente_al_agua !== 'all') {
      tags.push(createFilterTag('resistente_al_agua', currentFilters.resistente_al_agua, `Resistente: ${currentFilters.resistente_al_agua}`));
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
      case 'marca':
        currentFilters.marca = 'all';
        break;
      case 'genero':
        currentFilters.genero = 'all';
        break;
      case 'color':
        currentFilters.color = 'all';
        break;
      case 'tono':
        currentFilters.tono = 'all';
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
      pseudocategoria: window.appData.seudocategoriaActual.nombre,
      marca: 'all',
      genero: 'all',
      color: 'all',
      tono: 'all',
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
      const seudocategoriaNombre = window.appData.seudocategoriaActual.nombre;
      const params = new URLSearchParams();
      if (seudocategoriaNombre) {
        params.append("seudocategoria", seudocategoriaNombre);
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

    if (currentFilters.genero && currentFilters.genero !== 'all') activeFilters.push(`para <strong>"${currentFilters.genero}"</strong>`);
    if (currentFilters.color && currentFilters.color !== 'all') activeFilters.push(`de color <strong>"${currentFilters.color}"</strong>`);
    if (currentFilters.tono && currentFilters.tono !== 'all') activeFilters.push(`en tono <strong>"${currentFilters.tono}"</strong>`);
    if (currentFilters.funcion && currentFilters.funcion !== 'all') activeFilters.push(`con función <strong>"${currentFilters.funcion}"</strong>`);
    if (currentFilters.ingrediente_clave && currentFilters.ingrediente_clave !== 'all') activeFilters.push(`con <strong>"${currentFilters.ingrediente_clave}"</strong>`);

    if (currentFilters.min_price && currentFilters.max_price) {
        activeFilters.push(`con precios entre <strong>$${currentFilters.min_price}</strong> y <strong>$${currentFilters.max_price}</strong>`);
    } else if (currentFilters.min_price) {
        activeFilters.push(`con precio mayor a <strong>$${currentFilters.min_price}</strong>`);
    } else if (currentFilters.max_price) {
        activeFilters.push(`con precio menor a <strong>$${currentFilters.max_price}</strong>`);
    }

    if (activeFilters.length > 0) {
        titleEl.textContent = 'No se encontraron productos con tu selección';
        let suggestionText = `Dentro de <strong>${window.appData.seudocategoriaActual.nombre}</strong>, no hemos podido encontrar productos `;
        suggestionText += activeFilters.join(' y ');
        suggestionText += '.<br><br><strong>Sugerencia:</strong> Intenta ajustar o eliminar algunos filtros para ver más resultados.';
        suggestionEl.innerHTML = suggestionText;
        clearBtn.classList.remove('hidden');
    } else {
        titleEl.textContent = '¡Vaya! No encontramos productos';
        suggestionEl.innerHTML = `Parece que no hay productos disponibles en la seudocategoría <strong>${window.appData.seudocategoriaActual.nombre}</strong> en este momento. Vuelve a intentarlo más tarde.`;
        clearBtn.classList.add('hidden');
    }

    productListingContainer.classList.add("hidden");
    noResultsMessage.classList.remove("hidden");
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

  init();
});