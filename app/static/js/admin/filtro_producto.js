/**
 * @file Módulo de Filtros de Productos (Admin).
 * @description Gestiona la interactividad del panel de filtros de la lista de productos,
 *              incluyendo la carga dinámica de categorías, la aplicación de filtros mediante AJAX
 *              y la actualización de la tabla de resultados sin recargar la página.
 *
 * @funcionalidadesClave
 * 1.  **Carga Dinámica de Categorías:** Actualiza los selectores de subcategoría, seudocategoría y marca en cascada.
 * 2.  **Aplicación de Filtros AJAX:** Envía los filtros al backend y actualiza la tabla y la paginación con la respuesta.
 * 3.  **Gestión de Estado de UI:** Muestra indicadores de carga y mensajes de "no resultados" de forma profesional.
 */
// Variable para almacenar el timeout del debounce
// Se adjunta a window para evitar errores de redeclaración en un entorno SPA
window.debounceTimeout = window.debounceTimeout || null;

function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return "$ 0";
  }
  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    return "$ 0";
  }
  return numValue.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function showTableSpinner() {
  const tableContainer = document.querySelector(
    ".bg-white.shadow-lg.rounded-xl"
  );
  if (tableContainer) {
    const spinnerOverlay = document.createElement("div");
    spinnerOverlay.id = "table-spinner-overlay";
    spinnerOverlay.className =
      "absolute inset-0 bg-white bg-opacity-75 flex justify-center items-center z-10";
    spinnerOverlay.innerHTML =
      '<div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>';
    tableContainer.appendChild(spinnerOverlay);
  }
}

function hideTableSpinner() {
  const spinnerOverlay = document.getElementById("table-spinner-overlay");
  if (spinnerOverlay) {
    spinnerOverlay.remove();
  }
}

/**
 * Inicializa todos los selects personalizados en el panel de filtros.
 * Utiliza delegación de eventos para manejar clics en opciones,
 * lo que permite que las opciones cargadas dinámicamente (subcategorías, marcas) funcionen correctamente.
 */

// Bandera para asegurar que el event listener global se adjunte solo una vez
// Se adjunta a window para evitar errores de redeclaración en un entorno SPA
window.isGlobalClickListenerAttached =
  window.isGlobalClickListenerAttached || false;

function initCustomSelects() {
  const customSelects = document.querySelectorAll(
    "#filtersPanel .custom-select"
  );

  if (!window.isGlobalClickListenerAttached) {
    document.addEventListener("click", (e) => {
      const openSelect = document.querySelector(".custom-select.open");
      if (openSelect && !e.target.closest(".custom-select")) {
        openSelect.classList.remove("open");
      }
    });
    window.isGlobalClickListenerAttached = true;
  }

  customSelects.forEach((select) => {
    const trigger = select.querySelector(".custom-select-trigger");
    const optionsContainer = select.querySelector(".custom-select-options");
    const valueDisplay = select.querySelector(".custom-select-value");
    const selectName = select.getAttribute("data-name");

    const selectedOption = select.querySelector(
      ".custom-select-option.selected"
    );
    if (selectedOption) {
      valueDisplay.textContent = selectedOption.textContent;
    }

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = select.classList.contains("open");
      document
        .querySelectorAll("#filtersPanel .custom-select.open")
        .forEach((s) => {
          if (s !== select) s.classList.remove("open");
        });
      select.classList.toggle("open");
    });

    optionsContainer.addEventListener("click", (e) => {
      const option = e.target.closest(".custom-select-option");
      if (!option) return;

      e.stopPropagation();

      optionsContainer
        .querySelectorAll(".custom-select-option")
        .forEach((opt) => opt.classList.remove("selected"));
      option.classList.add("selected");
      valueDisplay.textContent = option.textContent;
      select.classList.remove("open");

      // MEJORA PROFESIONAL: El input oculto ahora existe desde el principio en el HTML.
      const hiddenInput = select.querySelector(`input[name="${selectName}"]`);
      hiddenInput.value = option.getAttribute("data-value");

      // ---  Centralización de la lógica de cambio ---
      // Se llama a la función global `handleCustomSelectChange` definida en `lista_productos.html`.
      // Esta función se encarga de la lógica de dependencias de categorías y de llamar a `applyFilters`.
      if (typeof window.handleCustomSelectChange === 'function') {
        window.handleCustomSelectChange(select);
      }
    });
  });
}

