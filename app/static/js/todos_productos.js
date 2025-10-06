document.addEventListener("DOMContentLoaded", function () {
  // Estado inicial de los filtros
  let currentFilters = {
    categoria_principal: 'all',
    subcategoria: 'all',
    pseudocategoria: 'all',
    marca: 'all',
    genero: 'all',
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
  const categoryFilters = document.getElementById("category-filters-content");
  const subcategoryFilters = document.getElementById("subcategory-filters-content");
  const pseudocategoryFilters = document.getElementById("pseudocategory-filters-content");
  const brandFilters = document.getElementById("brand-filters-content");
  const genderFilters = document.getElementById("gender-filters-content");
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
  let isUpdatingFilters = false; // Bandera para evitar actualizaciones simultáneas

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

  // Inicialización
  async function init() {
    setupEventListeners();
    
    // Cargar datos iniciales
    await updateAllFilters();
    await fetchProductsWithFilters();
    await fetchAndSetPriceRange();
  }

  // Función para abrir/cerrar el drawer de filtros
  function toggleFilterDrawer(forceOpen = null) {
    const isOpen = filterDrawer.classList.contains("open");
    const shouldOpen = forceOpen !== null ? forceOpen : !isOpen;

    if (shouldOpen) {
      // --- Secuencia de Apertura Profesional ---
      filterModalOverlay.classList.remove("hidden");
      if (filterDrawer.classList.contains("hidden")) {
        filterDrawer.classList.remove("hidden");
        void filterDrawer.offsetWidth;
      }
      filterDrawer.classList.add("open");
      syncFiltersWithCurrentValues();
    } else {
      // --- Secuencia de Cierre ---
      filterDrawer.classList.remove("open");
      filterModalOverlay.classList.add("hidden");
    }
  }

  // Sincronizar los filtros del drawer con los valores actuales
  function syncFiltersWithCurrentValues() {
    // Sincronizar categorías
    const categoryInput = filterDrawer.querySelector(`input[name="category"][value="${currentFilters.categoria_principal}"]`);
    if (categoryInput) categoryInput.checked = true;
    
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

  // Función para actualizar todos los filtros (categorías, subcategorías, etc.)
  async function updateAllFilters() {
    if (isUpdatingFilters) return;
    isUpdatingFilters = true;
    
    try {
      await Promise.all([
        updateCategoryFilters(),
        updateSubcategoryFilters(),
        updatePseudocategoryFilters(),
        updateBrandFilters(),
        updateGenderFilters()
      ]);
      updateAppliedFiltersTags();
    } catch (error) {
      console.error('Error al actualizar filtros:', error);
    } finally {
      isUpdatingFilters = false;
    }
  }

  // Función para crear una opción de filtro (radio button)
  function createFilterOption(name, value, label, checked, isFirst = false) {
    const labelClass = isFirst ? 'font-medium' : '';
    return `
      <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
        <input
          type="radio"
          name="${name}"
          value="${value}"
          class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300"
          ${checked ? 'checked' : ''}
        />
        <span class="ml-3 text-gray-700 ${labelClass}">${label}</span>
      </label>
    `;
  }

  // Función genérica para actualizar un tipo de filtro
  async function updateFilterGroup(endpoint, container, filterKey, allLabel) {
    try {
      const params = new URLSearchParams();
      if (currentFilters.categoria_principal && currentFilters.categoria_principal !== 'all') params.append('categoria_principal', currentFilters.categoria_principal);
      if (currentFilters.subcategoria && currentFilters.subcategoria !== 'all') params.append('subcategoria', currentFilters.subcategoria);
      if (currentFilters.pseudocategoria && currentFilters.pseudocategoria !== 'all') params.append('seudocategoria', currentFilters.pseudocategoria);
      if (currentFilters.marca && currentFilters.marca !== 'all') params.append('marca', currentFilters.marca);

      const response = await fetch(`${endpoint}?${params.toString()}`);
      if (!response.ok) throw new Error(`Error ${response.status}`);
      
      const items = await response.json();
      
      container.innerHTML = createFilterOption(filterKey, 'all', allLabel, currentFilters[filterKey] === 'all', true);

      items.forEach(item => {
        const name = typeof item === 'string' ? item : item.nombre;
        container.innerHTML += createFilterOption(filterKey, name, name, currentFilters[filterKey] === name);
      });

      // Re-attach event listeners
      container.querySelectorAll(`input[name="${filterKey}"]`).forEach(input => {
        input.addEventListener('change', (e) => {
          currentFilters[filterKey] = e.target.value;
          // Si se cambia una categoría superior, resetear las inferiores
          if (filterKey === 'categoria_principal') {
            currentFilters.subcategoria = 'all';
            currentFilters.pseudocategoria = 'all';
          }
          if (filterKey === 'subcategoria') {
            currentFilters.pseudocategoria = 'all';
          }
          applyFilters();
        });
      });

    } catch (error) {
      console.error(`Error al actualizar ${filterKey}:`, error);
      // Fallback: mostrar solo la opción "Todos"
      container.innerHTML = createFilterOption(filterKey, 'all', allLabel, true, true);
    }
  }

  // Funciones específicas para cada filtro
  function updateCategoryFilters() {
    return updateFilterGroup('/api/filtros/categorias', categoryFilters, 'categoria_principal', 'Todas las categorías');
  }

  // Función para popular los filtros de subcategoría
  function updateSubcategoryFilters() {
    return updateFilterGroup('/api/filtros/subcategorias', subcategoryFilters, 'subcategoria', 'Todas las subcategorías');
  }

  // Función para popular los filtros de pseudocategoría
  function updatePseudocategoryFilters() {
    return updateFilterGroup('/api/filtros/seudocategorias', pseudocategoryFilters, 'pseudocategoria', 'Todas las pseudocategorías');
  }

  // Función para actualizar las opciones de marcas
  function updateBrandFilters() {
    return updateFilterGroup('/api/filtros/marcas', brandFilters, 'marca', 'Todas las marcas');
  }

  // Función para actualizar las opciones de género
  function updateGenderFilters() {
    return updateFilterGroup('/api/filtros/generos', genderFilters, 'genero', 'Todos los géneros');
  }

  // Función para actualizar las etiquetas de filtros aplicados
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
      
      tag.querySelector('button').addEventListener('click', () => removeFilter(key));
      return tag;
    };
    
    const tags = [
      createFilterTag('categoria_principal', currentFilters.categoria_principal, currentFilters.categoria_principal),
      createFilterTag('subcategoria', currentFilters.subcategoria, currentFilters.subcategoria),
      createFilterTag('pseudocategoria', currentFilters.pseudocategoria, currentFilters.pseudocategoria),
      createFilterTag('marca', currentFilters.marca, currentFilters.marca),
      createFilterTag('genero', currentFilters.genero, currentFilters.genero),
      createFilterTag('min_price', currentFilters.min_price, `Min: $${currentFilters.min_price}`),
      createFilterTag('max_price', currentFilters.max_price, `Max: $${currentFilters.max_price}`)
    ].filter(Boolean); // filter(Boolean) elimina los nulos
    
    tags.forEach(tag => appliedFiltersContainer.appendChild(tag));
    
    appliedFiltersContainer.classList.toggle('hidden', tags.length === 0);
  }

  // Función para quitar un filtro específico
  function removeFilter(filterKey) {
    switch (filterKey) {
      case 'categoria_principal':
        currentFilters.categoria_principal = 'all';
        currentFilters.subcategoria = 'all';
        currentFilters.pseudocategoria = 'all';
        break;
      case 'subcategoria':
        currentFilters.subcategoria = 'all';
        currentFilters.pseudocategoria = 'all';
        break;
      case 'pseudocategoria':
        currentFilters.pseudocategoria = 'all';
        break;
      case 'marca':
        currentFilters.marca = 'all';
        break;
      case 'genero':
        currentFilters.genero = 'all';
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
    currentFilters.min_price = minPriceInput.value;
    currentFilters.max_price = maxPriceInput.value;
    
    await updateAllFilters();
    await fetchProductsWithFilters();
  }

  // Función para restablecer todos los filtros
  function resetAllFilters() {
    currentFilters = {
      categoria_principal: 'all',
      subcategoria: 'all',
      pseudocategoria: 'all',
      marca: 'all',
      genero: 'all',
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

  // Función para cargar productos con filtros
  async function fetchProductsWithFilters() {
    if (isFetching) return;
    isFetching = true;

    showLoader();
    await new Promise(resolve => setTimeout(resolve, 300));

    const params = new URLSearchParams();
    
    // Agregar todos los filtros actuales
    currentFilters.ordenar_por = sortSelect.value;
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

  function displayDynamicNoResultsMessage(filters) {
    const titleEl = document.getElementById('no-results-title');
    const suggestionEl = document.getElementById('no-results-suggestion');
    const clearBtn = document.getElementById('clear-search-btn');

    if (!titleEl || !suggestionEl || !clearBtn) return;

    const activeFilters = [];
    if (currentFilters.marca && currentFilters.marca !== 'all') activeFilters.push(`de la marca <strong>"${currentFilters.marca}"</strong>`);
    if (currentFilters.pseudocategoria && currentFilters.pseudocategoria !== 'all') activeFilters.push(`en <strong>"${currentFilters.pseudocategoria}"</strong>`);
    else if (currentFilters.subcategoria && currentFilters.subcategoria !== 'all') activeFilters.push(`en la subcategoría <strong>"${currentFilters.subcategoria}"</strong>`);
    else if (currentFilters.categoria_principal && currentFilters.categoria_principal !== 'all') activeFilters.push(`en la categoría <strong>"${currentFilters.categoria_principal}"</strong>`);

    if (currentFilters.min_price && currentFilters.max_price) {
        activeFilters.push(`con precios entre <strong>$${currentFilters.min_price}</strong> y <strong>$${currentFilters.max_price}</strong>`);
    } else if (currentFilters.min_price) {
        activeFilters.push(`con precio mayor a <strong>$${currentFilters.min_price}</strong>`);
    } else if (currentFilters.max_price) {
        activeFilters.push(`con precio menor a <strong>$${currentFilters.max_price}</strong>`);
    }

    if (activeFilters.length > 0) {
        titleEl.textContent = 'No hay productos que coincidan con tu selección';
        let suggestionText = 'No hemos podido encontrar productos ';
        suggestionText += activeFilters.join(' y ');
        suggestionText += '.<br><br><strong>Sugerencia:</strong> Intenta ajustar o eliminar algunos filtros para ver más resultados.';
        suggestionEl.innerHTML = suggestionText;
        clearBtn.classList.remove('hidden');
    } else {
        titleEl.textContent = '¡Vaya! No encontramos productos';
        suggestionEl.innerHTML = 'Parece que no hay productos disponibles en este momento. Vuelve a intentarlo más tarde.';
        clearBtn.classList.add('hidden');
    }

    productListingContainer.classList.add("hidden");
    noResultsMessage.classList.remove("hidden");
  }

  // Función para actualizar el título y breadcrumbs
  function updateCategoryInfo() {
    let title = "Todos los Productos";
    let description = "Descubre nuestra exclusiva selección de productos de alta calidad";
    let breadcrumbsHtml = `
      <a href="/" class="text-pink-600 hover:text-pink-800 transition-colors duration-200 flex items-center">
        <i class="fas fa-home mr-1.5 text-sm"></i> Inicio
      </a>
      <span class="text-gray-300">/</span>
      <span class="text-gray-700 font-medium">Productos</span>
    `;

    if (currentFilters.categoria_principal && currentFilters.categoria_principal !== "all") {
      const categoryName = currentFilters.categoria_principal;
      title = categoryName;
      description = `Explora nuestros productos en la categoría ${categoryName}.`;
      breadcrumbsHtml = `
        <a href="/" class="text-pink-600 hover:text-pink-800 transition-colors duration-200 flex items-center">
          <i class="fas fa-home mr-1.5 text-sm"></i> Inicio
        </a>
        <span class="text-gray-300">/</span>
        <a href="/productos" class="text-pink-600 hover:text-pink-800 transition-colors">Productos</a>
        <span class="text-gray-300">/</span>
        <span class="text-gray-700 font-medium">${categoryName}</span>
      `;
    }

    if (currentFilters.subcategoria && currentFilters.subcategoria !== "all") {
      title = currentFilters.subcategoria;
      description = `Descubre la variedad en la subcategoría ${currentFilters.subcategoria}.`;
      breadcrumbsHtml += `
        <span class="text-gray-300">/</span>
        <span class="text-gray-700 font-medium">${currentFilters.subcategoria}</span>
      `;
    }

    if (currentFilters.pseudocategoria && currentFilters.pseudocategoria !== "all") {
      title = currentFilters.pseudocategoria;
      description = `Encuentra lo mejor en ${currentFilters.pseudocategoria}.`;
      breadcrumbsHtml += `
        <span class="text-gray-300">/</span>
        <span class="text-gray-700 font-medium">${currentFilters.pseudocategoria}</span>
      `;
    }

    categoryTitle.textContent = title;
    categoryDescription.textContent = description;
    breadcrumbs.innerHTML = breadcrumbsHtml;
  }

  function setupEventListeners() {
    // Drawer
    if (filterBtn) filterBtn.addEventListener("click", () => toggleFilterDrawer(true));
    if (closeFilterBtn) closeFilterBtn.addEventListener("click", () => toggleFilterDrawer(false));
    if (filterModalOverlay) filterModalOverlay.addEventListener("click", () => toggleFilterDrawer(false));
    if (filterDrawer) filterDrawer.addEventListener("click", (event) => event.stopPropagation());

    // Botones del Drawer
    if (applyFiltersBtn) {
      applyFiltersBtn.addEventListener("click", () => {
        currentFilters.categoria_principal = filterDrawer.querySelector('input[name="category"]:checked')?.value || "all";
        currentFilters.subcategoria = filterDrawer.querySelector('input[name="subcategory"]:checked')?.value || "all";
        currentFilters.pseudocategoria = filterDrawer.querySelector('input[name="pseudocategory"]:checked')?.value || "all";
        currentFilters.marca = filterDrawer.querySelector('input[name="brand"]:checked')?.value || "all";
        currentFilters.genero = filterDrawer.querySelector('input[name="gender"]:checked')?.value || "all";
        applyFilters();
        toggleFilterDrawer(false);
      });
    }

    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener("click", () => {
        resetAllFilters();
        toggleFilterDrawer(false);
      });
    }

    // Inputs de precio
    if (minPriceInput) minPriceInput.addEventListener("input", () => {
      updatePriceLabels();
      debounceFilterProducts();
    });
    
    if (maxPriceInput) maxPriceInput.addEventListener("input", () => {
      updatePriceLabels();
      debounceFilterProducts();
    });

    // Ordenamiento
    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        currentFilters.ordenar_por = sortSelect.value;
        fetchProductsWithFilters();
      });
    }

    // Limpiar filtros
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", resetAllFilters);
    }

    // Paginación
    if (loadMoreBtn) loadMoreBtn.addEventListener("click", loadMoreProducts);
    if (showLessBtn) showLessBtn.addEventListener("click", showLessProducts);

    // Limpiar búsqueda en "no resultados"
    const clearSearchBtn = document.getElementById("clear-search-btn");
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener("click", resetAllFilters);
    }
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
    const nextBatch = allProducts.slice(currentDisplayedProducts, currentDisplayedProducts + productsPerPage);
    renderProducts(nextBatch, false);
  }

  function showLessProducts() {
    renderProducts(allProducts.slice(0, productsPerPage), true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Función para obtener y establecer el rango de precios
  async function fetchAndSetPriceRange() {
    try {
      const response = await fetch('/api/productos/precios_rango');
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

  // Función para debounce
  let debounceTimeout;
  function debounceFilterProducts() {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      applyFilters();
    }, 500);
  }

  // Carga inicial
  init();
});