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

function renderProductCard(producto, delayIndex) {
  const card = document.createElement("a");
  card.href = `/${producto.slug}`; // Enlace a la página de detalles del producto
  card.className =
    "product-card bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group relative flex flex-col h-full";
  card.setAttribute("data-product-id", producto.id);
  card.setAttribute("data-category-name", producto.categoria_principal_nombre);

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
                        <div class="flex space-x-0.5" data-rating-stars="${
                          producto.id
                        }">
                            ${generateOptimizedStars(
                              producto.calificacion_promedio || 0
                            )}
                        </div>
                        <span class="text-xs text-gray-500 ml-1" data-rating-count="${
                          producto.id
                        }">(${producto.reseñas_count || 0} reseñas)</span>
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
