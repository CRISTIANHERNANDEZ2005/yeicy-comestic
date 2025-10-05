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

// MEJORA PROFESIONAL: Almacén para los controladores de eventos específicos de este módulo.
// Esto nos permitirá limpiarlos de forma segura cuando el contenido cambie.
const productModuleListeners = {
  listeners: [],
};

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
      // MEJORA: La función ahora está en este mismo archivo.
      handleCustomSelectChange(select);
      
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
      const editActionHtml = `
              <a href="/admin/producto/editar/${product.slug}" class="spa-edit-product-link edit-product-btn inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-600 hover:text-indigo-800 transition-all duration-300 transform hover:scale-110 shadow-md" title="Editar producto">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                  </svg>
              </a>`;

              
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
  console.log("🔄 [resetFilters] Iniciando reseteo de filtros...");
  const filterForm = document.getElementById("filterForm");
  if (filterForm) {
    // MEJORA PROFESIONAL: Evitar form.reset() que puede causar recursión.
    // Limpiar cada campo explícitamente es más seguro.
    filterForm.querySelectorAll('input[type="text"], input[type="number"], input[type="hidden"]').forEach(input => {
        if (input.name !== 'page' && input.name !== 'per_page') {
            input.value = '';
        }
    });
    filterForm.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });
  }

  // Resetear visualmente todos los custom selects a "Todas"
  document
    .querySelectorAll("#filtersPanel .custom-select")
    .forEach((select) => {
      // setCustomSelectValue se encarga de la lógica de reseteo visual y de valor.
      setCustomSelectValue(select, "");
    });

  // --- MEJORA PROFESIONAL: Restaurar estado completo de los filtros ---
  // Restaurar la visibilidad de todas las opciones de los filtros de categoría.
  console.log("🔄 [resetFilters] Restaurando visibilidad de categorías...");
  resetCategoryVisibility(true, true, true);
  // Recargar la lista completa de marcas.
  console.log("🔄 [resetFilters] Actualizando opciones de marcas...");
  updateBrandOptions();
  console.log("✅ [resetFilters] Reseteo de filtros completado.");
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
                // MEJORA: Generar siempre el botón de edición habilitado, independientemente del estado.
                // Esto corrige el bug donde el botón se desactivaba al cambiar el estado a inactivo.
                editActionHtml = `<a href="/admin/producto/editar/${slug}" class="spa-edit-product-link edit-product-btn inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-600 hover:text-indigo-800 transition-all duration-300 transform hover:scale-110 shadow-md" title="Editar producto"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></a>`;
                actionCell.innerHTML = editActionHtml + detailLink.outerHTML;
              }
            }
          }
          
          // MEJORA PROFESIONAL: Recargar la tabla con los filtros actuales.
          // Esto asegura que si un producto ya no cumple con el filtro de estado
          // (ej. se activa un producto mientras se filtra por 'inactivos'),
          // desaparecerá de la lista, proporcionando una experiencia de usuario consistente.
          // Se usa un pequeño delay para que el usuario pueda ver la notificación de éxito.
          window.toast.success(data.message, 1500); // Aumentamos la duración del toast
          setTimeout(() => {
              applyFilters(false); // false para resetear a la página 1 si es necesario
          }, 500);
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

/**
 * =====================================================================================
 * LÓGICA DE DEPENDENCIAS DE CATEGORÍAS (Movida desde lista_productos.html)
 * =====================================================================================
 */

/**
 * Punto de entrada para manejar cambios en los selectores de filtros.
 * @param {HTMLElement} selectDiv - El elemento .custom-select que cambió.
 */
function handleCustomSelectChange(selectDiv) {
    const name = selectDiv.dataset.name;
    const value = document.querySelector(`input[name="${name}"]`).value;

    if (['categoria_id', 'subcategoria_id', 'seudocategoria_id'].includes(name)) {
        updateCategoryDependencies(name, value);
    } else if (name === 'marca') {
        updateDependenciesForBrand(value);
    } else {
        applyFilters();
    }
}