/**
 * Actualiza las opciones de un select personalizado.
 */
function updateSelectOptions(selectName, options, defaultText = "Todas") {
  const select = document.querySelector(`[data-name="${selectName}"]`);
  if (!select) return;

  const optionsContainer = select.querySelector(".custom-select-options");
  const valueDisplay = select.querySelector(".custom-select-value");

  let optionsHTML = `<div class="custom-select-option selected" data-value="">${defaultText}</div>`;
  options.forEach((option) => {
    optionsHTML += `<div class="custom-select-option" data-value="${option.id}">${option.nombre}</div>`;
  });

  optionsContainer.innerHTML = optionsHTML;
  valueDisplay.textContent = defaultText;

  const hiddenInput = document.querySelector(`input[name="${selectName}"]`);
  if (hiddenInput) hiddenInput.value = "";
}

function applyFilters(fromPagination = false) {
  // Si la llamada no viene de la paginación, reseteamos a la página 1.
  if (!fromPagination) {
    let pageInput = document.querySelector('input[name="page"]');
    if (pageInput) {
      pageInput.value = "1";
    }
  }

  showTableSpinner();

  const formData = new FormData(document.getElementById("filterForm"));
  const params = new URLSearchParams();

  for (const [key, value] of formData.entries()) {
    params.append(key, value);
  }

  fetch(`/admin/api/products/filter?${params.toString()}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Error en la respuesta del servidor");
      }
      return response.json();
    })
    .then((data) => {
      hideTableSpinner();
      if (data.success) {
        updateProductsTable(data.products, data.pagination);
        updatePagination(data.pagination);
        updateResultsCounter(data.pagination, data.products);
      } else {
        console.error("Error al filtrar productos:", data.message);
        showNotification(
          "Error",
          data.message || "Error al filtrar productos",
          "error"
        );
      }
    })
    .catch((error) => {
      hideTableSpinner();
      console.error("Error en la petición de filtros:", error);
      showNotification("Error", "Error al filtrar productos", "error");
    });
}

function updateProductsTable(products, pagination) {
  const tbody = document.querySelector("#products-tbody");
  if (!tbody) {
    console.error("No se encontró el cuerpo de la tabla");
    return;
  }

  if (products.length === 0) {
    tbody.innerHTML = `
               <tr>
                   <td colspan="6" class="px-6 py-12 text-center text-gray-500">
                       <div class="flex flex-col items-center justify-center">
                           <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                           </svg>
                           <p class="text-lg font-medium text-gray-500">No se encontraron productos con los filtros aplicados.</p>
                           <p class="text-sm text-gray-400 mt-1">Intenta ajustar tus filtros para ver más resultados</p>
                       </div>
                   </td>
               </tr>
           `;
    return;
  }

  tbody.innerHTML = products
    .map((product) => {
      let editActionHtml = "";
      if (product.estado === "activo") {
        editActionHtml = `
                <a href="/admin/producto/editar/${product.slug}" class="spa-edit-product-link edit-product-btn inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-600 hover:text-indigo-800 transition-all duration-300 transform hover:scale-110 shadow-md" title="Editar producto">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                </a>`;
      } else {
        editActionHtml = `
                <button type="button" class="edit-product-btn-inactive inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-400 cursor-not-allowed transition-all duration-300 shadow-md" title="Para editar, el producto debe estar activo">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                </button>`;
      }

      return `
           <tr class="hover:bg-blue-50 transition-colors duration-200" data-product-id="${
             product.id
           }">
               <td class="px-6 py-4 whitespace-nowrap">
                   <div class="flex items-center">
                       <div class="flex-shrink-0 h-12 w-12 rounded-lg overflow-hidden shadow-sm border border-gray-200">
                           <img class="h-12 w-12 object-cover" src="${
                             product.imagen_url
                           }" alt="${product.nombre}">
                       </div>
                       <div class="ml-4">
                           <div class="text-sm font-semibold text-gray-900">${
                             product.nombre
                           }</div>
                           <div class="text-sm text-gray-500">${
                             product.marca || "Sin marca"
                           }</div>
                       </div>
                   </div>
               </td>
               <td class="px-6 py-4 whitespace-nowrap">
                   <div class="text-sm font-medium text-gray-900">${
                     product.categoria_principal_nombre
                   }</div>
                   <div class="text-sm text-gray-500">${
                     product.subcategoria_nombre
                   } / ${product.seudocategoria_nombre}</div>
               </td>
               <td class="px-6 py-4 whitespace-nowrap">
                   <div class="text-sm font-semibold text-gray-900">${formatCurrency(
                     product.precio
                   )}</div>
                   <div class="text-sm text-gray-500">Costo: ${formatCurrency(
                     product.costo
                   )}</div>
               </td>
               <td class="px-6 py-4 whitespace-nowrap">
                   <div class="text-sm font-medium text-gray-900">${
                     product.existencia
                   } unidades</div>
                   <div class="text-xs font-semibold ${
                     product.agotado
                       ? "text-red-600 bg-red-50 px-2 py-1 rounded-full inline-block"
                       : "text-green-600 bg-green-50 px-2 py-1 rounded-full inline-block"
                   }">
                       ${product.agotado ? "AGOTADO" : "Disponible"}
                   </div>
               </td>
               <td class="px-6 py-4 whitespace-nowrap">
                   <!-- Interruptor de estado tipo foco mejorado -->
                   <div class="flex items-center">
                       <div class="relative inline-block w-14 h-7 mr-2 align-middle select-none">
                           <input type="checkbox" id="toggle-${
                             product.id
                           }" class="sr-only toggle-product-status" data-product-id="${
        product.id
      }" ${product.estado === "activo" ? "checked" : ""}>
                           <label for="toggle-${
                             product.id
                           }" class="block h-7 w-14 rounded-full cursor-pointer transition-colors duration-300 ease-in-out ${
        product.estado === "activo"
          ? "bg-gradient-to-r from-green-400 to-emerald-500 shadow-lg"
          : "bg-gray-300"
      }" title="Cambiar estado del producto">
                               <span class="absolute left-1 top-1 bg-white w-5 h-5 rounded-full shadow-md transition-transform duration-300 ease-in-out ${
                                 product.estado === "activo"
                                   ? "transform translate-x-7"
                                   : "transform translate-x-0"
                               } flex items-center justify-center">
                                   <!-- Icono para estado activo -->
                                   ${
                                     product.estado === "activo"
                                       ? `<svg class="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                           <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                                       </svg>`
                                       : `<svg class="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                           <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                                       </svg>`
                                   }
                               </span>
                           </label>
                       </div>
                       ${
                         product.es_nuevo
                           ? `<span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                               Nuevo
                           </span>`
                           : ""
                       }
                   </div>
               </td>
               <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                   ${editActionHtml}
                   <a href="/admin/producto/${
                     product.slug
                   }" class="spa-product-detail-link inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 hover:text-blue-800 transition-all duration-300 transform hover:scale-110 shadow-md ml-2" title="Ver detalles del producto">
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                        </svg>
                                    </a>
               </td>
           </tr>
       `;
    })
    .join("");
}

function updatePagination(pagination) {
  const paginationContainer = document.querySelector(
    ".mt-8.flex.flex-col.items-center"
  );
  if (!paginationContainer) {
    console.error("No se encontró el contenedor de paginación");
    return;
  }

  let paginationHTML = `
           <div class="text-sm text-gray-700 mb-4">
               Mostrando página
               <span class="font-semibold text-blue-600">${pagination.page}</span>
               de
               <span class="font-semibold text-blue-600">${pagination.pages}</span>
           </div>
           
           <div class="flex flex-wrap justify-center gap-2">
       `;

  // Only add navigation buttons if there's more than one page
  if (pagination.pages > 1) {
    paginationHTML += `
           <a href="#" data-page="${
             pagination.prev_num
           }" class="pagination-link px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium ${
      !pagination.has_prev
        ? "text-gray-400 cursor-not-allowed"
        : "text-gray-700 hover:bg-gray-50 transition-colors duration-200"
    } inline-flex items-center" title="Ir a la página anterior">
               <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
               </svg>
               Anterior
           </a>
       `;

    const startPage = Math.max(1, pagination.page - 2);
    const endPage = Math.min(pagination.pages, pagination.page + 2);

    if (startPage > 1) {
      paginationHTML += `<a href="#" data-page="1" class="pagination-link px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200">1</a>`;
      if (startPage > 2) {
        paginationHTML += `<span class="px-3 py-2 text-gray-500">...</span>`;
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      if (i === pagination.page) {
        paginationHTML += `<span class="px-3 py-2 rounded-lg border border-blue-500 bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-sm font-medium" title="Página actual ${i}">${i}</span>`;
      } else {
        paginationHTML += `<a href="#" data-page="${i}" class="pagination-link px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200" title="Ir a la página ${i}">${i}</a>`;
      }
    }

    if (endPage < pagination.pages) {
      if (endPage < pagination.pages - 1) {
        paginationHTML += `<span class="px-3 py-2 text-gray-500">...</span>`;
      }
      paginationHTML += `<a href="#" data-page="${pagination.pages}" class="pagination-link px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200">${pagination.pages}</a>`;
    }

    paginationHTML += `
           <a href="#" data-page="${
             pagination.next_num
           }" class="pagination-link px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium ${
      !pagination.has_next
        ? "text-gray-400 cursor-not-allowed"
        : "text-gray-700 hover:bg-gray-50 transition-colors duration-200"
    } inline-flex items-center" title="Ir a la página siguiente">
               Siguiente
               <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
               </svg>
           </a>
       `;
  } // End of if (pagination.pages > 1)

  paginationHTML += `
           </div>
       `;

  paginationContainer.innerHTML = paginationHTML;
}

function updateResultsCounter(pagination, products) {
  const resultsCounter = document.querySelector(
    ".mb-6.bg-white.rounded-lg.p-4.shadow-sm.border.border-gray-200 .text-sm.text-gray-600"
  );
  if (!resultsCounter) {
    console.error("No se encontró el contador de resultados");
    return;
  }

  // --- MEJORA PROFESIONAL: Cálculo correcto del contador de resultados ---
  // El número del último item mostrado se calcula en base a la página actual y los items por página.
  // Se usa Math.min para asegurar que no mostremos un número mayor al total si estamos en la última página.
  const lastItem = Math.min(
    pagination.page * pagination.per_page,
    pagination.total // `pagination.total` es el total de productos que coinciden con el filtro.
  );
  const totalItems = pagination.total; // Usamos el total filtrado, no el general, para que sea consistente.

  resultsCounter.innerHTML = `
           Mostrando
           <span class="font-semibold text-blue-600">${lastItem}</span>
           de
           <span class="font-semibold text-blue-600">${totalItems}</span>
           productos
       `;
}

window.goToPage = function (page) {
  let pageInput = document.querySelector('input[name="page"]');
  if (!pageInput) {
    pageInput = document.createElement("input");
    pageInput.type = "hidden";
    pageInput.name = "page";
    document.getElementById("filterForm").appendChild(pageInput);
  }
  pageInput.value = page;

  applyFilters(true); // Indicar que la llamada viene de la paginación
};

/**
 * Resetea todos los filtros del formulario a su estado inicial.
 * Limpia los valores de los inputs, resetea los selects personalizados
 * y restaura la lista completa de opciones para categorías y marcas.
 */
function resetFilters() {
  const filterForm = document.getElementById("filterForm");
  if (filterForm) {
    filterForm.reset();
  }

  // Resetear visualmente todos los custom selects a "Todas"
  document
    .querySelectorAll("#filtersPanel .custom-select")
    .forEach((select) => {
      const valueDisplay = select.querySelector(".custom-select-value");
      const optionElements = select.querySelectorAll(".custom-select-option");
      const selectName = select.getAttribute("data-name");
      
      const hiddenInput = document.querySelector(`input[name="${selectName}"]`);
      if (hiddenInput) {
        hiddenInput.value = "";
      }
      if (valueDisplay && optionElements.length > 0) {
        valueDisplay.textContent = optionElements[0].textContent;
      }
    });

  // --- MEJORA PROFESIONAL: Restaurar estado completo de los filtros ---
  // Restaurar la visibilidad de todas las opciones de categoría.
  if (typeof window.resetCategoryVisibility === 'function') {
    window.resetCategoryVisibility(true, true, true);
  }
  // Recargar la lista completa de marcas desde la API.
  if (typeof window.updateBrandOptions === 'function') {
    window.updateBrandOptions().then(() => {
      // Aplicar filtros solo después de que las marcas se hayan actualizado.
      applyFilters();
    });
  } else {
    // Fallback si la función no existe, aunque no debería ocurrir.
    applyFilters();
  }
}

function showNotification(title, message, type) {
  const notification = document.getElementById("notification");
  if (!notification) {
    console.error("No se encontró el elemento de notificación");
    return;
  }

  const notificationTitle = document.getElementById("notificationTitle");
  const notificationMessage = document.getElementById("notificationMessage");
  const notificationIcon = document.getElementById("notificationIcon");

  notificationTitle.textContent = title;
  notificationMessage.textContent = message;

  if (type === "success") {
    notificationIcon.innerHTML = `
               <div class="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                   <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                   </svg>
               </div>
           `;
  } else if (type === "error") {
    notificationIcon.innerHTML = `
               <div class="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                   <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                   </svg>
               </div>
           `;
  } else if (type === "info") {
    notificationIcon.innerHTML = `
               <div class="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                   <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                   </svg>
               </div>
           `;
  }

  notification.classList.remove("translate-x-full");

  setTimeout(() => {
    notification.classList.add("translate-x-full");
  }, 5000);
}

function debounceFilter() {
  clearTimeout(window.debounceTimeout);
  window.debounceTimeout = setTimeout(() => {
    applyFilters();
  }, 500);
}

function toggleFilters() {
  const panel = document.getElementById("filtersPanel");
  const overlay = document.getElementById("overlay");

  panel.classList.toggle("translate-x-full");
  overlay.classList.toggle("hidden");

  if (!panel.classList.contains("translate-x-full")) {
    document.body.classList.add("overflow-hidden");
  } else {
    document.body.classList.remove("overflow-hidden");
  }
}

window.toggleProductStatus = function (productId, isActive) {
  const toggle = document.getElementById(`toggle-${productId}`);
  if (!toggle) {
    console.error(`No se encontró el toggle para el producto ${productId}`);
    return;
  }

  const label = toggle.nextElementSibling;
  const span = label.querySelector("span");
  const row = document.querySelector(`tr[data-product-id="${productId}"]`);

  const originalChecked = toggle.checked;
  const originalLabelClasses = Array.from(label.classList);
  const originalSpanClasses = Array.from(span.classList);
  const originalSpanInnerHTML = span.innerHTML;

  toggle.disabled = true;

  span.innerHTML = `
        <svg class="animate-spin h-3 w-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    `;

  if (row) {
    row.classList.add("bg-blue-100");
  }

  fetch(`/admin/api/products/${productId}/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCsrfToken(),
    },
    body: JSON.stringify({
      estado: isActive ? "activo" : "inactivo",
    }),
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((err) => {
          throw new Error(err.message || "Error en la solicitud");
        });
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        if (data.status_unchanged) {
          window.toast.info(data.message);
          toggle.checked = originalChecked;
          label.className = originalLabelClasses.join(" ");
          span.className = originalSpanClasses.join(" ");
          span.innerHTML = originalSpanInnerHTML;
        } else {
          if (data.new_status === "activo") {
            label.classList.remove("bg-gray-300");
            label.classList.add(
              "bg-gradient-to-r",
              "from-green-400",
              "to-emerald-500",
              "shadow-lg"
            );
            span.classList.add("transform", "translate-x-7");
            span.classList.remove("translate-x-0");
            span.innerHTML = `<svg class="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>`;
          } else {
            label.classList.add("bg-gray-300");
            label.classList.remove(
              "bg-gradient-to-r",
              "from-green-400",
              "to-emerald-500",
              "shadow-lg"
            );
            span.classList.remove("transform", "translate-x-7");
            span.classList.add("translate-x-0");
            span.innerHTML = `<svg class="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>`;
          }

          if (row) {
            const detailLink = row.querySelector(".spa-product-detail-link");
            if (detailLink) {
              const slug = detailLink.getAttribute("href").split("/").pop();
              const actionCell = row.querySelector("td:last-child");
              if (actionCell && slug) {
                let editActionHtml = "";
                if (data.new_status === "activo") {
                  editActionHtml = `<a href="/admin/producto/editar/${slug}" class="spa-edit-product-link edit-product-btn inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-600 hover:text-indigo-800 transition-all duration-300 transform hover:scale-110 shadow-md" title="Editar producto"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></a>`;
                } else {
                  editActionHtml = `<button type="button" class="edit-product-btn-inactive inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 text-gray-400 cursor-not-allowed transition-all duration-300 shadow-md" title="Para editar, el producto debe estar activo"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>`;
                }
                actionCell.innerHTML = editActionHtml + detailLink.outerHTML;
              }
            }
          }
          window.toast.success(data.message);
        }
      } else {
        toggle.checked = originalChecked;
        label.className = originalLabelClasses.join(" ");
        span.className = originalSpanClasses.join(" ");
        span.innerHTML = originalSpanInnerHTML;
        window.toast.error(
          data.message || "No se pudo cambiar el estado del producto."
        );
      }
    })
    .catch((error) => {
      toggle.checked = originalChecked;
      label.className = originalLabelClasses.join(" ");
      span.className = originalSpanClasses.join(" ");
      span.innerHTML = originalSpanInnerHTML;
      window.toast.error(
        "No se pudo cambiar el estado del producto. Inténtalo de nuevo."
      );
      console.error("Error al cambiar estado del producto:", error);
    })
    .finally(() => {
      if (row) {
        row.classList.remove("bg-blue-100");
      }
      toggle.disabled = false;
    });
};

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    const panel = document.getElementById("filtersPanel");
    if (panel && !panel.classList.contains("translate-x-full")) {
      toggleFilters();
    }
  }
});

