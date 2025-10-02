// Variables globales
let salesChart, categoryComparisonChart, subcategoryChart;
let currentPage = 1;
let productsPerPage = 10;
let isLoading = false;
let allTopProducts = []; // Almacenará todos los productos más vendidos
let filteredTopProducts = []; // Productos filtrados
let topProductsFilterTimeout = null; // Para el debounce de los filtros
let topProductsCurrentPage = 1; // para la paginación
const topProductsPerPage = 10; // productos por página

// Variables para productos relacionados
let relatedProductsCurrentPage = 1;
let relatedProductsPerPage = 10;
let relatedProductsFilterTimeout = null;
let currentRelatedProducts = []; // Almacena los productos relacionados actuales

// Variables para filtros de categoría de productos relacionados
let relatedSubcategories = [];
let relatedPseudocategories = [];

// Función para mostrar indicador de carga
function showLoading(element) {
  element.innerHTML = '<div class="loading-spinner"></div>';
}

// Función para formatear moneda
function formatCurrency(value) {
  if (value === null || value === undefined) return "$0";
  return (
    "$" +
    parseFloat(value).toLocaleString("es-CO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

// Función para formatear porcentaje
function formatPercentage(value) {
  if (value === null || value === undefined) return "0%";
  return parseFloat(value).toFixed(1) + "%";
}

// Función para mostrar un contenedor vacío con mensaje profesional
function showEmptyState(container, title, message, icon = "fa-inbox") {
  container.innerHTML = `
       <div class="no-data-container">
           <div class="no-data-icon">
               <i class="fas ${icon}"></i>
           </div>
           <h3 class="no-data-title">${title}</h3>
           <p class="no-data-message">${message}</p>
       </div>
   `;
}

// Función para mostrar un estado vacío en tarjetas
function showEmptyCard(container, title, message, icon = "fa-box-open") {
  container.innerHTML = `
       <div class="empty-state-card">
           <div class="empty-state-icon">
               <i class="fas ${icon}"></i>
           </div>
           <h3 class="font-medium text-gray-700">${title}</h3>
           <p class="text-gray-600 mt-2">${message}</p>
       </div>
   `;
}

// Función para mostrar un estado vacío en tablas
function showEmptyTable(
  tableContainer,
  title,
  message,
  icon = "fa-search",
  colspan = 9
) {
  tableContainer.innerHTML = `
       <tr>
           <td colspan="${colspan}" class="px-6 py-8 text-center">
               <div class="flex flex-col items-center justify-center">
                   <div class="text-gray-400 mb-4">
                       <i class="fas ${icon} text-5xl"></i>
                   </div>
                   <h3 class="text-lg font-medium text-gray-900 mb-2">${title}</h3>
                   <p class="text-gray-500">${message}</p>
               </div>
           </td>
       </tr>
   `;
}

// Función para obtener datos de la categoría
async function fetchCategoryData() {
  if (isLoading) return;
  isLoading = true;

  try {
    // Mostrar indicadores de carga en los gráficos
    const salesLoader = document.getElementById("salesChartLoading");
    if (salesLoader) salesLoader.style.display = "flex";

    const categoryComparisonLoader = document.getElementById(
      "categoryComparisonChartLoading"
    );
    if (categoryComparisonLoader)
      categoryComparisonLoader.style.display = "flex";

    const subcategoryLoader = document.getElementById(
      "subcategoryChartLoading"
    );
    if (subcategoryLoader) subcategoryLoader.style.display = "flex";

    const response = await fetch(
      `/admin/categorias-principales/${categoriaId}/detalle`
    );
    const data = await response.json();

    if (data.success) {
      updateCategoryHeader(data.category);
      updateMetrics(data.metrics);
      updateMarketTrends(data.trends);
      updateSubcategoryPerformance(data.subcategories);

      // Almacenar todos los productos más vendidos
      allTopProducts = data.topProducts || [];
      filteredTopProducts = [...allTopProducts];

      // Actualizar vista de productos más vendidos
      updateTopProductsView();
      populateCategoryFilter(data.subcategories);

      // Cargar productos relacionados
      fetchRelatedProductsAdvanced();
    } else {
      console.error("Error al cargar datos:", data.message);
      showErrorMessage(
        "Error al cargar los datos de la categoría: " + data.message
      );
    }
  } catch (error) {
    console.error("Error en la solicitud:", error);
    showErrorMessage(
      "Error de conexión al servidor. Por favor, intente nuevamente más tarde."
    );
  } finally {
    // Ocultar indicadores de carga
    const salesLoader = document.getElementById("salesChartLoading");
    if (salesLoader) salesLoader.style.display = "none";

    const categoryComparisonLoader = document.getElementById(
      "categoryComparisonChartLoading"
    );
    if (categoryComparisonLoader)
      categoryComparisonLoader.style.display = "none";

    const subcategoryLoader = document.getElementById(
      "subcategoryChartLoading"
    );
    if (subcategoryLoader) subcategoryLoader.style.display = "none";

    isLoading = false;
  }
}

// Función para poblar el filtro de categorías
function populateCategoryFilter(subcategories) {
  const categoryFilter = document.getElementById("category-filter");
  categoryFilter.innerHTML = '<option value="">Todas las categorías</option>';

  if (subcategories && subcategories.length > 0) {
    subcategories.forEach((subcategory) => {
      const option = document.createElement("option");
      option.value = subcategory.id;
      option.textContent = subcategory.nombre;
      categoryFilter.appendChild(option);

      if (
        subcategory.seudocategorias &&
        subcategory.seudocategorias.length > 0
      ) {
        subcategory.seudocategorias.forEach((pseudo) => {
          const pseudoOption = document.createElement("option");
          pseudoOption.value = `pseudo-${pseudo.id}`;
          pseudoOption.textContent = `  - ${pseudo.nombre}`;
          categoryFilter.appendChild(pseudoOption);
        });
      }
    });
  }
}

// Función para mostrar mensaje de error
function showErrorMessage(message) {
  // Crear una notificación de error
  const notification = document.createElement("div");
  notification.className =
    "fixed top-4 right-4 bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 flex items-center";
  notification.innerHTML = `
       <div class="mr-3">
           <i class="fas fa-exclamation-circle text-xl"></i>
       </div>
       <div>
           <h4 class="font-bold">Error</h4>
           <p>${message}</p>
       </div>
       <button class="ml-4 text-white hover:text-gray-200" onclick="this.parentElement.remove()">
           <i class="fas fa-times"></i>
       </button>
   `;
  document.body.appendChild(notification);

  // Auto-eliminar después de 5 segundos
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

// Función para mostrar mensaje de éxito
function showSuccessMessage(message) {
  // Crear una notificación de éxito
  const notification = document.createElement("div");
  notification.className =
    "fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 flex items-center";
  notification.innerHTML = `
       <div class="mr-3">
           <i class="fas fa-check-circle text-xl"></i>
       </div>
       <div>
           <h4 class="font-bold">Éxito</h4>
           <p>${message}</p>
       </div>
       <button class="ml-4 text-white hover:text-gray-200" onclick="this.parentElement.remove()">
           <i class="fas fa-times"></i>
       </button>
   `;
  document.body.appendChild(notification);

  // Auto-eliminar después de 3 segundos
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 3000);
}

// Función para actualizar encabezado de categoría
function updateCategoryHeader(category) {
  document.getElementById("category-name").textContent = category.nombre;
  document.getElementById("category-description").textContent =
    category.descripcion;
  document.getElementById("category-status").textContent =
    category.estado === "activo" ? "Activo" : "Inactivo";
  document.getElementById("category-status").className =
    category.estado === "activo"
      ? "bg-green-500 text-white text-xs font-medium px-2.5 py-0.5 rounded-full"
      : "bg-red-500 text-white text-xs font-medium px-2.5 py-0.5 rounded-full";
  document.getElementById("related-category-name").textContent =
    category.nombre;
}

// Función para actualizar métricas
function updateMetrics(metrics) {
  // Verificar si hay datos de productos
  const hasProducts = metrics.total_productos > 0;
  const hasSales = metrics.total_ventas > 0 || metrics.unidades_vendidas > 0;

  // Actualizar valores
  document.getElementById("total-sales").textContent = hasSales
    ? formatCurrency(metrics.total_ventas)
    : "Sin ventas";
  document.getElementById("units-sold").textContent = hasSales
    ? metrics.unidades_vendidas.toLocaleString()
    : "Sin ventas";
  document.getElementById("total-products").textContent =
    metrics.total_productos;
  document.getElementById("avg-margin").textContent =
    hasProducts && metrics.margen_promedio > 0
      ? formatPercentage(metrics.margen_promedio)
      : "Sin datos";

  // Actualizar tendencias
  const salesTrend = document.getElementById("sales-trend");
  const unitsTrend = document.getElementById("units-trend");
  const marginTrend = document.getElementById("margin-trend");

  if (hasSales) {
    salesTrend.innerHTML =
      metrics.ventas_tendencia > 0
        ? `<i class="fas fa-arrow-up mr-1"></i> ${formatPercentage(
            metrics.ventas_tendencia
          )}`
        : `<i class="fas fa-arrow-down mr-1"></i> ${formatPercentage(
            Math.abs(metrics.ventas_tendencia)
          )}`;
    salesTrend.className =
      metrics.ventas_tendencia > 0
        ? "text-green-600 text-sm flex items-center mt-1"
        : "text-red-600 text-sm flex items-center mt-1";
  } else {
    salesTrend.innerHTML = '<i class="fas fa-minus mr-1"></i> Sin datos';
    salesTrend.className = "text-gray-600 text-sm flex items-center mt-1";
  }

  if (hasSales) {
    unitsTrend.innerHTML =
      metrics.unidades_tendencia > 0
        ? `<i class="fas fa-arrow-up mr-1"></i> ${formatPercentage(
            metrics.unidades_tendencia
          )}`
        : `<i class="fas fa-arrow-down mr-1"></i> ${formatPercentage(
            Math.abs(metrics.unidades_tendencia)
          )}`;
    unitsTrend.className =
      metrics.unidades_tendencia > 0
        ? "text-green-600 text-sm flex items-center mt-1"
        : "text-red-600 text-sm flex items-center mt-1";
  } else {
    unitsTrend.innerHTML = '<i class="fas fa-minus mr-1"></i> Sin datos';
    unitsTrend.className = "text-gray-600 text-sm flex items-center mt-1";
  }

  if (hasProducts && metrics.margen_promedio > 0) {
    marginTrend.innerHTML =
      metrics.margen_tendencia > 0
        ? `<i class="fas fa-arrow-up mr-1"></i> ${formatPercentage(
            metrics.margen_tendencia
          )}`
        : `<i class="fas fa-arrow-down mr-1"></i> ${formatPercentage(
            Math.abs(metrics.margen_tendencia)
          )}`;
    marginTrend.className =
      metrics.margen_tendencia > 0
        ? "text-green-600 text-sm flex items-center mt-1"
        : "text-red-600 text-sm flex items-center mt-1";
  } else {
    marginTrend.innerHTML = '<i class="fas fa-minus mr-1"></i> Sin datos';
    marginTrend.className = "text-gray-600 text-sm flex items-center mt-1";
  }
}

// Función para actualizar tendencias del mercado
function updateMarketTrends(trends) {
  // Verificar si hay datos de evolución de ventas
  const hasSalesData = trends.evolucion_ventas.data.some((value) => value > 0);
  const salesChartContainer =
    document.getElementById("salesChart").parentElement;

  if (!hasSalesData) {
    showEmptyChart(
      salesChartContainer,
      "Sin datos de ventas",
      "No hay información de ventas disponible para esta categoría en los últimos meses."
    );
  } else {
    // Restaurar el canvas si fue reemplazado
    if (!document.getElementById("salesChart")) {
      salesChartContainer.innerHTML =
        '<canvas id="salesChart"></canvas><div id="salesChartLoading" class="loading-overlay" style="display: none;"><div class="loading-spinner"></div></div>';
      // Reinicializar el gráfico
      initializeSalesChart(trends.evolucion_ventas);
    } else if (salesChart) {
      salesChart.data.labels = trends.evolucion_ventas.labels;
      salesChart.data.datasets[0].data = trends.evolucion_ventas.data;
      salesChart.update();
    }
  }

  // MODIFICACIÓN: Siempre mostrar el gráfico de comparación, incluso si no hay datos
  const categoryComparisonContainer = document.getElementById(
    "categoryComparisonChart"
  ).parentElement;

  // Restaurar el canvas si fue reemplazado
  if (!document.getElementById("categoryComparisonChart")) {
    categoryComparisonContainer.innerHTML =
      '<canvas id="categoryComparisonChart"></canvas><div id="categoryComparisonChartLoading" class="loading-overlay" style="display: none;"><div class="loading-spinner"></div></div>';
    // Reinicializar el gráfico
    initializeCategoryComparisonChart(trends.comparacion_categorias);
  } else if (categoryComparisonChart) {
    categoryComparisonChart.data.labels = trends.comparacion_categorias.labels;
    categoryComparisonChart.data.datasets[0].data =
      trends.comparacion_categorias.current_data;
    categoryComparisonChart.data.datasets[1].data =
      trends.comparacion_categorias.previous_data;
    categoryComparisonChart.update();
  }

  // Actualizar indicadores clave
  document.getElementById("market-share").textContent = formatPercentage(
    trends.indicadores.participacion_mercado
  );
  document.getElementById("market-share-desc").textContent =
    trends.indicadores.participacion_mercado_desc;

  document.getElementById("growth-rate").textContent = formatPercentage(
    trends.indicadores.tasa_crecimiento
  );
  document.getElementById("growth-rate-desc").textContent =
    trends.indicadores.tasa_crecimiento_desc;

  document.getElementById("satisfaction").textContent = formatPercentage(
    trends.indicadores.satisfaccion_cliente
  );
  document.getElementById("satisfaction-desc").textContent =
    trends.indicadores.satisfaccion_cliente_desc;

  // Actualizar círculos de progreso
  updateProgressCircle(
    "market-share-circle",
    trends.indicadores.participacion_mercado
  );
  updateProgressCircle(
    "growth-rate-circle",
    trends.indicadores.tasa_crecimiento_clamped
  );
  updateProgressCircle(
    "satisfaction-circle",
    trends.indicadores.satisfaccion_cliente
  );
}

// Función para mostrar un estado vacío en gráficos
function showEmptyChart(
  chartContainer,
  title,
  message,
  icon = "fa-chart-line"
) {
  const chartId = chartContainer.querySelector("canvas").id;
  chartContainer.innerHTML = `
       <div class="no-data-container h-64">
           <div class="no-data-icon">
               <i class="fas ${icon}"></i>
           </div>
           <h3 class="no-data-title">${title}</h3>
           <p class="no-data-message">${message}</p>
       </div>
   `;
}

// Función para inicializar el gráfico de evolución de ventas
function initializeSalesChart(data) {
  const salesCtx = document.getElementById("salesChart").getContext("2d");
  salesChart = new Chart(salesCtx, {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Ventas ($)",
          data: data.data,
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 2,
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: function (value) {
              return "$" + value.toLocaleString();
            },
          },
        },
      },
    },
  });
}

