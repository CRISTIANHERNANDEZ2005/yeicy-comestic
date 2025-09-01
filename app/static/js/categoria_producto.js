document.addEventListener("DOMContentLoaded", function () {
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
});

document.addEventListener("DOMContentLoaded", function () {
  console.log("DEBUG: window.appData.productos en categoria_producto.js", window.appData.productos);
  const subcategoriasDisponibles = window.appData.subcategorias;
  const seudocategoriasDisponibles = window.appData.seudocategorias;
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

  let allProducts = window.appData.productos || [];
  const productsPerPage = 12;
  let currentDisplayedProducts = 0;
  let isFetching = false;

  const loadMoreBtn = document.getElementById("load-more-btn");
  const showLessBtn = document.getElementById("show-less-btn");

  // --- Animation Functions ---
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
    if (animate) {
        productGrid.innerHTML = "";
    }

    if (productsToRender.length === 0 && animate) {
      productListingContainer.classList.add("hidden");
      noResultsMessage.classList.remove("hidden");
    } else {
      productListingContainer.classList.remove("hidden");
      noResultsMessage.classList.add("hidden"); // MODIFIED LINE
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
  }

  

  // --- Mobile Filter Drawer Functions ---
  function toggleFilterDrawer() {
    mobileFilterDrawer.classList.toggle("open");
    filterModalOverlay.classList.toggle("hidden");
  }

  if (mobileFilterBtn) {
    mobileFilterBtn.addEventListener("click", toggleFilterDrawer);
  }
  if (closeFilterBtn) {
    closeFilterBtn.addEventListener("click", toggleFilterDrawer);
  }
  if (closeFilterBtnResults) {
    closeFilterBtnResults.addEventListener("click", toggleFilterDrawer);
  }
  if (filterModalOverlay) {
    filterModalOverlay.addEventListener("click", toggleFilterDrawer);
  }
  if (mobileFilterDrawer) {
    mobileFilterDrawer.addEventListener("click", function (event) {
      event.stopPropagation();
    });
  }

  // --- Filter Population Functions ---
  function updateSubcategoryFilters() {
    const targetElement = subcategoryFilters;
    const mobileTargetElement = mobileSubcategoryFilters;
    if (!targetElement || !mobileTargetElement) return;

    targetElement.innerHTML = "";
    mobileTargetElement.innerHTML = "";

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
    mobileTargetElement.insertAdjacentHTML(
      "beforeend",
      allOptionHtml.replace(/name="subcategory"/g, 'name="mobile-subcategory"')
    );

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
      mobileTargetElement.insertAdjacentHTML(
        "beforeend",
        subcategoryHtml.replace(/name="subcategory"/g, 'name="mobile-subcategory"')
      );
    });
  }

  function updatePseudocategoryFilters(selectedSubcategoryName) {
    const targetElement = pseudocategoryFilters;
    const mobileTargetElement = mobilePseudocategoryFilters;
    if (!targetElement || !mobileTargetElement) return;

    targetElement.innerHTML = "";
    mobileTargetElement.innerHTML = "";

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
    mobileTargetElement.insertAdjacentHTML(
      "beforeend",
      allOptionHtml.replace(/name="pseudocategory"/g, 'name="mobile-pseudocategory"')
    );

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
          mobileTargetElement.insertAdjacentHTML(
            "beforeend",
            pseudocategoryHtml.replace(/name="pseudocategory"/g, 'name="mobile-pseudocategory"')
          );
        });
      }
    }
  }

  function populateMobileFilters() {
    updateSubcategoryFilters();
    const selectedSubcategory = subcategoryFilters.querySelector(
      'input[name="subcategory"]:checked'
    ).value;
    updatePseudocategoryFilters(selectedSubcategory);

    if (minPriceInput && mobileMinPriceInput) {
      mobileMinPriceInput.value = minPriceInput.value;
    }
    if (maxPriceInput && mobileMaxPriceInput) {
      mobileMaxPriceInput.value = maxPriceInput.value;
    }
  }

  // --- Filter Fetching Functions ---
  async function fetchProductsWithFilters() {
    if (isFetching) return;
    isFetching = true;

    showLoader();

    await new Promise(resolve => setTimeout(resolve, 300));

    const selectedSubcategory = subcategoryFilters.querySelector(
      'input[name="subcategory"]:checked'
    ).value;
    const selectedPseudocategory = pseudocategoryFilters.querySelector(
      'input[name="pseudocategory"]:checked'
    ).value;
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
    if (selectedSort && selectedSort !== "az") {
      params.append("ordenar_por", selectedSort);
    }

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
      updateCategoryInfo(selectedSubcategory, selectedPseudocategory);
    } catch (error) {
      console.error(error);
      hideLoader();
      productListingContainer.classList.add("hidden");
      noResultsMessage.classList.remove("hidden");
    } finally {
        isFetching = false;
    }
  }

  // --- Event Listeners ---
  if (sortSelect) {
    sortSelect.addEventListener("change", fetchProductsWithFilters);
  }

  if (minPriceInput) {
    minPriceInput.addEventListener("input", fetchProductsWithFilters);
  }
  if (maxPriceInput) {
    maxPriceInput.addEventListener("input", fetchProductsWithFilters);
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

  if (mobileFilterDrawer) {
    mobileFilterDrawer.addEventListener("click", (event) => {
      const target = event.target;
      if (target.tagName === "INPUT" && target.type === "radio") {
        if (target.name === "mobile-subcategory") {
          const selectedSubcategory = target.value;
          updatePseudocategoryFilters(selectedSubcategory);
        }
      }
    });
  }

  if (applyMobileFiltersBtn) {
    applyMobileFiltersBtn.addEventListener("click", () => {
      const selectedSubcategory = mobileSubcategoryFilters.querySelector(
        'input[name="mobile-subcategory"]:checked'
      ).value;
      const selectedPseudocategory = mobilePseudocategoryFilters.querySelector(
        'input[name="mobile-pseudocategory"]:checked'
      ).value;
      const mobileMinPrice = mobileMinPriceInput.value;
      const mobileMaxPrice = mobileMaxPriceInput.value;

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

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      subcategoryFilters.querySelector('input[value="all"]').checked = true;
      pseudocategoryFilters.querySelector('input[value="all"]').checked = true;

      if (mobileSubcategoryFilters) {
        mobileSubcategoryFilters.querySelector(
          'input[value="all"]'
        ).checked = true;
      }
      if (mobilePseudocategoryFilters) {
        mobilePseudocategoryFilters.querySelector(
          'input[value="all"]'
        ).checked = true;
      }

      if (minPriceInput) minPriceInput.value = '';
      if (maxPriceInput) maxPriceInput.value = '';
      if (mobileMinPriceInput) mobileMinPriceInput.value = '';
      if (mobileMaxPriceInput) mobileMaxPriceInput.value = '';

      sortSelect.value = "az";

      updateSubcategoryFilters();
      updatePseudocategoryFilters("all");
      fetchProductsWithFilters();
    });
  }

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

  // --- Update Category Info Function ---
  function updateCategoryInfo(subcategory, pseudocategory) {
    const categoriaPrincipalNombre = window.appData.categoriaPrincipal.nombre;
    let title = categoriaPrincipalNombre;
    let description = window.appData.categoriaPrincipal.descripcion || `Productos de la categoría ${categoriaPrincipalNombre}`;
    let breadcrumbsHtml = `
      <a href="/" class="text-pink-600 hover:text-pink-800 transition-colors">Inicio</a>
      <span class="text-gray-300">/</span>
      <span class="text-gray-700 font-medium">${categoriaPrincipalNombre}</span>
    `;

    if (subcategory && subcategory !== "all") {
      title = subcategory;
      description = `Productos de la subcategoría ${subcategory}`;
      breadcrumbsHtml += `
        <span class="text-gray-300">/</span>
        <span class="text-gray-700 font-medium">${subcategory}</span>
      `;
    }

    if (pseudocategory && pseudocategory !== "all") {
      title = pseudocategory;
      description = `Productos de la pseudocategoría ${pseudocategory}`;
      breadcrumbsHtml += `
        <span class="text-gray-300">/</span>
        <span class="text-gray-700 font-medium">${pseudocategory}</span>
      `;
    }

    categoryTitle.textContent = title;
    categoryDescription.textContent = description;
    breadcrumbs.innerHTML = breadcrumbsHtml;
  }

  // --- Price Range Function ---
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
      if (mobileMinPriceInput) {
        mobileMinPriceInput.value = data.min_price || 0;
      }
      if (mobileMaxPriceInput) {
        mobileMaxPriceInput.value = data.max_price || 1000;
      }
    } catch (error) {
      console.error('Error al cargar el rango de precios:', error);
    }
  }

  // --- Initial Load ---
  async function init() {
    updateSubcategoryFilters();
    updatePseudocategoryFilters("all");
    await fetchAndSetPriceRange();
    await fetchProductsWithFilters(); // Fetch products on initial load
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