/**
 * Actualiza los selectores de categorías dependientes y las marcas.
 * @param {string} level - El nivel de la categoría que cambió ('categoria_id', 'subcategoria_id', 'seudocategoria_id').
 * @param {string} id - El ID de la categoría seleccionada.
 */
async function updateCategoryDependencies(level, id, applyFiltersAfter = true) {
    const mainCatSelect = document.querySelector('#filtersPanel .custom-select[data-name="categoria_id"]');
    const subCatSelect = document.querySelector('#filtersPanel .custom-select[data-name="subcategoria_id"]');
    const pseudoCatSelect = document.querySelector('#filtersPanel .custom-select[data-name="seudocategoria_id"]');
    const brandSelect = document.querySelector('#filtersPanel .custom-select[data-name="marca"]');

    if (!id) {
        if (level === 'categoria_id') {
            resetCategoryVisibility(false, true, true);
            setCustomSelectValue(subCatSelect, "");
            setCustomSelectValue(pseudoCatSelect, "");
        } else if (level === 'subcategoria_id') {
            resetCategoryVisibility(false, false, true);
            setCustomSelectValue(pseudoCatSelect, "");
        }
        await updateBrandOptions();
        if (applyFiltersAfter) {
            applyFilters();
        }
        return;
    }

    try {
        const response = await fetch(`/admin/api/products/category-dependencies?level=${level}&id=${id}`);
        if (!response.ok) throw new Error('Error en la respuesta de la API');
        
        const data = await response.json();
        if (!data.success) throw new Error(data.message);

        if (data.main_category_id && level !== 'categoria_id') {
            setCustomSelectValue(mainCatSelect, data.main_category_id);
        }
        if (data.sub_category_id && level !== 'subcategoria_id') {
            setCustomSelectValue(subCatSelect, data.sub_category_id);
        }

        if (level === 'categoria_id') {
            filterOptions(subCatSelect, data.sub_category_ids);
            filterOptions(pseudoCatSelect, data.pseudo_category_ids);
        } else if (level === 'subcategoria_id') {
            resetCategoryVisibility(true, false, false);
            filterOptions(pseudoCatSelect, data.pseudo_category_ids);
        } else if (level === 'seudocategoria_id') {
            resetCategoryVisibility(true, true, false);
        }

        await updateBrandOptions(data.brands);

        if (level === 'categoria_id') {
            const subCatValue = subCatSelect.querySelector('input[type="hidden"]').value;
            if (subCatValue && !data.sub_category_ids.includes(subCatValue)) {
                setCustomSelectValue(subCatSelect, "");
                setCustomSelectValue(pseudoCatSelect, "");
            }
        }
        if (level === 'categoria_id' || level === 'subcategoria_id') {
            const pseudoCatValue = pseudoCatSelect.querySelector('input[type="hidden"]').value;
            if (pseudoCatValue && !data.pseudo_category_ids.includes(pseudoCatValue)) {
                setCustomSelectValue(pseudoCatSelect, "");
            }
        }

        const brandValue = brandSelect.querySelector('input[type="hidden"]').value;
        if (brandValue && !data.brands.includes(brandValue)) {
            setCustomSelectValue(brandSelect, "");
        }

        if (applyFiltersAfter) {
            applyFilters();
        }

    } catch (error) {
        console.error('Error al actualizar dependencias de categorías:', error);
        window.toast.error('No se pudieron actualizar los filtros de categoría.');
    }
}

/**
 * Actualiza los selectores de categorías cuando se selecciona una marca.
 * @param {string} brandName - El nombre de la marca seleccionada.
 */