// Función para inicializar el gráfico de comparación de categorías
function initializeCategoryComparisonChart(data) {
  const categoryComparisonCtx = document
    .getElementById("categoryComparisonChart")
    .getContext("2d");
  categoryComparisonChart = new Chart(categoryComparisonCtx, {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Ventas Actuales ($)",
          data: data.current_data,
          backgroundColor: [
            "rgba(59, 130, 246, 0.8)",
            "rgba(16, 185, 129, 0.8)",
            "rgba(245, 158, 11, 0.8)",
            "rgba(139, 92, 246, 0.8)",
            "rgba(236, 72, 153, 0.8)",
          ],
          borderWidth: 0,
        },
        {
          label: "Ventas Anteriores ($)",
          data: data.previous_data,
          backgroundColor: [
            "rgba(59, 130, 246, 0.4)",
            "rgba(16, 185, 129, 0.4)",
            "rgba(245, 158, 11, 0.4)",
            "rgba(139, 92, 246, 0.4)",
            "rgba(236, 72, 153, 0.4)",
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return (
                context.dataset.label + ": $" + context.raw.toLocaleString()
              );
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return "$" + value.toLocaleString();
            },
          },
        },
      },
    },
  });
}

// Función para actualizar círculo de progreso
function updateProgressCircle(circleId, percentage) {
  const circle = document.getElementById(circleId);
  if (!circle) return;

  const circumference = 150.8; // 2 * PI * 24 (radio del círculo SVG)
  const offset =
    circumference -
    (Math.min(100, Math.max(0, parseFloat(percentage) || 0)) / 100) *
      circumference;
  circle.style.strokeDashoffset = offset;
}

