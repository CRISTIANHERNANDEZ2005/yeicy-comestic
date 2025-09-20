document.addEventListener("DOMContentLoaded", function () {
  // Estado inicial de los filtros
  let currentFilters = {
    categoria_principal: window.appData.categoriaPrincipal.nombre,
    subcategoria: window.appData.subcategoriaActual.nombre, // Fijo
    pseudocategoria: 'all',
    marca: 'all',
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
    
    minPriceInput.value = currentFilters.min_price || '';
    maxPriceInput.value = currentFilters.max_price || '';
    
    updatePriceLabels();
  }

  function updatePriceLabels() {
    minPriceLabel.textContent = minPriceInput.value ? `$${minPriceInput.value}` : '$0';
    maxPriceLabel.textContent = maxPriceInput.value ? `$${maxPriceInput.value}` : '$0';
  }

  async function updateAllFilters() {
    if (isUpdatingFilters) return;
    isUpdatingFilters = true;
    
    try {
      await Promise.all([
        updatePseudocategoryFilters(),
        updateBrandFilters()
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
        minPriceInput.value = data.min_price || 0;
      }
      if (maxPriceInput) {
        maxPriceInput.value = data.max_price || 1000;
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