async function updateDependenciesForBrand(brandName) {
    const mainCatSelect = document.querySelector('#filtersPanel .custom-select[data-name="categoria_id"]');
    const subCatSelect = document.querySelector('#filtersPanel .custom-select[data-name="subcategoria_id"]');
    const pseudoCatSelect = document.querySelector('#filtersPanel .custom-select[data-name="seudocategoria_id"]');

    if (!brandName) {
        resetCategoryVisibility(true, true, true);
        applyFilters();
        return;
    }

    try {
        const response = await fetch(`/admin/api/products/category-dependencies?level=marca&id=${encodeURIComponent(brandName)}`);
        if (!response.ok) throw new Error('Error en la respuesta de la API de marcas');

        const data = await response.json();
        if (!data.success) throw new Error(data.message);

        filterOptions(mainCatSelect, data.main_category_ids);
        filterOptions(subCatSelect, data.sub_category_ids);
        filterOptions(pseudoCatSelect, data.pseudo_category_ids);

        const mainCatValue = mainCatSelect.querySelector('input[type="hidden"]').value;
        if (mainCatValue && !data.main_category_ids.includes(mainCatValue)) setCustomSelectValue(mainCatSelect, "");

        const subCatValue = subCatSelect.querySelector('input[type="hidden"]').value;
        if (subCatValue && !data.sub_category_ids.includes(subCatValue)) setCustomSelectValue(subCatSelect, "");

        const pseudoCatValue = pseudoCatSelect.querySelector('input[type="hidden"]').value;
        if (pseudoCatValue && !data.pseudo_category_ids.includes(pseudoCatValue)) setCustomSelectValue(pseudoCatSelect, "");

        applyFilters();
    } catch (error) {
        console.error('Error al actualizar dependencias para la marca:', error);
        window.toast.error('No se pudieron actualizar los filtros para la marca seleccionada.');
    }
}

/**
 * Filtra las opciones de un custom select para mostrar solo las que están en una lista de IDs.
 * @param {HTMLElement} selectElement - El elemento .custom-select.
 * @param {string[]} allowedIds - Array de IDs que se deben mostrar.
 */
function filterOptions(selectElement, allowedIds) {
    if (!selectElement) return;
    const options = selectElement.querySelectorAll('.custom-select-option');
    options.forEach(option => {
        const value = option.dataset.value;
        if (value === "") {
            option.style.display = 'block';
        } else if (value) {
            option.style.display = allowedIds.includes(value) ? 'block' : 'none';
        }
    });
}

/**
 * Restablece la visibilidad de las opciones en los selectores de categoría.
 * @param {boolean} main - ¿Restablecer categorías principales?
 * @param {boolean} sub - ¿Restablecer subcategorías?
 * @param {boolean} pseudo - ¿Restablecer seudocategorías?
 */
function resetCategoryVisibility(main, sub, pseudo) {
    if (main) {
        document.querySelectorAll('#filtersPanel .custom-select[data-name="categoria_id"] .custom-select-option').forEach(opt => opt.style.display = 'block');
    }
    if (sub) {
        document.querySelectorAll('#filtersPanel .custom-select[data-name="subcategoria_id"] .custom-select-option').forEach(opt => opt.style.display = 'block');
    }
    if (pseudo) {
        document.querySelectorAll('#filtersPanel .custom-select[data-name="seudocategoria_id"] .custom-select-option').forEach(opt => opt.style.display = 'block');
    }
}

/**
 * Actualiza las opciones del selector de marcas.
 * @param {string[]} brands - Array con los nombres de las marcas a mostrar.
 */