// Función para actualizar rendimiento de subcategorías
function updateSubcategoryPerformance(subcategories) {
  // Verificar si hay datos de subcategorías
  if (!subcategories || subcategories.length === 0) {
    const subcategoryChartContainer =
      document.getElementById("subcategoryChart").parentElement;
    showEmptyChart(
      subcategoryChartContainer,
      "Sin subcategorías",
      "No hay subcategorías disponibles para esta categoría."
    );

    document.getElementById("top-subcategories").innerHTML = "";
    showEmptyCard(
      document.getElementById("subcategory-cards"),
      "Sin subcategorías",
      "No hay subcategorías disponibles para mostrar."
    );
    showEmptyCard(
      document.getElementById("low-performing-subcategories"),
      "Sin subcategorías",
      "No hay subcategorías con bajo rendimiento para mostrar."
    );

    return;
  }

  // Separar subcategorías con y sin ventas.
  const subcategoriesWithSales = subcategories.filter((s) => s.ventas > 0);
  const subcategoriesWithoutSales = subcategories.filter(
    (s) => s.ventas === 0
  );
  const lowPerformingSubcategories =
    subcategoriesWithSales.slice(3).concat(subcategoriesWithoutSales);

  // Actualizar gráfico
  const subcategoryChartContainer =
    document.getElementById("subcategoryChart").parentElement;
  
  // Mostrar estado vacío para el gráfico si no hay ventas.
  const totalSales = subcategories.reduce((sum, s) => sum + s.ventas, 0);
  if (totalSales === 0) {
    showEmptyChart(
      subcategoryChartContainer,
      "Sin Datos de Ventas",
      "Aún no se han registrado ventas en ninguna de las subcategorías."
    );
  } else {
    if (!document.getElementById("subcategoryChart")) {
      subcategoryChartContainer.innerHTML =
        '<canvas id="subcategoryChart"></canvas><div id="subcategoryChartLoading" class="loading-overlay" style="display: none;"><div class="loading-spinner"></div></div>';
      initializeSubcategoryChart(subcategories);
    } else if (subcategoryChart) {
      subcategoryChart.data.labels = subcategories.map((s) => s.nombre);
      subcategoryChart.data.datasets[0].data = subcategories.map((s) => s.ventas);
      subcategoryChart.update();
    }
  }

  // Actualizar top subcategorías
  const topSubcategoriesContainer =
    document.getElementById("top-subcategories");
  topSubcategoriesContainer.innerHTML = "";

  if (subcategoriesWithSales.length === 0) {
    showEmptyCard(
      topSubcategoriesContainer,
      "Sin Ventas",
      "Ninguna subcategoría ha generado ventas todavía."
    );
  } else {
    subcategoriesWithSales.slice(0, 3).forEach((subcategory, index) => {
      const colors = ["blue", "green", "purple"];
      const item = document.createElement("div");
      item.className = `flex items-center justify-between p-3 bg-${colors[index]}-50 rounded-lg`;
      item.innerHTML = `
               <div class="flex items-center">
                   <div class="w-8 h-8 rounded-full bg-${
                     colors[index]
                   }-100 flex items-center justify-center mr-3">
                       <span class="text-${
                         colors[index]
                       }-800 font-bold text-sm">${index + 1}</span>
                   </div>
                   <span class="font-medium text-gray-800">${
                     subcategory.nombre
                   }</span>
                   ${
                     subcategory.estado === "inactivo"
                       ? '<span class="status-badge status-inactive ml-2"><i class="fas fa-circle"></i>Inactivo</span>'
                       : ""
                   }
               </div>
               <span class="font-bold text-gray-800">${formatCurrency(
                 subcategory.ventas
               )}</span>
           `;
      topSubcategoriesContainer.appendChild(item);
    });
  }

  // Actualizar tarjetas de subcategorías
  const subcategoryCardsContainer =
    document.getElementById("subcategory-cards");
  subcategoryCardsContainer.innerHTML = "";

  if (subcategoriesWithSales.length === 0) {
    showEmptyCard(
      subcategoryCardsContainer,
      "Sin Rendimiento",
      "No hay datos de ventas para mostrar en las tarjetas de rendimiento."
    );
  } else {
    subcategoriesWithSales.slice(0, 3).forEach((subcategory, index) => {
      const colors = ["blue", "green", "purple"];
      const card = document.createElement("div");
      card.className =
        "category-card bg-white border border-gray-200 rounded-xl overflow-hidden";
      card.innerHTML = `
               <div class="bg-gradient-to-r from-${colors[index]}-600 to-${
        colors[index]
      }-800 text-white p-4">
                   <div class="flex justify-between items-center">
                       <h4 class="font-bold text-lg">${subcategory.nombre}</h4>
                       <span class="bg-${
                         colors[index]
                       }-900 text-xs font-medium px-2 py-1 rounded-full">Top ${
        index + 1
      }</span>
                   </div>
                   <p class="text-${
                     colors[index]
                   }-100 text-sm mt-1">Ventas: ${formatCurrency(
        subcategory.ventas
      )}</p>
               </div>
               <div class="p-4">
                   <h5 class="font-medium text-gray-700 mb-3">Seudocategorías Destacadas</h5>
                   <div class="space-y-3">
                       ${
                         subcategory.seudocategorias &&
                         subcategory.seudocategorias.length > 0
                           ? subcategory.seudocategorias
                               .map(
                                 (pseudo) => `
                               <div class="flex justify-between items-center text-sm">
                                   <div class="flex items-center">
                                       <span class="text-gray-600">${
                                         pseudo.nombre
                                       }</span>
                                       ${
                                         pseudo.estado === "inactivo"
                                           ? '<span class="status-badge status-inactive ml-2"><i class="fas fa-circle"></i>Inactivo</span>'
                                           : ""
                                       }
                                   </div>
                                   <span class="text-sm font-medium">${formatCurrency(
                                     pseudo.ventas
                                   )}</span>
                               </div>
                           `
                               )
                               .join("")
                           : '<p class="text-gray-500 text-sm">No hay seudocategorías disponibles</p>'
                       }
                   </div>
                   <div class="mt-4 pt-4 border-t border-gray-200">
                       <div class="flex justify-between text-sm">
                           <span class="text-gray-500">Crecimiento mensual:</span>
                           <span class="${
                             subcategory.crecimiento > 0
                               ? "text-green-600"
                               : "text-red-600"
                           } font-medium">
                               ${
                                 subcategory.crecimiento > 0 ? "+" : ""
                               }${formatPercentage(subcategory.crecimiento)}
                           </span>
                       </div>
                       <div class="flex justify-between text-sm mt-1">
                           <span class="text-gray-500">Estado:</span>
                           <span class="status-badge ${
                             subcategory.estado === "activo"
                               ? "status-active"
                               : "status-inactive"
                           }">
                               <i class="fas fa-circle"></i>${
                                 subcategory.estado === "activo"
                                   ? "Activo"
                                   : "Inactivo"
                               }
                           </span>
                       </div>
                   </div>
               </div>
           `;
      subcategoryCardsContainer.appendChild(card);
    });
  }

  // Actualizar subcategorías con bajo rendimiento
  const lowPerformingContainer = document.getElementById(
    "low-performing-subcategories"
  );
  lowPerformingContainer.innerHTML = "";

  if (lowPerformingSubcategories.length === 0) {
    showEmptyCard(
      lowPerformingContainer,
      "Rendimiento Óptimo",
      "No hay subcategorías adicionales o con cero ventas para mostrar aquí."
    );
  } else {
    lowPerformingSubcategories.forEach((subcategory, index) => {
      const colors = ["amber", "rose", "gray", "cyan", "lime"];
      const card = document.createElement("div");
      card.className =
        "category-card bg-white border border-gray-200 rounded-xl overflow-hidden";
      card.innerHTML = `
               <div class="bg-gradient-to-r from-${colors[index]}-600 to-${
        colors[index]
      }-800 text-white p-4">
                   <div class="flex justify-between items-center">
                       <h4 class="font-bold text-lg">${subcategory.nombre}</h4>
                       <span class="bg-${
                         colors[index]
                       }-900 text-xs font-medium px-2 py-1 rounded-full">Pos. ${
        index + 4
      }</span>
                   </div>
                   <p class="text-${
                     colors[index]
                   }-100 text-sm mt-1">Ventas: ${formatCurrency(
        subcategory.ventas
      )}</p>
               </div>
               <div class="p-4">
                   <h5 class="font-medium text-gray-700 mb-3">Seudocategorías</h5>
                   <div class="space-y-3">
                       ${
                         subcategory.seudocategorias &&
                         subcategory.seudocategorias.length > 0
                           ? subcategory.seudocategorias
                               .map(
                                 (pseudo) => `
                               <div class="flex justify-between items-center text-sm">
                                   <div class="flex items-center">
                                       <span class="text-gray-600">${
                                         pseudo.nombre
                                       }</span>
                                       ${
                                         pseudo.estado === "inactivo"
                                           ? '<span class="status-badge status-inactive ml-2"><i class="fas fa-circle"></i>Inactivo</span>'
                                           : ""
                                       }
                                   </div>
                                   <span class="text-sm font-medium">${formatCurrency(
                                     pseudo.ventas
                                   )}</span>
                               </div>
                           `
                               )
                               .join("")
                           : '<p class="text-gray-500 text-sm">No hay seudocategorías disponibles</p>'
                       }
                   </div>
                   <div class="mt-4 pt-4 border-t border-gray-200">
                       <div class="flex justify-between text-sm">
                           <span class="text-gray-500">Crecimiento mensual:</span>
                           <span class="${
                             subcategory.crecimiento > 0
                               ? "text-green-600"
                               : "text-red-600"
                           } font-medium">
                               ${
                                 subcategory.crecimiento > 0 ? "+" : ""
                               }${formatPercentage(subcategory.crecimiento)}
                           </span>
                       </div>
                       <div class="flex justify-between text-sm mt-1">
                           <span class="text-gray-500">Estado:</span>
                           <span class="status-badge ${
                             subcategory.estado === "activo"
                               ? "status-active"
                               : "status-inactive"
                           }">
                               <i class="fas fa-circle"></i>${
                                 subcategory.estado === "activo"
                                   ? "Activo"
                                   : "Inactivo"
                               }
                           </span>
                       </div>
                   </div>
               </div>
           `;
      lowPerformingContainer.appendChild(card);
    });
  }
}

