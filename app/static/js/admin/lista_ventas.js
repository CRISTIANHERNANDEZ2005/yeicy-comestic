// MEJORA PROFESIONAL: Patrón de Módulo para la página de Ventas.
// Esto encapsula toda la lógica, evita colisiones de nombres en el ámbito global
// y permite una reinicialización segura en un entorno SPA.

const VentasPageModule = (() => {
  // Estado del módulo
  let ventasChart = null;
  let isInitialized = false;
  let currentFilterParams = new URLSearchParams(window.location.search);
  let eventListenersAttached = false;
  let debounceTimer;
  let currentPage = 1;
  let currentPerPage = 20;
  let currentChartPeriod = '30d'; // Nuevo estado para el período del gráfico

  /**
   * Función principal de inicialización/re-inicialización.
   */
  function init() {
    // Guardia de contexto: si no estamos en la página de ventas, no hacer nada.
    // Y si ya está inicializado, tampoco.
    if (!document.getElementById("ventas-chart")) {
      console.log("Not on the Ventas page. Skipping initialization.");
      return;
    }
    if (isInitialized) {
        console.log("Ventas page already initialized. Skipping.");
        return;
    }
    console.log("Initializing Ventas Page...");

    setupEventListeners();
    loadInitialData();

    // Inicializar el módulo para crear pedidos/ventas si existe
    if (typeof crearPedidoApp !== 'undefined') {
      crearPedidoApp.init();
      // Sobrescribir la URL de envío para que apunte a la creación de ventas
      crearPedidoApp.submitUrl = '/admin/api/ventas';
      crearPedidoApp.isVentaMode = true; // Flag para indicar que estamos creando una venta
    }

    isInitialized = true;
  }

  /**
   * Función pública para recargar los datos de la página.
   * Esto es más limpio que llamar a init() de nuevo.
   */
  function reloadData() {
    console.log("Reloading Ventas data...");
    loadVentas(1, currentPerPage, true); // Volver a la página 1 y mostrar loader
    loadEstadisticas();
  }
  /**
   * Función de limpieza para cuando el usuario navega fuera de la página.
   * Esencial para el correcto funcionamiento de la SPA.
   */
  function destroy() {
    if (!isInitialized) {
      return;
    }
    console.log("Destroying Ventas Page module...");
    removeEventListeners();
    if (ventasChart) {
      ventasChart.destroy();
      ventasChart = null;
    }
    clearTimeout(debounceTimer);
    isInitialized = false;
  }

  // Función para formatear moneda
  function formatCurrency(value) {
    if (!value) return "$ 0";
    return (
      "$ " +
      parseFloat(value).toLocaleString("es-CO", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
    );
  }

  // Función para formatear fecha
  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  // Función para mostrar/ocultar el overlay de carga
  function toggleLoadingOverlay(show) {
    const loadingOverlay = document.getElementById("loading-overlay");
    if (!loadingOverlay) return;

    if (show) {
      loadingOverlay.classList.remove("hidden");
    } else {
      loadingOverlay.classList.add("hidden");
    }
  }

  // Función para cargar estadísticas
  async function loadEstadisticas() {
    const chartLoader = document.getElementById('chart-loading-overlay');
    if (chartLoader) chartLoader.classList.replace('hidden', 'flex');

    // Añadir el período del gráfico a los parámetros
    const statsParams = new URLSearchParams(currentFilterParams);
    statsParams.set('periodo', currentChartPeriod);

    try {
      const response = await fetch(`/admin/api/ventas/estadisticas?${statsParams.toString()}`);
      const data = await response.json();

      if (data.success) {
        // MEJORA PROFESIONAL: Actualización estática para una respuesta instantánea.
        document.getElementById("total-ventas").textContent = data.estadisticas.total_ventas.toLocaleString('es-CO');
        document.getElementById("total-ingresos").textContent = formatCurrency(data.estadisticas.total_ingresos);
        document.getElementById("ticket-promedio").textContent = formatCurrency(data.estadisticas.ticket_promedio);
        document.getElementById("total-inversion").textContent = formatCurrency(data.estadisticas.total_inversion);
        document.getElementById("total-utilidad").textContent = formatCurrency(data.estadisticas.total_utilidad);
        
        // Para el margen, que es un porcentaje
        const margenElement = document.getElementById("margen-utilidad");
        if (margenElement) {
            const endValue = data.estadisticas.margen_utilidad;
            margenElement.textContent = `${endValue.toFixed(1)}%`;
        }

        // Actualizar gráfico
        updateVentasChart(data.estadisticas.grafico, currentChartPeriod);
      } else {
        window.toast.error("Error al cargar estadísticas");
      }
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
      window.toast.error("Error al cargar estadísticas");
    } finally {
      if (chartLoader) chartLoader.classList.replace('flex', 'hidden');
    }
  }

  // Función para inicializar o actualizar el gráfico de ventas
  function updateVentasChart(graficoData, period) {
    const canvas = document.getElementById("ventas-chart");
    const chartTitle = document.getElementById("chart-title");

    if (chartTitle) {
        let titleText = 'Evolución de Ventas';
        if (period === '7d') titleText += ' (Últimos 7 días)';
        else if (period === '30d') titleText += ' (Últimos 30 días)';
        else if (period === '1y') titleText += ' (Último Año)';
        chartTitle.textContent = titleText;
    }


    if (!canvas) return;

    // Destruir la instancia ANTERIOR del gráfico si existe.
    // Esto es crucial para evitar errores de Chart.js en una SPA.
    if (ventasChart) {
      ventasChart.destroy();
      ventasChart = null;
    }

    const ctx = canvas.getContext("2d");
    ventasChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: graficoData.fechas,
        datasets: [
          {
            label: "Ventas",
            data: graficoData.cantidades,
            borderColor: "rgb(59, 130, 246)",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            tension: 0.3,
            fill: true,
            yAxisID: "y",
          },
          {
            label: "Ingresos ($)",
            data: graficoData.totales,
            borderColor: "rgb(16, 185, 129)",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            tension: 0.3,
            fill: true,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            position: "top",
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                let label = context.dataset.label || "";
                if (label) {
                  label += ": ";
                }
                if (context.parsed.y !== null) {
                  if (context.datasetIndex === 0) {
                    label += context.parsed.y + " ventas";
                  } else {
                    label += formatCurrency(context.parsed.y);
                  }
                }
                return label;
              },
            },
          },
        },
        scales: {
          y: {
            type: "linear",
            display: true,
            position: "left",
            title: {
              display: true,
              text: "Cantidad de Ventas",
            },
          },
          y1: {
            type: "linear",
            display: true,
            position: "right",
            title: {
              display: true,
              text: "Ingresos ($)",
            },
            grid: {
              drawOnChartArea: false,
            },
          },
        },
      },
    });
  }

  // Función para cargar ventas
  async function loadVentas(
    page = 1,
    perPage = currentPerPage,
    showLoading = true
  ) {
    try {
      // Mostrar overlay de carga
      if (showLoading) {
        toggleLoadingOverlay(true);
      }

      // Actualizar parámetros de página y elementos por página
      currentPage = page;
      currentPerPage = perPage;
      currentFilterParams.set("page", page);
      currentFilterParams.set("per_page", perPage);

      const response = await fetch(
        `/admin/api/ventas?${currentFilterParams.toString()}`
      );
      const data = await response.json();

      if (data.success) {
        // Efecto de desvanecimiento
        const tableBody = document.getElementById("ventas-table-body");
        if (tableBody) {
          tableBody.style.opacity = "0.5";

          setTimeout(() => {
            renderVentasTable(data.ventas);
            renderPagination(data.pagination);

            if (data.ventas.length === 0) {
              const noVentasMessage =
                document.getElementById("no-ventas-message");
              if (noVentasMessage) noVentasMessage.classList.remove("hidden");
            } else {
              const noVentasMessage =
                document.getElementById("no-ventas-message");
              if (noVentasMessage) noVentasMessage.classList.add("hidden");
            }

            // Restaurar opacidad
            tableBody.style.opacity = "1";
          }, 300);
        }
      } else {
        window.toast.error("Error al cargar ventas");
      }
    } catch (error) {
      console.error("Error al cargar ventas:", error);
      window.toast.error("Error al cargar ventas");
    } finally {
      // Ocultar overlay de carga
      if (showLoading) {
        setTimeout(() => {
          toggleLoadingOverlay(false);
        }, 500);
      }
    }
  }

  // Función para renderizar la tabla de ventas con diseño mejorado
  function renderVentasTable(ventas) {
    const tableBody = document.getElementById("ventas-table-body");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    ventas.forEach((venta, index) => {
      const row = document.createElement("tr");

      // Añadir animación de aparición escalonada
      row.style.opacity = "0";
      row.style.transform = "translateY(20px)";
      row.style.transition = `opacity 0.3s ease ${
        index * 0.05
      }s, transform 0.3s ease ${index * 0.05}s`;

      row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span class="text-blue-800 font-medium">${
                              venta.usuario_nombre
                                ? venta.usuario_nombre.charAt(0).toUpperCase()
                                : "N"
                            }</span>
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${
                              venta.usuario_nombre || "N/A"
                            }</div>
                            <div class="text-sm text-gray-500">${
                              venta.usuario ? venta.usuario.numero : ""
                            }</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${formatDate(venta.created_at)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${formatCurrency(venta.total)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="status-badge ${
                      venta.estado === "activo" ? "active" : "inactive"
                    }">
                        <i class="fas ${
                          venta.estado === "activo"
                            ? "fa-check-circle"
                            : "fa-times-circle"
                        }"></i>
                        ${venta.estado === "activo" ? "Activo" : "Inactivo"}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div class="actions-container">
                        <button class="action-btn view tooltip" data-id="${
                          venta.id
                        }" data-tooltip="Ver detalles de esta venta">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn toggle ${
                          venta.estado === "activo" ? "active" : "inactive"
                        } tooltip" 
                                data-id="${venta.id}" 
                                data-status="${venta.estado}" 
                                data-tooltip="${
                                  venta.estado === "activo"
                                    ? "Inactivar esta venta"
                                    : "Activar esta venta"
                                }">
                            <i class="fas ${
                              venta.estado === "activo" ? "fa-ban" : "fa-check"
                            }"></i>
                        </button>
                    </div>
                </td>
            `;

      tableBody.appendChild(row);

      // Activar animación después de añadir al DOM
      setTimeout(() => {
        row.style.opacity = "1";
        row.style.transform = "translateY(0)";
      }, 50);
    });

    // Agregar eventos a los botones
    document.querySelectorAll(".action-btn.view").forEach((btn) => {
      btn.addEventListener("click", function () {
        const ventaId = this.getAttribute("data-id");
        showVentaDetail(ventaId);
      });
    });

    document.querySelectorAll(".action-btn.toggle").forEach((btn) => {
      btn.addEventListener("click", function () {
        const ventaId = this.getAttribute("data-id");
        const currentStatus = this.getAttribute("data-status");
        const newStatus = currentStatus === "activo" ? "inactivo" : "activo";
        showConfirmModal(ventaId, newStatus);
      });
    });
  }

  // Función para renderizar la paginación
  function renderPagination(pagination) {
    const container = document.getElementById("pagination-container");
    if (!container) return;

    container.innerHTML = "";

    if (pagination.pages <= 1) return;

    const paginationDiv = document.createElement("div");
    paginationDiv.className = "flex flex-col items-center w-full";

    // Información de paginación - Solo mostrar elementos por página
    const endItem = Math.min(
      pagination.page * pagination.per_page,
      pagination.total
    );

    let paginationHTML = `
            <div class="text-sm text-gray-700 mb-4">
                Mostrando <span class="font-medium">${endItem}</span> de 
                <span class="font-medium">${pagination.total}</span> resultados
            </div>
            
            <div class="flex justify-center w-full">
                <!-- Navegación de página -->
                <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
        `;

    // Botón anterior
    paginationHTML += `
            <button id="prev-page" class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${
              !pagination.has_prev ? "cursor-not-allowed opacity-50" : ""
            }" ${!pagination.has_prev ? "disabled" : ""}>
                <span class="sr-only">Anterior</span>
                <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
            </button>
        `;

    // Determinar el rango de páginas a mostrar
    let startPage = Math.max(1, pagination.page - 2);
    let endPage = Math.min(pagination.pages, startPage + 4);

    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    // Botón de primera página si no está en el rango
    if (startPage > 1) {
      paginationHTML += `
                <button class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50" data-page="1">
                    1
                </button>
            `;

      if (startPage > 2) {
        paginationHTML += `
                    <span class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                        ...
                    </span>
                `;
      }
    }

    // Números de página
    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === pagination.page;
      paginationHTML += `
                <button class="relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                  isActive
                    ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                    : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                }" data-page="${i}">
                    ${i}
                </button>
            `;
    }

    // Botón de última página si no está en el rango
    if (endPage < pagination.pages) {
      if (endPage < pagination.pages - 1) {
        paginationHTML += `
                    <span class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                        ...
                    </span>
                `;
      }

      paginationHTML += `
                <button class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50" data-page="${pagination.pages}">
                    ${pagination.pages}
                </button>
            `;
    }

    // Botón siguiente
    paginationHTML += `
            <button id="next-page" class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 ${
              !pagination.has_next ? "cursor-not-allowed opacity-50" : ""
            }" ${!pagination.has_next ? "disabled" : ""}>
                <span class="sr-only">Siguiente</span>
                <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                </svg>
            </button>
        `;

    paginationHTML += `
                </nav>
            </div>
            
            <!-- Selector de página para móviles -->
            <div class="flex items-center mt-4 sm:hidden">
                <label for="mobile-page-select" class="mr-2 text-sm text-gray-700">Página:</label>
                <select id="mobile-page-select" class="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500">
        `;

    // Opciones para el selector de página móvil
    for (let i = 1; i <= pagination.pages; i++) {
      paginationHTML += `<option value="${i}" ${
        i === pagination.page ? "selected" : ""
      }>${i}</option>`;
    }

    paginationHTML += `
                </select>
                <span class="ml-2 text-sm text-gray-700">de ${pagination.pages}</span>
            </div>
        `;

    paginationDiv.innerHTML = paginationHTML;
    container.appendChild(paginationDiv);

    // Agregar eventos a los botones de paginación
    const prevPageBtn = document.getElementById("prev-page");
    if (prevPageBtn) {
      prevPageBtn.addEventListener("click", () => {
        if (pagination.has_prev) {
          loadVentas(pagination.prev_num, currentPerPage);
        }
      });
    }

    const nextPageBtn = document.getElementById("next-page");
    if (nextPageBtn) {
      nextPageBtn.addEventListener("click", () => {
        if (pagination.has_next) {
          loadVentas(pagination.next_num, currentPerPage);
        }
      });
    }

    // Eventos a los números de página
    document.querySelectorAll("[data-page]").forEach((btn) => {
      btn.addEventListener("click", function () {
        const page = parseInt(this.getAttribute("data-page"));
        loadVentas(page, currentPerPage);
      });
    });

    // Evento para el selector de página móvil
    const mobilePageSelect = document.getElementById("mobile-page-select");
    if (mobilePageSelect) {
      mobilePageSelect.addEventListener("change", function () {
        const page = parseInt(this.value);
        loadVentas(page, currentPerPage);
      });
    }
  }

  // Función para mostrar detalles de venta
  async function showVentaDetail(ventaId) {
    try {
      const response = await fetch(`/admin/api/ventas/${ventaId}`);
      const data = await response.json();

      if (data.success) {
        const venta = data.venta;
        const modal = document.getElementById("venta-detail-modal");
        const content = document.getElementById("venta-detail-content");

        if (!modal || !content) return;

        let productosHTML = "";
        venta.productos.forEach((producto) => {
          productosHTML += `
                        <tr>
                            <td class="px-4 py-3 border-b">${
                              producto.producto_nombre
                            }</td>
                            <td class="px-4 py-3 border-b text-center">${
                              producto.cantidad
                            }</td>
                            <td class="px-4 py-3 border-b text-right">${formatCurrency(
                              producto.precio_unitario
                            )}</td>
                            <td class="px-4 py-3 border-b text-right font-medium">${formatCurrency(
                              producto.subtotal
                            )}</td>
                        </tr>
                    `;
        });

        content.innerHTML = `
                    <!-- Elemento oculto para almacenar el ID de la venta -->
                    <div data-venta-id="${
                      venta.id
                    }" style="display: none;"></div>
                    
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        <!-- Información de la venta -->
                        <div class="lg:col-span-2">
                            <div class="info-card h-full">
                                <div class="info-card-header">
                                    <h3 class="text-lg font-semibold text-gray-800 flex items-center">
                                        <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
                                        </svg>
                                        Información de la Venta
                                    </h3>
                                </div>
                                <div class="info-card-body">
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <p class="text-sm text-gray-500">ID de Venta</p>
                                            <p class="font-medium text-lg">#${venta.id
                                              .toString()
                                              .padStart(6, "0")}</p>
                                        </div>
                                        <div>
                                            <p class="text-sm text-gray-500">Fecha</p>
                                            <p class="font-medium">${formatDate(
                                              venta.created_at
                                            )}</p>
                                        </div>
                                        <div>
                                            <p class="text-sm text-gray-500">Estado</p>
                                            <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                              venta.estado_pedido ===
                                              "completado"
                                                ? "bg-green-100 text-green-800"
                                                : venta.estado_pedido ===
                                                  "pendiente"
                                                ? "bg-yellow-100 text-yellow-800"
                                                : "bg-red-100 text-red-800"
                                            }">
                                                ${venta.estado_pedido}
                                            </span>
                                        </div>
                                        <div>
                                            <p class="text-sm text-gray-500">Método de Pago</p>
                                            <p class="font-medium">${
                                              venta.metodo_pago ||
                                              "Contra Entrega"
                                            }</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Resumen de la venta -->
                        <div>
                            <div class="summary-card h-full">
                                <h3 class="text-lg font-semibold mb-4 flex items-center">
                                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                    Resumen
                                </h3>
                                <div class="summary-item">
                                    <span>Subtotal:</span>
                                    <span>${formatCurrency(venta.total)}</span>
                                </div>
                                <div class="summary-item">
                                    <span>Impuestos:</span>
                                    <span>${formatCurrency(
                                      venta.impuestos
                                    )}</span>
                                </div>
                                <div class="summary-item">
                                    <span>Descuentos:</span>
                                    <span>${formatCurrency(
                                      venta.descuentos
                                    )}</span>
                                </div>
                                <div class="summary-item">
                                    <span>Total:</span>
                                    <span>${formatCurrency(venta.total)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Información del cliente -->
                    <div class="info-card mb-8">
                        <div class="info-card-header">
                            <h3 class="text-lg font-semibold text-gray-800 flex items-center">
                                <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                </svg>
                                Información del Cliente
                            </h3>
                        </div>
                        <div class="info-card-body">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p class="text-sm text-gray-500">Nombre Completo</p>
                                    <p class="font-medium">${
                                      venta.usuario.nombre
                                    } ${venta.usuario.apellido}</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-500">Número de Contacto</p>
                                    <p class="font-medium">${
                                      venta.usuario.numero
                                    }</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Productos -->
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                            <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                            </svg>
                            Productos Comprados
                        </h3>
                        <div class="overflow-x-auto">
                            <table class="product-table w-full">
                                <thead>
                                    <tr>
                                        <th>Producto</th>
                                        <th class="text-center">Cantidad</th>
                                        <th class="text-right">Precio Unitario</th>
                                        <th class="text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${productosHTML}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;

        // Mostrar modal con animación
        modal.classList.remove("hidden");
        setTimeout(() => {
          modal.classList.add("active");
        }, 10);
      } else {
        window.toast.error("Error al cargar detalles de la venta");
      }
    } catch (error) {
      console.error("Error al cargar detalles de la venta:", error);
      window.toast.error("Error al cargar detalles de la venta");
    }
  }

  // Función para cambiar el estado de una venta
  async function toggleVentaStatus(ventaId, newStatus) {
    try {
      const response = await fetch(`/admin/api/ventas/${ventaId}/estado`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content"),
        },
        body: JSON.stringify({ estado: newStatus }),
      });

      const data = await response.json();

      if (data.success) {
        window.toast.success(
          `La venta ha sido marcada como ${newStatus} correctamente`
        );

        // Actualizar la tabla en tiempo real
        updateVentaRowStatus(ventaId, newStatus);

        // Actualizar estadísticas en tiempo real
        loadEstadisticas();
      } else {
        window.toast.error(
          data.message || "Error al cambiar el estado de la venta"
        );
      }
    } catch (error) {
      console.error("Error al cambiar estado de la venta:", error);
      window.toast.error("Error al cambiar el estado de la venta");
    }
  }

  // Función para actualizar el estado de una venta en la tabla
  function updateVentaRowStatus(ventaId, newStatus) {
    // Buscar la fila de la venta en la tabla
    const rows = document.querySelectorAll("#ventas-table-body tr");
    rows.forEach((row) => {
      const toggleBtn = row.querySelector(".action-btn.toggle");
      if (toggleBtn && toggleBtn.getAttribute("data-id") === ventaId) {
        // Actualizar el badge de estado
        const statusBadge = row.querySelector(".status-badge");
        if (statusBadge) {
          statusBadge.className = `status-badge ${
            newStatus === "activo" ? "active" : "inactive"
          }`;
          statusBadge.innerHTML = `
                        <i class="fas ${
                          newStatus === "activo"
                            ? "fa-check-circle"
                            : "fa-times-circle"
                        }"></i>
                        ${newStatus === "activo" ? "Activo" : "Inactivo"}
                    `;
        }

        // Actualizar el botón de toggle
        toggleBtn.className = `action-btn toggle ${
          newStatus === "activo" ? "active" : "inactive"
        } tooltip`;
        toggleBtn.setAttribute("data-status", newStatus);
        toggleBtn.setAttribute(
          "data-tooltip",
          newStatus === "activo" ? "Inactivar esta venta" : "Activar esta venta"
        );
        toggleBtn.innerHTML = `<i class="fas ${
          newStatus === "activo" ? "fa-ban" : "fa-check"
        }"></i>`;

        // Añadir animación de resaltado a la fila
        row.classList.add("row-updated");
        setTimeout(() => {
          row.classList.remove("row-updated");
        }, 2000);
      }
    });
  }

  // Función para contar filtros activos
  function countActiveFilters() {
    let count = 0;
    const venta_id = document.getElementById("venta_id")?.value || "";
    const cliente = document.getElementById("cliente")?.value || "";
    const fecha_inicio = document.getElementById("fecha_inicio")?.value || "";
    const fecha_fin = document.getElementById("fecha_fin")?.value || "";
    const monto_min = document.getElementById("monto_min")?.value || "";
    const monto_max = document.getElementById("monto_max")?.value || "";
    const sort_by = document.getElementById("sort_by")?.value || "created_at";
    const estado = document.getElementById("estado")?.value || "todos";

    if (venta_id) count++;
    if (cliente) count++;
    if (fecha_inicio) count++;
    if (fecha_fin) count++;
    if (monto_min) count++;
    if (monto_max) count++;
    if (estado !== "todos") count++;
    if (sort_by !== "created_at") count++;

    return count;
  }

  // Función para actualizar indicadores de filtros
  function updateFilterIndicators() {
    const activeFiltersCount = countActiveFilters();
    const activeFiltersElement = document.getElementById(
      "active-filters-count"
    );
    const clearFiltersElement = document.getElementById("clear-filters");

    if (activeFiltersCount > 0) {
      if (activeFiltersElement) {
        activeFiltersElement.textContent = `${activeFiltersCount} filtros activos`;
        activeFiltersElement.classList.remove("hidden");
      }
      if (clearFiltersElement) {
        clearFiltersElement.classList.remove("hidden");
      }
    } else {
      if (activeFiltersElement) {
        activeFiltersElement.classList.add("hidden");
      }
      if (clearFiltersElement) {
        clearFiltersElement.classList.add("hidden");
      }
    }
  }

  // Función para aplicar filtros automáticamente
  function applyFilters() {
    // Actualizar parámetros de filtro
    currentFilterParams = new URLSearchParams();
    const venta_id = document.getElementById("venta_id")?.value || "";
    const cliente = document.getElementById("cliente")?.value || "";
    const fecha_inicio = document.getElementById("fecha_inicio")?.value || "";
    const fecha_fin = document.getElementById("fecha_fin")?.value || "";
    const monto_min = document.getElementById("monto_min")?.value || "";
    const monto_max = document.getElementById("monto_max")?.value || "";
    const sort_by = document.getElementById("sort_by")?.value || "created_at";
    const estado = document.getElementById("estado")?.value || "todos";

    if (venta_id) currentFilterParams.set("venta_id", venta_id);
    if (cliente) currentFilterParams.set("cliente", cliente);
    if (fecha_inicio) currentFilterParams.set("fecha_inicio", fecha_inicio);
    if (fecha_fin) currentFilterParams.set("fecha_fin", fecha_fin);
    if (monto_min) currentFilterParams.set("monto_min", monto_min);
    if (monto_max) currentFilterParams.set("monto_max", monto_max);
    if (estado !== "todos") currentFilterParams.set("estado", estado);
    if (sort_by !== "created_at") currentFilterParams.set("sort_by", sort_by);

    // Actualizar indicadores de filtros
    updateFilterIndicators();

    // Recargar ventas y estadísticas
    loadVentas(1, currentPerPage, true);
    loadEstadisticas();
  }

  // Evento para cerrar modal de detalles
  const closeModalBtn = document.getElementById("close-modal");
  const closeModalBtnFooter = document.getElementById("close-modal-btn");
  const modal = document.getElementById("venta-detail-modal");

  if (closeModalBtn && modal) {
    closeModalBtn.addEventListener("click", function () {
      modal.classList.remove("active");
      setTimeout(() => {
        modal.classList.add("hidden");
      }, 300);
    });
  }

  if (closeModalBtnFooter && modal) {
    closeModalBtnFooter.addEventListener("click", function () {
      modal.classList.remove("active");
      setTimeout(() => {
        modal.classList.add("hidden");
      }, 300);
    });
  }

  // Evento para imprimir detalles
  const printBtn = document.getElementById("print-detail");
  if (printBtn) {
    printBtn.addEventListener("click", function () {
      // Obtener el ID de la venta actual del modal
      const modal = document.getElementById("venta-detail-modal");
      if (modal) {
        // Buscar el ID de la venta en el contenido del modal
        const ventaIdElement = modal.querySelector("[data-venta-id]");
        if (ventaIdElement) {
          const ventaId = ventaIdElement.getAttribute("data-venta-id");
          if (ventaId) {
            // Abrir una nueva ventana con la URL de impresión
            const printWindow = window.open(
              `/admin/api/ventas/${ventaId}/imprimir`,
              "_blank"
            );
            if (printWindow) {
              printWindow.focus();
            } else {
              window.toast.error(
                "No se pudo abrir la ventana de impresión. Verifica que tu navegador permita ventanas emergentes.",
                "error"
              );
            }
          }
        } else {
          window.toast.error(
            "No se encontró el ID de la venta para imprimir",
            "error"
          );
        }
      }
    });
  }

  // Evento para abrir/cerrar panel de filtros
  const filterToggleBtn = document.getElementById("filter-toggle-btn");
  const filterPanel = document.getElementById("filter-panel");
  const overlay = document.getElementById("overlay");

  if (filterToggleBtn && filterPanel && overlay) {
    filterToggleBtn.addEventListener("click", function () {
      filterPanel.classList.remove("translate-x-full");
      overlay.classList.remove("hidden");
      document.body.classList.add("no-scroll"); // Deshabilita el scroll del body
    });

    // Cerrar panel al hacer clic en el overlay
    overlay.addEventListener("click", function () {
      filterPanel.classList.add("translate-x-full");
      overlay.classList.add("hidden");
      document.body.classList.remove("no-scroll"); // Habilita el scroll del body
    });

    // Cerrar panel al hacer clic en el botón de cerrar
    const closeFilterPanelBtn = document.getElementById("close-filter-panel");
    if (closeFilterPanelBtn) {
      closeFilterPanelBtn.addEventListener("click", function () {
        filterPanel.classList.add("translate-x-full");
        overlay.classList.add("hidden");
        document.body.classList.remove("no-scroll"); // Habilita el scroll del body
      });
    }
  }

  // Eventos para filtros automáticos (con debounce)
  const ventaIdInput = document.getElementById("venta_id");
  if (ventaIdInput) {
    ventaIdInput.addEventListener("input", function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyFilters, 500);
    });
  }

  const clienteInput = document.getElementById("cliente");
  if (clienteInput) {
    clienteInput.addEventListener("input", function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        applyFilters();
      }, 500); // Esperar 500ms después de que el usuario deje de escribir
    });
  }

  const fechaInicioInput = document.getElementById("fecha_inicio");
  if (fechaInicioInput) {
    // MEJORA PROFESIONAL: Al cambiar la fecha, solo se actualizan las estadísticas y el gráfico.
    // No se recarga la tabla de ventas para una experiencia más fluida.
    fechaInicioInput.addEventListener("change", loadEstadisticas);
  }

  const fechaFinInput = document.getElementById("fecha_fin");
  if (fechaFinInput) {
    // MEJORA PROFESIONAL: Al cambiar la fecha, solo se actualizan las estadísticas y el gráfico.
    fechaFinInput.addEventListener("change", loadEstadisticas);
  }

  const estadoInput = document.getElementById("estado");
  if (estadoInput) {
    estadoInput.addEventListener("change", function () {
      applyFilters();
    });
  }

  const montoMinInput = document.getElementById("monto_min");
  if (montoMinInput) {
    montoMinInput.addEventListener("input", function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        applyFilters();
      }, 500); // Esperar 500ms después de que el usuario deje de escribir
    });
  }

  const montoMaxInput = document.getElementById("monto_max");
  if (montoMaxInput) {
    montoMaxInput.addEventListener("input", function () {
      debounceTimer = setTimeout(function () {
        applyFilters();
      }, 500); // Esperar 500ms después de que el usuario deje de escribir
    });
  }

  // Función para mostrar la modal de confirmación
  function showConfirmModal(ventaId, newStatus) {
    const modal = document.getElementById("confirm-status-modal");
    const modalContent = document.getElementById("confirm-modal-content");
    const actionText = document.getElementById("confirm-action-text");
    const confirmBtn = document.getElementById("confirm-action");

    if (!modal || !modalContent || !actionText || !confirmBtn) return;

    // Almacenar datos en el botón de confirmación
    confirmBtn.dataset.ventaId = ventaId;
    confirmBtn.dataset.newStatus = newStatus;

    actionText.textContent = newStatus === "inactivo" ? "inactivar" : "activar";

    modal.classList.remove("hidden");
    setTimeout(() => {
      modal.classList.add("active");
      modalContent.style.transform = "scale(1)";
      modalContent.style.opacity = "1";
    }, 10);
  }

  // Función para cerrar cualquier modal abierto
  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("active");
      setTimeout(() => modal.classList.add("hidden"), 300);
    }
  }

  // --- MANEJO DE EVENTOS CENTRALIZADO ---

  function handlePageClick(e) {
    // Guardia de contexto: si no estamos en la página de ventas, no hacer nada.
    if (!document.getElementById("ventas-chart")) {
        return;
    }

    // Cerrar modales
    if (e.target.closest("#close-modal, #close-modal-btn")) {
      closeModal("venta-detail-modal");
    }
    if (e.target.closest("#cancel-confirm")) {
      closeModal("confirm-status-modal");
    }

    // Acción de confirmar cambio de estado
    if (e.target.closest("#confirm-action")) {
      const btn = e.target.closest("#confirm-action");
      const ventaId = btn.dataset.ventaId;
      const newStatus = btn.dataset.newStatus;
      if (ventaId && newStatus) {
        toggleVentaStatus(ventaId, newStatus);
      }
      closeModal("confirm-status-modal");
    }

    // Imprimir
    if (e.target.closest("#print-detail")) {
      const ventaIdElement = document.querySelector(
        "#venta-detail-modal [data-venta-id]"
      );
      if (ventaIdElement) {
        const ventaId = ventaIdElement.getAttribute("data-venta-id");
        window.open(`/admin/api/ventas/${ventaId}/imprimir`, "_blank");
      }
    }

    // Panel de filtros
    if (e.target.closest("#filter-toggle-btn")) {
      document.getElementById("filter-panel")?.classList.remove("translate-x-full");
      document.getElementById("overlay")?.classList.remove("hidden");
    }
    if (e.target.closest("#close-filter-panel") || e.target.id === "overlay") {
      document.getElementById("filter-panel")?.classList.add("translate-x-full");
      document.getElementById("overlay")?.classList.add("hidden");
    }

    // Limpiar filtros
    if (e.target.closest("#reset-filters") || e.target.closest("#clear-filters")) {
      document.getElementById("venta_id").value = "";
      document.getElementById("filter-form")?.reset();
      const sortBySelect = document.querySelector('.custom-select[data-name="sort_by"]');
      if (sortBySelect) {
        const firstOption = sortBySelect.querySelector('.custom-select-option');
        if (firstOption) firstOption.click(); // Simula clic para actualizar UI y valor
      }
      applyFilters();
    }

    // Botón de refrescar
    if (e.target.closest("#addVentaBtn")) {
      if (typeof crearPedidoApp !== 'undefined') {
        // MEJORA PROFESIONAL: Configurar el modal para el modo "Venta"
        crearPedidoApp.submitUrl = '/admin/api/ventas';
        crearPedidoApp.isVentaMode = true;
        crearPedidoApp.openModal();
        // Cambiar el título del modal para que sea específico para ventas.
        document.getElementById('pedidoModalTitle').textContent = 'Crear Nueva Venta';
      }
    }

    // Select personalizado
    const customSelectTrigger = e.target.closest(".custom-select-trigger");
    if (customSelectTrigger) {
      const select = customSelectTrigger.closest(".custom-select");
      document.querySelectorAll(".custom-select").forEach(s => {
        if (s !== select) s.classList.remove("open");
      });
      select.classList.toggle("open");
    }

    const customSelectOption = e.target.closest(".custom-select-option");
    if (customSelectOption) {
      const select = customSelectOption.closest(".custom-select");
      const valueDisplay = select.querySelector(".custom-select-value");
      const name = select.getAttribute("data-name");
      const hiddenInput = document.getElementById(name);

      select.querySelectorAll(".custom-select-option").forEach(opt => opt.classList.remove("selected"));
      customSelectOption.classList.add("selected");
      valueDisplay.textContent = customSelectOption.textContent;
      if (hiddenInput) hiddenInput.value = customSelectOption.getAttribute("data-value");

      select.classList.remove("open");
      if (name === "sort_by") applyFilters();
    }

    // Cerrar select si se hace clic fuera
    if (!e.target.closest(".custom-select")) {
      document.querySelectorAll(".custom-select.open").forEach(s => s.classList.remove("open"));
    }
  }

  function handleChartPeriodSelector(e) {
    const button = e.target.closest('.chart-period-btn');
    if (!button) return;

    currentChartPeriod = button.dataset.period;

    document.querySelectorAll('.chart-period-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    // Recargar solo las estadísticas y el gráfico
    loadEstadisticas();
  }

  function setupEventListeners() {
    if (eventListenersAttached) return;
    console.log("Attaching Ventas event listeners.");

    document.body.addEventListener("click", handlePageClick);

    const chartPeriodSelector = document.getElementById('chart-period-selector');
    if (chartPeriodSelector) {
        chartPeriodSelector.addEventListener('click', handleChartPeriodSelector);
    }

    // Listeners de 'change' y 'input' que no necesitan delegación porque los elementos son estáticos
    document.getElementById("per-page-select")?.addEventListener("change", function () {
      currentPerPage = parseInt(this.value);
      applyFilters();
    });

    const filterForm = document.getElementById("filter-form");
    if (filterForm) {
      filterForm.addEventListener("input", (e) => {
        if (e.target.matches("#cliente, #monto_min, #monto_max")) {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(applyFilters, 500);
        }
      });
      filterForm.addEventListener("change", (e) => {
        if (e.target.matches("#fecha_inicio, #fecha_fin, #estado")) {
          applyFilters();
        }
      });
    }
    eventListenersAttached = true;
  }

  function removeEventListeners() {
    if (!eventListenersAttached) return;
    console.log("Removing Ventas event listeners.");
    document.body.removeEventListener("click", handlePageClick);
    // No es necesario remover los listeners de 'per-page-select' y 'filter-form'

    const chartPeriodSelector = document.getElementById('chart-period-selector');
    if (chartPeriodSelector) {
        chartPeriodSelector.removeEventListener('click', handleChartPeriodSelector);
    }

    // porque los elementos son destruidos y recreados por la SPA.
    eventListenersAttached = false;
  }

  function loadInitialData() {
    currentFilterParams = new URLSearchParams(window.location.search);
    currentPage = 1;
    currentPerPage = parseInt(document.getElementById('per-page-select')?.value) || 20;

    // Cargar datos
    loadVentas(1, currentPerPage, false);
    loadEstadisticas();
    updateFilterIndicators();
  }

  return {
    init: init,
    destroy: destroy,
    reloadData: reloadData, // Exponer la función de recarga
    // Exponer funciones específicas para actualizaciones granulares.
    loadEstadisticas: loadEstadisticas,
    loadVentas: loadVentas,
    currentPerPage: currentPerPage
  };
})();

// Patrón de inicialización robusto para SPA
// MEJORA PROFESIONAL: Exponer el módulo en el objeto window para que otros scripts puedan interactuar con él.
// Esto es crucial para que el modal de creación de ventas pueda llamar a `reloadData`.
window.VentasPageModule = VentasPageModule;

const runVentasInitialization = () => {
  window.VentasPageModule.init();
};
const destroyVentasModule = () => {
    window.VentasPageModule.destroy();
};

// 1. Para carga de página directa (hard refresh)
document.addEventListener("DOMContentLoaded", () => {
    // Antes de inicializar, nos aseguramos de que cualquier módulo anterior sea destruido.
    // Esto es una salvaguarda para recargas en caliente (hot-reloads) en desarrollo.
    destroyVentasModule();
    runVentasInitialization();
});

// 2. Para navegación SPA: Escuchar eventos de admin_spa.js
document.addEventListener("content-will-load", destroyVentasModule);
document.addEventListener("content-loaded", runVentasInitialization);
