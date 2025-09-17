document.addEventListener("DOMContentLoaded", function () {
  const allCategorias = window.appData.categorias;
  const allSubcategorias = window.appData.subcategorias;
  const allSeudocategorias = window.appData.seudocategorias;
  const productGrid = document.getElementById("product-grid");
  const productGridLoader = document.getElementById("product-grid-loader");
  const productListingContainer = document.getElementById(
    "product-listing-container"
  );
  const noResultsMessage = document.getElementById("no-results-message");
  const categoryTitle = document.getElementById("category-title");
  const categoryDescription = document.getElementById("category-description");
  const breadcrumbs = document.getElementById("breadcrumbs");
  const productCount = document.getElementById("product-count");
  const totalProductCount = document.getElementById("total-product-count");
  const categoryFilters = document.getElementById("category-filters-content");
  const subcategoryFilters = document.getElementById(
    "subcategory-filters-content"
  );
  const pseudocategoryFilters = document.getElementById(
    "pseudocategory-filters-content"
  );
  const clearFiltersBtn = document.getElementById("clear-filters");

  // Mobile filter elements
  const mobileFilterDrawer = document.getElementById("mobile-filter-drawer");
  const mobileFilterBtn = document.getElementById("mobile-filter-btn");
  const closeFilterBtn = document.getElementById("close-filter-btn");
  const applyMobileFiltersBtn = document.getElementById("apply-mobile-filters");
  const closeFilterBtnResults = document.getElementById(
    "close-filter-btn-results"
  );
  const mobileCategoryFilters = document.getElementById(
    "mobile-category-filters"
  );
  const mobileSubcategoryFilters = document.getElementById(
    "mobile-subcategory-filters"
  );
  const mobilePseudocategoryFilters = document.getElementById(
    "mobile-pseudocategory-filters"
  );
  const filterModalOverlay = document.getElementById("filter-modal-overlay");

  const sortSelect = document.getElementById("sort-select");
  const minPriceInput = document.getElementById("min-price");
  const maxPriceInput = document.getElementById("max-price");
  const mobileMinPriceInput = document.getElementById("mobile-min-price");
  const mobileMaxPriceInput = document.getElementById("mobile-max-price");

  let allProducts = [];
  const productsPerPage = 12;
  let currentDisplayedProducts = 0;
  let isFetching = false; // Flag to prevent multiple simultaneous fetches

  // Toggle para los filtros del sidebar
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

  // --- Start of Corrected Animation Code ---

  function showLoader() {
    // Ensure the main container is visible so the loader can be seen
    productListingContainer.classList.remove("hidden");

    // Hide product grid and "no results" message
    productGrid.style.display = "none";
    noResultsMessage.classList.add("hidden");

    // Show loader
    productGridLoader.style.display = "grid";
    
    // Hide pagination buttons
    if (loadMoreBtn) loadMoreBtn.style.display = "none";
    if (showLessBtn) showLessBtn.style.display = "none";
  }

  function hideLoader() {
    productGridLoader.style.display = "none";
  }

  function renderProducts(productsToRender, animate = false) {
    // Clear previous products if we are doing a full animated render
    if (animate) {
        productGrid.innerHTML = "";
    }

    if (productsToRender.length === 0 && animate) { // Only show no-results if it's a fresh render
      productListingContainer.classList.add("hidden");
      noResultsMessage.classList.remove("hidden");
    } else {
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

      // Update counts
      currentDisplayedProducts = productGrid.children.length;
      productCount.textContent = currentDisplayedProducts;
      totalProductCount.textContent = allProducts.length;

      // Update pagination buttons visibility
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
  }

  // --- End of Corrected Animation Code ---

  // Función para abrir/cerrar el drawer de filtros móvil
  function toggleFilterDrawer() {
    mobileFilterDrawer.classList.toggle("open");
    filterModalOverlay.classList.toggle("hidden");
  }

  // Event listeners para el drawer móvil
  if (mobileFilterBtn) {
    mobileFilterBtn.addEventListener("click", toggleFilterDrawer);
  }
  if (closeFilterBtn) {
    closeFilterBtn.addEventListener("click", toggleFilterDrawer);
  }
  if (closeFilterBtnResults) {
    closeFilterBtnResults.addEventListener("click", toggleFilterDrawer);
  }

  // Close drawer when clicking outside (on the overlay)
  if (filterModalOverlay) {
    filterModalOverlay.addEventListener("click", toggleFilterDrawer);
  }

  // Prevent clicks inside the drawer from closing it
  if (mobileFilterDrawer) {
    mobileFilterDrawer.addEventListener("click", function (event) {
      event.stopPropagation();
    });
  }

  // Función para popular los filtros de subcategoría
  function updateSubcategoryFilters(selectedCategoryName) {
    const targetElement = subcategoryFilters;
    const mobileTargetElement = mobileSubcategoryFilters;
    targetElement.innerHTML = "";
    mobileTargetElement.innerHTML = "";

    // Add "Todas" option
    const allOptionHtml = `
        <label class="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
          <input
            type="radio"
            name="subcategory"
            value="all"
            class="rounded-full text-pink-600 focus:ring-pink-500"
            checked
          />
          <span class="ml-2 text-gray-700">Todas</span>
        </label>
      `;
    targetElement.insertAdjacentHTML("beforeend", allOptionHtml);
    mobileTargetElement.insertAdjacentHTML(
      "beforeend",
      allOptionHtml.replace(/name=\"subcategory\"/g, 'name="mobile-subcategory"')
    );

    if (selectedCategoryName !== "all") {
      const categoryId = allCategorias.find(
        (cat) => cat.nombre === selectedCategoryName
      )?.id;
      if (categoryId) {
        const filteredSubcategories = allSubcategorias.filter(
          (sub) => sub.categoria_principal_id === categoryId
        );
        filteredSubcategories.forEach((sub) => {
          const subcategoryHtml = `
              <label class="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                <input
                  type="radio"
                  name="subcategory"
                  value="${sub.nombre}"
                  class="rounded-full text-pink-600 focus:ring-pink-500"
                />
                <span class="ml-2 text-gray-700">${sub.nombre}</span>
              </label>
            `;
          targetElement.insertAdjacentHTML("beforeend", subcategoryHtml);
          mobileTargetElement.insertAdjacentHTML(
            "beforeend",
            subcategoryHtml.replace(
              /name=\"subcategory\"/g,
              'name="mobile-subcategory"'
            )
          );
        });
      }
    }
  }

  // Función para popular los filtros de pseudocategoría
  function updatePseudocategoryFilters(selectedSubcategoryName) {
    const targetElement = pseudocategoryFilters;
    const mobileTargetElement = mobilePseudocategoryFilters;
    targetElement.innerHTML = "";
    mobileTargetElement.innerHTML = "";

    // Add "Todas" option
    const allOptionHtml = `
        <label class="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
          <input
            type="radio"
            name="pseudocategory"
            value="all"
            class="rounded-full text-pink-600 focus:ring-pink-500"
            checked
          />
          <span class="ml-2 text-gray-700">Todas</span>
        </label>
      `;
    targetElement.insertAdjacentHTML("beforeend", allOptionHtml);
    mobileTargetElement.insertAdjacentHTML(
      "beforeend",
      allOptionHtml.replace(
        /name=\"pseudocategory\"/g,
        'name="mobile-pseudocategory"'
      )
    );

    if (selectedSubcategoryName !== "all") {
      const subcategoryId = allSubcategorias.find(
        (sub) => sub.nombre === selectedSubcategoryName
      )?.id;
      if (subcategoryId) {
        const filteredPseudocategorias = allSeudocategorias.filter(
          (pseudo) => pseudo.subcategoria_id == subcategoryId
        );
        filteredPseudocategorias.forEach((pseudo) => {
          const pseudocategoryHtml = `
              <label class="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                <input
                  type="radio"
                  name="pseudocategory"
                  value="${pseudo.nombre}"
                  class="rounded-full text-pink-600 focus:ring-pink-500"
                />
                <span class="ml-2 text-gray-700">${pseudo.nombre}</span>
              </label>
            `;
          targetElement.insertAdjacentHTML("beforeend", pseudocategoryHtml);
          mobileTargetElement.insertAdjacentHTML(
            "beforeend",
            pseudocategoryHtml.replace(
              /name=\"pseudocategory\"/g,
              'name="mobile-pseudocategory"'
            )
          );
        });
      }
    }
  }

  // Función para popular los filtros de categoría en el drawer móvil
  function populateMobileFilters() {
    // Categories are static, just clone them
    if (categoryFilters && mobileCategoryFilters) {
      mobileCategoryFilters.innerHTML = "";
      const desktopCategoryFilters = categoryFilters.querySelectorAll("label");
      desktopCategoryFilters.forEach((label) => {
        const newLabel = label.cloneNode(true);
        const input = newLabel.querySelector("input");
        if (input) {
          input.name = "mobile-category";
        }
        mobileCategoryFilters.appendChild(newLabel);
      });
    }

    // Subcategories and Pseudocategories are dynamic based on selection
    const selectedCategory = categoryFilters.querySelector(
      'input[name="category"]:checked'
    ).value;
    updateSubcategoryFilters(selectedCategory);
    const selectedSubcategory = subcategoryFilters.querySelector(
      'input[name="subcategory"]:checked'
    ).value;
    updatePseudocategoryFilters(selectedSubcategory);

    // Set mobile price inputs to match desktop price inputs
    if (minPriceInput && mobileMinPriceInput) {
      mobileMinPriceInput.value = minPriceInput.value;
    }
    if (maxPriceInput && mobileMaxPriceInput) {
      mobileMaxPriceInput.value = maxPriceInput.value;
    }
  }

  // Función para cargar productos con filters
  async function fetchProductsWithFilters() {
    if (isFetching) return;
    isFetching = true;

    showLoader();

    // Artificial delay to ensure loader is visible
    await new Promise(resolve => setTimeout(resolve, 300));

    const selectedCategory = categoryFilters.querySelector(
      'input[name="category"]:checked'
    ).value;
    const selectedSubcategory = subcategoryFilters.querySelector(
      'input[name="subcategory"]:checked'
    ).value;
    const selectedPseudocategory = pseudocategoryFilters.querySelector(
      'input[name="pseudocategory"]:checked'
    ).value;
    const selectedSort = sortSelect.value;

    const params = new URLSearchParams();
    if (selectedCategory && selectedCategory !== "all") {
      params.append("categoria_principal", selectedCategory);
    }
    if (selectedSubcategory && selectedSubcategory !== "all") {
      params.append("subcategoria", selectedSubcategory);
    }
    if (selectedPseudocategory && selectedPseudocategory !== "all") {
      params.append("seudocategoria", selectedPseudocategory);
    }
    if (selectedSort && selectedSort !== "az") {
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
      renderProducts(allProducts.slice(0, productsPerPage), true);
      updateCategoryInfo(
        selectedCategory,
        selectedSubcategory,
        selectedPseudocategory
      );
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

  // Event listeners for price inputs
  if (minPriceInput) {
    minPriceInput.addEventListener("input", fetchProductsWithFilters);
  }
  if (maxPriceInput) {
    maxPriceInput.addEventListener("input", fetchProductsWithFilters);
  }

  // Función para actualizar el título y breadcrumbs
  function updateCategoryInfo(category, subcategory, pseudocategory) {
    let title = "Todos los Productos";
    let description = "Descubre nuestra selección de productos.";
    let breadcrumbsHtml = `
          <a href="/" class="text-pink-600 hover:text-pink-800 transition-colors">Inicio</a>
          <span class="text-gray-400">|</span>
          <span class="text-gray-700 font-medium">Productos</span>
        `;

    if (category && category !== "all") {
      title = category;
      description = `Productos de la categoría ${category}`;
      breadcrumbsHtml = `
              <a href="/" class="text-pink-600 hover:text-pink-800 transition-colors">Inicio</a>
              <span class="text-gray-400">|</span>
              <a href="/productos" class="text-pink-600 hover:text-pink-800 transition-colors">Productos</a>
              <span class="text-gray-400">|</span>
              <span class="text-gray-700 font-medium">${category}</span>
          `;
    }

    if (subcategory && subcategory !== "all") {
      title = subcategory;
      description = `Productos de la subcategoría ${subcategory}`;
      breadcrumbsHtml += `
              <span class="text-gray-400">|</span>
              <span class="text-gray-700 font-medium">${subcategory}</span>
          `;
    }

    if (pseudocategory && pseudocategory !== "all") {
      title = pseudocategory;
      description = `Productos de la pseudocategoría ${pseudocategory}`;
      breadcrumbsHtml += `
              <span class="text-gray-400">|</span>
              <span class="text-gray-700 font-medium">${pseudocategory}</span>
          `;
    }

    categoryTitle.textContent = title;
    categoryDescription.textContent = description;
    breadcrumbs.innerHTML = breadcrumbsHtml;
  }

  // Event listener para los filtros de escritorio
  if (categoryFilters) {
    categoryFilters.addEventListener("change", (event) => {
      const selectedCategory = event.target.value;
      updateSubcategoryFilters(selectedCategory);
      updatePseudocategoryFilters("all");
      fetchProductsWithFilters();
    });
  }

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

  // Event listener para el drawer de filtros móvil usando delegación de eventos
  if (mobileFilterDrawer) {
    mobileFilterDrawer.addEventListener("click", (event) => {
      const target = event.target;

      // Asegurarse de que el objetivo sea un input de radio antes de continuar
      if (target.tagName === "INPUT" && target.type === "radio") {
        // Actualización dinámica de subcategorías
        if (target.name === "mobile-category") {
          const selectedCategory = target.value;
          updateSubcategoryFilters(selectedCategory);
          updatePseudocategoryFilters("all"); // Resetea el siguiente nivel
        }

        // Actualización dinámica de pseudocategorías
        if (target.name === "mobile-subcategory") {
          const selectedSubcategory = target.value;
          updatePseudocategoryFilters(selectedSubcategory);
        }
      }
    });
  }

  // Event listener para el botón de aplicar filtros en móvil
  if (applyMobileFiltersBtn) {
    applyMobileFiltersBtn.addEventListener("click", () => {
      const selectedCategory = mobileCategoryFilters.querySelector(
        'input[name="mobile-category"]:checked'
      ).value;
      const selectedSubcategory = mobileSubcategoryFilters.querySelector(
        'input[name="mobile-subcategory"]:checked'
      ).value;
      const selectedPseudocategory = mobilePseudocategoryFilters.querySelector(
        'input[name="mobile-pseudocategory"]:checked'
      ).value;
      const mobileMinPrice = mobileMinPriceInput.value;
      const mobileMaxPrice = mobileMaxPriceInput.value;

      // Set desktop filters to match mobile selection
      categoryFilters.querySelector(
        `input[value="${selectedCategory}"]`
      ).checked = true;
      subcategoryFilters.querySelector(
        `input[value="${selectedSubcategory}"]`
      ).checked = true;
      pseudocategoryFilters.querySelector(
        `input[value="${selectedPseudocategory}"]`
      ).checked = true;
      minPriceInput.value = mobileMinPrice;
      maxPriceInput.value = mobileMaxPrice;

      fetchProductsWithFilters();
      toggleFilterDrawer();
    });
  }

  // Event listener para limpiar filtros
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      categoryFilters.querySelector('input[value="all"]').checked = true;
      subcategoryFilters.querySelector('input[value="all"]').checked = true;
      pseudocategoryFilters.querySelector('input[value="all"]').checked = true;

      // Also reset mobile filters
      mobileCategoryFilters.querySelector('input[value="all"]').checked = true;
      mobileSubcategoryFilters.querySelector(
        'input[value="all"]'
      ).checked = true;
      mobilePseudocategoryFilters.querySelector(
        'input[value="all"]'
      ).checked = true;

      // Also reset price inputs
      if (minPriceInput) minPriceInput.value = '';
      if (maxPriceInput) maxPriceInput.value = '';
      if (mobileMinPriceInput) mobileMinPriceInput.value = '';
      if (mobileMaxPriceInput) mobileMaxPriceInput.value = '';

      // Also reset sort select
      sortSelect.value = "az";

      // Update cascading filters after clearing
      updateSubcategoryFilters("all");
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
      renderProducts(nextBatch, false); // `false` to not re-animate all cards
    });
  }

  if (showLessBtn) {
    showLessBtn.addEventListener("click", () => {
      renderProducts(allProducts.slice(0, productsPerPage), true);
      window.scrollTo({ top: 0, behavior: "smooth" }); // Scroll to top
    });
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
        minPriceInput.value = data.min_price;
      }
      if (maxPriceInput) {
        maxPriceInput.value = data.max_price;
      }
      if (mobileMinPriceInput) {
        mobileMinPriceInput.value = data.min_price;
      }
      if (mobileMaxPriceInput) {
        mobileMaxPriceInput.value = data.max_price;
      }
    } catch (error) {
      console.error('Error al cargar el rango de precios:', error);
    }
  }

  // Carga inicial
  async function init() {
    // Initialize filters before fetching products
    updateSubcategoryFilters("all");
    updatePseudocategoryFilters("all");
    await fetchAndSetPriceRange(); // Fetch and set price range before filtering products
    await fetchProductsWithFilters();
    populateMobileFilters();
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