// Función para inicializar el gráfico de subcategorías
function initializeSubcategoryChart(subcategories) {
  const subcategoryCtx = document
    .getElementById("subcategoryChart")
    .getContext("2d");
  subcategoryChart = new Chart(subcategoryCtx, {
    type: "doughnut",
    data: {
      labels: subcategories.map((s) => s.nombre),
      datasets: [
        {
          data: subcategories.map((s) => s.ventas),
          backgroundColor: [
            "rgba(59, 130, 246, 0.8)",
            "rgba(16, 185, 129, 0.8)",
            "rgba(139, 92, 246, 0.8)",
            "rgba(245, 158, 11, 0.8)",
            "rgba(244, 63, 94, 0.8)",
            "rgba(107, 114, 128, 0.8)",
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return context.label + ": $" + context.raw.toLocaleString();
            },
          },
        },
      },
    },
  });
}

// Función para actualizar vista de productos más vendidos
function updateTopProductsView() {
  const tableView = document.getElementById("table-view");
  const gridView = document.getElementById("grid-view");
  const tableBtn = document.getElementById("view-table");
  const gridBtn = document.getElementById("view-grid");

  if (tableBtn.classList.contains("active")) {
    // Vista de tabla
    tableView.style.display = "block";
    gridView.style.display = "none";
    renderTopProductsTable(filteredTopProducts);
  } else {
    // Vista de cuadrícula
    tableView.style.display = "none";
    gridView.style.display = "grid";
    renderTopProductsGrid(filteredTopProducts);
  }
}

// Función para renderizar la tabla de productos más vendidos
function renderTopProductsTable(products) {
  const tableBody = document.getElementById("top-products-table");

  if (!products || products.length === 0) {
    showEmptyTable(
      tableBody,
      "No hay productos vendidos",
      "No se encontraron productos con los filtros aplicados."
    );
    return;
  }

  tableBody.innerHTML = "";

  products.forEach((product) => {
    const row = document.createElement("tr");
    row.innerHTML = `
           <td class="px-6 py-4 whitespace-nowrap">
               <div class="flex items-center">
                   <div class="flex-shrink-0 h-12 w-12 rounded-lg overflow-hidden shadow-sm border border-gray-200">
                       <img class="h-12 w-12 object-cover" src="${
                         product.imagen_url || "https://via.placeholder.com/40"
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
                 product.categoria_principal_nombre || ""
               }</div>
               <div class="text-sm text-gray-500">${
                 product.subcategoria_nombre || ""
               } / ${product.seudocategoria_nombre || ""}</div>
           </td>
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatCurrency(
             product.precio
           )}</td>
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${
             product.unidades_vendidas
           }</td>
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatCurrency(
             product.ingresos
           )}</td>
           <td class="px-6 py-4 whitespace-nowrap">
               <span class="trend-indicator ${
                 product.tendencia > 0 ? "trend-up" : "trend-down"
               }">
                   <i class="fas fa-arrow-${
                     product.tendencia > 0 ? "up" : "down"
                   } mr-1"></i> ${formatPercentage(Math.abs(product.tendencia))}
               </span>
           </td>
           <td class="px-6 py-4 whitespace-nowrap">
               <span class="status-badge ${
                 product.estado === "activo"
                   ? "status-active"
                   : "status-inactive"
               }">
                   <i class="fas fa-circle"></i>${
                     product.estado === "activo" ? "Activo" : "Inactivo"
                   }
               </span>
           </td>
           <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
               <a href="/admin/producto/${
                 product.slug
               }" class="text-blue-600 hover:text-blue-900">Ver</a>
           </td>
       `;
    tableBody.appendChild(row);
  });
}

