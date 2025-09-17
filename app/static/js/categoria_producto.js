document.addEventListener("DOMContentLoaded", function () {
  const subcategoriasDisponibles = window.appData.subcategorias;
  const seudocategoriasDisponibles = window.appData.seudocategorias;
  const productGrid = document.getElementById("product-grid");
  const brandFilters = document.getElementById("brand-filters-content");
  const productGridLoader = document.getElementById("product-grid-loader");
  const productListingContainer = document.getElementById("product-listing-container");
  const noResultsMessage = document.getElementById("no-results-message");
  const categoryTitle = document.getElementById("category-title");
  const categoryDescription = document.getElementById("category-description");
  const breadcrumbs = document.getElementById("breadcrumbs");
  const productCount = document.getElementById("product-count");
  const totalProductCount = document.getElementById("total-product-count");
  const subcategoryFilters = document.getElementById("subcategory-filters-content");
  const pseudocategoryFilters = document.getElementById("pseudocategory-filters-content");
  const clearFiltersBtn = document.getElementById("clear-filters");
  const resetFiltersBtn = document.getElementById("reset-filters");

  // Elementos del drawer de filtros unificado
  const filterDrawer = document.getElementById("filter-drawer");
  const filterBtn = document.getElementById("filter-btn");
  const closeFilterBtn = document.getElementById("close-filter-btn");
  const applyFiltersBtn = document.getElementById("apply-filters");
  const filterModalOverlay = document.getElementById("filter-modal-overlay");

  const sortSelect = document.getElementById("sort-select");
  const minPriceInput = document.getElementById("min-price");
  const maxPriceInput = document.getElementById("max-price");
  const minPriceLabel = document.getElementById("min-price-label");
  const maxPriceLabel = document.getElementById("max-price-label");

  let allProducts = [];
  const productsPerPage = 12;
  let currentDisplayedProducts = 0;
  let isFetching = false;

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

  const loadMoreBtn = document.getElementById("load-more-btn");
  const showLessBtn = document.getElementById("show-less-btn");

  // Función para abrir/cerrar el drawer de filtros
  function toggleFilterDrawer(forceOpen = null) {
    const isOpen = filterDrawer.classList.contains("open");
    const shouldOpen = forceOpen !== null ? forceOpen : !isOpen;

    if (shouldOpen) {
      // --- Secuencia de Apertura Profesional ---
      // 1. Hacer visible el overlay
      filterModalOverlay.classList.remove("hidden");

      // 2. Si es la primera vez, quitar 'hidden' para que el elemento exista en el layout
      if (filterDrawer.classList.contains("hidden")) {
        filterDrawer.classList.remove("hidden");
        // 3. Forzar un reflow. Es un truco necesario para que la transición se aplique correctamente en la primera apertura.
        void filterDrawer.offsetWidth;
      }

      // 4. Añadir la clase 'open' para iniciar la animación de entrada
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
    // Sincronizar subcategorías
    const selectedSubcategory = subcategoryFilters.querySelector('input[name="subcategory"]:checked')?.value || "all";
    const subcategoryInput = filterDrawer.querySelector(`input[name="subcategory"][value="${selectedSubcategory}"]`);
    if (subcategoryInput) subcategoryInput.checked = true;
    
    // Sincronizar pseudocategorías
    const selectedPseudocategory = pseudocategoryFilters.querySelector('input[name="pseudocategory"]:checked')?.value || "all";
    const pseudocategoryInput = filterDrawer.querySelector(`input[name="pseudocategory"][value="${selectedPseudocategory}"]`);
    if (pseudocategoryInput) pseudocategoryInput.checked = true;

    // Sincronizar marcas
    const selectedBrand = brandFilters.querySelector('input[name="brand"]:checked')?.value || "all";
    const brandInput = filterDrawer.querySelector(`input[name="brand"][value="${selectedBrand}"]`);
    if (brandInput) brandInput.checked = true;
    
    // Sincronizar precios
    minPriceInput.value = minPriceInput.value || '';
    maxPriceInput.value = maxPriceInput.value || '';
    
    // Actualizar etiquetas de precio
    updatePriceLabels();
  }

  // Actualizar etiquetas de precio
  function updatePriceLabels() {
    minPriceLabel.textContent = minPriceInput.value ? `$${minPriceInput.value}` : '$0';
    maxPriceLabel.textContent = maxPriceInput.value ? `$${maxPriceInput.value}` : '$0';
  }

  // Event listeners para el drawer de filtros
  if (filterBtn) {
    filterBtn.addEventListener("click", () => toggleFilterDrawer(true));
  }
  if (closeFilterBtn) {
    closeFilterBtn.addEventListener("click", () => toggleFilterDrawer(false));
  }
  if (filterModalOverlay) {
    filterModalOverlay.addEventListener("click", () => toggleFilterDrawer(false));
  }

  // Prevenir clicks dentro del drawer de cerrarlo
  if (filterDrawer) {
    filterDrawer.addEventListener("click", function (event) {
      event.stopPropagation();
    });
  }

  // Event listener para aplicar filtros desde el drawer
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener("click", () => {
      // Obtener valores seleccionados en el drawer
      const selectedSubcategory = filterDrawer.querySelector('input[name="subcategory"]:checked')?.value || "all";
      const selectedPseudocategory = filterDrawer.querySelector('input[name="pseudocategory"]:checked')?.value || "all";
      const selectedBrand = filterDrawer.querySelector('input[name="brand"]:checked')?.value || "all";
      
      // Actualizar los filtros principales
      subcategoryFilters.querySelector(`input[value="${selectedSubcategory}"]`)?.click();
      pseudocategoryFilters.querySelector(`input[value="${selectedPseudocategory}"]`)?.click();
      brandFilters.querySelector(`input[value="${selectedBrand}"]`)?.click();
      
      // Cerrar el drawer
      toggleFilterDrawer(false);
    });
  }

  // Event listener para restablecer filtros desde el drawer
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", () => {
      // Restablecer todos los filtros en el drawer
      filterDrawer.querySelector('input[name="subcategory"][value="all"]')?.click();
      filterDrawer.querySelector('input[name="pseudocategory"][value="all"]')?.click();
      filterDrawer.querySelector('input[name="brand"][value="all"]')?.click();
      minPriceInput.value = '';
      maxPriceInput.value = '';
      updatePriceLabels();
      
      // Aplicar los cambios
      applyFiltersBtn.click();
    });
  }

  // Event listeners para los inputs de precio
  if (minPriceInput) {
    minPriceInput.addEventListener("input", () => {
      updatePriceLabels();
      // Aplicar filtros automáticamente al cambiar el precio
      if (!isFetching) {
        fetchProductsWithFilters();
      }
    });
  }
  
  if (maxPriceInput) {
    maxPriceInput.addEventListener("input", () => {
      updatePriceLabels();
      // Aplicar filtros automáticamente al cambiar el precio
      if (!isFetching) {
        fetchProductsWithFilters();
      }
    });
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

  function renderProducts(productsToRender, animate = false) {
    productGrid.innerHTML = "";
    productListingContainer.classList.remove("hidden");
    noResultsMessage.classList.add("hidden");
    productGrid.style.display = "grid";

    productsToRender.forEach((product, index) => {
      const productCard = renderProductCard(product);
        if (animate) {
            productCard.classList.add("card-enter");
            productCard.style.animationDelay = `${index * 50}ms`;
        }
        productGrid.appendChild(productCard);
      });

    currentDisplayedProducts = productGrid.children.length;
    productCount.textContent = currentDisplayedProducts;
    totalProductCount.textContent = allProducts.length;

    if (currentDisplayedProducts < allProducts.length) {
      loadMoreBtn.style.display = "block";
    } else {
      loadMoreBtn.style.display = "none";
    }

    if (currentDisplayedProducts > productsPerPage) {
      showLessBtn.style.display = "block";
    } else {
      showLessBtn.style.display = "none";
    }
  }


  // Función para popular los filtros de subcategoría
  function updateSubcategoryFilters() {
    const targetElement = subcategoryFilters;
    targetElement.innerHTML = "";

    const allOptionHtml = `
        <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
          <input
            type="radio"
            name="subcategory"
            value="all"
            class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300"
            checked
          />
          <span class="ml-3 text-gray-700 font-medium">Todas las subcategorías</span>
        </label>
      `;
    targetElement.insertAdjacentHTML("beforeend", allOptionHtml);

    subcategoriasDisponibles.forEach((sub) => {
      const subcategoryHtml = `
          <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
            <input
              type="radio"
              name="subcategory"
              value="${sub.nombre}"
              class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300"
            />
            <span class="ml-3 text-gray-700">${sub.nombre}</span>
          </label>
        `;
      targetElement.insertAdjacentHTML("beforeend", subcategoryHtml);
    });
  }

  // Función para popular los filtros de pseudocategoría
  function updatePseudocategoryFilters(selectedSubcategoryName) {
    const targetElement = pseudocategoryFilters;
    targetElement.innerHTML = "";

    const allOptionHtml = `
        <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
          <input
            type="radio"
            name="pseudocategory"
            value="all"
            class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300"
            checked
          />
          <span class="ml-3 text-gray-700 font-medium">Todas las pseudocategorías</span>
        </label>
      `;
    targetElement.insertAdjacentHTML("beforeend", allOptionHtml);

    if (selectedSubcategoryName !== "all") {
      const subcategoryId = subcategoriasDisponibles.find(
        (sub) => sub.nombre === selectedSubcategoryName
      )?.id;
      if (subcategoryId) {
        const filteredPseudocategorias = seudocategoriasDisponibles.filter(
          (pseudo) => pseudo.subcategoria_id == subcategoryId
        );
        filteredPseudocategorias.forEach((pseudo) => {
          const pseudocategoryHtml = `
              <label class="flex items-center p-2.5 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors duration-200">
                <input
                  type="radio"
                  name="pseudocategory"
                  value="${pseudo.nombre}"
                  class="rounded-full text-pink-600 focus:ring-pink-500 border-gray-300"
                />
                <span class="ml-3 text-gray-700">${pseudo.nombre}</span>
              </label>
            `;
          targetElement.insertAdjacentHTML("beforeend", pseudocategoryHtml);
        });
      }
    }
  }

  // Función para cargar productos con filtros
  async function fetchProductsWithFilters() {
    if (isFetching) return;
    isFetching = true;

    showLoader();
    await new Promise(resolve => setTimeout(resolve, 300));

    const selectedSubcategory = subcategoryFilters.querySelector('input[name="subcategory"]:checked')?.value || "all";
    const selectedPseudocategory = pseudocategoryFilters.querySelector('input[name="pseudocategory"]:checked')?.value || "all";
    const selectedBrand = brandFilters.querySelector('input[name="brand"]:checked')?.value || "all";
    const selectedSort = sortSelect.value;

    const params = new URLSearchParams();
    
    // Always include the current principal category
    params.append("categoria_principal", window.appData.categoriaPrincipal.nombre);

    if (selectedSubcategory && selectedSubcategory !== "all") {
      params.append("subcategoria", selectedSubcategory);
    }
    if (selectedPseudocategory && selectedPseudocategory !== "all") {
      params.append("seudocategoria", selectedPseudocategory);
    }
    if (selectedBrand && selectedBrand !== "all") {
      params.append("marca", selectedBrand);
    }
    if (selectedSort && selectedSort !== "newest") {
      params.append("ordenar_por", selectedSort);
    }

    // Add price filters
    const minPrice = minPriceInput.value;
    const maxPrice = maxPriceInput.value;

    if (minPrice) {
      params.append("min_price", minPrice);
    }
    if (maxPrice) {
      params.append("max_price", maxPrice);
    }

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
        displayDynamicNoResultsMessage({
          subcategory: selectedSubcategory,
          pseudocategory: selectedPseudocategory,
          brand: selectedBrand,
          minPrice: minPrice,
          maxPrice: maxPrice
        });
      } else {
        renderProducts(allProducts.slice(0, productsPerPage), true);
        updateCategoryInfo(selectedSubcategory, selectedPseudocategory);
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

  // Event listener for sort select
  if (sortSelect) {
    sortSelect.addEventListener("change", fetchProductsWithFilters);
  }

  function displayDynamicNoResultsMessage(filters) {
    const titleEl = document.getElementById('no-results-title');
    const suggestionEl = document.getElementById('no-results-suggestion');
    const clearBtn = document.getElementById('clear-search-btn');

    if (!titleEl || !suggestionEl || !clearBtn) return;

    const activeFilters = [];
    if (filters.brand && filters.brand !== 'all') activeFilters.push(`de la marca <strong>"${filters.brand}"</strong>`);
    if (filters.pseudocategory && filters.pseudocategory !== 'all') activeFilters.push(`en <strong>"${filters.pseudocategory}"</strong>`);
    else if (filters.subcategory && filters.subcategory !== 'all') activeFilters.push(`en la subcategoría <strong>"${filters.subcategory}"</strong>`);

    if (filters.minPrice && filters.maxPrice) {
        activeFilters.push(`con precios entre <strong>$${filters.minPrice}</strong> y <strong>$${filters.maxPrice}</strong>`);
    } else if (filters.minPrice) {
        activeFilters.push(`con precio mayor a <strong>$${filters.minPrice}</strong>`);
    } else if (filters.maxPrice) {
        activeFilters.push(`con precio menor a <strong>$${filters.maxPrice}</strong>`);
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
  function updateCategoryInfo(subcategory, pseudocategory) {
    const categoriaPrincipal = window.appData.categoriaPrincipal;
    let title = categoriaPrincipal.nombre;
    let description = categoriaPrincipal.descripcion || `Productos de la categoría ${categoriaPrincipal.nombre}`;
    let breadcrumbsHtml = `
      <a href="/" class="text-pink-600 hover:text-pink-800 transition-colors duration-200 flex items-center">
        <i class="fas fa-home mr-1.5 text-sm"></i> Inicio
      </a>
      <span class="text-gray-300">/</span>
      <span class="text-gray-700 font-medium">${categoriaPrincipal.nombre}</span>
    `;

    if (subcategory && subcategory !== "all") {
      const subcategoryObj = subcategoriasDisponibles.find(s => s.nombre === subcategory);
      title = subcategory;
      description = subcategoryObj?.descripcion || `Descubre la variedad en la subcategoría ${subcategory}.`;
      breadcrumbsHtml = `
        <a href="/" class="text-pink-600 hover:text-pink-800 transition-colors duration-200 flex items-center">
          <i class="fas fa-home mr-1.5 text-sm"></i> Inicio
        </a>
        <span class="text-gray-300">/</span>
        <a href="/${categoriaPrincipal.slug}" class="text-pink-600 hover:text-pink-800 transition-colors">${categoriaPrincipal.nombre}</a>
        <span class="text-gray-300">/</span>
        <span class="text-gray-700 font-medium">${subcategory}</span>
      `;
    }

    if (pseudocategory && pseudocategory !== "all") {
      const pseudocategoryObj = seudocategoriasDisponibles.find(p => p.nombre === pseudocategory);
      title = pseudocategory;
      description = pseudocategoryObj?.descripcion || `Encuentra lo mejor en ${pseudocategory}.`;
      // Asume que la subcategoría ya está en el breadcrumb
      breadcrumbsHtml += `
        <span class="text-gray-300">/</span>
        <span class="text-gray-700 font-medium">${pseudocategory}</span>
      `;
    }

    categoryTitle.textContent = title;
    categoryDescription.textContent = description;
    breadcrumbs.innerHTML = breadcrumbsHtml;
  }

  // Event listener para los filtros de escritorio
  if (subcategoryFilters) {
    subcategoryFilters.addEventListener("change", (event) => {
      const selectedSubcategory = event.target.value;
      updatePseudocategoryFilters(selectedSubcategory);
      fetchProductsWithFilters();
    });
  }

  if (pseudocategoryFilters) {
    pseudocategoryFilters.addEventListener("change", fetchProductsWithFilters);
  }

  if (brandFilters) {
    brandFilters.addEventListener("change", fetchProductsWithFilters);
  }

  // Event listener para limpiar filtros
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      subcategoryFilters.querySelector('input[value="all"]').checked = true;
      pseudocategoryFilters.querySelector('input[value="all"]').checked = true;
      brandFilters.querySelector('input[value="all"]').checked = true;

      // Also reset price inputs
      if (minPriceInput) minPriceInput.value = '';
      if (maxPriceInput) maxPriceInput.value = '';
      updatePriceLabels();

      // Also reset sort select to the new default
      sortSelect.value = "newest";

      // Update cascading filters after clearing
      updateSubcategoryFilters();
      updatePseudocategoryFilters("all");
      fetchProductsWithFilters();
    });
  }

  // Load More / Show Less functionality
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      const nextBatch = allProducts.slice(
        currentDisplayedProducts,
        currentDisplayedProducts + productsPerPage
      );
      renderProducts(nextBatch, false);
    });
  }

  if (showLessBtn) {
    showLessBtn.addEventListener("click", () => {
      renderProducts(allProducts.slice(0, productsPerPage), true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
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

  // Carga inicial
  async function init() {
    updateSubcategoryFilters();
    updatePseudocategoryFilters("all");
    await fetchAndSetPriceRange();
    await fetchProductsWithFilters();
  }

  init();

  const clearSearchBtn = document.getElementById("clear-search-btn");
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      if (clearFiltersBtn) {
        clearFiltersBtn.click();
      }
    });
  }
});