async function updateBrandOptions(brands) {
    const brandSelect = document.querySelector('#filtersPanel .custom-select[data-name="marca"]');
    if (!brandSelect) return;
    const optionsContainer = brandSelect.querySelector('.custom-select-options');
    const hiddenInput = brandSelect.querySelector('input[type="hidden"]');
    const currentBrandValue = hiddenInput ? hiddenInput.value : '';

    let brandsToShow = brands;

    if (!brands) {
        const response = await fetch('/admin/api/products/category-dependencies');
        const data = await response.json();
        if (data.success) {
            brandsToShow = data.brands;
        } else {
            brandsToShow = [];
        }
    }

    let newOptionsHtml = '<div class="custom-select-option" data-value="">Todas</div>';
    if (brandsToShow) {
        brandsToShow.forEach(brand => {
            newOptionsHtml += `<div class="custom-select-option" data-value="${brand}">${brand}</div>`;
        });
    }

    optionsContainer.innerHTML = newOptionsHtml;
    setCustomSelectValue(brandSelect, currentBrandValue);
}

/**
 * Establece el valor de un custom select programáticamente.
 * @param {HTMLElement} selectElement - El elemento .custom-select.
 * @param {string} value - El valor a seleccionar.
 */
function setCustomSelectValue(selectElement, value) {
    if (!selectElement) return;
    const hiddenInput = selectElement.querySelector('input[type="hidden"]');
    if (!hiddenInput) return;
    const valueDisplay = selectElement.querySelector('.custom-select-value');
    const options = selectElement.querySelectorAll('.custom-select-option');

    hiddenInput.value = value;

    let found = false;
    options.forEach(option => {
        if (option.dataset.value === value) {
            option.classList.add('selected');
            valueDisplay.textContent = option.textContent.trim();
            found = true;
        } else {
            option.classList.remove('selected');
        }
    });

    if (!found) {
        const allOption = selectElement.querySelector('.custom-select-option[data-value=""]');
        if (allOption) {
            allOption.classList.add('selected');
            valueDisplay.textContent = allOption.textContent.trim();
        }
    }
}

/**
 * =====================================================================================
 * FIN DE LA LÓGICA DE DEPENDENCIAS
 * =====================================================================================
 */