// Función para renderizar la cuadrícula de productos más vendidos
function renderTopProductsGrid(products) {
  const gridContainer = document.getElementById("grid-view");

  if (!products || products.length === 0) {
    showEmptyCard(
      gridContainer,
      "No hay productos vendidos",
      "No se encontraron productos con los filtros aplicados."
    );
    return;
  }

  gridContainer.innerHTML = "";

  products.forEach((product) => {
    const card = document.createElement("div");
    card.className = `product-grid-card ${
      product.estado === "inactivo" ? "opacity-70" : ""
    }`;
    card.innerHTML = `
           <img src="${
             product.imagen_url || "https://via.placeholder.com/300x200"
           }" alt="${product.nombre}" class="product-grid-img">
           <div class="product-grid-content">
               <div class="product-grid-header">
                   <h4 class="product-grid-title">${product.nombre}</h4>
                   ${
                     product.estado === "inactivo"
                       ? '<span class="status-badge status-inactive"><i class="fas fa-circle"></i>Inactivo</span>'
                       : ""
                   }
               </div>
               <p class="product-grid-brand">${product.marca || "N/A"}</p>
               <div class="product-grid-price">${formatCurrency(
                 product.precio
               )}</div>
               <div class="product-grid-stats">
                   <div class="product-grid-stat">
                       <div class="product-grid-stat-value">${
                         product.unidades_vendidas
                       }</div>
                       <div class="product-grid-stat-label">Unidades</div>
                   </div>
                   <div class="product-grid-stat">
                       <div class="product-grid-stat-value">${formatCurrency(
                         product.ingresos
                       )}</div>
                       <div class="product-grid-stat-label">Ingresos</div>
                   </div>
                   <div class="product-grid-stat">
                       <div class="product-grid-stat-value ${
                         product.tendencia > 0
                           ? "text-green-600"
                           : "text-red-600"
                       }">
                           ${
                             product.tendencia > 0 ? "+" : ""
                           }${formatPercentage(product.tendencia)}
                       </div>
                       <div class="product-grid-stat-label">Tendencia</div>
                   </div>
               </div>
               <div class="product-grid-footer">
                   <div>
                       <div class="text-xs font-medium text-gray-800">${
                         product.categoria_principal_nombre || ""
                       }</div>
                       <div class="text-xs text-gray-500">${
                         product.subcategoria_nombre || ""
                       } / ${product.seudocategoria_nombre || ""}</div>
                   </div>
                   <a href="/admin/producto/${
                     product.slug
                   }" class="text-blue-600 hover:text-blue-800 text-sm font-medium">Ver detalles</a>
               </div>
           </div>
       `;
    gridContainer.appendChild(card);
  });
}

// Función para aplicar filtros a productos más vendidos
async function applyTopProductsFilters(page = 1) {
  topProductsCurrentPage = page;
  const loader = document.getElementById("top-products-loader");
  if (loader) loader.classList.remove("hidden");

  const period = document.getElementById("period-filter").value;
  const sortBy = document.getElementById("sort-filter").value;
  const minPrice = document.getElementById("min-price").value;
  const maxPrice = document.getElementById("max-price").value;
  const categoryFilter = document.getElementById("category-filter").value;
  const statusFilter = document.getElementById("status-filter").value;
  const search = document.getElementById("product-search").value;

  try {
    // Construir URL con parámetros de consulta
    const params = new URLSearchParams();
    params.append("period", period);
    params.append("sort_by", sortBy);
    if (minPrice) params.append("min_price", minPrice);
    if (maxPrice) params.append("max_price", maxPrice);
    if (categoryFilter) params.append("category_filter", categoryFilter);
    if (statusFilter) params.append("status_filter", statusFilter);
    if (search) params.append("search", search);
    // Usar paginación en lugar de límite fijo
    params.append("page", topProductsCurrentPage);
    params.append("per_page", topProductsPerPage);

    const response = await fetch(
      `/admin/categorias-principales/${categoriaId}/top-products-filtered?${params.toString()}`
    );
    const data = await response.json();

    if (data.success) {
      // Actualizar productos filtrados
      filteredTopProducts = data.products;
      updateTopProductsView();
      // Renderizar la paginación
      renderTopProductsPagination(data.pagination);
    } else {
      console.error("Error al cargar productos filtrados:", data.message);
      showErrorMessage(
        "Error al cargar los productos filtrados: " + data.message
      );
    }
  } catch (error) {
    console.error("Error en la solicitud:", error);
    showErrorMessage(
      "Error de conexión al cargar productos filtrados. Por favor, intente nuevamente más tarde."
    );
  } finally {
    if (loader) loader.classList.add("hidden");
  }
}

// Función para aplicar filtros con debounce
function applyTopProductsFiltersWithDebounce() {
  // Limpiar el timeout anterior si existe
  clearTimeout(topProductsFilterTimeout);

  // Establecer un nuevo timeout
  topProductsFilterTimeout = setTimeout(() => {
    applyTopProductsFilters(1); // Resetear a la página 1
  }, 500); // 500ms de retraso
}

// Función para restablecer filtros
function resetTopProductsFilters() {
  document.getElementById("product-search").value = "";
  document.getElementById("min-price").value = "";
  document.getElementById("max-price").value = "";
  document.getElementById("sort-filter").value = "ventas";
  document.getElementById("period-filter").value = "30";
  document.getElementById("category-filter").value = "";
  document.getElementById("status-filter").value = "";

  // Llamar a la función de filtrado para recargar desde el servidor
  applyTopProductsFilters(1);
}

// NUEVA FUNCIÓN: Renderizar la paginación
function renderTopProductsPagination(pagination) {
  const paginationContainer = document.getElementById(
    "top-products-pagination"
  );
  if (!paginationContainer || !pagination || pagination.pages <= 1) {
    if (paginationContainer) paginationContainer.innerHTML = "";
    return;
  }

  let paginationHTML =
    '<nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">';

  // Botón Anterior
  paginationHTML += `
       <button onclick="applyTopProductsFilters(${pagination.prev_num})" 
               class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${
                 !pagination.has_prev ? "cursor-not-allowed opacity-50" : ""
               }" 
               ${!pagination.has_prev ? "disabled" : ""}>
           <span class="sr-only">Anterior</span>
           <i class="fas fa-chevron-left h-5 w-5"></i>
       </button>
   `;

  // Números de página
  const maxVisiblePages = 5;
  let startPage = Math.max(
    1,
    pagination.page - Math.floor(maxVisiblePages / 2)
  );
  let endPage = Math.min(pagination.pages, startPage + maxVisiblePages - 1);
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    paginationHTML += `<button onclick="applyTopProductsFilters(1)" class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">1</button>`;
    if (startPage > 2) {
      paginationHTML += `<span class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const isActive = i === pagination.page;
    paginationHTML += `
           <button onclick="applyTopProductsFilters(${i})" 
                   class="relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                     isActive
                       ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                       : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                   }"
                   ${isActive ? "disabled" : ""}>
               ${i}
           </button>
       `;
  }

  if (endPage < pagination.pages) {
    if (endPage < pagination.pages - 1) {
      paginationHTML += `<span class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>`;
    }
    paginationHTML += `<button onclick="applyTopProductsFilters(${pagination.pages})" class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">${pagination.pages}</button>`;
  }

  // Botón Siguiente
  paginationHTML += `
       <button onclick="applyTopProductsFilters(${pagination.next_num})" 
               class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${
                 !pagination.has_next ? "cursor-not-allowed opacity-50" : ""
               }" 
               ${!pagination.has_next ? "disabled" : ""}>
           <span class="sr-only">Siguiente</span>
           <i class="fas fa-chevron-right h-5 w-5"></i>
       </button>
   `;

  paginationHTML += "</nav>";
  paginationContainer.innerHTML = paginationHTML;
}

