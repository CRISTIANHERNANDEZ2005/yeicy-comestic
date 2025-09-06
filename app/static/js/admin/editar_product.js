function initializeEditarProductForm() {
  // Elementos del DOM
  const form = document.getElementById("product-form");
  // Si el formulario no existe, significa que no estamos en la página de edición de productos, salimos.
  if (!form) {
    return;
  }

  const productId = form.dataset.productId;

  // Asegurarse de que todos los elementos necesarios existan antes de continuar
  const imagenUrlInput = document.getElementById("imagen_url");
  const previewImage = document.getElementById("preview-image");
  const imagePlaceholder = document.getElementById("image-placeholder");
  const addEspecificacionBtn = document.getElementById("add-especificacion");
  const especificacionesContainer = document.getElementById(
    "especificaciones-container"
  );
  const previewBtn = document.getElementById("preview-btn");
  const previewModal = document.getElementById("preview-modal");
  const closePreviewBtns = document.querySelectorAll(
    "#close-preview, #close-preview-btn"
  );
  const submitBtn = document.getElementById("submit-btn");
  const submitText = document.getElementById("submit-text");

  const statusBasic = document.getElementById("status-basic");
  const statusCategory = document.getElementById("status-category");
  const statusPrices = document.getElementById("status-prices");
  const statusInventory = document.getElementById("status-inventory");
  const completionPercentage = document.getElementById("completion-percentage");
  const completionBar = document.getElementById("completion-bar");

  const margenGanancia = document.getElementById("margen-ganancia");
  const totalVentas = document.getElementById("total-ventas");
  const gananciaTotal = document.getElementById("ganancia-total");

  const categoriaPrincipal = document.getElementById("categoria_principal");
  const subcategoria = document.getElementById("subcategoria");
  const seudocategoria = document.getElementById("seudocategoria");

  const precioInput = document.getElementById("precio");
  const costoInput = document.getElementById("costo");
  const existenciaInput = document.getElementById("existencia");
  const stockMinimoInput = document.getElementById("stock_minimo");
  const stockMaximoInput = document.getElementById("stock_maximo");
  const precioError = document.getElementById("precio-error");
  const existenciaError = document.getElementById("existencia-error");

  const priceChartCanvas = document.getElementById("priceChart");

  // Si alguno de los elementos críticos no se encuentra, salimos
  if (
    !imagenUrlInput ||
    !previewImage ||
    !imagePlaceholder ||
    !addEspecificacionBtn ||
    !especificacionesContainer ||
    !previewBtn ||
    !previewModal ||
    closePreviewBtns.length === 0 ||
    !submitBtn ||
    !submitText ||
    !statusBasic ||
    !statusCategory ||
    !statusPrices ||
    !statusInventory ||
    !completionPercentage ||
    !completionBar ||
    !margenGanancia ||
    !totalVentas ||
    !gananciaTotal ||
    !categoriaPrincipal ||
    !subcategoria ||
    !seudocategoria ||
    !precioInput ||
    !costoInput ||
    !existenciaInput ||
    !stockMinimoInput ||
    !stockMaximoInput ||
    !precioError ||
    !existenciaError ||
    !priceChartCanvas
  ) {
    console.warn(
      "Faltan elementos críticos en el DOM para inicializar editar_product.js"
    );
    return;
  }

  let priceChartInstance; // Declare priceChartInstance locally

  // Destruir la instancia anterior del gráfico si existe
  if (priceChartInstance) {
    priceChartInstance.destroy();
  }

  // Gráfico de distribución de precios
  const ctx = priceChartCanvas.getContext("2d");
  priceChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Costo", "Ganancia"],
      datasets: [
        {
          data: [0, 0],
          backgroundColor: [
            "rgba(54, 162, 235, 0.7)",
            "rgba(75, 192, 192, 0.7)",
          ],
          borderColor: ["rgba(54, 162, 235, 1)", "rgba(75, 192, 192, 1)"],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });

  // Previsualización de imagen
  imagenUrlInput.oninput = function () {
    // Usar oninput directamente para evitar duplicación de listeners
    const url = this.value;
    if (url) {
      previewImage.src = url;
      previewImage.onload = function () {
        previewImage.classList.remove("hidden");
        imagePlaceholder.classList.add("hidden");
      };
      previewImage.onerror = function () {
        previewImage.classList.add("hidden");
        imagePlaceholder.classList.remove("hidden");
      };
    } else {
      previewImage.classList.add("hidden");
      imagePlaceholder.classList.remove("hidden");
    }
    updateFormStatus();
    updateFinancialMetrics();
  };

  // Validación de precios
  function validatePrices() {
    const precio = parseFloat(precioInput.value);
    const costo = parseFloat(costoInput.value);

    if (!isNaN(precio) && !isNaN(costo) && precio <= costo) {
      precioError.classList.remove("hidden");
      precioInput.classList.add("border-red-500");
      costoInput.classList.add("border-red-500");
      return false;
    } else {
      precioError.classList.add("hidden");
      precioInput.classList.remove("border-red-500");
      costoInput.classList.remove("border-red-500");
      return true;
    }
  }

  // Validación de stock
  function validateStock() {
    const existencia = parseInt(existenciaInput.value);
    const stockMinimo = parseInt(stockMinimoInput.value);
    const stockMaximo = parseInt(stockMaximoInput.value);

    let isValid = true;
    let errorMessage = "";

    // Limpiar errores previos
    existenciaError.classList.add("hidden");
    existenciaInput.classList.remove("border-red-500");
    stockMinimoInput.classList.remove("border-red-500");
    stockMaximoInput.classList.remove("border-red-500");

    if (isNaN(existencia) || isNaN(stockMinimo) || isNaN(stockMaximo)) {
      // No validar si algún campo está vacío o no es un número
      return true;
    }

    if (stockMinimo >= stockMaximo) {
      errorMessage = "El stock mínimo debe ser menor que el stock máximo.";
      stockMinimoInput.classList.add("border-red-500");
      stockMaximoInput.classList.add("border-red-500");
      isValid = false;
    }

    if (existencia <= stockMinimo) {
      if (errorMessage) errorMessage += "<br>";
      errorMessage += "La existencia debe ser mayor que el stock mínimo.";
      existenciaInput.classList.add("border-red-500");
      stockMinimoInput.classList.add("border-red-500");
      isValid = false;
    }

    if (existencia >= stockMaximo) {
      if (errorMessage) errorMessage += "<br>";
      errorMessage += "La existencia debe ser menor que el stock máximo.";
      existenciaInput.classList.add("border-red-500");
      stockMaximoInput.classList.add("border-red-500");
      isValid = false;
    }

    if (!isValid) {
      existenciaError.innerHTML = `<i class="fas fa-exclamation-circle mr-1"></i>${errorMessage}`;
      existenciaError.classList.remove("hidden");
    }

    return isValid;
  }

  // Actualizar métricas financieras
  function updateFinancialMetrics() {
    const precio = parseFloat(precioInput.value) || 0;
    const costo = parseFloat(costoInput.value) || 0;
    const existencia = parseInt(existenciaInput.value) || 0;

    // Calcular margen de ganancia
    let margen = 0;
    if (precio > 0 && costo > 0 && precio > costo) {
      margen = ((precio - costo) / precio) * 100;
    }
    margenGanancia.textContent = `${margen.toFixed(1)}%`;

    // Calcular total de ventas potencial
    const totalVentasValor = precio * existencia;
    totalVentas.textContent = `${totalVentasValor.toLocaleString("es-CO", {
      maximumFractionDigits: 0,
    })}`;

    // Calcular ganancia total potencial
    const gananciaTotalValor = (precio - costo) * existencia;
    gananciaTotal.textContent = `${gananciaTotalValor.toLocaleString("es-CO", {
      maximumFractionDigits: 0,
    })}`;

    // Actualizar gráfico
    if (priceChartInstance && precio > 0 && costo > 0 && precio > costo) {
      priceChartInstance.data.datasets[0].data = [costo, precio - costo];
      priceChartInstance.update();
    } else if (priceChartInstance) {
      priceChartInstance.data.datasets[0].data = [0, 0];
      priceChartInstance.update();
    }
  }

  precioInput.oninput = function () {
    validatePrices();
    updateFinancialMetrics();
    updateFormStatus();
  };

  costoInput.oninput = function () {
    validatePrices();
    updateFinancialMetrics();
    updateFormStatus();
  };

  existenciaInput.oninput = function () {
    updateFinancialMetrics();
    validateStock();
    updateFormStatus();
  };

  stockMinimoInput.oninput = function () {
    validateStock();
    updateFinancialMetrics();
    updateFormStatus();
  };

  stockMaximoInput.oninput = function () {
    validateStock();
    updateFinancialMetrics();
    updateFormStatus();
  };

  // Cargar y seleccionar categorías
  async function loadAndSelectCategories() {
    const selectedCategoriaPrincipalId = form.dataset.selectedCategoriaPrincipalId;
    const selectedSubcategoriaId = form.dataset.selectedSubcategoriaId;
    const selectedSeudocategoriaId = form.dataset.selectedSeudocategoriaId;

    // 1. Cargar categorías principales
    await fetch("/admin/api/categorias_principales")
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          categoriaPrincipal.innerHTML = '<option value="">Selecciona una categoría</option>';
          data.categorias.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat.id;
            option.textContent = cat.nombre;
            categoriaPrincipal.appendChild(option);
          });
          if (selectedCategoriaPrincipalId) {
            categoriaPrincipal.value = selectedCategoriaPrincipalId;
          }
        }
      });

    // 2. Cargar subcategorías si hay una categoría principal seleccionada
    if (categoriaPrincipal.value) {
      subcategoria.disabled = false;
      subcategoria.classList.remove("bg-gray-100");
      await fetch(`/admin/api/categorias/${categoriaPrincipal.value}/subcategorias`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            subcategoria.innerHTML = '<option value="">Selecciona una subcategoría</option>';
            data.subcategorias.forEach(sub => {
              const option = document.createElement("option");
              option.value = sub.id;
              option.textContent = sub.nombre;
              subcategoria.appendChild(option);
            });
            if (selectedSubcategoriaId) {
              subcategoria.value = selectedSubcategoriaId;
            }
          }
        });
    }

    // 3. Cargar seudocategorías si hay una subcategoría seleccionada
    if (subcategoria.value) {
      seudocategoria.disabled = false;
      seudocategoria.classList.remove("bg-gray-100");
      await fetch(`/admin/api/subcategorias/${subcategoria.value}/seudocategorias`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            seudocategoria.innerHTML = '<option value="">Selecciona una seudocategoría</option>';
            data.seudocategorias.forEach(seudo => {
              const option = document.createElement("option");
              option.value = seudo.id;
              option.textContent = seudo.nombre;
              seudocategoria.appendChild(option);
            });
            if (selectedSeudocategoriaId) {
              seudocategoria.value = selectedSeudocategoriaId;
            }
          }
        });
    }
    updateFormStatus();
  }

  categoriaPrincipal.onchange = async function () {
    const selectedCategory = this.value;
    subcategoria.innerHTML = '<option value="">Selecciona una subcategoría</option>';
    seudocategoria.innerHTML = '<option value="">Selecciona primero una subcategoría</option>';
    seudocategoria.disabled = true;
    subcategoria.disabled = true;
    subcategoria.classList.add("bg-gray-100");
    seudocategoria.classList.add("bg-gray-100");

    if (selectedCategory) {
      subcategoria.disabled = false;
      subcategoria.classList.remove("bg-gray-100");
      await fetch(`/admin/api/categorias/${selectedCategory}/subcategorias`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            data.subcategorias.forEach(sub => {
              const option = document.createElement("option");
              option.value = sub.id;
              option.textContent = sub.nombre;
              subcategoria.appendChild(option);
            });
          }
        });
    }
    updateFormStatus();
  };

  subcategoria.onchange = async function () {
    const selectedSubcategory = this.value;
    seudocategoria.innerHTML = '<option value="">Selecciona una seudocategoría</option>';
    seudocategoria.disabled = true;
    seudocategoria.classList.add("bg-gray-100");

    if (selectedSubcategory) {
      seudocategoria.disabled = false;
      seudocategoria.classList.remove("bg-gray-100");
      await fetch(`/admin/api/subcategorias/${selectedSubcategory}/seudocategorias`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            data.seudocategorias.forEach(seudo => {
              const option = document.createElement("option");
              option.value = seudo.id;
              option.textContent = seudo.nombre;
              seudocategoria.appendChild(option);
            });
          }
        });
    }
    updateFormStatus();
  };

  seudocategoria.onchange = updateFormStatus;

  // Agregar especificación
  addEspecificacionBtn.onclick = function () {
    const nuevaEspecificacion = document.createElement("div");
    nuevaEspecificacion.className = "grid grid-cols-1 md:grid-cols-5 gap-3 items-center especificacion-item fade-in";
    nuevaEspecificacion.innerHTML = `
    <div class="md:col-span-2">
        <input type="text" class="especificacion-key w-full px-4 py-3 border border-gray-300 rounded-lg input-focus focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Propiedad">
    </div>
    <div class="md:col-span-2">
        <input type="text" class="especificacion-value w-full px-4 py-3 border border-gray-300 rounded-lg input-focus focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Valor">
    </div>
    <div>
        <button type="button" class="remove-especificacion w-full py-3 px-4 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition">
            <i class="fas fa-trash-alt"></i>
        </button>
    </div>
`;
    especificacionesContainer.appendChild(nuevaEspecificacion);
    nuevaEspecificacion.querySelector(".remove-especificacion").onclick = function () {
      nuevaEspecificacion.remove();
    };
  };

  document.querySelectorAll(".remove-especificacion").forEach(btn => {
    btn.onclick = function () {
      this.closest(".especificacion-item").remove();
    };
  });

  // Actualizar estado del formulario
  function updateFormStatus() {
    const nombre = document.getElementById("nombre").value;
    const descripcion = document.getElementById("descripcion").value;
    const imagenUrl = document.getElementById("imagen_url").value;
    const basicComplete = nombre && descripcion && imagenUrl;
    statusBasic.className = basicComplete ? "w-3 h-3 rounded-full bg-green-500 mr-2" : "w-3 h-3 rounded-full bg-red-500 mr-2";

    const categoryComplete = categoriaPrincipal.value && subcategoria.value && seudocategoria.value;
    statusCategory.className = categoryComplete ? "w-3 h-3 rounded-full bg-green-500 mr-2" : "w-3 h-3 rounded-full bg-red-500 mr-2";

    const precio = precioInput.value;
    const costo = costoInput.value;
    const pricesComplete = precio && costo && validatePrices();
    statusPrices.className = pricesComplete ? "w-3 h-3 rounded-full bg-green-500 mr-2" : "w-3 h-3 rounded-full bg-red-500 mr-2";

    const existencia = existenciaInput.value;
    const inventoryComplete = existencia !== "" && validateStock();
    statusInventory.className = inventoryComplete ? "w-3 h-3 rounded-full bg-green-500 mr-2" : "w-3 h-3 rounded-full bg-red-500 mr-2";

    let sections = 4;
    let completedSections = 0;
    if (basicComplete) completedSections++;
    if (categoryComplete) completedSections++;
    if (pricesComplete) completedSections++;
    if (inventoryComplete) completedSections++;

    const percentage = Math.round((completedSections / sections) * 100);
    completionPercentage.textContent = `${percentage}%`;
    completionBar.style.width = `${percentage}%`;

    const formComplete = basicComplete && categoryComplete && pricesComplete && inventoryComplete;
    submitBtn.classList.toggle("btn-disabled", !formComplete);
    if (!formComplete) {
      submitBtn.setAttribute("title", "Completa todos los campos para guardar los cambios.");
    } else {
      submitBtn.removeAttribute("title");
    }
    return formComplete;
  }

  document.getElementById("nombre").oninput = updateFormStatus;
  document.getElementById("descripcion").oninput = updateFormStatus;

  function openModal(modal) {
    modal.classList.remove("hidden");
    modal.classList.remove("modal-exiting");
    modal.classList.add("modal-entering");
  }

  function closeModal(modal) {
    modal.classList.remove("modal-entering");
    modal.classList.add("modal-exiting");
    modal.addEventListener("animationend", () => {
      modal.classList.add("hidden");
    }, { once: true });
  }

  previewBtn.onclick = function () {
    const nombre = document.getElementById("nombre").value || "Nombre del Producto";
    const descripcion = document.getElementById("descripcion").value || "Descripción del producto";
    const marca = document.getElementById("marca").value || "Marca";
    const precio = document.getElementById("precio").value || "0.00";
    const costo = document.getElementById("costo").value || "0.00";
    const existencia = document.getElementById("existencia").value || "0";
    const imagenUrl = document.getElementById("imagen_url").value || "https://via.placeholder.com/400";

    const categoriaPrincipalText = categoriaPrincipal.options[categoriaPrincipal.selectedIndex]?.text || "Categoría";
    const subcategoriaText = subcategoria.options[subcategoria.selectedIndex]?.text || "Subcategoría";
    const seudocategoriaText = seudocategoria.options[seudocategoria.selectedIndex]?.text || "Seudocategoría";

    const especificaciones = {};
    document.querySelectorAll(".especificacion-item").forEach(item => {
      const key = item.querySelector(".especificacion-key").value;
      const value = item.querySelector(".especificacion-value").value;
      if (key && value) {
        especificaciones[key] = value;
      }
    });

    const precioNum = parseFloat(precio) || 0;
    const costoNum = parseFloat(costo) || 0;
    const existenciaNum = parseInt(existencia) || 0;
    const margen = precioNum > 0 && costoNum > 0 && precioNum > costoNum ? ((precioNum - costoNum) / precioNum) * 100 : 0;
    const totalVentasValor = precioNum * existenciaNum;
    const gananciaTotalValor = (precioNum - costoNum) * existenciaNum;

    let especificacionesHtml = "";
    if (Object.keys(especificaciones).length > 0) {
      especificacionesHtml = '<div class="mt-4"><h4 class="font-medium text-gray-700 mb-2">Especificaciones:</h4><ul class="space-y-1">';
      for (const [key, value] of Object.entries(especificaciones)) {
        especificacionesHtml += `<li class="text-sm text-gray-600"><span class="font-medium">${key}:</span> ${value}</li>`;
      }
      especificacionesHtml += "</ul></div>";
    }

    const previewContent = document.getElementById("preview-content");
    previewContent.innerHTML = `
    <div class="flex flex-col md:flex-row gap-6">
        <div class="md:w-1/2">
            <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <img src="${imagenUrl}" alt="${nombre}" class="w-full h-full object-cover">
            </div>
        </div>
        <div class="md:w-1/2">
            <h2 class="text-2xl font-bold text-gray-800">${nombre}</h2>
            <p class="text-gray-600 mt-1">${marca}</p>
            <div class="mt-4">
                <span class="text-2xl font-bold text-indigo-600">${parseFloat(precio).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span class="text-sm text-gray-500 ml-2">Costo: ${parseFloat(costo).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div class="mt-4">
                <span class="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">Existencia: ${existencia} unidades</span>
            </div>
            <div class="mt-6">
                <h3 class="font-medium text-gray-700 mb-2">Categorización:</h3>
                <p class="text-sm text-gray-600">${categoriaPrincipalText} > ${subcategoriaText} > ${seudocategoriaText}</p>
            </div>
            <div class="mt-6">
                <h3 class="font-medium text-gray-700 mb-2">Descripción:</h3>
                <p class="text-gray-600">${descripcion}</p>
            </div>
            ${especificacionesHtml}
            <div class="mt-6 pt-4 border-t border-gray-200">
                <h3 class="font-medium text-gray-700 mb-3">Indicadores Financieros</h3>
                <div class="grid grid-cols-3 gap-4">
                    <div class="bg-indigo-50 p-3 rounded-lg">
                        <p class="text-xs text-indigo-700">Margen</p>
                        <p class="font-bold text-indigo-700">${margen.toFixed(1)}%</p>
                        <p class="text-xs text-gray-500 mt-1"><span class="formula">((P-C)/P)×100</span></p>
                    </div>
                    <div class="bg-green-50 p-3 rounded-lg">
                        <p class="text-xs text-green-700">Ventas Potencial</p>
                        <p class="font-bold text-green-700">${totalVentasValor.toLocaleString("es-CO", { maximumFractionDigits: 0 })}</p>
                        <p class="text-xs text-gray-500 mt-1"><span class="formula">P×E</span></p>
                    </div>
                    <div class="bg-purple-50 p-3 rounded-lg">
                        <p class="text-xs text-purple-700">Ganancia Potencial</p>
                        <p class="font-bold text-purple-700">${gananciaTotalValor.toLocaleString("es-CO", { maximumFractionDigits: 0 })}</p>
                        <p class="text-xs text-gray-500 mt-1"><span class="formula">(P-C)×E</span></p>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;
    openModal(previewModal);
  };

  closePreviewBtns.forEach(btn => {
    btn.addEventListener("click", function () {
      closeModal(previewModal);
    });
  });

  previewModal.addEventListener("click", function (event) {
    if (event.target === previewModal) {
      closeModal(previewModal);
    }
  });

  function handleDisabledSubmitClick() {
    const messages = [];
    const sectionsToHighlight = [];

    if (!/bg-green-500/.test(statusBasic.className)) {
      messages.push("información básica");
      sectionsToHighlight.push(document.getElementById("seccion-basica"));
    }
    if (!/bg-green-500/.test(statusCategory.className)) {
      messages.push("categorización");
      sectionsToHighlight.push(document.getElementById("seccion-categorias"));
    }
    if (!/bg-green-500/.test(statusPrices.className)) {
      messages.push("precios");
      sectionsToHighlight.push(document.getElementById("seccion-precios"));
    }
    if (!/bg-green-500/.test(statusInventory.className)) {
      messages.push("inventario");
      sectionsToHighlight.push(document.getElementById("seccion-inventario"));
    }

    let toastMessage = "Por favor, complete todos los campos obligatorios para guardar.";
    if (messages.length > 0) {
      toastMessage = `Falta completar: ${messages.join(", ")}.`;
    }
    showNotification(toastMessage, "error");

    if (sectionsToHighlight.length > 0) {
      const firstInvalidSection = sectionsToHighlight[0];
      if (firstInvalidSection) {
        firstInvalidSection.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      sectionsToHighlight.forEach(section => {
        if (section) {
          section.classList.add("bg-red-50");
          setTimeout(() => {
            section.classList.remove("bg-red-50");
          }, 2500);
        }
      });
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const isFormComplete = updateFormStatus();
    if (!isFormComplete || !validatePrices() || !validateStock()) {
      handleDisabledSubmitClick();
      return;
    }

    const formData = new FormData(form);
    const especificaciones = {};
    document.querySelectorAll(".especificacion-item").forEach(item => {
      const key = item.querySelector(".especificacion-key").value;
      const value = item.querySelector(".especificacion-value").value;
      if (key && value) {
        especificaciones[key] = value;
      }
    });
    formData.append("especificaciones", JSON.stringify(especificaciones));

    submitBtn.classList.add("btn-disabled");
    submitText.innerHTML = '<span class="loading-spinner mr-2"></span> Guardando...';

    fetch(`/admin/api/producto/editar/${productId}`, {
      method: "PUT",
      body: formData,
    })
      .then(response => response.json().then(data => ({ status: response.status, body: data })))
      .then(({ status, body }) => {
        if (body.success) {
          showNotification("Producto actualizado exitosamente");
          setTimeout(() => {
            window.loadAdminContent("/admin/lista-productos");
          }, 2000);
        } else {
          showNotification(body.message || "Ocurrió un error al actualizar el producto", "error");
          if (status === 409) {
            const nombreInput = document.getElementById("nombre");
            nombreInput.classList.add("border-red-500");
            nombreInput.focus();
            nombreInput.addEventListener("input", () => {
              nombreInput.classList.remove("border-red-500");
            }, { once: true });
          }
          submitBtn.classList.remove("btn-disabled");
          submitText.textContent = "Guardar Cambios";
        }
      })
      .catch(error => {
        console.error("Error en la solicitud:", error);
        showNotification("Ocurrió un error en la conexión con el servidor", "error");
        submitBtn.classList.remove("btn-disabled");
        submitText.textContent = "Guardar Cambios";
      });
  });

  function showNotification(message, type = "success") {
    if (type === "error") {
      window.toast.error(message);
    } else {
      window.toast.success(message);
    }
  }

  // Inicializar
  loadAndSelectCategories();
  updateFinancialMetrics();
  updateFormStatus();
}

document.addEventListener("DOMContentLoaded", initializeEditarProductForm);
document.addEventListener("content-loaded", function (event) {
  if (event.detail.container.querySelector("#product-form[data-product-id]")) {
    initializeEditarProductForm();
  }
});