function setupFilterEventListeners() {
  // --- MEJORA PROFESIONAL: Delegación de eventos para la paginación ---
  // Este listener se adjunta a un contenedor estático y maneja los clics en los
  // enlaces de paginación, incluso si se recrean dinámicamente.
  const paginationContainer = document.querySelector(
    ".mt-8.flex.flex-col.items-center"
  );
  if (paginationContainer) {
    paginationContainer.addEventListener("click", function (e) {
      const target = e.target.closest(".pagination-link");
      if (target && !target.classList.contains("cursor-not-allowed")) {
        e.preventDefault();
        const page = target.dataset.page;
        if (page) {
          window.goToPage(page);
        }
      }
    });
  }

  // "Limpiar Filtros" button in panel
  const resetPanelButton = document.querySelector(
    '#filtersPanel button[onclick="resetFilters()"]'
  );
  if (resetPanelButton) {
    resetPanelButton.onclick = null; // Remove inline handler
    resetPanelButton.addEventListener("click", resetFilters);
  }

  // Main "Limpiar Filtros" button
  const resetMainButton = document.querySelector(
    'button[onclick="resetFilters()"]'
  );
  if (resetMainButton && !resetMainButton.closest("#filtersPanel")) {
    resetMainButton.onclick = null; // Remove inline handler
    resetMainButton.addEventListener("click", resetFilters);
  }

  // Per page select
  const perPageSelect = document.getElementById("perPageSelect");
  if (perPageSelect) {
    // Evitar duplicar listeners en SPA
    if (!perPageSelect.hasAttribute("data-listener-attached")) {
      perPageSelect.addEventListener("change", function () {
        let perPageInput = document.querySelector('input[name="per_page"]');
        if (!perPageInput) {
          perPageInput = document.createElement("input");
          perPageInput.type = "hidden";
          perPageInput.name = "per_page";
          document.getElementById("filterForm").appendChild(perPageInput);
        }
        perPageInput.value = this.value;
        window.goToPage(1); // Reset to page 1
      });
      perPageSelect.setAttribute("data-listener-attached", "true");
    }
  }

  // Product status toggle (delegation)
  const tableBody = document.getElementById("products-tbody");
  if (tableBody) {
    tableBody.addEventListener("change", function (e) {
      if (e.target.classList.contains("toggle-product-status")) {
        const productId = e.target.dataset.productId;
        const isActive = e.target.checked;
        window.toggleProductStatus(productId, isActive);
      }
    });

    // Add this new event listener for the edit button
    tableBody.addEventListener("click", function (e) {
      const editButton = e.target.closest(".edit-product-btn-inactive");
      if (editButton) {
        e.preventDefault();
        e.stopPropagation(); // Stop other listeners from being called
        window.toast.info(
          "Para editar un producto, primero debe estar activo."
        );
      }
    });
  }

  // Name input
  const nameInput = document.querySelector(
    '#filtersPanel input[name="nombre"]'
  );
  if (nameInput) {
    nameInput.onkeyup = null; // Remove inline handler
    nameInput.addEventListener("keyup", debounceFilter);
  }

  // Price inputs
  const minPriceInput = document.querySelector(
    '#filtersPanel input[name="min_price"]'
  );
  if (minPriceInput) {
    minPriceInput.onchange = null; // Remove inline handler
    minPriceInput.addEventListener("change", applyFilters);
  }
  const maxPriceInput = document.querySelector(
    '#filtersPanel input[name="max_price"]'
  );
  if (maxPriceInput) {
    maxPriceInput.onchange = null; // Remove inline handler
    maxPriceInput.addEventListener("change", applyFilters);
  }

  // Checkboxes (agotados, nuevos)
  const agotadosCheckbox = document.getElementById("agotados");
  if (agotadosCheckbox) {
    agotadosCheckbox.onchange = null; // Remove inline handler
    agotadosCheckbox.addEventListener("change", applyFilters);
  }
  const nuevosCheckbox = document.getElementById("nuevos");
  if (nuevosCheckbox) {
    nuevosCheckbox.onchange = null; // Remove inline handler
    nuevosCheckbox.addEventListener("change", applyFilters);
  }

  // Toggle filters button (floating and close)
  const toggleButtons = document.querySelectorAll(
    'button[onclick="toggleFilters()"]'
  );
  toggleButtons.forEach((button) => {
    button.onclick = null; // Remove inline handler
    button.addEventListener("click", toggleFilters);
  });

  // Overlay click
  const overlay = document.getElementById("overlay");
  if (overlay) {
    overlay.onclick = null; // Remove inline handler
    overlay.addEventListener("click", toggleFilters);
  }

  // Initial call to initCustomSelects for custom selects
  initCustomSelects();
}

document.addEventListener("DOMContentLoaded", setupFilterEventListeners);
document.addEventListener("content-loaded", setupFilterEventListeners);