// =============== NUEVAS FUNCIONES PARA PRODUCTOS RELACIONADOS ===============

// Función para obtener productos relacionados con filtros avanzados
async function fetchRelatedProductsAdvanced() {
  const loader = document.getElementById("related-products-loader");
  if (loader) loader.classList.remove("hidden");

  try {
    // Obtener parámetros de filtrado
    const search = document.getElementById("related-product-search").value;
    const sortBy = document.getElementById("related-sort-by").value;
    const order = document.getElementById("related-order").value;
    const estado = document.getElementById("related-status").value;
    // Nuevos filtros de categoría
    const subcategoriaId = document.getElementById(
      "related-subcategory-filter"
    ).value;
    const seudocategoriaId = document.getElementById(
      "related-pseudocategory-filter"
    ).value;

    // Construir URL con parámetros de consulta
    const params = new URLSearchParams();
    params.append("page", relatedProductsCurrentPage);
    params.append("per_page", relatedProductsPerPage);
    if (search) params.append("search", search);
    if (sortBy) params.append("sort_by", sortBy);
    if (order) params.append("order", order);
    if (estado) params.append("estado", estado);
    if (subcategoriaId) params.append("subcategoria_id", subcategoriaId);
    if (seudocategoriaId) params.append("seudocategoria_id", seudocategoriaId);

    const response = await fetch(
      `/admin/categorias-principales/${categoriaId}/productos-relacionados-advanced?${params.toString()}`
    );
    const data = await response.json();

    if (data.success) {
      // Almacenar los productos obtenidos para reutilizarlos al cambiar de vista
      currentRelatedProducts = data.products;
      // Actualizar vista de productos relacionados
      updateRelatedProductsView(data.products);
      updateRelatedPaginationInfo(data);
      renderRelatedPagination(data);
    } else {
      console.error("Error al cargar productos relacionados:", data.message);
      showErrorMessage(
        "Error al cargar los productos relacionados: " + data.message
      );
    }
  } catch (error) {
    console.error("Error en la solicitud:", error);
    showErrorMessage(
      "Error de conexión al cargar productos relacionados. Por favor, intente nuevamente más tarde."
    );
  } finally {
    if (loader) loader.classList.add("hidden");
  }
}

// Función para actualizar vista de productos relacionados
function updateRelatedProductsView(products) {
  const tableView = document.getElementById("related-table-view");
  const gridView = document.getElementById("related-grid-view");
  const tableBtn = document.getElementById("related-view-table");
  const gridBtn = document.getElementById("related-view-grid");

  if (tableBtn.classList.contains("active")) {
    // Vista de tabla
    tableView.style.display = "block";
    gridView.style.display = "none";
    renderRelatedProductsTable(products);
  } else {
    // Vista de cuadrícula
    tableView.style.display = "none";
    gridView.style.display = "grid";
    renderRelatedProductsGrid(products);
  }
}

// Función para renderizar la tabla de productos relacionados
function renderRelatedProductsTable(products) {
  const tableBody = document.getElementById("related-products-table-body");

  if (!products || products.length === 0) {
    showEmptyTable(
      tableBody,
      "No hay productos disponibles",
      "No se encontraron productos con los filtros aplicados.",
      7
    );
    return;
  }

  tableBody.innerHTML = "";

  products.forEach((product) => {
    const row = document.createElement("tr");
    row.innerHTML = `
           <td class="px-6 py-4 whitespace-nowrap">
               <div class="flex items-center">
                   <div class="flex-shrink-0 h-12 w-12 rounded-lg overflow-hidden shadow-sm border border-gray-200">
                       <img class="h-12 w-12 object-cover" src="${
                         product.imagen_url || "https://via.placeholder.com/40"
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
                 product.categoria_principal_nombre || ""
               }</div>
               <div class="text-sm text-gray-500">${
                 product.subcategoria_nombre || ""
               } / ${product.seudocategoria_nombre || ""}</div>
           </td>
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatCurrency(
             product.precio
           )}</td>
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
               <span class="text-xs ${
                 product.agotado
                   ? "bg-red-100 text-red-800"
                   : "bg-green-100 text-green-800"
               } px-2 py-1 rounded">
                   ${product.existencia}
               </span>
           </td>
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
               <div class="flex items-center">
                   ${renderStars(product.calificacion_promedio)}
                   <span class="ml-1 text-sm text-gray-600">${
                     product.calificacion_promedio
                       ? product.calificacion_promedio.toFixed(1)
                       : "N/A"
                   }</span>
               </div>
           </td>
           <td class="px-6 py-4 whitespace-nowrap">
               <span class="status-badge ${
                 product.estado === "activo"
                   ? "status-active"
                   : "status-inactive"
               }">
                   <i class="fas fa-circle"></i>${
                     product.estado === "activo" ? "Activo" : "Inactivo"
                   }
               </span>
           </td>
           <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
               <a href="/admin/producto/${
                 product.slug
               }" class="text-blue-600 hover:text-blue-900">Ver</a>
           </td>
       `;
    tableBody.appendChild(row);
  });
}

