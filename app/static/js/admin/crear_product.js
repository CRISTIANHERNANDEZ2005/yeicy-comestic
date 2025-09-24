function initializeCrearProductForm() {
  // Elementos del DOM
  const form = document.getElementById("product-form");
  // Si el formulario no existe, significa que no estamos en la página de creación de productos, salimos.
  if (!form) {
    return;
  }

  // Asegurarse de que todos los elementos necesarios existan antes de continuar
  const imagenFileInput = document.getElementById("imagen_file");
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
    !imagenFileInput ||
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
      "Faltan elementos críticos en el DOM para inicializar crear_product.js"
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
  imagenFileInput.onchange = function (event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        previewImage.src = e.target.result;
        previewImage.classList.remove("hidden");
        imagePlaceholder.classList.add("hidden");
      };
      reader.readAsDataURL(file);
    } else {
      previewImage.classList.add("hidden");
      imagePlaceholder.classList.remove("hidden");
      previewImage.src = ""; // Limpiar src si no hay archivo
    }
    updateFormStatus();
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
    // Usar oninput directamente
    validatePrices();
    updateFinancialMetrics();
    updateFormStatus();
  };

  costoInput.oninput = function () {
    // Usar oninput directamente
    validatePrices();
    updateFinancialMetrics();
    updateFormStatus();
  };

  existenciaInput.oninput = function () {
    // Usar oninput directamente
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

  // Cargar subcategorías desde la API
  categoriaPrincipal.onchange = function () {
    // Usar onchange directamente
    const selectedCategory = this.value;

    // Limpiar subcategoría y seudocategoría
    subcategoria.innerHTML =
      '<option value="">Selecciona una subcategoría</option>';
    seudocategoria.innerHTML =
      '<option value="">Selecciona primero una subcategoría</option>';
    seudocategoria.disabled = true;

    if (selectedCategory) {
      // Habilitar subcategoría
      subcategoria.disabled = false;
      subcategoria.classList.remove("bg-gray-100");

      // Cargar subcategorías desde la API
      fetch(`/admin/api/categorias/${selectedCategory}/subcategorias`)
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            data.subcategorias.forEach((sub) => {
              const option = document.createElement("option");
              option.value = sub.id;
              option.textContent = sub.nombre;
              subcategoria.appendChild(option);
            });
          } else {
            console.error("Error al cargar subcategorías:", data.message);
          }
        })
        .catch((error) => {
          console.error("Error en la solicitud:", error);
        });
    } else {
      subcategoria.disabled = true;
      subcategoria.classList.add("bg-gray-100");
    }
    updateFormStatus();
  };

  // Cargar seudocategorías desde la API
  subcategoria.onchange = function () {
    // Usar onchange directamente
    const selectedSubcategory = this.value;

    // Limpiar seudocategoría
    seudocategoria.innerHTML =
      '<option value="">Selecciona una seudocategoría</option>';

    if (selectedSubcategory) {
      // Habilitar seudocategoría
      seudocategoria.disabled = false;
      seudocategoria.classList.remove("bg-gray-100");

      // Cargar seudocategorías desde la API
      fetch(`/admin/api/subcategorias/${selectedSubcategory}/seudocategorias`)
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            data.seudocategorias.forEach((seudo) => {
              const option = document.createElement("option");
              option.value = seudo.id;
              option.textContent = seudo.nombre;
              seudocategoria.appendChild(option);
            });
          } else {
            console.error("Error al cargar seudocategorías:", data.message);
          }
        })
        .catch((error) => {
          console.error("Error en la solicitud:", error);
        });
    } else {
      seudocategoria.disabled = true;
      seudocategoria.classList.add("bg-gray-100");
    }
    updateFormStatus();
  };

  // Cambio de seudocategoría
  seudocategoria.onchange = updateFormStatus; // Usar onchange directamente

  // Agregar especificación
  addEspecificacionBtn.onclick = function () {
    // Usar onclick directamente
    const nuevaEspecificacion = document.createElement("div");
    nuevaEspecificacion.className =
      "grid grid-cols-1 md:grid-cols-5 gap-3 items-center especificacion-item fade-in";
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

    // Agregar evento para eliminar
    nuevaEspecificacion.querySelector(".remove-especificacion").onclick =
      function () {
        // Usar onclick directamente
        nuevaEspecificacion.remove();
      };
  };

  // Eliminar especificación (para las existentes)
  document.querySelectorAll(".remove-especificacion").forEach((btn) => {
    btn.onclick = function () {
      // Usar onclick directamente
      this.closest(".especificacion-item").remove();
    };
  });

  // Actualizar estado del formulario
  function updateFormStatus() {
    // Verificar información básica
    const nombre = document.getElementById("nombre").value;
    const descripcion = document.getElementById("descripcion").value; // La descripción es opcional en algunos casos, pero la mantenemos obligatoria por ahora.
    const imagenFile = document.getElementById("imagen_file").files.length > 0;

    const basicComplete = nombre && descripcion && imagenFile;
    statusBasic.className = basicComplete
      ? "w-3 h-3 rounded-full bg-green-500 mr-2"
      : "w-3 h-3 rounded-full bg-red-500 mr-2";

    // Verificar categorías
    const categoryComplete =
      categoriaPrincipal.value && subcategoria.value && seudocategoria.value;
    statusCategory.className = categoryComplete
      ? "w-3 h-3 rounded-full bg-green-500 mr-2"
      : "w-3 h-3 rounded-full bg-red-500 mr-2";

    // Verificar precios
    const precio = precioInput.value;
    const costo = costoInput.value;
    const pricesComplete = precio && costo && validatePrices();
    statusPrices.className = pricesComplete
      ? "w-3 h-3 rounded-full bg-green-500 mr-2"
      : "w-3 h-3 rounded-full bg-red-500 mr-2";

    // Verificar inventario
    const existencia = existenciaInput.value; // Use existenciaInput directly
    const inventoryComplete = existencia !== "" && validateStock(); // Add validateStock()
    statusInventory.className = inventoryComplete
      ? "w-3 h-3 rounded-full bg-green-500 mr-2"
      : "w-3 h-3 rounded-full bg-red-500 mr-2";

    // Calcular porcentaje de completitud
    let sections = 4;
    let completedSections = 0;

    if (basicComplete) completedSections++;

    if (categoryComplete) completedSections++;

    if (pricesComplete) completedSections++;

    if (inventoryComplete) completedSections++;

    const percentage = Math.round((completedSections / sections) * 100);
    completionPercentage.textContent = `${percentage}%`;
    completionBar.style.width = `${percentage}%`;

    const formComplete =
      basicComplete && categoryComplete && pricesComplete && inventoryComplete;
    submitBtn.classList.toggle("btn-disabled", !formComplete);

    if (!formComplete) {
      submitBtn.setAttribute(
        "title",
        "Completa todos los campos para guardar el producto."
      );
    } else {
      submitBtn.removeAttribute("title");
    }

    return formComplete; // Return true if form is complete and valid
  }

  // Eventos para actualizar estado del formulario
  document.getElementById("nombre").oninput = updateFormStatus; // Usar oninput directamente
  document.getElementById("descripcion").oninput = updateFormStatus; // Usar oninput directamente

  function openModal(modal) {
    modal.classList.remove("hidden");
    modal.classList.remove("modal-exiting");
    modal.classList.add("modal-entering");
  }

  function closeModal(modal) {
    modal.classList.remove("modal-entering");
    modal.classList.add("modal-exiting");
    modal.addEventListener(
      "animationend",
      () => {
        modal.classList.add("hidden");
      },
      { once: true }
    );
  }

  // Vista previa del producto
  previewBtn.onclick = function () {
    // Usar onclick directamente
    const nombre =
      document.getElementById("nombre").value || "Nombre del Producto";
    const descripcion =
      document.getElementById("descripcion").value ||
      "Descripción del producto";
    const marca = document.getElementById("marca").value || "Marca";
    const precio = document.getElementById("precio").value || "0.00";
    const costo = document.getElementById("costo").value || "0.00"; // Usar el valor del input
    const existencia = document.getElementById("existencia").value || "0";
    
    // Usar la previsualización de la imagen local si existe, si no, un placeholder
    const imagenFile = document.getElementById("imagen_file").files[0];
    const imagenUrl = imagenFile
      ? URL.createObjectURL(imagenFile)
      : "https://via.placeholder.com/400";

    const categoriaPrincipalText =
      categoriaPrincipal.options[categoriaPrincipal.selectedIndex]?.text ||
      "Categoría";
    const subcategoriaText =
      subcategoria.options[subcategoria.selectedIndex]?.text || "Subcategoría";
    const seudocategoriaText =
      seudocategoria.options[seudocategoria.selectedIndex]?.text ||
      "Seudocategoría";

    // Recopilar especificaciones
    const especificaciones = {};
    document.querySelectorAll(".especificacion-item").forEach((item) => {
      const key = item.querySelector(".especificacion-key").value;
      const value = item.querySelector(".especificacion-value").value;
      if (key && value) {
        especificaciones[key] = value;
      }
    });

    // Calcular métricas financieras
    const precioNum = parseFloat(precio) || 0;
    const costoNum = parseFloat(costo) || 0;
    const existenciaNum = parseInt(existencia) || 0;
    const margen =
      precioNum > 0 && costoNum > 0 && precioNum > costoNum
        ? ((precioNum - costoNum) / precioNum) * 100
        : 0;
    const totalVentasValor = precioNum * existenciaNum;
    const gananciaTotalValor = (precioNum - costoNum) * existenciaNum;

    // Generar HTML de especificaciones
    let especificacionesHtml = "";
    if (Object.keys(especificaciones).length > 0) {
      especificacionesHtml =
        '<div class="mt-4"><h4 class="font-medium text-gray-700 mb-2">Especificaciones:</h4><ul class="space-y-1">';
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
                <span class="text-2xl font-bold text-indigo-600">${parseFloat(
                  precio
                ).toLocaleString("es-CO", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}</span>
                <span class="text-sm text-gray-500 ml-2">Costo: ${parseFloat(
                  costo
                ).toLocaleString("es-CO", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}</span>
            </div>
            
            <div class="mt-4">
                <span class="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    Existencia: ${existencia} unidades
                </span>
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
                        <p class="font-bold text-indigo-700">${margen.toFixed(
                          1
                        )}%</p>
                        <p class="text-xs text-gray-500 mt-1">
                            <span class="formula">((P-C)/P)×100</span>
                        </p>
                    </div>
                    <div class="bg-green-50 p-3 rounded-lg">
                        <p class="text-xs text-green-700">Ventas Potencial</p>
                        <p class="font-bold text-green-700">${totalVentasValor.toLocaleString(
                          "es-CO",
                          { maximumFractionDigits: 0 }
                        )}</p>
                        <p class="text-xs text-gray-500 mt-1">
                            <span class="formula">P×E</span>
                        </p>
                    </div>
                    <div class="bg-purple-50 p-3 rounded-lg">
                        <p class="text-xs text-purple-700">Ganancia Potencial</p>
                        <p class="font-bold text-purple-700">${gananciaTotalValor.toLocaleString(
                          "es-CO",
                          { maximumFractionDigits: 0 }
                        )}</p>
                        <p class="text-xs text-gray-500 mt-1">
                            <span class="formula">(P-C)×E</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;

    openModal(previewModal);
  };

  // Cerrar vista previa
  closePreviewBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      closeModal(previewModal);
    });
  });

  // Cerrar vista previa al hacer clic fuera del modal
  previewModal.addEventListener("click", function (event) {
    if (event.target === previewModal) {
      closeModal(previewModal);
    }
  });

  function handleDisabledSubmitClick() {
    const messages = [];
    const sectionsToHighlight = [];

    // Revisar cada sección y construir el mensaje de error
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

    let toastMessage =
      "Por favor, complete todos los campos obligatorios para guardar.";
    if (messages.length > 0) {
      toastMessage = `Falta completar: ${messages.join(", ")}.`;
    }

    showNotification(toastMessage, "error");

    if (sectionsToHighlight.length > 0) {
      // Hacer scroll a la primera sección incompleta
      const firstInvalidSection = sectionsToHighlight[0];
      if (firstInvalidSection) {
        firstInvalidSection.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }

      // Resaltar las secciones incompletas
      sectionsToHighlight.forEach((section) => {
        if (section) {
          section.classList.add("bg-red-50");
          setTimeout(() => {
            section.classList.remove("bg-red-50");
          }, 2500);
        }
      });
    }
  }

  // Enviar formulario
  form.addEventListener("submit", function (e) {
    e.preventDefault(); // Prevenir siempre el envío por defecto

    const isFormComplete = updateFormStatus();

    if (!isFormComplete || !validatePrices() || !validateStock()) {
      handleDisabledSubmitClick(); // Esta función ya muestra notificaciones
      // No es necesario mostrar otra notificación aquí.
      return;
    }

    // Recopilar datos del formulario
    const formData = new FormData(form);
    const especificaciones = {};

    document.querySelectorAll(".especificacion-item").forEach((item) => {
      const key = item.querySelector(".especificacion-key").value;
      const value = item.querySelector(".especificacion-value").value;
      if (key && value) {
        especificaciones[key] = value;
      }
    });

    // Agregar especificaciones como JSON
    formData.append("especificaciones", JSON.stringify(especificaciones));

    // Asegurarse de que el archivo de imagen esté en el FormData
    const imagenFile = document.getElementById("imagen_file").files[0];
    if (imagenFile) {
      formData.append("imagen_file", imagenFile);
    }

    // Mostrar indicador de carga
    submitBtn.classList.add("btn-disabled"); // Usar clase para deshabilitar visualmente
    submitText.innerHTML =
      '<span class="loading-spinner mr-2"></span> Guardando...';

    // Enviar datos al servidor
    fetch("/admin/producto/crear", {
      method: "POST",
      body: formData,
    })
      .then((response) => {
        // Devolvemos una promesa que se resuelve con el status y el body en formato JSON
        return response
          .json()
          .then((data) => ({ status: response.status, body: data }));
      })
      .then(({ status, body }) => {
        if (body.success) {
          showNotification("Producto creado exitosamente");
          setTimeout(() => {
            window.loadAdminContent("/admin/lista-productos");
          }, 2000);
        } else {
          showNotification(
            body.message || "Ocurrió un error al crear el producto",
            "error"
          );

          // Ahora 'status' está disponible aquí y podemos verificar si es 409
          if (status === 409) {
            const nombreInput = document.getElementById("nombre");
            nombreInput.classList.add("border-red-500");
            nombreInput.focus();
            nombreInput.addEventListener(
              "input",
              () => {
                nombreInput.classList.remove("border-red-500");
              },
              { once: true }
            );
          }

          submitBtn.classList.remove("btn-disabled"); // Reactivar en caso de error
          submitText.textContent = "Guardar Producto";
        }
      })
      .catch((error) => {
        console.error("Error en la solicitud:", error);
        showNotification(
          "Ocurrió un error en la conexión con el servidor",
          "error"
        );
        submitBtn.classList.remove("btn-disabled"); // Reactivar en caso de error
        submitText.textContent = "Guardar Producto";
      });
  });

  // Mostrar notificación (usando el sistema de notifications.html)
  function showNotification(message, type = "success") {
    if (type === "error") {
      window.toast.error(message);
    } else {
      window.toast.success(message);
    }
  }

  // Cargar categorías principales desde la API
  async function loadCategoriasPrincipales() {
    try {
      const response = await fetch("/admin/api/categorias_principales");
      const data = await response.json();

      if (data.success) {
        // Limpiar opciones existentes excepto la primera (placeholder)
        categoriaPrincipal.innerHTML =
          '<option value="">Selecciona una categoría</option>';
        data.categorias.forEach((cat) => {
          const option = document.createElement("option");
          option.value = cat.id;
          option.textContent = cat.nombre;
          categoriaPrincipal.appendChild(option);
        });
      } else {
        console.error("Error al cargar categorías principales:", data.message);
      }
    } catch (error) {
      console.error("Error en la solicitud de categorías principales:", error);
    }
  }

  // Inicializar estado del formulario y cargar categorías principales
  updateFormStatus();
  loadCategoriasPrincipales();
}

// Ejecutar la función de inicialización cuando el DOM esté completamente cargado
document.addEventListener("DOMContentLoaded", initializeCrearProductForm);

// Escuchar el evento personalizado 'content-loaded' de admin_spa.js
document.addEventListener("content-loaded", function (event) {
  // Verificar si el contenido cargado incluye el formulario de creación de producto
  // MEJORA PROFESIONAL: Usar `document` en lugar de `event.detail.container` para asegurar
  // que la búsqueda se realiza en todo el DOM después de la actualización de la SPA.
  // Esto es más robusto.
  if (document.querySelector("#product-form")) {
    console.log("Product form detected on content-loaded. Initializing...");
    initializeCrearProductForm();
  }
});