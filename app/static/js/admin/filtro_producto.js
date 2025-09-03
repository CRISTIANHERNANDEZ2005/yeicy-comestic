// Variable para almacenar el timeout del debounce
let debounceTimeout;

function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return "$ 0";
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
        return "$ 0";
    }
    return numValue.toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}


function showTableSpinner() {
  const tableContainer = document.querySelector('.bg-white.shadow-lg.rounded-xl');
  if (tableContainer) {
    const spinnerOverlay = document.createElement('div');
    spinnerOverlay.id = 'table-spinner-overlay';
    spinnerOverlay.className = 'absolute inset-0 bg-white bg-opacity-75 flex justify-center items-center z-10';
    spinnerOverlay.innerHTML = '<div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>';
    tableContainer.appendChild(spinnerOverlay);
  }
}

function hideTableSpinner() {
  const spinnerOverlay = document.getElementById('table-spinner-overlay');
  if (spinnerOverlay) {
    spinnerOverlay.remove();
  }
}


/**
 * Inicializa todos los selects personalizados en el panel de filtros.
 * Utiliza delegación de eventos para manejar clics en opciones,
 * lo que permite que las opciones cargadas dinámicamente (subcategorías, marcas) funcionen correctamente.
 */
function initCustomSelects() {
  const customSelects = document.querySelectorAll("#filtersPanel .custom-select");

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-trigger')) {
      customSelects.forEach(select => select.classList.remove('open'));
    }
  });

  customSelects.forEach((select) => {
    const trigger = select.querySelector(".custom-select-trigger");
    const optionsContainer = select.querySelector(".custom-select-options");
    const valueDisplay = select.querySelector(".custom-select-value");
    const selectName = select.getAttribute("data-name");

    const selectedOption = select.querySelector(".custom-select-option.selected");
    if (selectedOption) {
      valueDisplay.textContent = selectedOption.textContent;
    }

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = select.classList.contains('open');
      document.querySelectorAll("#filtersPanel .custom-select.open").forEach(s => {
        if (s !== select) s.classList.remove('open');
      });
      select.classList.toggle('open');
    });

    optionsContainer.addEventListener("click", (e) => {
      const option = e.target.closest('.custom-select-option');
      if (!option) return;

      e.stopPropagation();
      
      optionsContainer.querySelectorAll(".custom-select-option").forEach(opt => opt.classList.remove("selected"));
      option.classList.add("selected");
      valueDisplay.textContent = option.textContent;
      select.classList.remove("open");

      let hiddenInput = document.querySelector(`input[name="${selectName}"]`);
      if (!hiddenInput) {
        hiddenInput = document.createElement("input");
        hiddenInput.type = "hidden";
        hiddenInput.name = selectName;
        document.getElementById("filterForm").appendChild(hiddenInput);
      }
      hiddenInput.value = option.getAttribute("data-value");

      const value = option.getAttribute("data-value");
      if (selectName === "categoria_id") {
        loadSubcategorias(value);
        loadMarcas();
        applyFilters();
      } else if (selectName === "subcategoria_id") {
        loadSeudocategorias(value);
        loadMarcas();
        applyFilters();
      } else if (selectName === "seudocategoria_id") {
        loadMarcas();
        applyFilters();
      } else if (["estado", "sort_by", "sort_order", "marca"].includes(selectName)) {
        applyFilters();
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
    options.forEach(option => {
        optionsHTML += `<div class="custom-select-option" data-value="${option.id}">${option.nombre}</div>`;
    });

    optionsContainer.innerHTML = optionsHTML;
    valueDisplay.textContent = defaultText;

    const hiddenInput = document.querySelector(`input[name="${selectName}"]`);
    if (hiddenInput) hiddenInput.value = "";
}


function loadSubcategorias(categoriaId) {
  const subcategoriaSelect = document.querySelector('[data-name="subcategoria_id"]');
  const subcategoriaValue = subcategoriaSelect.querySelector(".custom-select-value");
  
  loadSeudocategorias("");

  if (!categoriaId) {
    updateSelectOptions('subcategoria_id', []);
    return;
  }

  subcategoriaValue.innerHTML = '<span class="loading-indicator"></span>';

  fetch(`/admin/api/categories/${categoriaId}/subcategories`)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        updateSelectOptions('subcategoria_id', data.subcategorias);
      } else {
        console.error("Error al cargar subcategorías:", data.message);
        subcategoriaValue.textContent = "Error";
      }
    })
    .catch(error => {
      console.error("Error en la petición de subcategorías:", error);
      subcategoriaValue.textContent = "Error";
    });
}

function loadSeudocategorias(subcategoriaId) {
    const seudoSelect = document.querySelector('[data-name="seudocategoria_id"]');
    const seudoValue = seudoSelect.querySelector(".custom-select-value");

    if (!subcategoriaId) {
        updateSelectOptions('seudocategoria_id', []);
        return;
    }

    seudoValue.innerHTML = '<span class="loading-indicator"></span>';

    fetch(`/admin/api/subcategories/${subcategoriaId}/pseudocategories`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateSelectOptions('seudocategoria_id', data.seudocategorias);
            } else {
                console.error("Error al cargar seudocategorías:", data.message);
                seudoValue.textContent = "Error";
            }
        })
        .catch(error => {
            console.error("Error en la petición de seudocategorías:", error);
            seudoValue.textContent = "Error";
        });
}