// Función para renderizar la cuadrícula de productos relacionados
function renderRelatedProductsGrid(products) {
  const gridContainer = document.getElementById("related-grid-view");

  if (!products || products.length === 0) {
    showEmptyCard(
      gridContainer,
      "No hay productos disponibles",
      "No se encontraron productos con los filtros aplicados."
    );
    return;
  }

  gridContainer.innerHTML = "";

  products.forEach((product) => {
    const card = document.createElement("div");
    card.className = `related-product-card ${
      product.estado === "inactivo" ? "opacity-70" : ""
    }`;
    card.innerHTML = `
           <div class="related-product-image-container">
               <img src="${
                 product.imagen_url || "https://via.placeholder.com/300x200"
               }" alt="${product.nombre}" class="related-product-image">
               <div class="related-product-badges">
                   ${
                     product.es_nuevo
                       ? '<span class="related-product-badge related-product-badge-new">Nuevo</span>'
                       : ""
                   }
                   ${
                     product.estado === "inactivo"
                       ? '<span class="related-product-badge related-product-badge-inactive">Inactivo</span>'
                       : ""
                   }
               </div>
           </div>
           <div class="related-product-content">
               <div class="related-product-header">
                   <h4 class="related-product-title">${product.nombre}</h4>
                   ${
                     product.estado === "inactivo"
                       ? '<span class="status-badge status-inactive"><i class="fas fa-circle"></i>Inactivo</span>'
                       : ""
                   }
               </div>
               <p class="related-product-brand">${product.marca || "N/A"}</p>
               <div class="related-product-details">
                   <div class="related-product-price">${formatCurrency(
                     product.precio
                   )}</div>
                   <div class="related-product-rating">
                       <div class="related-product-stars">
                           ${renderStars(product.calificacion_promedio)}
                       </div>
                       <span class="related-product-rating-value">${
                         product.calificacion_promedio
                           ? product.calificacion_promedio.toFixed(1)
                           : "N/A"
                       }</span>
                   </div>
               </div>
               <div class="related-product-stats">
                   <div class="related-product-stat">
                       <div class="related-product-stat-value">${
                         product.existencia
                       }</div>
                       <div class="related-product-stat-label">Existencia</div>
                   </div>
                   <div class="related-product-stat">
                       <div class="related-product-stat-value ${
                         product.agotado ? "text-red-600" : "text-green-600"
                       }">
                           ${product.agotado ? "Agotado" : "Disponible"}
                       </div>
                       <div class="related-product-stat-label">Estado</div>
                   </div>
                   <div class="related-product-stat">
                       <div class="related-product-stat-value">
                           ${
                             product.calificacion_promedio
                               ? product.calificacion_promedio.toFixed(1)
                               : "N/A"
                           }
                       </div>
                       <div class="related-product-stat-label">Calificación</div>
                   </div>
               </div>
               <div class="related-product-footer">
                   <div>
                       <div class="text-xs font-medium text-gray-800">${
                         product.categoria_principal_nombre || ""
                       }</div>
                       <div class="text-xs text-gray-500">${
                         product.subcategoria_nombre || ""
                       } / ${product.seudocategoria_nombre || ""}</div>
                   </div>
                   <a href="/admin/producto/${
                     product.slug
                   }" class="related-product-action">Ver detalles</a>
               </div>
           </div>
       `;
    gridContainer.appendChild(card);
  });
}

// Función para actualizar información de paginación de productos relacionados
function updateRelatedPaginationInfo(data) {
  const start = (data.page - 1) * data.per_page + 1;
  const end = Math.min(data.page * data.per_page, data.total);

  document.getElementById(
    "related-products-pagination-info"
  ).innerHTML = `Mostrando <span class="font-medium">${start}-${end}</span> de <span class="font-medium">${data.total}</span> productos`;
}