function setupFilterEventListeners() {
  // --- MEJORA PROFESIONAL: Delegación de eventos para la paginación ---
  // Este listener se adjunta a un contenedor estático y maneja los clics en los
  // enlaces de paginación, incluso si se recrean dinámicamente.
  // MEJORA PROFESIONAL: Declarar todas las variables de elementos al principio de la función.
  const paginationContainer = document.querySelector(
    ".mt-8.flex.flex-col.items-center"
  );
  const resetPanelButton = document.getElementById("reset-panel-button");
  const resetMainButton = document.getElementById("reset-main-button");
  const perPageSelect = document.getElementById("perPageSelect");
  const tableBody = document.getElementById("products-tbody");
  const nameInput = document.querySelector(
    '#filtersPanel input[name="nombre"]'
  );
  const minPriceInput = document.querySelector(
    '#filtersPanel input[name="min_price"]'
  );
  const maxPriceInput = document.querySelector(
    '#filtersPanel input[name="max_price"]'
  );
  const agotadosCheckbox = document.getElementById("agotados");
  const nuevosCheckbox = document.getElementById("nuevos");
  const toggleButtons = document.querySelectorAll('#toggle-filters-button, #close-filters-panel-button');
  const overlay = document.getElementById("overlay");

  // Handler unificado para los botones de reseteo
  const resetFiltersHandler = () => {
    console.log("🖱️ Click detectado en botón 'Limpiar Filtros'. Ejecutando handler...");
    resetFilters();
    applyFilters();
  };

  // Asignación de listeners
  if (resetPanelButton) {
    // MEJORA: Limpiar listeners anteriores para evitar duplicados en SPA
    resetPanelButton.removeEventListener("click", resetFiltersHandler);
    resetPanelButton.addEventListener("click", resetFiltersHandler);
    productModuleListeners.listeners.push({ element: resetPanelButton, type: 'click', handler: resetFiltersHandler, name: 'resetPanel' });
  }

  if (resetMainButton && !resetMainButton.closest("#filtersPanel")) {
    // MEJORA: Limpiar listeners anteriores
    resetMainButton.removeEventListener("click", resetFiltersHandler);
    resetMainButton.addEventListener("click", resetFiltersHandler);
    productModuleListeners.listeners.push({ element: resetMainButton, type: 'click', handler: resetFiltersHandler, name: 'resetMain' });
  }

  if (paginationContainer) {
    const paginationHandler = function (e) {
      const target = e.target.closest(".pagination-link");
      if (target && !target.classList.contains("cursor-not-allowed")) {
        e.preventDefault();
        const page = target.dataset.page;
        if (page) window.goToPage(page);
      }
    };
    paginationContainer.removeEventListener("click", paginationHandler);
    paginationContainer.addEventListener("click", paginationHandler);
    productModuleListeners.listeners.push({ element: paginationContainer, type: 'click', handler: paginationHandler, name: 'pagination' });
  }

  if (perPageSelect) {
    // Evitar duplicar listeners en SPA
    const perPageHandler = function () {
      let perPageInput = document.querySelector('input[name="per_page"]');
      if (!perPageInput) {
        perPageInput = document.createElement("input");
        perPageInput.type = "hidden";
        perPageInput.name = "per_page";
        document.getElementById("filterForm").appendChild(perPageInput);
      }
      perPageInput.value = this.value;
      window.goToPage(1); // Reset to page 1
    };
    perPageSelect.removeEventListener("change", perPageHandler); // Limpiar
    perPageSelect.addEventListener("change", perPageHandler);
    productModuleListeners.listeners.push({ element: perPageSelect, type: 'change', handler: perPageHandler, name: 'perPage' });
  }

  // Product status toggle (delegation)
  if (tableBody) {
    const tableChangeHandler = function (e) {
      if (e.target.classList.contains("toggle-product-status")) {
        const productId = e.target.dataset.productId;
        const isActive = e.target.checked;
        window.toggleProductStatus(productId, isActive);
      }
    };
    tableBody.removeEventListener("change", tableChangeHandler);
    tableBody.addEventListener("change", tableChangeHandler);
    productModuleListeners.listeners.push({ element: tableBody, type: 'change', handler: tableChangeHandler, name: 'toggleStatus' });

    // Add this new event listener for the edit button
    tableBody.addEventListener("click", function (e) {
      const editButton = e.target.closest(".edit-product-btn-inactive");
    });
  }

  // Name input
  if (nameInput) {
    nameInput.onkeyup = null; // Remove inline handler
    // MEJORA: Limpiar listeners anteriores
    nameInput.removeEventListener("keyup", debounceFilter);
    nameInput.addEventListener("keyup", debounceFilter);
  }

  // Price inputs
  if (minPriceInput) {
    minPriceInput.onchange = null; // Remove inline handler
    // MEJORA: Limpiar listeners anteriores
    minPriceInput.removeEventListener("change", applyFilters);
    minPriceInput.addEventListener("change", applyFilters);
  }
  if (maxPriceInput) {
    maxPriceInput.onchange = null; // Remove inline handler
    // MEJORA: Limpiar listeners anteriores
    maxPriceInput.removeEventListener("change", applyFilters);
    maxPriceInput.addEventListener("change", applyFilters);
  }

  // Checkboxes (agotados, nuevos)
  if (agotadosCheckbox) {
    agotadosCheckbox.onchange = null; // Remove inline handler
    // MEJORA: Limpiar listeners anteriores
    agotadosCheckbox.removeEventListener("change", applyFilters);
    agotadosCheckbox.addEventListener("change", applyFilters);
  }
  if (nuevosCheckbox) {
    nuevosCheckbox.onchange = null; // Remove inline handler
    // MEJORA: Limpiar listeners anteriores
    nuevosCheckbox.removeEventListener("change", applyFilters);
    nuevosCheckbox.addEventListener("change", applyFilters);
  }

  // Toggle filters button (floating and close)
  toggleButtons.forEach((button) => {
    // MEJORA: Limpiar listeners anteriores
    button.removeEventListener("click", toggleFilters);
    button.addEventListener("click", toggleFilters);
    productModuleListeners.listeners.push({ element: button, type: 'click', handler: toggleFilters, name: `toggleFilters-${button.id}` });
  });

  // Overlay click
  if (overlay) {
    // MEJORA: Limpiar listeners anteriores
    overlay.removeEventListener("click", toggleFilters);
    overlay.addEventListener("click", toggleFilters);
    productModuleListeners.listeners.push({ element: overlay, type: 'click', handler: toggleFilters, name: 'overlay' });
  }

  // Initial call to initCustomSelects for custom selects
  initCustomSelects();
}
/**
 * =====================================================================================
 * GESTIÓN DEL CICLO DE VIDA DE LA SPA
 * =====================================================================================
 */