function loadMarcas() {
    const categoriaId = document.querySelector('input[name="categoria_id"]')?.value || '';
    const subcategoriaId = document.querySelector('input[name="subcategoria_id"]')?.value || '';
    const seudocategoriaId = document.querySelector('input[name="seudocategoria_id"]')?.value || '';

    const marcaSelect = document.querySelector('[data-name="marca"]');
    const marcaValue = marcaSelect.querySelector(".custom-select-value");
    marcaValue.innerHTML = '<span class="loading-indicator"></span>';

    const params = new URLSearchParams({
        categoria_id: categoriaId,
        subcategoria_id: subcategoriaId,
        seudocategoria_id: seudocategoriaId,
    }).toString();

    fetch(`/admin/api/brands?${params}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateSelectOptions('marca', data.marcas);
            } else {
                console.error("Error al cargar marcas:", data.message);
                marcaValue.textContent = "Error";
            }
        })
        .catch(error => {
            console.error("Error en la petición de marcas:", error);
            marcaValue.textContent = "Error";
        });
}


function applyFilters(fromPagination = false) {
  // Si la llamada no viene de la paginación, reseteamos a la página 1.
  if (!fromPagination) {
    let pageInput = document.querySelector('input[name="page"]');
    if (pageInput) {
      pageInput.value = '1';
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
    .map(
      (product) => `
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
                   <div class="text-sm font-semibold text-gray-900">${formatCurrency(product.precio)}</div>
                   <div class="text-sm text-gray-500">Costo: ${formatCurrency(product.costo)}</div>
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
                           }" class="sr-only" ${
        product.estado === "activo" ? "checked" : ""
      } onchange="toggleProductStatus('${product.id}', this.checked)">
                           <label for="toggle-${
                             product.id
                           }" class="block h-7 w-14 rounded-full cursor-pointer transition-colors duration-300 ease-in-out ${
        product.estado === "activo"
          ? "bg-gradient-to-r from-green-400 to-emerald-500 shadow-lg"
          : "bg-gray-300"
      }">
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
                   <a href="#" class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-600 hover:text-indigo-800 transition-all duration-300 transform hover:scale-110 shadow-md" title="Editar producto">
                       <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                       </svg>
                   </a>
               </td>
           </tr>
       `
    )
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
           <a href="#" onclick="goToPage(${
             pagination.prev_num
           })" class="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium ${
    !pagination.has_prev
      ? "text-gray-400 cursor-not-allowed"
      : "text-gray-700 hover:bg-gray-50 transition-colors duration-200"
  } inline-flex items-center">
               <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
               </svg>
               Anterior
           </a>
       `;

    const startPage = Math.max(1, pagination.page - 2);
    const endPage = Math.min(pagination.pages, pagination.page + 2);

    if (startPage > 1) {
      paginationHTML += `<a href="#" onclick="goToPage(1)" class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200">1</a>`;
      if (startPage > 2) {
        paginationHTML += `<span class="px-3 py-2 text-gray-500">...</span>`;
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      if (i === pagination.page) {
        paginationHTML += `<span class="px-3 py-2 rounded-lg border border-blue-500 bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-sm font-medium">${i}</span>`;
      } else {
        paginationHTML += `<a href="#" onclick="goToPage(${i})" class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200">${i}</a>`;
      }
    }

    if (endPage < pagination.pages) {
      if (endPage < pagination.pages - 1) {
        paginationHTML += `<span class="px-3 py-2 text-gray-500">...</span>`;
      }
      paginationHTML += `<a href="#" onclick="goToPage(${pagination.pages})" class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200">${pagination.pages}</a>`;
    }

    paginationHTML += `
           <a href="#" onclick="goToPage(${
             pagination.next_num
           })" class="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium ${
    !pagination.has_next
      ? "text-gray-400 cursor-not-allowed"
      : "text-gray-700 hover:bg-gray-50 transition-colors duration-200"
  } inline-flex items-center">
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

  const count = products.length;
  const total = pagination.total_general;

  resultsCounter.innerHTML = `
           Mostrando
           <span class="font-semibold text-blue-600">${count}</span>
           de
           <span class="font-semibold text-blue-600">${total}</span>
           productos
       `;
}

function goToPage(page) {
  let pageInput = document.querySelector('input[name="page"]');
  if (!pageInput) {
    pageInput = document.createElement("input");
    pageInput.type = "hidden";
    pageInput.name = "page";
    document.getElementById("filterForm").appendChild(pageInput);
  }
  pageInput.value = page;

  applyFilters(true); // Indicar que la llamada viene de la paginación
}

function resetFilters() {
  document.getElementById("filterForm").reset();

  document
    .querySelectorAll("#filtersPanel .custom-select")
    .forEach((select) => {
      const valueDisplay = select.querySelector(".custom-select-value");
      const optionElements = select.querySelectorAll(".custom-select-option");
      const selectName = select.getAttribute("data-name");

      optionElements.forEach((opt) => opt.classList.remove("selected"));
      optionElements[0].classList.add("selected");
      valueDisplay.textContent = optionElements[0].textContent;

      const hiddenInput = document.querySelector(`input[name="${selectName}"]`);
      if (hiddenInput) {
        hiddenInput.value = "";
      }
    });

  applyFilters();
}

function debounceFilter() {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    applyFilters();
  }, 500);
}

function toggleFilters() {
  const panel = document.getElementById("filtersPanel");
  const overlay = document.getElementById("overlay");

  // Alternar clases para animación
  panel.classList.toggle("translate-x-full");
  overlay.classList.toggle("hidden");

  // Añadir efecto de desenfoque al contenido principal cuando el menú está abierto
  if (!panel.classList.contains("translate-x-full")) {
    document.body.classList.add("overflow-hidden");
  } else {
    document.body.classList.remove("overflow-hidden");
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

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    const panel = document.getElementById("filtersPanel");
    if (panel && !panel.classList.contains("translate-x-full")) {
      toggleFilters();
    }
  }
});

document.addEventListener("DOMContentLoaded", function () {
  initCustomSelects();
});