// Función para renderizar la paginación de productos relacionados
function renderRelatedPagination(data) {
  const paginationContainer = document.getElementById(
    "related-products-pagination-controls"
  );
  if (!paginationContainer || !data || data.pages <= 1) {
    if (paginationContainer) paginationContainer.innerHTML = "";
    return;
  }

  let paginationHTML = "";

  // Botón Anterior
  paginationHTML += `
       <button onclick="changeRelatedProductsPage(${data.page - 1})" 
               class="related-products-pagination-btn ${
                 data.page <= 1 ? "disabled" : ""
               }" 
               ${data.page <= 1 ? "disabled" : ""}>
           <i class="fas fa-chevron-left mr-1"></i> Anterior
       </button>
   `;

  // Números de página
  const maxVisiblePages = 5;
  let startPage = Math.max(1, data.page - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(data.pages, startPage + maxVisiblePages - 1);
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    paginationHTML += `<button onclick="changeRelatedProductsPage(1)" class="related-products-pagination-btn">1</button>`;
    if (startPage > 2) {
      paginationHTML += `<span class="related-products-pagination-ellipsis">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const isActive = i === data.page;
    paginationHTML += `
           <button onclick="changeRelatedProductsPage(${i})" 
                   class="related-products-pagination-btn ${
                     isActive ? "active" : ""
                   }"
                   ${isActive ? "disabled" : ""}>
               ${i}
           </button>
       `;
  }

  if (endPage < data.pages) {
    if (endPage < data.pages - 1) {
      paginationHTML += `<span class="related-products-pagination-ellipsis">...</span>`;
    }
    paginationHTML += `<button onclick="changeRelatedProductsPage(${data.pages})" class="related-products-pagination-btn">${data.pages}</button>`;
  }

  // Botón Siguiente
  paginationHTML += `
       <button onclick="changeRelatedProductsPage(${data.page + 1})" 
               class="related-products-pagination-btn ${
                 data.page >= data.pages ? "disabled" : ""
               }" 
               ${data.page >= data.pages ? "disabled" : ""}>
           Siguiente <i class="fas fa-chevron-right ml-1"></i>
       </button>
   `;

  paginationContainer.innerHTML = paginationHTML;
}

// Función para cambiar la página de productos relacionados
function changeRelatedProductsPage(page) {
  relatedProductsCurrentPage = page;
  fetchRelatedProductsAdvanced();
}

// Función para aplicar filtros con debounce
function applyRelatedProductsFiltersWithDebounce() {
  // Limpiar el timeout anterior si existe
  clearTimeout(relatedProductsFilterTimeout);

  // Establecer un nuevo timeout
  relatedProductsFilterTimeout = setTimeout(() => {
    relatedProductsCurrentPage = 1; // Resetear a la página 1
    fetchRelatedProductsAdvanced();
  }, 500); // 500ms de retraso
}

// Función para restablecer filtros de productos relacionados
function resetRelatedProductsFilters() {
  document.getElementById("related-product-search").value = "";
  document.getElementById("related-sort-by").value = "nombre"; // Valor por defecto
  document.getElementById("related-order").value = "asc"; // Valor por defecto
  document.getElementById("related-status").value = ""; // "Todos"

  // MEJORA: Restablecer los filtros de categoría que faltaban
  const subcategoryFilter = document.getElementById(
    "related-subcategory-filter"
  );
  if (subcategoryFilter) subcategoryFilter.value = ""; // "Todas"

  const pseudocategoryFilter = document.getElementById(
    "related-pseudocategory-filter"
  );
  if (pseudocategoryFilter) {
    pseudocategoryFilter.value = ""; // "Todas"
    pseudocategoryFilter.disabled = true; // Deshabilitar ya que no hay subcategoría seleccionada
  }

  // Restablecer la paginación y recargar los productos con los filtros limpios
  relatedProductsCurrentPage = 1;
  fetchRelatedProductsAdvanced();
}

// Función para renderizar estrellas de calificación
function renderStars(rating) {
  if (!rating) return '<i class="far fa-star"></i>'.repeat(5);

  let stars = "";
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  for (let i = 0; i < fullStars; i++) {
    stars += '<i class="fas fa-star"></i>';
  }

  if (hasHalfStar) {
    stars += '<i class="fas fa-star-half-alt"></i>';
  }

  const emptyStars = 5 - Math.ceil(rating);
  for (let i = 0; i < emptyStars; i++) {
    stars += '<i class="far fa-star"></i>';
  }

  return stars;
}

// Función para poblar los filtros de categoría de productos relacionados
async function populateRelatedCategoryFilters() {
  try {
    const response = await fetch(
      `/admin/categorias-principales/${categoriaId}/subcategorias-filtro`
    );
    const data = await response.json();
    if (data.success) {
      relatedSubcategories = data.subcategorias;
      const subcategoryFilter = document.getElementById(
        "related-subcategory-filter"
      );
      subcategoryFilter.innerHTML = '<option value="">Todas</option>'; // Reset
      relatedSubcategories.forEach((sub) => {
        const option = document.createElement("option");
        option.value = sub.id;
        option.textContent = sub.nombre;
        subcategoryFilter.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error al cargar filtros de subcategoría:", error);
  }
}

// Función para poblar el filtro de seudocategoría
async function populateRelatedPseudocategoryFilter(subcategoryId) {
  const pseudocategoryFilter = document.getElementById(
    "related-pseudocategory-filter"
  );
  pseudocategoryFilter.innerHTML = '<option value="">Todas</option>'; // Reset

  if (!subcategoryId) {
    pseudocategoryFilter.disabled = true;
    return;
  }

  pseudocategoryFilter.disabled = false;
  try {
    const response = await fetch(
      `/admin/subcategorias/${subcategoryId}/seudocategorias-filtro`
    );
    const data = await response.json();
    if (data.success) {
      relatedPseudocategories = data.seudocategorias;
      relatedPseudocategories.forEach((pseudo) => {
        const option = document.createElement("option");
        option.value = pseudo.id;
        option.textContent = pseudo.nombre;
        pseudocategoryFilter.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error al cargar filtros de seudocategoría:", error);
    pseudocategoryFilter.disabled = true;
  }
}

// Inicialización
document.addEventListener("DOMContentLoaded", function () {
  // Inicializar gráficos
  const salesCtx = document.getElementById("salesChart").getContext("2d");
  salesChart = new Chart(salesCtx, {
    type: "line",
    data: {
      labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun"],
      datasets: [
        {
          label: "Ventas ($)",
          data: [0, 0, 0, 0, 0, 0],
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 2,
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: function (value) {
              return "$" + value.toLocaleString();
            },
          },
        },
      },
    },
  });

  const categoryComparisonCtx = document
    .getElementById("categoryComparisonChart")
    .getContext("2d");
  categoryComparisonChart = new Chart(categoryComparisonCtx, {
    type: "bar",
    data: {
      labels: ["Electrónica", "Hogar", "Ropa", "Deportes", "Juguetes"],
      datasets: [
        {
          label: "Ventas Actuales ($)",
          data: [0, 0, 0, 0, 0],
          backgroundColor: [
            "rgba(59, 130, 246, 0.8)",
            "rgba(16, 185, 129, 0.8)",
            "rgba(245, 158, 11, 0.8)",
            "rgba(139, 92, 246, 0.8)",
            "rgba(236, 72, 153, 0.8)",
          ],
          borderWidth: 0,
        },
        {
          label: "Ventas Anteriores ($)",
          data: [0, 0, 0, 0, 0],
          backgroundColor: [
            "rgba(59, 130, 246, 0.4)",
            "rgba(16, 185, 129, 0.4)",
            "rgba(245, 158, 11, 0.4)",
            "rgba(139, 92, 246, 0.4)",
            "rgba(236, 72, 153, 0.4)",
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return (
                context.dataset.label + ": $" + context.raw.toLocaleString()
              );
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return "$" + value.toLocaleString();
            },
          },
        },
      },
    },
  });

  const subcategoryCtx = document
    .getElementById("subcategoryChart")
    .getContext("2d");
  subcategoryChart = new Chart(subcategoryCtx, {
    type: "doughnut",
    data: {
      labels: [],
      datasets: [
        {
          data: [],
          backgroundColor: [
            "rgba(59, 130, 246, 0.8)",
            "rgba(16, 185, 129, 0.8)",
            "rgba(139, 92, 246, 0.8)",
            "rgba(245, 158, 11, 0.8)",
            "rgba(244, 63, 94, 0.8)",
            "rgba(107, 114, 128, 0.8)",
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return context.label + ": $" + context.raw.toLocaleString();
            },
          },
        },
      },
    },
  });

  // Cargar datos iniciales
  fetchCategoryData();

  // Event listeners para filtros de productos más vendidos - Aplicación automática
  document
    .getElementById("period-filter")
    .addEventListener("change", applyTopProductsFiltersWithDebounce);
  document
    .getElementById("sort-filter")
    .addEventListener("change", applyTopProductsFiltersWithDebounce);
  document
    .getElementById("min-price")
    .addEventListener("input", applyTopProductsFiltersWithDebounce);
  document
    .getElementById("max-price")
    .addEventListener("input", applyTopProductsFiltersWithDebounce);
  document
    .getElementById("category-filter")
    .addEventListener("change", applyTopProductsFiltersWithDebounce);
  document
    .getElementById("status-filter")
    .addEventListener("change", applyTopProductsFiltersWithDebounce);
  document
    .getElementById("product-search")
    .addEventListener("input", applyTopProductsFiltersWithDebounce);

  // Event listeners para botones de filtros
  document
    .getElementById("reset-filters")
    .addEventListener("click", resetTopProductsFilters);

  // Event listeners para vista de productos más vendidos
  document.getElementById("view-table").addEventListener("click", function () {
    document.getElementById("view-table").classList.add("active");
    document.getElementById("view-grid").classList.remove("active");
    updateTopProductsView();
  });

  document.getElementById("view-grid").addEventListener("click", function () {
    document.getElementById("view-grid").classList.add("active");
    document.getElementById("view-table").classList.remove("active");
    updateTopProductsView();
  });

  // ============= EVENT LISTENERS PARA PRODUCTOS RELACIONADOS =============

  // Event listeners para productos relacionados
  document
    .getElementById("related-view-table")
    .addEventListener("click", function () {
      document.getElementById("related-view-table").classList.add("active");
      document.getElementById("related-view-grid").classList.remove("active");
      updateRelatedProductsView(currentRelatedProducts);
    });

  document
    .getElementById("related-view-grid")
    .addEventListener("click", function () {
      document.getElementById("related-view-grid").classList.add("active");
      document.getElementById("related-view-table").classList.remove("active");
      updateRelatedProductsView(currentRelatedProducts);
    });

  document
    .getElementById("related-products-per-page")
    .addEventListener("change", function () {
      relatedProductsPerPage = parseInt(this.value);
      relatedProductsCurrentPage = 1;
      fetchRelatedProductsAdvanced();
    });

  document
    .getElementById("related-product-search")
    .addEventListener("input", applyRelatedProductsFiltersWithDebounce);
  document
    .getElementById("related-sort-by")
    .addEventListener("change", applyRelatedProductsFiltersWithDebounce);
  document
    .getElementById("related-order")
    .addEventListener("change", applyRelatedProductsFiltersWithDebounce);
  document
    .getElementById("related-status")
    .addEventListener("change", applyRelatedProductsFiltersWithDebounce);

  // Cargar filtros de categoría para productos relacionados
  populateRelatedCategoryFilters();

  // Event listeners para filtros de categoría de productos relacionados
  document
    .getElementById("related-subcategory-filter")
    .addEventListener("change", function () {
      const subcategoryId = this.value;
      populateRelatedPseudocategoryFilter(subcategoryId);
      // Se llama a applyRelatedProductsFiltersWithDebounce para que el filtro de seudocategoría se aplique
      applyRelatedProductsFiltersWithDebounce();
    });

  document
    .getElementById("related-pseudocategory-filter")
    .addEventListener("change", applyRelatedProductsFiltersWithDebounce);

  document
    .getElementById("reset-related-filters")
    .addEventListener("click", resetRelatedProductsFilters);

  // Tab functionality
  document.querySelectorAll(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const tabId = button.getAttribute("data-tab");

      // Deactivate all tabs and contents

      document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.classList.remove("border-blue-500", "text-blue-600");
        btn.classList.add("border-transparent", "text-gray-500");
      });
      document.querySelectorAll(".tab-content").forEach((content) => {
        content.classList.remove("active");
      });

      // Activate selected tab and content
      button.classList.remove("border-transparent", "text-gray-500");
      button.classList.add("border-blue-500", "text-blue-600");
      document.getElementById(tabId).classList.add("active");
    });
  });
});
