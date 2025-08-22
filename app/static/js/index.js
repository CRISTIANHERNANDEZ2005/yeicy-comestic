

// --- LIKE AUTH MODAL LOGIC ---
let likeAuthModalTimeout;
function showLikeAuthModal(msg) {
  const modal = document.getElementById("like-auth-modal");
  const modalInner = document.getElementById("like-auth-modal-inner");
  const modalMsg = document.getElementById("like-auth-modal-msg");
  if (modal && modalMsg && modalInner) {
    modalMsg.textContent =
      msg || "Debes iniciar sesión para agregar productos a tus favoritos.";
    // Responsive position
    if (window.innerWidth < 768) {
      modal.classList.remove("items-end", "justify-start");
      modal.classList.add("items-end", "justify-center");
      modal.style.bottom = "70px";
      modal.style.top = "";
      modal.style.left = "0";
      modal.style.right = "0";
    } else {
      modal.classList.remove("items-end", "justify-center");
      modal.classList.add("items-end", "justify-start");
      modal.style.bottom = "40px";
      modal.style.left = "40px";
      modal.style.right = "";
      modal.style.top = "";
    }
    modal.style.display = "flex";
    modalInner.classList.remove("modal-animate-out");
    modalInner.classList.add("modal-animate-in");
    clearTimeout(likeAuthModalTimeout);
    likeAuthModalTimeout = setTimeout(() => {
      hideLikeAuthModal();
    }, 5000);
  }
}
function hideLikeAuthModal() {
  const modal = document.getElementById("like-auth-modal");
  const modalInner = document.getElementById("like-auth-modal-inner");
  if (modal && modalInner) {
    modalInner.classList.remove("modal-animate-in");
    modalInner.classList.add("modal-animate-out");
    setTimeout(() => {
      modal.style.display = "none";
    }, 450);
  }
  clearTimeout(likeAuthModalTimeout);
}
// Cerrar modal si el usuario hace click en el botón de login
document.addEventListener("DOMContentLoaded", function () {
  const loginBtn = document.getElementById("like-auth-login-btn");
  if (loginBtn) {
    loginBtn.addEventListener("click", function () {
      hideLikeAuthModal();
    });
  }
});

// Asignar lógica al botón de like
document.addEventListener("click", function (e) {
  const likeBtn = e.target.closest(".like-btn");
  if (likeBtn) {
    if (!window.USUARIO_AUTENTICADO) {
      e.preventDefault();
      showLikeAuthModal();
      return false;
    }
    // Aquí iría la lógica real de like para usuarios autenticados
  }
});

// Mejorar tamaño/flotante del botón de like en móvil
function updateLikeBtnStyles() {
  const isMobile = window.innerWidth < 768;
  document.querySelectorAll(".like-btn .like-icon").forEach((icon) => {
    if (isMobile) {
      icon.classList.add("w-9", "h-9");
      icon.classList.remove("w-7", "h-7", "w-6", "h-6", "w-5", "h-5");
    } else {
      icon.classList.remove("w-9", "h-9");
      icon.classList.add("w-6", "h-6", "md:w-5", "md:h-5");
    }
  });
}
window.addEventListener("resize", updateLikeBtnStyles);
document.addEventListener("DOMContentLoaded", updateLikeBtnStyles);

