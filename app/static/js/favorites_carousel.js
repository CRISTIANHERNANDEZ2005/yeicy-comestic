document.addEventListener("DOMContentLoaded", function () {
  // Elementos DOM
  const track = document.getElementById("carouselTrack");
  const prevBtn = document.querySelector(".carousel-prev");
  const nextBtn = document.querySelector(".carousel-next");
  const indicatorsContainer = document.getElementById("carouselIndicators");
  const loadingState = document.getElementById("loadingState");

  // Estado mejorado
  let currentIndex = 0;
  let isMobile = window.IS_MOBILE || window.innerWidth < 768;
  let productsPerSlide = isMobile ? 2 : 4;
  let totalProducts = window.PRODUCTS_DATA.length;
  let totalSlides = Math.max(1, Math.ceil(totalProducts / productsPerSlide));

  // Función optimizada de carga
  function initializeProductCarousel() {
    // Validar que existan productos
    if (!window.PRODUCTS_DATA || window.PRODUCTS_DATA.length === 0) {
      loadingState.innerHTML = `
                    <div class="text-center py-12">
                        <p class="text-gray-500 text-lg">No hay productos disponibles en esta categoría</p>
                    </div>
                `;
      return;
    }

    totalSlides = Math.max(1, Math.ceil(totalProducts / productsPerSlide));

    // Fade out del skeleton
    if (loadingState) {
      loadingState.style.opacity = "0";
      setTimeout(() => {
        loadingState.remove();
      }, 400);
    }

    createRealContent();
    showControlsWithAnimation();
  }

  window.reinitializeFavoritesCarousel = () => {
    totalProducts = window.PRODUCTS_DATA.length;
    totalSlides = Math.max(1, Math.ceil(totalProducts / productsPerSlide));
    currentIndex = 0;
    createRealContent();
    showControlsWithAnimation();
  };

  // Crear contenido real con manejo preciso
  function createRealContent() {
    track.innerHTML = "";

    for (let slideIndex = 0; slideIndex < totalSlides; slideIndex++) {
      const slide = createOptimizedSlide(slideIndex);
      track.appendChild(slide);
    }

    renderSmartIndicators();
    updateCarouselPosition();
  }

  // Crear slide optimizado
  function createOptimizedSlide(slideIndex) {
    const slide = document.createElement("div");
    slide.className = "carousel-slide w-full flex-shrink-0";

    const grid = document.createElement("div");
    grid.className = `grid gap-4 ${isMobile ? "grid-cols-2" : "grid-cols-4"}`;

    const startIndex = slideIndex * productsPerSlide;
    const endIndex = Math.min(startIndex + productsPerSlide, totalProducts);

    for (let i = startIndex; i < endIndex; i++) {
      const productData = window.PRODUCTS_DATA[i];
      if (productData) {
        const productCard = createOptimizedProductCard(
          productData,
          i - startIndex
        );
        grid.appendChild(productCard);
      }
    }

    slide.appendChild(grid);
    return slide;
  }

  // Función mejorada para verificar si es nuevo
  function verificarEsNuevo(producto) {
    if (producto.es_nuevo === undefined || producto.es_nuevo === null) {
      // Fallback: calcular basado en fecha si está disponible
      if (producto.fecha_creacion) {
        const fechaProducto = new Date(producto.fecha_creacion);
        const fechaActual = new Date();
        const diferenciaDias = Math.floor(
          (fechaActual - fechaProducto) / (1000 * 60 * 60 * 24)
        );
        return diferenciaDias <= 7; // 7 días para mayor profesionalismo
      }
      return false;
    }
    return producto.es_nuevo;
  }

  function createOptimizedProductCard(producto, delayIndex) {
    const template = document.getElementById("product-card-template");
    if (!template) {
      console.error("Product card template not found!");
      return document.createElement("div");
    }

    const card = template.content.cloneNode(true).firstElementChild;
    card.href = `/producto/${producto.id}`;
    card.setAttribute("data-product-id", producto.id);
    card.style.animationDelay = `${delayIndex * 0.08}s`;

    const isFavorite =
      window.favoritesManager?.favoriteProducts.has(String(producto.id)) ||
      false;

    card.addEventListener("click", function (e) {
      if (e.target.closest("button, a:not(.product-card)")) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    const esNuevo = verificarEsNuevo(producto);
    if (esNuevo) {
      const nuevoTag = card.querySelector(".new-tag");
      if (nuevoTag) nuevoTag.classList.remove("hidden");
    }

    const hasImage =
      producto.imagen_url &&
      producto.imagen_url.trim() !== "" &&
      !producto.imagen_url.includes("default");
    const img = card.querySelector(".product-image");
    if (hasImage) {
      img.src = producto.imagen_url;
      img.alt = producto.nombre;
    } else {
      card.querySelector(".image-placeholder").classList.remove("hidden");
      img.classList.add("hidden");
    }

    card.querySelector(".product-brand").textContent =
      producto.marca || "Sin marca";
    card.querySelector(".product-name").textContent = producto.nombre;
    card.querySelector(".product-description").textContent =
      producto.descripcion.substring(0, 70) +
      (producto.descripcion.length > 70 ? "..." : "");
    card.querySelector(".product-price").textContent = `$${parseFloat(
      producto.precio
    ).toFixed(2)}`;
    card.querySelector(".product-rating-stars").innerHTML =
      generateOptimizedStars(producto.calificacion_promedio || 0);
    card.querySelector(".product-rating-reviews").textContent = `(${
      producto.reseñas || 0
    } reseñas)`;

    const favBtn = card.querySelector(".favorite-btn");
    favBtn.setAttribute("data-product-id", producto.id);
    window.favoritesManager?.updateFavoriteButton(favBtn, isFavorite);

    const cartBtn = card.querySelector(".add-to-cart");
    cartBtn.setAttribute("data-product-id", producto.id);
    cartBtn.setAttribute("data-product-name", producto.nombre);

    return card;
  }

  // Generar estrellas optimizadas
  function generateOptimizedStars(rating) {
    const stars = Math.round(rating);
    let html = "";
    for (let i = 0; i < 5; i++) {
      const color = i < stars ? "text-yellow-400" : "text-gray-300";
      const size = "w-3 h-3";
      html += `<svg class="${size} ${color}" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>`;
    }
    return html;
  }

  // Renderizar indicadores inteligentes
  function renderSmartIndicators() {
    indicatorsContainer.innerHTML = "";

    if (totalSlides <= 1) {
      indicatorsContainer.style.display = "none";
      return;
    }

    indicatorsContainer.style.display = "flex";

    for (let i = 0; i < totalSlides; i++) {
      const indicator = document.createElement("button");
      indicator.className = `carousel-indicator ${i === 0 ? "active" : ""}`;
      indicator.setAttribute("data-index", i);
      indicator.setAttribute("aria-label", `Diapositiva ${i + 1}`);

      indicator.addEventListener("click", () => {
        currentIndex = i;
        updateCarouselPosition();
        updateActiveIndicator();
      });

      indicatorsContainer.appendChild(indicator);
    }
  }

  // Actualizar indicador activo
  function updateActiveIndicator() {
    const indicators = indicatorsContainer.querySelectorAll(
      ".carousel-indicator"
    );
    indicators.forEach((indicator, idx) => {
      indicator.classList.toggle("active", idx === currentIndex);
    });
  }

  // Mostrar controles con animación suave
  function showControlsWithAnimation() {
    setTimeout(() => {
      const shouldShow = totalSlides > 1;
      prevBtn.style.opacity = shouldShow ? "1" : "0";
      nextBtn.style.opacity = shouldShow ? "1" : "0";
      prevBtn.style.transform = "scale(1)";
      nextBtn.style.transform = "scale(1)";
      prevBtn.style.pointerEvents = shouldShow ? "auto" : "none";
      nextBtn.style.pointerEvents = shouldShow ? "auto" : "none";
    }, 300);
  }

  // Actualizar posición del carrusel
  function updateCarouselPosition() {
    const slideWidth = 100;
    track.style.transform = `translateX(-${currentIndex * slideWidth}%)`;
    updateActiveIndicator();

    // Ajustar altura dinámicamente
    setTimeout(adjustCarouselHeight, 100);
  }

  // Navegación mejorada
  function navigate(direction) {
    if (totalSlides <= 1) return;

    const newIndex =
      direction === "next"
        ? (currentIndex + 1) % totalSlides
        : (currentIndex - 1 + totalSlides) % totalSlides;

    currentIndex = newIndex;
    updateCarouselPosition();
  }

  // Event listeners mejorados
  prevBtn?.addEventListener("click", () => navigate("prev"));
  nextBtn?.addEventListener("click", () => navigate("next"));

  // Touch/swipe optimizado
  let touchStartX = 0;
  let touchEndX = 0;

  track.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  });

  track.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  });

  function handleSwipe() {
    if (totalSlides <= 1) return;

    if (touchEndX < touchStartX - 50) navigate("next");

    if (touchEndX > touchStartX + 50) navigate("prev");
  }

  function adjustCarouselHeight() {
    const viewport = document.querySelector(".carousel-viewport");
    const track = document.getElementById("carouselTrack");

    if (viewport && track) {
      const activeSlide = track.children[currentIndex];
      if (activeSlide) {
        const slideHeight = activeSlide.offsetHeight;
        viewport.style.minHeight = `${slideHeight + 40}px`; // 40px extra para el zoom
      }
    }
  }

  // Responsive con throttling
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const wasMobile = isMobile;
      isMobile = window.innerWidth < 768;

      if (wasMobile !== isMobile) {
        productsPerSlide = isMobile ? 2 : 4;
        totalSlides = Math.max(1, Math.ceil(totalProducts / productsPerSlide));
        createRealContent();
      }
    }, 250);
  });

  // Auto-inicialización
  if (window.PRODUCTS_DATA) {
    initializeProductCarousel();
  } else {
    console.warn("PRODUCTS_DATA not found. Carousel will not be initialized.");
  }
});