const ProductListPageModule = (() => {
    let isInitialized = false;
    // MEJORA: Mover el handler aquí para que sea persistente a través de las llamadas a init/destroy
    let resetFiltersHandler = null;

    function init() {
        // Guardia de contexto: si no estamos en la página de productos, no hacer nada.
        if (!document.getElementById('filterForm')) {
            // console.log("Not on the product list page. Skipping initialization.");
            return;
        }

        if (isInitialized) {
            // console.log("Product list module already initialized. Skipping.");
            return;
        }
        console.log("🚀 Initializing Product List Page Module...");

        // MEJORA: Definir el handler aquí para que la función `destroy` tenga acceso a la misma referencia.
        resetFiltersHandler = () => {
            console.log("🖱️ Click detectado en botón 'Limpiar Filtros'. Ejecutando handler...");
            resetFilters();
            applyFilters();
        };

        // Adjuntar listeners para los botones de reseteo
        const resetPanelButton = document.getElementById("reset-panel-button");
        if (resetPanelButton) {
            console.log("   -> Attaching listener to reset-panel-button");
            resetPanelButton.addEventListener("click", resetFiltersHandler);
        }

        const resetMainButton = document.getElementById("reset-main-button");
        if (resetMainButton) {
            console.log("   -> Attaching listener to reset-main-button");
            resetMainButton.addEventListener("click", resetFiltersHandler);
        }

        // Configurar el resto de los event listeners
        setupFilterEventListeners();

        isInitialized = true;
    }

    function destroy() {
        if (!isInitialized) {
            return;
        }
        console.log("🔥 Destroying Product List Page Module...");

        // MEJORA: Limpieza explícita de los listeners de reseteo
        const resetPanelButton = document.getElementById("reset-panel-button");
        if (resetPanelButton && resetFiltersHandler) {
            console.log("   -> Removing listener from reset-panel-button");
            resetPanelButton.removeEventListener("click", resetFiltersHandler);
        }
        const resetMainButton = document.getElementById("reset-main-button");
        if (resetMainButton && resetFiltersHandler) {
            console.log("   -> Removing listener from reset-main-button");
            resetMainButton.removeEventListener("click", resetFiltersHandler);
        }

        productModuleListeners.listeners.forEach(({ element, type, handler, name }) => {
            if (element) {
                // console.log(`   -> Removing listener '${name}' from element.`);
                element.removeEventListener(type, handler);
            }
        });
        productModuleListeners.listeners = [];
        isInitialized = false;
    }

    // Escuchar el evento de la SPA para inicializar el módulo.
    document.addEventListener('content-loaded', (event) => {
        // MEJORA PROFESIONAL: Usar requestAnimationFrame para garantizar que el DOM esté listo.
        // Esto soluciona la condición de carrera donde el script se ejecuta antes de que el HTML esté parseado.
        requestAnimationFrame(init);
    });

    // Escuchar el evento para limpiar el módulo antes de que el contenido se vaya.
    document.addEventListener('content-will-load', destroy);

    // Para la carga inicial de la página (no SPA).
    document.addEventListener('DOMContentLoaded', init);

})();