// --- RESTO DEL SCRIPT ORIGINAL ---
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
    loadingState.style.opacity = "0";

    setTimeout(() => {
      loadingState.remove();
      createRealContent();
      showControlsWithAnimation();
    }, 400);
  }

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
    const card = document.createElement("a");
    card.href = `/producto/${producto.id}`; // Enlace a la página de detalles del producto
    card.className =
      "product-card bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group relative flex flex-col h-full";
    card.setAttribute("data-product-id", producto.id);

    // Verificar si el producto está en favoritos
    const isFavorite = window.favoritesManager
      ? window.favoritesManager.favoriteProducts.has(String(producto.id))
      : false;

    card.style.animationDelay = `${delayIndex * 0.08}s`;

    // Prevenir la navegación cuando se hace clic en elementos interactivos
    card.addEventListener("click", function (e) {
      // Si el clic fue en un botón o enlace dentro de la tarjeta, prevenir la navegación
      if (e.target.closest("button, a:not(.product-card)")) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // Verificar si es nuevo con lógica profesional
    const esNuevo = verificarEsNuevo(producto);
    const nuevoTag = esNuevo
      ? `
                <div class="absolute top-2 right-2 bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-sm animate-pulse z-10">
                    🌟 NUEVO
                </div>
            `
      : "";

    // Determinar tiempo transcurrido para tooltip
    let tiempoTranscurrido = "";
    if (producto.fecha_creacion) {
      const fechaProducto = new Date(producto.fecha_creacion);
      const fechaActual = new Date();
      const diferenciaDias = Math.floor(
        (fechaActual - fechaProducto) / (1000 * 60 * 60 * 24)
      );

      if (diferenciaDias === 0) {
        tiempoTranscurrido = "Hoy";
      } else if (diferenciaDias === 1) {
        tiempoTranscurrido = "Ayer";
      } else if (diferenciaDias <= 7) {
        tiempoTranscurrido = `Hace ${diferenciaDias} día${
          diferenciaDias > 1 ? "s" : ""
        }`;
      }
    }

    // Determinar si debemos mostrar el placeholder
    const hasImage =
      producto.imagen_url &&
      producto.imagen_url.trim() !== "" &&
      !producto.imagen_url.includes("default");

    // URL para el placeholder SVG
    const placeholderSvg =
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZDhkYWRiIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KPHBhdGggZD0iTTMuMTYgMTguODhMMTUuMTIgNi45M2EuMTYuMTYgMCAwIDEgLjIyIDBsMy4wNiAzLjA2YS4xNi4xNiAwIDAgMSAwIC4yMkw2LjQ0IDIyYTEgMSAwIDAgMS0xLjM5LjA2bC02LjE1LTUuNzlhMS4yNSAxLjI1IDAgMCAxIC4yNi0xLjM5eiIvPgo8cGF0aCBkPSJNMTkgMTlhMiAyIDAgMSAwIDAtNCAyIDIgMCAwIDAgMCA0eiIvPgo8cGF0aCBkPSJNMjIgMTB2OGEyIDIgMCAwIDEtMiAyaC0xM2wtMy4yLTIuN2ExIDEgMCAwIDAtMS42LjRsLTMuMzUgNCIvPgo8cGF0aCBkPSJNMiAxMHYtNGEyIDIgMCAwIDEgMi0yaDZhMSAxIDAgMCAwIC44LS40bDIuNi0zLjQ1YTEgMSAwIDAgMSAuOC0uMzVIMThhMiAyIDAgMCAxIDIgMlYxMCIvPgo8L3N2Zz4=";

    card.innerHTML = `
               <div class="relative bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col h-full transform hover:scale-[1.03] group-hover:z-10">
                    <div class="product-image-container relative overflow-hidden aspect-square ${
                      !hasImage
                        ? "bg-gray-50 flex items-center justify-center"
                        : "bg-gray-100"
                    }">
                        ${
                          !hasImage
                            ? `<div class="w-full h-full flex flex-col items-center justify-center p-4">
                                       <div class="w-16 h-16 mb-2 text-gray-300">
                                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                           </svg>
                                       </div>
                                       <span class="text-xs text-center text-gray-400 font-medium">Imagen no disponible</span>
                                   </div>`
                            : `<img src="${producto.imagen_url}" alt="${producto.nombre}" loading="lazy" 
                                      class="product-image w-full h-full object-cover" 
                                      onerror="this.onerror=null; this.src='${placeholderSvg}'; this.classList.add('p-4', 'opacity-50')">`
                        }
                        ${nuevoTag}
                        ${
                          tiempoTranscurrido && hasImage
                            ? `<div class="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">${tiempoTranscurrido}</div>`
                            : ""
                        }
                    </div>
                    <div class="p-3 md:p-4 flex flex-col flex-grow">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-xs uppercase tracking-wide text-gray-600 font-medium">${
                              producto.marca || "Sin marca"
                            }</span>
                             <button class="favorite-btn ${
                               !window.favoritesManager ||
                               !window.favoritesManager.isAuthenticated
                                 ? "text-gray-300"
                                 : isFavorite
                                 ? "text-red-500"
                                 : "text-gray-400"
                             } transition-all duration-200 hover:scale-110 z-20 relative"
                 title="${
                   !window.favoritesManager ||
                   !window.favoritesManager.isAuthenticated
                     ? "Inicia sesión para guardar en favoritos"
                     : isFavorite
                     ? "Eliminar de favoritos"
                     : "Añadir a favoritos"
                 }"
                 aria-label="${
                   !window.favoritesManager ||
                   !window.favoritesManager.isAuthenticated
                     ? "Inicia sesión para guardar en favoritos"
                     : isFavorite
                     ? "Eliminar de favoritos"
                     : "Añadir a favoritos"
                 }"
                 data-product-id="${producto.id}"
                 tabindex="0"
                 style="background: none; border: none; outline: none;"
                 data-initialized="true">
                <svg class="w-6 h-6" fill="${
                  !window.favoritesManager ||
                  !window.favoritesManager.isAuthenticated
                    ? "none"
                    : isFavorite
                    ? "currentColor"
                    : "none"
                }" 
                     viewBox="0 0 24 24" 
                     stroke="currentColor" 
                     stroke-width="1.5"
                     ${
                       !window.favoritesManager ||
                       !window.favoritesManager.isAuthenticated
                         ? 'opacity="0.6"'
                         : ""
                     }>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
            </button>
        </div>
        <h3 class="text-sm md:text-base font-semibold text-gray-800 mb-1 line-clamp-2">${
          producto.nombre
        }</h3>
                        <div class="min-h-[36px] md:min-h-[40px] mb-2">
                            <p class="text-xs text-gray-600 line-clamp-2">
                                ${producto.descripcion.substring(0, 70)}${
      producto.descripcion.length > 70 ? "..." : ""
    }
                            </p>
                        </div>
                        <div class="flex items-center mb-2">
                            <div class="flex space-x-0.5">
                                ${generateOptimizedStars(
                                  producto.calificacion_promedio || 0
                                )}
                            </div>
                            <span class="text-xs text-gray-500 ml-1">(${
                              producto.reseñas || 0
                            } reseñas)</span>
                        </div>
                        <div class="flex items-center justify-between mt-auto pt-2">
                            <p class="text-base md:text-lg font-bold text-pink-600">$${parseFloat(
                              producto.precio
                            ).toFixed(2)}</p>
                             <button class="add-to-cart bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white px-3 py-2 md:px-4 rounded-full hover:from-pink-600 hover:to-fuchsia-600 transition-all duration-300 flex items-center text-xs md:text-sm hover:shadow-lg hover:scale-105 active:scale-95 z-20 relative"
                                   data-product-id="${producto.id}"
                                   data-quantity="1"
                                   data-product-name="${producto.nombre}"
                                   onclick="event.stopPropagation(); event.preventDefault(); if(window.cart) { window.cart.addToCart(event.currentTarget); }">
                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <span class="hidden sm:inline">Añadir</span>
                            </button>
                        </div>
                </div>
            `;

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

  // La función toggleFavorite ha sido movida a favorites.js

  // Auto-inicialización
  setTimeout(initializeProductCarousel, 800);

  // Notificación de productos nuevos
  const nuevosProductos = window.PRODUCTS_DATA.filter((p) =>
    verificarEsNuevo(p)
  );
  if (nuevosProductos.length > 0) {
    console.log(
      `✅ Hay ${nuevosProductos.length} productos nuevos disponibles`
    );
  }

  // Inicialización de botones de favoritos
  const initFavoriteButton = (button) => {
    // Solo inicializar si no está ya inicializado
    if (button.getAttribute("data-initialized") === "true") return;

    const productId = parseInt(button.getAttribute("data-product-id"));
    if (!productId || isNaN(productId)) return;

    // Verificar si el gestor de favoritos está disponible
    if (window.favoritesManager) {
      // Verificar si el usuario está autenticado
      const isAuthenticated = window.favoritesManager.isAuthenticated;

      // Si no está autenticado, actualizar el botón en consecuencia
      if (!isAuthenticated) {
        button.classList.remove("text-red-500", "text-gray-400");
        button.classList.add("text-gray-300");
        button.setAttribute("title", "Inicia sesión para guardar en favoritos");
        button.setAttribute(
          "aria-label",
          "Inicia sesión para guardar en favoritos"
        );
        const svg = button.querySelector("svg");
        if (svg) {
          svg.setAttribute("fill", "none");
          svg.style.opacity = "0.6";
        }
      } else {
        // Obtener el estado actual del favorito solo si está autenticado
        const isFavorite =
          window.favoritesManager.favoriteProducts.has(productId);
        // Actualizar la apariencia del botón
        window.favoritesManager.updateFavoriteButton(button, isFavorite);
      }

      // Marcar como inicializado
      button.setAttribute("data-initialized", "true");

      // No necesitamos agregar manejadores de eventos aquí ya que usamos delegación de eventos
    }
  };

  // Inicializar botones existentes cuando el DOM esté listo
  document.addEventListener("DOMContentLoaded", function () {
    // Inicializar el gestor de favoritos si existe
    if (window.favoritesManager) {
      // Inicializar botones existentes
      document.querySelectorAll(".favorite-btn").forEach(initFavoriteButton);

      // Configurar un observador de mutación para manejar contenido dinámico
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              // Solo elementos
              const newButtons = node.matches(".favorite-btn")
                ? [node]
                : node.querySelectorAll(".favorite-btn");

              newButtons.forEach((button) => initFavoriteButton(button));
            }
          });
        });
      });

      // Observar cambios en el cuerpo del documento
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  });
}); // Cierre del DOMContentLoaded
