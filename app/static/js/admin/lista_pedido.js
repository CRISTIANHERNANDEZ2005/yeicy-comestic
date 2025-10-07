// Objeto global para la aplicación de pedidos
// Polyfill para String.prototype.title para JS, para emular el comportamiento de Python
if (!String.prototype.title) {
  String.prototype.title = function () {
    return this.replace(/\w\S*/g, function (txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  };
}

// Objeto global para la aplicación de pedidos
window.pedidosApp = {
  currentEstado: "en-proceso",
  currentPage: 1,
  itemsPerPage: 10,
  isLoading: false,
  initialized: false,
  elements: {},
  hasActiveFilters: false,
  pedidoParaConfirmar: null,
  nuevoEstadoParaConfirmar: null,
  selectedPedidoId: null,
  selectedSeguimientoEstado: null,

  // Re-inicializar la aplicación (para SPA)
  reinitialize: function () {
    console.log("Reinitializing pedidosApp...");
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.isLoading = false;
    this.hasActiveFilters = false;

    // Re-cachear elementos del DOM y re-adjuntar listeners
    this.cacheElements();
    this.initializeView();

    // Resetear filtros de forma segura
    const pedidoIdFilter = document.getElementById("pedidoIdFilter");
    if (pedidoIdFilter) pedidoIdFilter.value = "";
    const clienteFilter = document.getElementById("clienteFilter");
    if (clienteFilter) clienteFilter.value = "";
    const fechaInicioFilter = document.getElementById("fechaInicioFilter");
    if (fechaInicioFilter) fechaInicioFilter.value = "";
    const fechaFinFilter = document.getElementById("fechaFinFilter");
    if (fechaFinFilter) fechaFinFilter.value = "";
    const sortFilter = document.getElementById("sortFilter");
    if (sortFilter) sortFilter.value = "created_at";
    const statusFilter = document.getElementById("statusFilter");
    if (statusFilter) statusFilter.value = "all";

    // Re-adjuntar listeners principales y cargar los pedidos.
    // loadPedidos se encargará de inicializar la sección de seguimiento.
    this.setupEventListeners();
    this.loadPedidos();
  },

  // Inicializar la aplicación
  init: function (initialPaginationData) {
    if (this.initialized) {
      this.reinitialize();
      return;
    }
    this.cacheElements();
    this.initializeView();
    this.setupEventListeners();
    this.initialized = true;

    // Si hay datos de paginación iniciales, usarlos
    if (
      initialPaginationData &&
      Object.keys(initialPaginationData).length > 0
    ) {
      this.updatePaginationInfo({ pagination: initialPaginationData });
      this.showHidePaginationControls(initialPaginationData.total > 0);
      // Los datos iniciales están en el DOM, así que podemos inicializar el seguimiento.
      this.initSeguimientoSection();
    } else {
      this.loadPedidos();
    }
  },

  // Inicializar la sección de seguimiento
  initSeguimientoSection: function () {
    console.log("Initializing Seguimiento Section...");
    const seguimientoContent = document.getElementById("seguimientoContent");
    const noPedidosMessage = document.getElementById("noPedidosMessage");

    // Verificar si hay pedidos disponibles
    const pedidoSelect = document.getElementById("pedidoSeguimientoSelect");
    if (pedidoSelect && pedidoSelect.options.length <= 1) {
      if (seguimientoContent) seguimientoContent.classList.add("hidden");
      if (noPedidosMessage) noPedidosMessage.classList.remove("hidden");
    } else {
      if (seguimientoContent) seguimientoContent.classList.add("hidden");
      if (noPedidosMessage) noPedidosMessage.classList.remove("hidden");
    }

    // La lógica de eventos se moverá a setupEventListeners para usar delegación
    // y evitar problemas de reinicialización.
  },

  // Cerrar sección de seguimiento
  closeSeguimientoSection: function () {
    const seguimientoContent = document.getElementById("seguimientoContent");
    const noPedidosMessage = document.getElementById("noPedidosMessage");
    const pedidoSelect = document.getElementById("pedidoSeguimientoSelect");

    if (seguimientoContent) seguimientoContent.classList.add("hidden");
    if (noPedidosMessage) noPedidosMessage.classList.remove("hidden");
    if (pedidoSelect) pedidoSelect.value = "";

    this.selectedPedidoId = null;
    this.selectedSeguimientoEstado = null;
  },

  // Cargar datos de seguimiento
  loadSeguimientoData: function (pedidoId) {
    const seguimientoContent = document.getElementById("seguimientoContent");
    if (seguimientoContent) {
      seguimientoContent.classList.add("updating");
    }

    // MEJORA PROFESIONAL: Añadir { cache: "no-store" } para evitar que el navegador
    // use una versión en caché de los datos del pedido. Esto asegura que siempre
    // se obtenga la información más reciente, incluyendo el historial de seguimiento actualizado.
    fetch(`/admin/api/pedidos/${pedidoId}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          this.updateSeguimientoUI(data.pedido);

          const event = new CustomEvent("seguimiento-updated", {
            detail: {
              pedidoId: pedidoId,
              seguimientoEstado: data.pedido.seguimiento_estado,
            },
          });
          document.dispatchEvent(event);
        } else {
          window.toast.error("Error al cargar datos de seguimiento");
        }

        if (seguimientoContent) {
          seguimientoContent.classList.remove("updating");
        }
      })
      .catch((error) => {
        console.error("Error al cargar datos de seguimiento:", error);
        window.toast.error("Error al cargar datos de seguimiento");

        if (seguimientoContent) {
          seguimientoContent.classList.remove("updating");
        }
      });
  },

  // Actualizar la UI de seguimiento
  updateSeguimientoUI: function (pedido) {
    const currentEstadoEl = document.getElementById("currentSeguimientoEstado");
    if (currentEstadoEl) {
      currentEstadoEl.textContent = (pedido.seguimiento_estado || "recibido")
        .replace("_", " ")
        .title();
      currentEstadoEl.className = `seguimiento-badge seguimiento-${(
        pedido.seguimiento_estado || "recibido"
      ).replace(" ", "-")}`;
    }

    const notasTextarea = document.getElementById("seguimientoNotas");
    if (notasTextarea) {
      // MEJORA: Muestra la última nota del historial o la nota general.
      const historial = pedido.seguimiento_historial || [];
      const ultimaEntrada =
        historial.length > 0 ? historial[historial.length - 1] : null;
      notasTextarea.value = ultimaEntrada
        ? ultimaEntrada.notas
        : pedido.notas_seguimiento || "";
    }

    this.updateTimeline(pedido);
    this.selectSeguimientoEstado(pedido.seguimiento_estado || "recibido");
  },

  // MEJORA: Función unificada para actualizar la línea de tiempo con estados y timestamps.
  updateTimeline: function (pedido) {
    let historial = pedido.seguimiento_historial || [];
    const ultimoEstado = pedido.seguimiento_estado || "recibido";

    // MEJORA PROFESIONAL: Asegurar que el estado 'recibido' siempre tenga un timestamp.
    // Si no está en el historial (para pedidos antiguos), se usa la fecha de creación del pedido.
    // Esto da robustez y consistencia a la línea de tiempo.
    const tieneEstadoRecibido = historial.some((e) => e.estado === "recibido");

    if (!tieneEstadoRecibido) {
      // Se crea una copia para no mutar el objeto original directamente.
      historial = [
        {
          estado: "recibido",
          notas: "Pedido recibido en el sistema", // Nota genérica para retrocompatibilidad
          timestamp: pedido.created_at,
        },
        ...historial,
      ];
    }

    // MEJORA PROFESIONAL: Crear un mapa con la última entrada del historial para cada estado.
    // Esto permite acceder tanto a la nota como al timestamp más reciente de cada etapa.
    const statusHistoryMap = {};
    historial.forEach((entry) => {
      statusHistoryMap[entry.estado] = entry;
    });

    const timelineItems = document.querySelectorAll(".timeline-item");
    const estadosOrden = [
      "recibido",
      "en preparacion",
      "en camino",
      "entregado",
    ];
    const ultimoEstadoIndex = estadosOrden.indexOf(ultimoEstado);

    timelineItems.forEach((item) => {
      const estado = item.getAttribute("data-estado");
      const esEstadoCancelado = estado === "cancelado";
      const timestampEl = document.getElementById(
        `${estado.replace(/ /g, "-")}-timestamp`
      );
      const notasEl = document.getElementById(
        `${estado.replace(/ /g, "-")}-notas`
      );
      const dot = item.querySelector(".timeline-dot");

      // Resetea estilos y contenido
      item.classList.remove("active", "completed");
      if (dot) {
        dot.classList.remove("bg-blue-500", "bg-green-500", "bg-red-500");
        dot.classList.add("bg-gray-200");
      }
      if (timestampEl) {
        timestampEl.textContent = "--:--";
      }
      if (notasEl) {
        // El estado 'recibido' tiene un texto por defecto diferente.
        if (estado === "recibido" && !esEstadoCancelado) {
          notasEl.textContent =
            "El pedido ha sido recibido en nuestro sistema.";
        } else {
          notasEl.textContent = "Pendiente de actualización.";
        }
      }

      // MEJORA: Actualiza el timestamp y la nota si el estado está en el historial.
      if (statusHistoryMap[estado]) {
        const entry = statusHistoryMap[estado];
        if (timestampEl) {
          const date = new Date(entry.timestamp);
          const dateOptions = {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "America/Bogota",
          };
          const timeOptions = {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: "America/Bogota",
          };
          timestampEl.textContent = `${date.toLocaleDateString(
            "es-CO",
            dateOptions
          )} ${date.toLocaleTimeString("es-CO", timeOptions)}`;
        }
        if (notasEl && entry.notas) {
          notasEl.textContent = entry.notas;
        }
      }

      // Actualiza el estado visual (activo/completado)
      if (ultimoEstado === "cancelado") {
        // Si el pedido está cancelado, el item 'cancelado' es el activo.
        if (esEstadoCancelado) {
          item.classList.add("active");
          if (dot) dot.classList.add("bg-red-500");
        }
        // MEJORA PROFESIONAL: Solo marcar como completados los estados que realmente ocurrieron.
        else if (statusHistoryMap[estado]) {
          item.classList.add("completed");
          if (dot) dot.classList.add("bg-green-500");
        }
      } else {
        const itemIndex = estadosOrden.indexOf(estado);
        if (itemIndex !== -1) {
          // Si el estado es anterior al último, o si el pedido ya fue entregado, se marca como completado.
          if (
            statusHistoryMap[estado] &&
            (itemIndex < ultimoEstadoIndex || ultimoEstado === "entregado")
          ) {
            item.classList.add("completed");
            if (dot) dot.classList.add("bg-green-500");
          } else if (itemIndex === ultimoEstadoIndex) {
                    item.classList.add("active");
            if (dot) dot.classList.add("bg-blue-500");
          }
        }
      }
    });
  },

  // Actualizar el timeline de seguimiento
  // Seleccionar estado de seguimiento
  selectSeguimientoEstado: function (estado) {
    this.selectedSeguimientoEstado = estado;

    // MEJORA PROFESIONAL: Acotar el selector para que solo afecte a los botones de la sección principal de seguimiento,
    // evitando conflictos con los botones del modal.
    const seguimientoButtons = document.querySelectorAll(
      "#mainSeguimientoButtons .seguimiento-btn"
    );
    seguimientoButtons.forEach((btn) => {
      btn.classList.remove("active");
      if (btn.getAttribute("data-estado") === estado) {
        btn.classList.add("active");
      }
    });
  },

  // Actualizar estado de seguimiento
  updateSeguimiento: function (
    pedidoId,
    nuevoEstado,
    notas,
    onSuccessCallback = null
  ) {
    if (this.isLoading) return;

    const seguimientoContent = document.getElementById("seguimientoContent");
    if (seguimientoContent) {
      seguimientoContent.classList.add("updating");
    }

    fetch(`/admin/api/pedidos/${pedidoId}/seguimiento`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken":
          document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content") || "",
      },
      body: JSON.stringify({
        seguimiento_estado: nuevoEstado,
        notas: notas,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // MEJORA PROFESIONAL: Ejecutar callback de éxito si existe (para cerrar modales, etc.)
          if (onSuccessCallback) {
            onSuccessCallback();
          }

          window.toast.success(data.message);

          // Si el estado principal del pedido cambió (ej. a 'completado' o 'cancelado'),
          // el pedido debe desaparecer de la vista actual ('en proceso').
          const estadoPedidoActual = this.getEstadoFromView();

          if (
            data.estado_pedido_cambiado &&
            data.nuevo_estado_pedido !== estadoPedidoActual
          ) {
            // El estado principal cambió y ya no coincide con la vista actual.
            // Animamos la eliminación de la fila y luego recargamos la lista.
            const pedidoRow = document.querySelector(
              `tr[data-pedido-id="${data.pedido_id}"]`
            );
            if (pedidoRow) {
              pedidoRow.style.transition =
                "opacity 0.5s ease, transform 0.5s ease";
              pedidoRow.style.opacity = "0";
              pedidoRow.style.transform = "translateX(-20px)";
              setTimeout(() => {
                this.loadPedidos(); // Recargamos la lista para actualizar todo, incluyendo la paginación.
              }, 500);
            } else {
              // Si la fila no se encuentra (poco probable), simplemente recargamos.
              this.loadPedidos();
            }

            // Cerrar la sección de seguimiento ya que el pedido ya no está en la lista.
            this.closeSeguimientoSection();
          } else {
            // Si el estado principal no cambió o sigue siendo el de la vista actual,
            // solo actualizamos la UI de seguimiento y la tabla.
            this.loadSeguimientoData(pedidoId);
            this.updatePedidoSeguimientoInTable(pedidoId, nuevoEstado);
          }

          const event = new CustomEvent("seguimiento-changed", {
            detail: {
              pedidoId: pedidoId,
              nuevoEstado: nuevoEstado,
              notas: notas,
            },
          });
          document.dispatchEvent(event);
        } else {
          window.toast.error(
            data.message || "Error al actualizar estado de seguimiento"
          );
        }
        this.isLoading = false;

        if (seguimientoContent) {
          seguimientoContent.classList.remove("updating");
        }
      })
      .catch((error) => {
        console.error("Error al actualizar estado de seguimiento:", error);
        window.toast.error("Error al actualizar estado de seguimiento");
        this.isLoading = false;

        if (seguimientoContent) {
          seguimientoContent.classList.remove("updating");
        }
      });
  },

  // Actualizar el seguimiento en la tabla de pedidos
  updatePedidoSeguimientoInTable: function (pedidoId, nuevoEstado) {
    const pedidoRow = document.querySelector(
      `tr[data-pedido-id="${pedidoId}"]`
    );
    if (pedidoRow) {
      const seguimientoBadge = pedidoRow.querySelector(".seguimiento-badge");
      if (seguimientoBadge) {
        seguimientoBadge.textContent = nuevoEstado.replace("_", " ").title();
        seguimientoBadge.className = `seguimiento-badge seguimiento-${nuevoEstado.replace(
          " ",
          "-"
        )}`;

        seguimientoBadge.classList.add("updating");

        setTimeout(() => {
          seguimientoBadge.classList.remove("updating");
        }, 1000);
      }
    }
  },

  // Mostrar u ocultar controles de paginación
  showHidePaginationControls: function (show) {
    const topControls = document.getElementById("pagination-top-controls");
    const bottomControls = document.getElementById(
      "pagination-bottom-controls"
    );

    if (show) {
      if (topControls) topControls.classList.remove("hidden");
      if (bottomControls) bottomControls.classList.remove("hidden");
    } else {
      if (topControls) topControls.classList.add("hidden");
      if (bottomControls) bottomControls.classList.add("hidden");
    }
  },

  // Verificar si hay filtros activos
  checkActiveFilters: function () {
    const pedidoId = document.getElementById("pedidoIdFilter")?.value || "";
    const cliente = document.getElementById("clienteFilter")?.value || "";
    const fechaInicio =
      document.getElementById("fechaInicioFilter")?.value || "";
    const fechaFin = document.getElementById("fechaFinFilter")?.value || "";
    const sortFilter =
      document.getElementById("sortFilter")?.value || "created_at";
    const statusFilter =
      document.getElementById("statusFilter")?.value || "all";

    this.hasActiveFilters = !!(
      pedidoId ||
      cliente ||
      fechaInicio ||
      fechaFin ||
      sortFilter !== "created_at" ||
      statusFilter !== "all"
    );
  },

  // Función para cambiar estado del pedido
  togglePedidoEstado: function (pedidoId, nuevoEstadoBool) {
    const nuevoEstado = nuevoEstadoBool ? "activo" : "inactivo";
    fetch(`/admin/api/pedidos/${pedidoId}/estado-activo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken":
          document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content") || "",
      },
      body: JSON.stringify({ estado: nuevoEstado }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          window.toast.success(`Pedido ${nuevoEstado} correctamente`);

          // Verificar si el pedido estaba seleccionado en la sección de seguimiento
          const pedidoSelect = document.getElementById(
            "pedidoSeguimientoSelect"
          );
          if (pedidoSelect && pedidoSelect.value == pedidoId) {
            // Si se está desactivando, cerrar la sección de seguimiento
            if (nuevoEstadoBool === false) {
              this.closeSeguimientoSection();
            } else {
              // Si se está activando, recargar los datos de seguimiento
              this.loadSeguimientoData(pedidoId);
            }
          }

          // Recargar la lista de pedidos
          this.loadPedidos();

          const event = new CustomEvent("pedido-estado-changed", {
            detail: {
              pedidoId: pedidoId,
              nuevoEstado: nuevoEstado,
            },
          });
          document.dispatchEvent(event);
        } else {
          window.toast.error(data.message || "Error al cambiar estado");
        }
      })
      .catch((err) => {
        console.error(err);
        window.toast.error("Error al cambiar estado del pedido");
      });
  },

  // Mostrar modal de confirmación para cambiar estado
  showConfirmEstadoModal: function (pedidoId, nuevoEstado) {
    const pedidoRow = document
      .querySelector(`#toggle-pedido-${pedidoId}`)
      ?.closest("tr");
    if (!pedidoRow) {
      window.toast.error("No se encontró el pedido");
      return;
    }

    const toggleInput = document.getElementById(`toggle-pedido-${pedidoId}`);

    this.pedidoParaConfirmar = pedidoId;
    this.nuevoEstadoParaConfirmar = nuevoEstado;

    if (
      this.elements.pedidoModal &&
      !this.elements.pedidoModal.classList.contains("hidden")
    ) {
      this.closePedidoModal();
    }

    fetch(`/admin/api/pedidos/${pedidoId}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          this.showConfirmEstadoModalContent(data.pedido, nuevoEstado);
        } else {
          window.toast.error("Error al cargar detalles del pedido");
        }
      })
      .catch((error) => {
        console.error("Error al cargar detalles del pedido:", error);
        window.toast.error("Error al cargar detalles del pedido");
      });
  },

  // Mostrar contenido del modal de confirmación
  showConfirmEstadoModalContent: function (pedido, nuevoEstado) {
    const modal = document.getElementById("confirmEstadoModal");
    const modalContent = document.getElementById("confirmEstadoModalContent");

    if (!modal || !modalContent) return;

    let estadoColor = "blue";
    let estadoIcon = "clock";
    let estadoText = "En Proceso";
    let modalTitle = "Confirmar Cambio de Estado";

    if (nuevoEstado === "completado") {
      estadoColor = "green";
      estadoIcon = "check-circle";
      estadoText = "Completado";
      modalTitle = "Marcar como Completado";
    } else if (nuevoEstado === "cancelado") {
      estadoColor = "red";
      estadoIcon = "times-circle";
      estadoText = "Cancelado";
      modalTitle = "Cancelar Pedido";
    } else if (nuevoEstado === "en proceso") {
      estadoColor = "blue";
      estadoIcon = "sync-alt";
      estadoText = "En Proceso";
      modalTitle = "Poner en Proceso";
    }

    const fecha = new Date(pedido.created_at);
    const fechaFormateada = fecha.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let productosHtml = "";
    if (pedido.productos && pedido.productos.length > 0) {
      productosHtml = pedido.productos
        .map((producto) => {
          const imagenSrc = producto.producto_imagen_url || "https://via.placeholder.com/50";

          return `
                    <tr>
                        <td class="py-3 px-4">
                            <div class="producto-info">
                                <img src="${imagenSrc}" alt="${
            producto.producto_nombre
          }" class="producto-imagen">
                                <div class="producto-detalles">
                                    <div class="font-medium">${
                                      producto.producto_nombre
                                    }</div>
                                </div>
                            </div>
                        </td>
                        <td class="py-3 px-4">
                            ${producto.cantidad}
                        </td>
                        <td class="py-3 px-4">
                            $ ${producto.precio_unitario.toLocaleString()}
                        </td>
                        <td class="py-3 px-4 text-right">
                            $ ${producto.subtotal.toLocaleString()}
                        </td>
                    </tr>
                `;
        })
        .join("");
    } else {
      productosHtml = `
                <tr>
                    <td colspan="4" class="py-4 px-4 text-center text-gray-500">
                        No hay productos en este pedido
                    </td>
                </tr>
            `;
    }

    let confirmMessage = "";
    if (nuevoEstado === "completado") {
      if (pedido.estado_pedido === "en proceso") {
        confirmMessage =
          "Está a punto de marcar este pedido como completado. El cliente recibirá una notificación.";
      } else if (pedido.estado_pedido === "cancelado") {
        confirmMessage =
          "Está a punto de cambiar este pedido de cancelado a completado. La existencia se ajustará automáticamente y el cliente recibirá una notificación.";
      }
    } else if (nuevoEstado === "cancelado") {
      if (pedido.estado_pedido === "en proceso") {
        confirmMessage =
          "Está a punto de cancelar este pedido. La existencia de los productos será devuelta y el cliente recibirá una notificación.";
      } else if (pedido.estado_pedido === "completado") {
        confirmMessage =
          "Está a punto de cambiar este pedido de completado a cancelado. La existencia será devuelto al producto y el cliente recibirá una notificación.";
      }
    } else if (nuevoEstado === "en proceso") {
      if (pedido.estado_pedido === "completado") {
        confirmMessage =
          "Está a punto de cambiar este pedido de completado a en proceso. El estado del pedido se actualizará pero no se afectará la existencia y el cliente recibirá una notificación.";
      } else if (pedido.estado_pedido === "cancelado") {
        confirmMessage =
          "Está a punto de reactivar este pedido cancelado. La existencia se ajustará automáticamente y el pedido volverá a estar en proceso y el cliente recibirá una notificación.";
      }
    }

    document.getElementById("confirmEstadoModalTitle").textContent = modalTitle;
    document.getElementById("confirmEstadoBadge").innerHTML = `
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            ${estadoText}
        `;
    document.getElementById("confirmPedidoId").textContent = pedido.id;
    document.getElementById("confirmPedidoCliente").textContent = pedido.usuario
      ? pedido.usuario.nombre + " " + pedido.usuario.apellido
      : "N/A";
    document.getElementById("confirmPedidoClienteContacto").textContent =
      pedido.usuario ? pedido.usuario.numero : "N/A";
    document.getElementById(
      "confirmPedidoTotal"
    ).textContent = `$ ${pedido.total.toLocaleString()}`;
    document.getElementById("confirmPedidoProductosTable").innerHTML =
      productosHtml;
    document.getElementById("confirmEstadoMessage").textContent =
      confirmMessage;

    modal.classList.remove("hidden");
    modalContent.offsetHeight;
  },

  // Cerrar modal de confirmación
  closeConfirmEstadoModal: function () {
    const modal = document.getElementById("confirmEstadoModal");
    const modalContent = document.getElementById("confirmEstadoModalContent");

    if (modal && modalContent) {
      modalContent.classList.add("closing");
      setTimeout(() => {
        modal.classList.add("hidden");
        modalContent.classList.remove("closing");
        this.pedidoParaConfirmar = null;
        this.nuevoEstadoParaConfirmar = null;
      }, 300);
    }
  },

  // Confirmar actualización de estado
  confirmUpdateEstado: function () {
    if (!this.pedidoParaConfirmar || !this.nuevoEstadoParaConfirmar) return;

    this.updateEstado(this.pedidoParaConfirmar, this.nuevoEstadoParaConfirmar);
    this.closeConfirmEstadoModal();
  },

  // Cachear elementos del DOM
  cacheElements: function () {
    this.elements.pedidosTableBody =
      document.getElementById("pedidosTableBody");
    this.elements.paginationContainer = document.getElementById(
      "paginationContainer"
    );
    this.elements.showingTo = document.getElementById("pagination-showing-top");
    this.elements.totalItems = document.getElementById("pagination-total-top");
    this.elements.currentPageDisplay = document.getElementById(
      "pagination-current-page"
    );
    this.elements.totalPagesDisplay = document.getElementById(
      "pagination-total-pages"
    );
    this.elements.pedidosListLoaderOverlay = document.getElementById(
      "pedidosListLoaderOverlay"
    );
    this.elements.pedidoModal = document.getElementById("pedidoModal");
    this.elements.pedidoModalContent =
      document.getElementById("pedidoModalContent");
    this.elements.confirmEstadoModal =
      document.getElementById("confirmEstadoModal");
    this.elements.confirmEstadoModalContent = document.getElementById(
      "confirmEstadoModalContent"
    );
  },

  // Inicializar la vista
  initializeView: function () {
    const path = window.location.pathname;
    if (path.endsWith("/completados")) {
      this.currentEstado = "completados";
    } else if (path.endsWith("/cancelados")) {
      this.currentEstado = "cancelados";
    } else {
      this.currentEstado = "en-proceso";
    }

    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active", "border-blue-500", "text-blue-600");
      btn.classList.add("border-transparent", "text-gray-500");
      if (btn.getAttribute("data-estado") === this.currentEstado) {
        btn.classList.add("active", "border-blue-500", "text-blue-600");
        btn.classList.remove("border-transparent", "text-gray-500");
      }
    });
  },

  // Cargar datos de pedidos
  loadPedidos: function (resetPage = true) {
    if (this.isLoading) return;

    this.isLoading = true;
    if (this.elements.pedidosListLoaderOverlay) {
      this.elements.pedidosListLoaderOverlay.classList.remove("hidden");
    }

    if (resetPage) {
      this.currentPage = 1;
    }

    const pedidoId = document.getElementById("pedidoIdFilter")?.value || "";
    const cliente = document.getElementById("clienteFilter")?.value || "";
    const fechaInicio =
      document.getElementById("fechaInicioFilter")?.value || "";
    const fechaFin = document.getElementById("fechaFinFilter")?.value || "";
    const sortFilter =
      document.getElementById("sortFilter")?.value || "created_at";
    const statusFilter =
      document.getElementById("statusFilter")?.value || "all";

    this.checkActiveFilters();

    let apiUrl = `/admin/api/pedidos/filter?page=${this.currentPage}&per_page=${
      this.itemsPerPage
    }&estado=${this.getEstadoFromView()}`;

    if (pedidoId) apiUrl += `&pedido_id=${encodeURIComponent(pedidoId)}`;
    if (cliente) apiUrl += `&cliente=${encodeURIComponent(cliente)}`;
    if (fechaInicio) apiUrl += `&fecha_inicio=${fechaInicio}`;
    if (fechaFin) apiUrl += `&fecha_fin=${fechaFin}`;
    if (statusFilter !== "all") apiUrl += `&status=${statusFilter}`;

    let sortBy = "created_at";
    let sortOrder = "desc";

    if (sortFilter === "created_at-desc") {
      sortBy = "created_at";
      sortOrder = "asc";
    } else if (sortFilter === "cliente") {
      sortBy = "cliente";
      sortOrder = "asc";
    } else if (sortFilter === "cliente-desc") {
      sortBy = "cliente";
      sortOrder = "desc";
    } else if (sortFilter === "total") {
      sortBy = "total";
      sortOrder = "asc";
    } else if (sortFilter === "total-desc") {
      sortBy = "total";
      sortOrder = "desc";
    }

    apiUrl += `&sort_by=${sortBy}&sort_order=${sortOrder}`;

    fetch(apiUrl, {
      cache: "no-store", // Prevenir que el navegador cachee los resultados del filtro
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          let customMessage = null;
          if (!data.pedidos || data.pedidos.length === 0) {
            if (this.hasActiveFilters) {
              customMessage =
                "No hay pedidos que coincidan con los filtros aplicados.";

              if (cliente && !fechaInicio && !fechaFin) {
                customMessage = `No se encontraron pedidos para el cliente "${cliente}".`;
              } else if (!cliente && fechaInicio && !fechaFin) {
                customMessage = `No se encontraron pedidos desde la fecha ${fechaInicio}.`;
              } else if (!cliente && !fechaInicio && fechaFin) {
                customMessage = `No se encontraron pedidos hasta la fecha ${fechaFin}.`;
              } else if (cliente && fechaInicio && fechaFin) {
                customMessage = `No se encontraron pedidos para el cliente "${cliente}" en el rango de fechas seleccionado.`;
              } else if (cliente && fechaInicio) {
                customMessage = `No se encontraron pedidos para el cliente "${cliente}" desde la fecha ${fechaInicio}.`;
              } else if (cliente && fechaFin) {
                customMessage = `No se encontraron pedidos para el cliente "${cliente}" hasta la fecha ${fechaFin}.`;
              } else if (fechaInicio && fechaFin) {
                customMessage = `No se encontraron pedidos en el rango de fechas ${fechaInicio} a ${fechaFin}.`;
              }
            } else {
              customMessage = `No hay pedidos ${this.getEstadoText()}`;
            }
          }

          this.updateTable(data.pedidos, customMessage);
          this.updatePagination(data.pagination);
          this.updatePaginationInfo(data);

          const hasResults = data.pedidos && data.pedidos.length > 0;
          this.showHidePaginationControls(
            hasResults && data.pagination.total > 0
          );

          // LA SOLUCIÓN: Inicializar la sección de seguimiento DESPUÉS de que el select se ha poblado.
          this.initSeguimientoSection();

          this.updatePedidoSeguimientoSelect(data.pedidos);

          // Verificar si el pedido seleccionado en seguimiento aún existe en la nueva lista
          if (this.selectedPedidoId) {
            const pedidoExists =
              data.pedidos &&
              data.pedidos.some((p) => p.id == this.selectedPedidoId);
            if (!pedidoExists) {
              this.closeSeguimientoSection();
            }
          }

          const event = new CustomEvent("pedidos-updated", {
            detail: {
              pedidos: data.pedidos,
              pagination: data.pagination,
            },
          });
          document.dispatchEvent(event);
        } else {
          window.toast.error("Error al cargar pedidos");
        }
        this.isLoading = false;
        if (this.elements.pedidosListLoaderOverlay) {
          this.elements.pedidosListLoaderOverlay.classList.add("hidden");
        }
      })
      .catch((error) => {
        console.error("Error al cargar pedidos:", error);
        window.toast.error("Error al cargar pedidos");
        this.isLoading = false;
        if (this.elements.pedidosListLoaderOverlay) {
          this.elements.pedidosListLoaderOverlay.classList.add("hidden");
        }
      });
  },

  // Actualizar el selector de pedidos en la sección de seguimiento
  updatePedidoSeguimientoSelect: function (pedidos) {
    const pedidoSelect = document.getElementById("pedidoSeguimientoSelect");
    const seguimientoContent = document.getElementById("seguimientoContent");
    const noPedidosMessage = document.getElementById("noPedidosMessage");

    if (!pedidoSelect) return;

    // Limpiar opciones existentes, excepto la primera que es el placeholder.
    while (pedidoSelect.options.length > 1) {
      pedidoSelect.remove(1);
    }

    // Llenar el select con los nuevos pedidos.
    if (pedidos && pedidos.length > 0) {
      // MEJORA PROFESIONAL: Mostrar todos los pedidos, pero indicar visualmente si están inactivos.
      pedidos.forEach((pedido) => {
        const option = document.createElement("option");
        option.value = pedido.id;
        option.setAttribute(
          "data-estado",
          pedido.seguimiento_estado || "recibido"
        );
        option.setAttribute("data-notas", pedido.notas_seguimiento || "");

        // Añadir etiqueta "(Inactivo)" si corresponde para claridad del admin.
        const estadoLabel =
          pedido.estado === "inactivo" ? " (Inactivo)" : "";
        option.textContent = `#${pedido.id.substring(0, 8)}... - ${
          pedido.usuario_nombre || "N/A"
        } - $ ${pedido.total.toLocaleString()}${estadoLabel}`;
        pedidoSelect.appendChild(option);
      });
    } else {
      // Si no hay pedidos en la lista, nos aseguramos de que la sección de seguimiento esté cerrada.
      this.closeSeguimientoSection();
    }
  },

  // Actualizar tabla con datos de pedidos
  updateTable: function (pedidos, customMessage) {
    let html = "";

    if (pedidos && pedidos.length > 0) {
      pedidos.forEach((pedido) => {
        const isInactive = pedido.estado === "inactivo";
        const rowClass = isInactive
          ? "border-t border-gray-100 bg-gray-50 opacity-75"
          : "border-t border-gray-100 hover:bg-gray-50";

        html += `
                    <tr class="${rowClass}" data-estado="${
          pedido.estado
        }" data-pedido-id="${pedido.id}">
                        <td class="py-4 px-4">
                            ${pedido.usuario_nombre || "N/A"}
                            ${
                              isInactive
                                ? '<span class="ml-2 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded-full">Inactivo</span>'
                                : ""
                            }
                        </td>
                        <td class="py-4 px-4">${
                          pedido.productos_count || 0
                        }</td>
                        <td class="py-4 px-4">$ ${
                          pedido.total ? pedido.total.toLocaleString() : "0"
                        }</td>
                        <td class="py-4 px-4">${
                          pedido.created_at
                            ? pedido.created_at.substring(0, 10)
                            : "N/A"
                        }</td>
                        <td class="py-4 px-4">
                            <div class="flex items-center">
                                <span class="seguimiento-badge seguimiento-${
                                  pedido.seguimiento_estado
                                    ? pedido.seguimiento_estado.replace(
                                        " ",
                                        "-"
                                      )
                                    : "recibido"
                                }">
                                    ${
                                      pedido.seguimiento_estado
                                        ? pedido.seguimiento_estado
                                            .replace("_", " ")
                                            .title()
                                        : "Recibido"
                                    }
                                </span>
                            </div>
                        </td>
                        <td class="py-4 px-4">
                            <div class="flex items-center justify-center">
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox"
                                           class="sr-only peer"
                                           id="toggle-pedido-${pedido.id}"
                                           ${
                                             pedido.estado === "activo"
                                               ? "checked"
                                               : ""
                                           }
                                           onchange="pedidosApp.togglePedidoEstado('${
                                             pedido.id
                                           }', this.checked)">
                                    <div class="w-11 h-6 bg-gray-300 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-300 peer-checked:bg-green-500 transition-all duration-300"></div>
                                    <div class="absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-md transform peer-checked:translate-x-5 transition-transform duration-300"></div>
                                </label>
                            </div>
                        </td>
                        <td class="py-4 px-4">
                            <div class="flex space-x-2">
                                <button class="action-button view text-blue-600 hover:text-blue-800" title="Ver detalles" onclick="pedidosApp.viewPedido('${
                                  pedido.id
                                }')">
                                    <i class="fas fa-eye"></i>
                                </button>
                                ${this.renderActionButtons(pedido)}
                            </div>
                        </td>
                    </tr>
                `;
      });
    } else {
      const message = customMessage || `No hay pedidos ${this.getEstadoText()}`;
      html = `
                <tr class="no-results-row">
                    <td colspan="7" class="text-center py-8 text-gray-500">
                        <svg class="no-results-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <div class="no-results-title">No se encontraron pedidos</div>
                        <div>${message}</div>
                        ${
                          this.hasActiveFilters
                            ? `
                            <div class="no-results-actions">
                                <button type="button" onclick="pedidosApp.clearFilters()">
                                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                    </svg>
                                    Limpiar filtros
                                </button>
                            </div>
                        `
                            : ""
                        }
                    </td>
                </tr>
            `;
    }

    if (this.elements.pedidosTableBody) {
      this.elements.pedidosTableBody.innerHTML = html;
    }
  },

  renderActionButtons: function (pedido) {
    let buttons = '';
    if (pedido.estado_pedido === "en proceso") { // Pedidos en proceso
      // El botón de editar siempre está disponible para pedidos "en proceso"
      return `
                <button class="action-button complete text-green-600 hover:text-green-800" 
                        title="Marcar como completado" 
                        onclick="pedidosApp.showConfirmEstadoModal('${pedido.id}', 'completado')">
                    <i class="fas fa-check-circle"></i>
                </button>
                <button class="action-button cancel text-red-600 hover:text-red-800" 
                        title="Cancelar pedido" 
                        onclick="pedidosApp.showConfirmEstadoModal('${pedido.id}', 'cancelado')">
                    <i class="fas fa-times-circle"></i>
                </button>
                <button class="action-button edit text-yellow-600 hover:text-yellow-800" 
                        title="Editar pedido" 
                        onclick="pedidosApp.editPedido('${pedido.id}')">
                    <i class="fas fa-edit"></i>
                </button>
            `;
    } else if (pedido.estado_pedido === "completado") { // Pedidos completados
      return `
              <button class="action-button process text-blue-600 hover:text-blue-800" 
                      title="Poner en proceso" 
                      onclick="pedidosApp.showConfirmEstadoModal('${pedido.id}', 'en proceso')">
                  <i class="fas fa-sync-alt"></i>
              </button>
              <button class="action-button cancel text-red-600 hover:text-red-800" 
                      title="Cancelar pedido" 
                      onclick="pedidosApp.showConfirmEstadoModal('${pedido.id}', 'cancelado')">
                  <i class="fas fa-times-circle"></i>
              </button>
              `;
    } else if (pedido.estado_pedido === "cancelado") { // Pedidos cancelados
      return `
              <button class="action-button process text-blue-600 hover:text-blue-800" 
                      title="Poner en proceso" 
                      onclick="pedidosApp.showConfirmEstadoModal('${pedido.id}', 'en proceso')">
                  <i class="fas fa-sync-alt"></i>
              </button>
              <button class="action-button complete text-green-600 hover:text-green-800" 
                      title="Marcar como completado" 
                      onclick="pedidosApp.showConfirmEstadoModal('${pedido.id}', 'completado')">
                  <i class="fas fa-check-circle"></i>
              </button>
              `;
    }
    return "";
  },

  getEstadoFromView: function () {
    switch (this.currentEstado) {
      case "completados":
        return "completado";
      case "cancelados":
        return "cancelado";
      default:
        return "en proceso";
    }
  },

  getEstadoText: function () {
    switch (this.currentEstado) {
      case "completados":
        return "completados";
      case "cancelados":
        return "cancelados";
      default:
        return "en proceso";
    }
  },

  updatePagination: function (pagination) {
    if (!this.elements.paginationContainer) return;

    let html = "";

    html += `
            <button class="pagination-nav-button border border-gray-300 text-gray-700 rounded-md ${
              pagination.has_prev ? "" : "disabled"
            }" 
                    onclick="pedidosApp.changePage(${pagination.prev_num})" ${
      !pagination.has_prev ? "disabled" : ""
    }>
                <i class="fas fa-chevron-left mr-1"></i> Anterior
            </button>
        `;

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
      html += `<button class="pagination-button border border-gray-300 text-gray-700" onclick="pedidosApp.changePage(1)">1</button>`;
      if (startPage > 2) {
        html += `<span class="pagination-ellipsis">...</span>`;
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      html += `
                <button class="pagination-button border border-gray-300 ${
                  i === pagination.page
                    ? "active bg-blue-600 text-white"
                    : "text-gray-700"
                }" 
                        onclick="pedidosApp.changePage(${i})">${i}</button>
            `;
    }

    if (endPage < pagination.pages) {
      if (endPage < pagination.pages - 1) {
        html += `<span class="pagination-ellipsis">...</span>`;
      }
      html += `<button class="pagination-button border border-gray-300 text-gray-700" onclick="pedidosApp.changePage(${pagination.pages})">${pagination.pages}</button>`;
    }

    html += `
            <button class="pagination-nav-button border border-gray-300 text-gray-700 rounded-md ${
              pagination.has_next ? "" : "disabled"
            }" 
                    onclick="pedidosApp.changePage(${pagination.next_num})" ${
      !pagination.has_next ? "disabled" : ""
    }>
                Siguiente <i class="fas fa-chevron-right ml-1"></i>
            </button>
        `;

    this.elements.paginationContainer.innerHTML = html;
  },

  updatePaginationInfo: function (data) {
    const pagination = data.pagination;
    const currentPage = pagination.page;
    const perPage = pagination.per_page;
    let itemsDisplayed = Math.min(currentPage * perPage, pagination.total);

    if (this.elements.showingTo) {
      this.elements.showingTo.textContent = itemsDisplayed;
    }
    if (this.elements.totalItems) {
      this.elements.totalItems.textContent = pagination.total;
    }
    if (this.elements.currentPageDisplay) {
      this.elements.currentPageDisplay.textContent = currentPage;
    }
    if (this.elements.totalPagesDisplay) {
      this.elements.totalPagesDisplay.textContent = pagination.pages;
    }
  },

  changePage: function (page) {
    this.currentPage = page;
    this.loadPedidos(false);
  },

  viewPedido: function (pedidoId) {
    fetch(`/admin/api/pedidos/${pedidoId}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          this.showPedidoModal(data.pedido);
        } else {
          window.toast.error("Error al cargar detalles del pedido");
        }
      })
      .catch((error) => {
        console.error("Error al cargar detalles del pedido:", error);
        window.toast.error("Error al cargar detalles del pedido");
      });
  },

  editPedido: function (pedidoId) {
    fetch(`/admin/api/pedidos/${pedidoId}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          const pedido = data.pedido;
          crearPedidoApp.openModalForEdit(pedido);
        } else {
          window.toast.error("Error al cargar detalles del pedido");
        }
      })
      .catch((error) => {
        console.error("Error al cargar detalles del pedido:", error);
        window.toast.error("Error al cargar detalles del pedido");
      });
  },

  showPedidoModal: function (pedido) {
    const modal = this.elements.pedidoModal;
    const modalContent = this.elements.pedidoModalContent;

    if (!modal || !modalContent) return;

    if (
      this.elements.confirmEstadoModal &&
      !this.elements.confirmEstadoModal.classList.contains("hidden")
    ) {
      this.closeConfirmEstadoModal();
    }

    let estadoColor = "blue";
    let estadoIcon = "clock";
    if (pedido.estado_pedido === "completado") {
      estadoColor = "green";
      estadoIcon = "check-circle";
    } else if (pedido.estado_pedido === "cancelado") {
      estadoColor = "red";
      estadoIcon = "times-circle";
    }

    const fecha = new Date(pedido.created_at);
    const fechaFormateada = fecha.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let productosHtml = "";
    if (pedido.productos && pedido.productos.length > 0) {
      productosHtml = pedido.productos
        .map((producto) => {
          const imagenSrc = producto.producto_imagen_url || "https://via.placeholder.com/50";

          return `
                    <tr>
                        <td class="py-3 px-4">
                            <div class="producto-info">
                                <img src="${imagenSrc}" alt="${
            producto.producto_nombre
          }" class="producto-imagen">
                                <div class="producto-detalles">
                                    <div class="font-medium">${
                                      producto.producto_nombre
                                    }</div>
                                </div>
                            </div>
                        </td>
                        <td class="py-3 px-4">
                            ${producto.cantidad}
                        </td>
                        <td class="py-3 px-4">
                            $ ${producto.precio_unitario.toLocaleString()}
                        </td>
                        <td class="py-3 px-4 text-right">
                            $ ${producto.subtotal.toLocaleString()}
                        </td>
                    </tr>
                `;
        })
        .join("");
    } else {
      productosHtml = `
                <tr>
                    <td colspan="4" class="py-4 px-4 text-center text-gray-500">
                        No hay productos en este pedido
                    </td>
                </tr>
            `;
    }

    let accionesHtml = "";
    if (pedido.estado_pedido === "en proceso") {
      accionesHtml = `
                <button class="modal-action-btn success" onclick="pedidosApp.showConfirmEstadoModal('${pedido.id}', 'completado')">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Marcar como Completado
                </button>
                <button class="modal-action-btn danger" onclick="pedidosApp.showConfirmEstadoModal('${pedido.id}', 'cancelado')">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                    Cancelar Pedido
                </button>
            `;
    } else if (pedido.estado_pedido === "completado") {
      accionesHtml = `
                <button class="modal-action-btn primary" onclick="pedidosApp.showConfirmEstadoModal('${pedido.id}', 'en proceso')">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    Poner en Proceso
                </button>
                <button class="modal-action-btn danger" onclick="pedidosApp.showConfirmEstadoModal('${pedido.id}', 'cancelado')">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                    Cancelar Pedido
                </button>
            `;
    } else if (pedido.estado_pedido === "cancelado") {
      accionesHtml = `
                <button class="modal-action-btn primary" onclick="pedidosApp.showConfirmEstadoModal('${pedido.id}', 'en proceso')">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    Poner en Proceso
                </button>
                <button class="modal-action-btn success" onclick="pedidosApp.showConfirmEstadoModal('${pedido.id}', 'completado')">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Marcar como Completado
                </button>
            `;
    }

    accionesHtml += `
            <button class="modal-action-btn secondary" onclick="pedidosApp.closePedidoModal()">
                Cerrar
            </button>
        `;

    document.getElementById("pedidoEstadoBadge").innerHTML = `
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            ${
              pedido.estado_pedido.charAt(0).toUpperCase() +
              pedido.estado_pedido.slice(1)
            }
            ${
              pedido.estado === "inactivo"
                ? '<span class="ml-2 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded-full">Inactivo</span>'
                : ""
            }
        `;
    document.getElementById(
      "pedidoFecha"
    ).textContent = `Fecha: ${fechaFormateada}`;
    document.getElementById("pedidoId").textContent = pedido.id;
    document.getElementById("pedidoCliente").textContent = pedido.usuario
      ? pedido.usuario.nombre + " " + pedido.usuario.apellido
      : "N/A";
    document.getElementById("pedidoClienteContacto").textContent =
      pedido.usuario ? pedido.usuario.numero : "N/A";
    document.getElementById(
      "pedidoTotal"
    ).textContent = `$ ${pedido.total.toLocaleString()}`;
    document.getElementById("pedidoProductosTable").innerHTML = productosHtml;

    const seguimientoEstado = document.getElementById(
      "currentSeguimientoEstado"
    );
    if (seguimientoEstado) {
      seguimientoEstado.textContent = pedido.seguimiento_estado
        ? pedido.seguimiento_estado.replace("_", " ").title()
        : "Recibido";
      seguimientoEstado.className = `seguimiento-badge seguimiento-${
        pedido.seguimiento_estado
          ? pedido.seguimiento_estado.replace(" ", "-")
          : "recibido"
      }`;
    }

    // MEJORA PROFESIONAL: Mostrar la nota específica del estado actual en el modal.
    // Esto da un contexto más preciso al administrador.
    const historial = pedido.seguimiento_historial || [];
    const estadoActual = pedido.seguimiento_estado || "recibido";
    let notaActual = pedido.notas_seguimiento || "No hay notas de seguimiento"; // Fallback

    // Buscar la última entrada en el historial que coincida con el estado actual del pedido.
    const entradaActual = historial
      .slice()
      .reverse()
      .find((e) => e.estado === estadoActual);
    if (entradaActual && entradaActual.notas) {
      notaActual = entradaActual.notas;
    }

    const seguimientoNotas = document.getElementById("currentSeguimientoNotas");
    if (seguimientoNotas) {
      seguimientoNotas.textContent = notaActual;
    }

    const seguimientoNotasModal = document.getElementById(
      "seguimientoNotasModal"
    );
    if (seguimientoNotasModal) {
      seguimientoNotasModal.value =
        notaActual === "No hay notas de seguimiento" ? "" : notaActual;
    }

    const seguimientoButtons = document.getElementById("seguimientoButtons");
    if (seguimientoButtons) {
      // MEJORA PROFESIONAL: Deshabilitar controles si el pedido está inactivo.
      // ACTUALIZACIÓN: Ya no se deshabilita, solo se aplica un estilo visual.
      const isInactive = pedido.estado === "inactivo";
      seguimientoButtons.innerHTML = this.generateSeguimientoButtons(
        pedido.seguimiento_estado || "recibido",
        isInactive
      );

      // MEJORA: Aplicar una clase para dar una pista visual si el pedido está inactivo,
      // pero sin deshabilitar la funcionalidad.
      const seguimientoModalContainer = document.getElementById(
        "seguimientoModalContainer"
      );
      if (seguimientoModalContainer) {
        if (isInactive) {
          seguimientoModalContainer.classList.add("inactive-order-controls");
        } else {
          seguimientoModalContainer.classList.remove("inactive-order-controls");
          seguimientoModalContainer.removeAttribute("title");
        }
      }
    }

    // MEJORA: Seleccionar el estado actual en el modal al abrirlo para que tenga color y esté pre-seleccionado.
    this.selectSeguimientoEstadoModal(pedido.seguimiento_estado || "recibido");

    this.setupSeguimientoModalUpdate(pedido.id);

    document.getElementById("pedidoAcciones").innerHTML = accionesHtml;

    modal.classList.remove("hidden");
    modalContent.offsetHeight;
  },

  generateSeguimientoButtons: function (currentEstado, isInactive = false) {
    const estados = [
      { value: "recibido", label: "Recibido", icon: "inbox", color: "blue" },
      {
        value: "en preparacion",
        label: "En Preparación",
        icon: "clipboard-list",
        color: "yellow",
      },
      {
        value: "en camino",
        label: "En Camino",
        icon: "truck",
        color: "indigo",
      },
      {
        value: "entregado",
        label: "Entregado",
        icon: "check-circle",
        color: "green",
      },
      {
        value: "cancelado",
        label: "Cancelado",
        icon: "times-circle",
        color: "red",
      },
    ];

    let buttonsHtml = "";

    estados.forEach((estado) => {
      const isActive = currentEstado === estado.value;
      // ACTUALIZACIÓN: La restricción 'isInactive' se elimina para permitir la edición.
      const disabled = isInactive;
      const isFinalState =
        currentEstado === "entregado" || currentEstado === "cancelado";
      const isRevertAction = isFinalState && estado.value !== currentEstado;

      const formattedValue = estado.value.replace(/ /g, "-");

      buttonsHtml += `
                <button class="seguimiento-btn ${isActive ? "active" : ""} ${
        isRevertAction ? "revert-action" : ""
      } seguimiento-btn-${formattedValue}"
                        data-estado="${estado.value}" 
                        onclick="pedidosApp.selectSeguimientoEstadoModal('${
                          estado.value
                        }')"
                        >
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${this.getIconPath(
                          estado.icon
                        )}"></path>
                    </svg>
                    ${estado.label}
                </button>
            `;
    });

    return buttonsHtml;
  },

  getIconPath: function (iconName) {
    const icons = {
      inbox:
        "M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4",
      "clipboard-list":
        "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
      truck:
        "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0",
      "check-circle": "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
      "times-circle":
        "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
    };
    return icons[iconName] || icons["check-circle"];
  },

  selectSeguimientoEstadoModal: function (estado) {
    document
      .querySelectorAll("#seguimientoButtons .seguimiento-btn")
      .forEach((btn) => {
        btn.classList.remove("active");
        if (btn.getAttribute("data-estado") === estado) {
          btn.classList.add("active");
        }
      });

    this.selectedSeguimientoEstadoModal = estado;
  },

  setupSeguimientoModalUpdate: function (pedidoId) {
    const updateBtn = document.getElementById("updateSeguimientoModalBtn");
    if (updateBtn) {
      updateBtn.removeEventListener(
        "click",
        this.seguimientoModalUpdateHandler
      );

      this.seguimientoModalUpdateHandler = () => {
        if (this.selectedSeguimientoEstadoModal) {
          // MEJORA: Leer notas del modal, validar y llamar a la función de actualización.
          const notasTextarea = document.getElementById(
            "seguimientoNotasModal"
          );
          const notas = notasTextarea.value.trim();

          if (!notas) {
            window.toast.error("Las notas de seguimiento son obligatorias.");
            notasTextarea.focus();
            notasTextarea.classList.add("border-red-500", "ring-red-500");
            setTimeout(() => {
              notasTextarea.classList.remove("border-red-500", "ring-red-500");
            }, 3000);
            return;
          }

          // Llamar a updateSeguimiento con un callback para cerrar el modal al éxito.
          this.updateSeguimiento(
            pedidoId,
            this.selectedSeguimientoEstadoModal,
            notas,
            () => this.closePedidoModal()
          );
        } else {
          window.toast.warning(
            "Por favor, selecciona un estado de seguimiento"
          );
        }
      };

      updateBtn.addEventListener("click", this.seguimientoModalUpdateHandler);
    }
  },

  updateEstado: function (pedidoId, nuevoEstado) {
    if (this.isLoading) return;

    this.isLoading = true;
    fetch(`/admin/api/pedidos/${pedidoId}/estado`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken":
          document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content") || "",
      },
      body: JSON.stringify({ estado: nuevoEstado }),
    })
      .then((response) => response.json())
      .then((data) => {
        this.isLoading = false;
        if (data.success) {
          window.toast.success(data.message);

          const estadoVistaActual = this.getEstadoFromView();
          // Si el nuevo estado del pedido es diferente al de la vista actual,
          // el pedido debe desaparecer de la tabla.
          if (nuevoEstado !== estadoVistaActual) {
            const pedidoRow = document.querySelector(
              `tr[data-pedido-id="${pedidoId}"]`
            );
            if (pedidoRow) {
              // Animar la eliminación de la fila para una mejor UX
              pedidoRow.style.transition =
                "opacity 0.5s ease, transform 0.5s ease";
              pedidoRow.style.opacity = "0";
              pedidoRow.style.transform = "translateX(-20px)";
              setTimeout(() => this.loadPedidos(), 500); // Recargar después de la animación
            } else {
              this.loadPedidos(); // Recargar si la fila no se encuentra
            }
          } else {
            // Si el estado no cambia la pertenencia a la vista (ej. de inactivo a activo),
            // simplemente recargamos para mostrar los datos actualizados.
            this.loadPedidos();
          }
        } else {
          window.toast.error(data.message || "Error al actualizar estado");
        }
      })
      .catch((error) => {
        console.error("Error al actualizar estado del pedido:", error);
        window.toast.error("Error al actualizar estado del pedido");
        this.isLoading = false;
      });
  },
  
  //  La función ahora acepta un parámetro `loadData` (por defecto true).
  // Esto permite limpiar los campos de los filtros sin necesariamente disparar una recarga
  // de datos, lo que es útil al cambiar de pestaña, donde la recarga se maneja por separado.
  clearFilters: function (loadData = true) {
    document.getElementById("pedidoIdFilter").value = "";
    document.getElementById("clienteFilter").value = "";
    document.getElementById("fechaInicioFilter").value = "";
    document.getElementById("fechaFinFilter").value = "";
    document.getElementById("sortFilter").value = "created_at";
    document.getElementById("statusFilter").value = "all";
    
    if (loadData) {
        this.loadPedidos();
    }
  },

  showInactiveOrderMessage: function () {
    window.toast.warning(
      "No se puede realizar esta acción en un pedido inactivo. Por favor, actívelo primero."
    );
  },

  setupEventListeners: function () {
    // Usar delegación de eventos en un contenedor estático (document)
    // Esto es más robusto para SPAs y evita problemas de listeners duplicados.

    // --- Delegación para la sección de SEGUIMIENTO ---
    document.body.removeEventListener("click", this._handleSeguimientoClick);
    this._handleSeguimientoClick = (e) => {
      // MEJORA PROFESIONAL: Hacer el selector específico para los botones de la sección principal.
      // Esto evita que este listener se dispare para los botones del modal, que tienen su propio `onclick`.
      const mainSeguimientoBtn = e.target.closest(
        "#mainSeguimientoButtons .seguimiento-btn"
      );
      if (mainSeguimientoBtn) {
        const estado = mainSeguimientoBtn.getAttribute("data-estado");
        this.selectSeguimientoEstado(estado);
        return;
      }

      const updateBtn = e.target.closest("#updateSeguimientoBtn");
      if (updateBtn) {
        if (this.selectedPedidoId && this.selectedSeguimientoEstado) {
          const notasTextarea = document.getElementById("seguimientoNotas");
          const notas = notasTextarea.value.trim();

          if (!notas) {
            window.toast.error("Las notas de seguimiento son obligatorias.");
            notasTextarea.focus();
            notasTextarea.classList.add("border-red-500", "ring-red-500");
            setTimeout(() => {
              notasTextarea.classList.remove("border-red-500", "ring-red-500");
            }, 3000);
            return;
          }
          this.updateSeguimiento(
            this.selectedPedidoId,
            this.selectedSeguimientoEstado,
            notas
          );
        } else {
          window.toast.warning(
            "Por favor, selecciona un pedido y un estado de seguimiento"
          );
        }
        return;
      }

      const refreshBtn = e.target.closest("#refreshSeguimientoBtn");
      if (refreshBtn) {
        if (this.selectedPedidoId) {
          this.loadSeguimientoData(this.selectedPedidoId);
          window.toast.success("Datos de seguimiento actualizados");
        } else {
          window.toast.warning("Por favor, selecciona un pedido");
        }
        return;
      }
    };
    document.body.addEventListener("click", this._handleSeguimientoClick);

    document.body.removeEventListener("change", this._handleSeguimientoChange);
    this._handleSeguimientoChange = (e) => {
      if (e.target.id === "pedidoSeguimientoSelect") {
        const selectedOption = e.target.options[e.target.selectedIndex];
        if (selectedOption.value) {
          this.selectedPedidoId = selectedOption.value;
          this.loadSeguimientoData(selectedOption.value);
          document
            .getElementById("seguimientoContent")
            ?.classList.remove("hidden");
          document.getElementById("noPedidosMessage")?.classList.add("hidden");
        } else {
          this.closeSeguimientoSection();
        }
      }
    };
    document.body.addEventListener("change", this._handleSeguimientoChange);

    // Tabs para estados de pedido - MEJORADO PARA CERRAR SEGUIMIENTO AL CAMBIAR DE TAB
    document.querySelectorAll(".tab-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        const btn = e.currentTarget;
        document.querySelectorAll(".tab-btn").forEach((b) => {
          b.classList.remove("active", "border-blue-500", "text-blue-600");
          b.classList.add("border-transparent", "text-gray-500");
        });
        btn.classList.add("active", "border-blue-500", "text-blue-600");
        btn.classList.remove("border-transparent", "text-gray-500");

        // MEJORA PROFESIONAL: Limpiar los filtros al cambiar de pestaña.
        // Se llama a clearFilters(false) para resetear los campos del formulario
        // sin disparar una recarga extra, ya que loadPedidos() se llama justo después.
        this.clearFilters(false);
        // Cerrar la sección de seguimiento al cambiar de tab
        this.closeSeguimientoSection();

        this.currentEstado = btn.getAttribute("data-estado");

        let newPath = "/admin/lista-pedidos";
        if (this.currentEstado === "completados") {
          newPath += "/completados";
        } else if (this.currentEstado === "cancelados") {
          newPath += "/cancelados";
        }

        window.history.pushState({}, "", newPath);
        this.loadPedidos();
      });
    });

    const itemsPerPageSelect = document.getElementById("itemsPerPage");
    if (itemsPerPageSelect) {
      itemsPerPageSelect.addEventListener("change", (e) => {
        this.itemsPerPage = parseInt(e.target.value);
        this.loadPedidos();
      });
    }

    let debounceTimeout;
    const debounceLoadData = () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        this.loadPedidos();
      }, 500);
    };

    const pedidoIdFilterInput = document.getElementById("pedidoIdFilter");
    if (pedidoIdFilterInput) {
      pedidoIdFilterInput.addEventListener("keyup", debounceLoadData);
    };

    const clienteFilterInput = document.getElementById("clienteFilter");
    if (clienteFilterInput) {
      clienteFilterInput.addEventListener("keyup", debounceLoadData);
    }

    const fechaInicioFilterInput = document.getElementById("fechaInicioFilter");
    if (fechaInicioFilterInput) {
      fechaInicioFilterInput.addEventListener("change", () =>
        this.loadPedidos()
      );
    }

    const fechaFinFilterInput = document.getElementById("fechaFinFilter");
    if (fechaFinFilterInput) {
      fechaFinFilterInput.addEventListener("change", () => this.loadPedidos());
    }

    const sortFilterInput = document.getElementById("sortFilter");
    if (sortFilterInput) {
      sortFilterInput.addEventListener("change", () => this.loadPedidos());
    }

    const statusFilterInput = document.getElementById("statusFilter");
    if (statusFilterInput) {
      statusFilterInput.addEventListener("change", () => this.loadPedidos());
    }

    const clearFiltersBtn = document.getElementById("clearFilters");
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", () => {
        this.clearFilters();
      });
    }

    const clearFiltersViewBtn = document.getElementById("clearFiltersViewBtn");
    if (clearFiltersViewBtn) {
      clearFiltersViewBtn.addEventListener("click", () => {
        this.clearFilters();
      });
    }

    const closePedidoModal = document.getElementById("closePedidoModal");
    if (closePedidoModal) {
      closePedidoModal.addEventListener("click", () => {
        this.closePedidoModal();
      });
    }

    const closeConfirmEstadoModal = document.getElementById(
      "closeConfirmEstadoModal"
    );
    if (closeConfirmEstadoModal) {
      closeConfirmEstadoModal.addEventListener("click", () => {
        this.closeConfirmEstadoModal();
      });
    }

    const confirmUpdateEstado = document.getElementById("confirmUpdateEstado");
    if (confirmUpdateEstado) {
      confirmUpdateEstado.addEventListener("click", () => {
        this.confirmUpdateEstado();
      });
    }

    const cancelConfirmEstado = document.getElementById("cancelConfirmEstado");
    if (cancelConfirmEstado) {
      cancelConfirmEstado.addEventListener("click", () => {
        this.closeConfirmEstadoModal();
      });
    }

    const modal = this.elements.pedidoModal;
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          this.closePedidoModal();
        }
      });
    }

    const confirmModal = this.elements.confirmEstadoModal;
    if (confirmModal) {
      confirmModal.addEventListener("click", (e) => {
        if (e.target === confirmModal) {
          this.closeConfirmEstadoModal();
        }
      });
    }

    document.addEventListener("seguimiento-changed", (event) => {
      const { pedidoId, nuevoEstado } = event.detail;
      this.updatePedidoSeguimientoInTable(pedidoId, nuevoEstado);
    });

    document.addEventListener("pedido-estado-changed", (event) => {
      const { pedidoId, nuevoEstado } = event.detail;
      this.loadPedidos();
    });
  },

  closePedidoModal: function () {
    const modal = this.elements.pedidoModal;
    const modalContent = this.elements.pedidoModalContent;

    if (modal && modalContent) {
      modalContent.classList.add("closing");
      setTimeout(() => {
        modal.classList.add("hidden");
        modalContent.classList.remove("closing");
      }, 300);
    }
  },
};

function toggleFilters() {
  const panel = document.getElementById("filtersPanel");
  const overlay = document.getElementById("overlay");
  panel.classList.toggle("translate-x-full");
  overlay.classList.toggle("hidden");
  if (!panel.classList.contains("translate-x-full")) {
    document.body.classList.add("no-scroll");
  } else {
    document.body.classList.remove("no-scroll");
  }
}

window.crearPedidoApp = {
  pedido: {
    usuario_id: null,
    productos: [],
  },

  elements: {},
  isEditMode: false,
  editingPedidoId: null,
  submitUrl: '/admin/api/pedidos', // URL por defecto para la creación
  isVentaMode: false, // Flag para saber si estamos creando una venta

  init: function () {
    this.cacheElements();
    this.setupEventListeners();
  },

  cacheElements: function () {
    this.elements.modal = document.getElementById("crearPedidoModal");
    this.elements.modalContent = this.elements.modal.querySelector(".bg-white");
    this.elements.customerSearchInput = document.getElementById(
      "customerSearchInput"
    );
    this.elements.customerSearchResults = document.getElementById(
      "customerSearchResults"
    );
    this.elements.selectedCustomer =
      document.getElementById("selectedCustomer");
    this.elements.selectedCustomerName = document.getElementById(
      "selectedCustomerName"
    );
    this.elements.selectedCustomerId =
      document.getElementById("selectedCustomerId");
    this.elements.removeSelectedCustomer = document.getElementById(
      "removeSelectedCustomer"
    );
    this.elements.productSearchInput =
      document.getElementById("productSearchInput");
    this.elements.productSearchResults = document.getElementById(
      "productSearchResults"
    );
    this.elements.pedidoItemsTableBody = document.getElementById(
      "pedidoItemsTableBody"
    );
    this.elements.noItemsRow = document.getElementById("noItemsRow");
    this.elements.pedidoTotal = document.getElementById("crearPedidoTotal");
    this.elements.pedidoForm = document.getElementById("pedidoForm");
    this.elements.savePedidoBtn = document.getElementById("savePedidoBtn");
    this.elements.cancelPedidoBtn = document.getElementById("cancelPedidoBtn");
    this.elements.closePedidoModalBtn = document.getElementById(
      "closePedidoModalBtn"
    );
    this.elements.pedidoModalTitle =
      document.getElementById("pedidoModalTitle");
  },

  setupEventListeners: function () {
    this.elements.customerSearchInput.addEventListener(
      "input",
      this.debounce(this.searchCustomers.bind(this), 300)
    );
    this.elements.customerSearchResults.addEventListener(
      "click",
      this.selectCustomer.bind(this)
    );
    this.elements.removeSelectedCustomer.addEventListener(
      "click",
      this.removeSelectedCustomer.bind(this)
    );
    this.elements.productSearchInput.addEventListener(
      "input",
      this.debounce(this.searchProducts.bind(this), 300)
    );
    this.elements.productSearchResults.addEventListener(
      "click",
      this.selectProduct.bind(this)
    );
    this.elements.pedidoForm.addEventListener(
      "submit",
      this.submitPedido.bind(this)
    );
    this.elements.cancelPedidoBtn.addEventListener(
      "click",
      this.closeModal.bind(this)
    );
    this.elements.closePedidoModalBtn.addEventListener(
      "click",
      this.closeModal.bind(this)
    );
    this.elements.modal.addEventListener("click", (e) => {
      if (e.target === this.elements.modal) {
        this.closeModal();
      }
    });
    document.addEventListener("click", this.handleOutsideClick.bind(this));
  },

  handleOutsideClick: function (event) {
    if (
      !this.elements.customerSearchInput.contains(event.target) &&
      !this.elements.customerSearchResults.contains(event.target)
    ) {
      this.elements.customerSearchResults.classList.add("hidden");
    }

    if (
      !this.elements.productSearchInput.contains(event.target) &&
      !this.elements.productSearchResults.contains(event.target)
    ) {
      this.elements.productSearchResults.classList.add("hidden");
    }
  },

  openModal: function () {
    this.isEditMode = false;
    this.editingPedidoId = null;

    this.pedido = {
      usuario_id: null,
      productos: [],
    };
    this.elements.customerSearchInput.value = "";
    this.elements.productSearchInput.value = "";
    this.elements.selectedCustomer.classList.add("hidden");
    this.renderPedidoItems();
    this.updateTotal();

    this.elements.pedidoModalTitle.textContent = "Crear Nuevo Pedido";
    this.elements.savePedidoBtn.textContent = "Guardar Pedido";

    this.elements.modal.classList.remove("hidden");
  },

  openModalForEdit: function (pedido) {
    this.isEditMode = true;
    this.editingPedidoId = pedido.id;

    this.pedido.usuario_id = pedido.usuario.id;
    this.elements.selectedCustomerId.value = pedido.usuario.id;
    this.elements.selectedCustomerName.textContent = pedido.usuario
      ? pedido.usuario.nombre + " " + pedido.usuario.apellido
      : "N/A";
    this.elements.selectedCustomer.classList.remove("hidden");

    this.pedido.productos = [];
    if (pedido.productos && pedido.productos.length > 0) {
      pedido.productos.forEach((item) => {
        this.pedido.productos.push({
          id: item.producto_id,
          nombre: item.producto_nombre,
          precio: item.precio_unitario,
          existencia: item.producto_existencia || 0,
          cantidad: item.cantidad,
        });
      });
    }

    this.renderPedidoItems();
    this.updateTotal();

    this.elements.pedidoModalTitle.textContent = "Editar Pedido";
    this.elements.savePedidoBtn.textContent = "Actualizar Pedido";

    this.elements.modal.classList.remove("hidden");
  },

  searchCustomers: function () {
    const query = this.elements.customerSearchInput.value.trim();
    if (query.length < 2) {
      this.elements.customerSearchResults.classList.add("hidden");
      return;
    }

    fetch(`/admin/api/usuarios-registrados?q=${encodeURIComponent(query)}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success && data.usuarios) {
          this.renderCustomerResults(data.usuarios);
        } else {
          this.showNoResultsMessage(
            this.elements.customerSearchResults,
            "No se encontraron clientes que coincidan con la búsqueda"
          );
        }
      })
      .catch((error) => {
        console.error("Error al buscar clientes:", error);
        this.showNoResultsMessage(
          this.elements.customerSearchResults,
          "Error al buscar clientes"
        );
      });
  },

  renderCustomerResults: function (usuarios) {
    if (!usuarios || usuarios.length === 0) {
      this.showNoResultsMessage(
        this.elements.customerSearchResults,
        "No se encontraron clientes que coincidan con la búsqueda"
      );
      return;
    }

    let html = "";
    usuarios.forEach((usuario) => {
      html += `
                <div class="search-result-item customer-result-item" data-id="${usuario.id}" data-name="${usuario.nombre} ${usuario.apellido}">
                    <div class="search-result-info">
                        <div class="search-result-name">${usuario.nombre} ${usuario.apellido}</div>
                        <div class="search-result-detail">${usuario.numero}</div>
                    </div>
                </div>
            `;
    });

    this.elements.customerSearchResults.innerHTML = html;
    this.elements.customerSearchResults.classList.remove("hidden");
    this.elements.customerSearchResults.classList.add("search-dropdown");
  },

  showNoResultsMessage: function (container, message) {
    container.innerHTML = `<div class="no-results">${message}</div>`;
    container.classList.remove("hidden");
    container.classList.add("search-dropdown");
  },

  selectCustomer: function (event) {
    const item = event.target.closest(".customer-result-item");
    if (!item) return;

    const id = item.getAttribute("data-id");
    const name = item.getAttribute("data-name");

    this.pedido.usuario_id = id;
    this.elements.selectedCustomerId.value = id;
    this.elements.selectedCustomerName.textContent = name;
    this.elements.selectedCustomer.classList.remove("hidden");
    this.elements.customerSearchResults.classList.add("hidden");
    this.elements.customerSearchInput.value = "";
  },

  removeSelectedCustomer: function () {
    this.pedido.usuario_id = null;
    this.elements.selectedCustomerId.value = "";
    this.elements.selectedCustomer.classList.add("hidden");
  },

  searchProducts: function () {
    const query = this.elements.productSearchInput.value.trim();
    if (query.length < 2) {
      this.elements.productSearchResults.classList.add("hidden");
      return;
    }

    let url = `/admin/api/productos/search?q=${encodeURIComponent(query)}`;
    if (this.isEditMode && this.editingPedidoId) {
      url += `&pedido_id=${this.editingPedidoId}`;
    }

    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        if (data.success && data.productos) {
          this.renderProductResults(data.productos);
        } else {
          this.showNoResultsMessage(
            this.elements.productSearchResults,
            "No se encontraron productos que coincidan con la búsqueda"
          );
        }
      })
      .catch((error) => {
        console.error("Error al buscar productos:", error);
        this.showNoResultsMessage(
          this.elements.productSearchResults,
          "Error al buscar productos"
        );
      });
  },

  renderProductResults: function (productos) {
    if (!productos || productos.length === 0) {
      this.showNoResultsMessage(
        this.elements.productSearchResults,
        "No se encontraron productos que coincidan con la búsqueda"
      );
      return;
    }

    let html = "";
    productos.forEach((producto) => {
      html += `
                <div class="search-result-item product-result-item" 
                     data-id="${producto.id}" 
                     data-nombre="${producto.nombre}" 
                     data-precio="${producto.precio}"
                     data-existencia="${producto.existencia || 0}"
                     data-imagen="${producto.imagen_url || ""}">
                    <div class="search-result-image">
                        ${
                          producto.imagen_url
                            ? `<img class="h-10 w-10 rounded-full object-cover" src="${producto.imagen_url}" alt="${producto.nombre}">`
                            : '<div class="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center"><span class="text-xs text-gray-500">IMG</span></div>'
                        }
                    </div>
                    <div class="search-result-info">
                        <div class="search-result-name">${producto.nombre}</div>
                        <div class="search-result-detail">$ ${producto.precio.toLocaleString()} - Stock: ${
        producto.existencia || 0
      }</div>
                    </div>
                </div>
            `;
    });

    this.elements.productSearchResults.innerHTML = html;
    this.elements.productSearchResults.classList.remove("hidden");
    this.elements.productSearchResults.classList.add("search-dropdown");
  },

  selectProduct: function (event) {
    const item = event.target.closest(".product-result-item");
    if (!item) return;

    const id = item.getAttribute("data-id");
    const nombre = item.getAttribute("data-nombre");
    const precio = parseFloat(item.getAttribute("data-precio"));
    const existencia = parseInt(item.getAttribute("data-existencia")) || 0;

    const existingItem = this.pedido.productos.find((p) => p.id === id);
    if (existingItem) {
      existingItem.cantidad = Math.min(existingItem.cantidad + 1, existencia);
    } else {
      this.pedido.productos.push({
        id: id,
        nombre: nombre,
        precio: precio,
        existencia: existencia,
        cantidad: 1,
      });
    }

    this.renderPedidoItems();
    this.updateTotal();
    this.elements.productSearchResults.classList.add("hidden");
    this.elements.productSearchInput.value = "";
  },

  renderPedidoItems: function () {
    if (this.pedido.productos.length === 0) {
      this.elements.noItemsRow.classList.remove("hidden");
      const rows = this.elements.pedidoItemsTableBody.querySelectorAll(
        "tr:not(#noItemsRow)"
      );
      rows.forEach((row) => row.remove());
    } else {
      this.elements.noItemsRow.classList.add("hidden");

      const rows = this.elements.pedidoItemsTableBody.querySelectorAll(
        "tr:not(#noItemsRow)"
      );
      rows.forEach((row) => row.remove());

      this.pedido.productos.forEach((producto, index) => {
        const subtotal = producto.precio * producto.cantidad;
        const row = document.createElement("tr");
        row.innerHTML = `
                    <td class="px-4 py-3">
                        <div class="font-medium">${producto.nombre}</div>
                        <div class="text-xs text-gray-500">Stock disponible: ${
                          producto.existencia
                        }</div>
                    </td>
                    <td class="px-4 py-3">
                        $ ${producto.precio.toLocaleString()}
                    </td>
                    <td class="px-4 py-3">
                        <input type="number" min="1" max="${
                          producto.existencia
                        }" value="${producto.cantidad}" 
                               class="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                               data-index="${index}" onchange="crearPedidoApp.updateCantidad(${index}, this.value)">
                    </td>
                    <td class="px-4 py-3">
                        $ ${subtotal.toLocaleString()}
                    </td>
                    <td class="px-4 py-3 text-right">
                        <button type="button" class="text-red-500 hover:text-red-700" onclick="crearPedidoApp.removeProducto(${index})">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                `;
        this.elements.pedidoItemsTableBody.appendChild(row);
      });
    }

    this.updateTotal();
  },

  updateCantidad: function (index, newCantidad) {
    const cantidad = parseInt(newCantidad);
    const producto = this.pedido.productos[index];

    if (isNaN(cantidad) || cantidad < 1) {
      this.renderPedidoItems();
      return;
    }

    if (cantidad > producto.existencia) {
      producto.cantidad = producto.existencia;
      window.toast.warning(
        `La cantidad máxima disponible para ${producto.nombre} es ${producto.existencia}`
      );
    } else {
      producto.cantidad = cantidad;
    }

    this.renderPedidoItems();
    this.updateTotal();
  },

  removeProducto: function (index) {
    this.pedido.productos.splice(index, 1);
    this.renderPedidoItems();
    this.updateTotal();
  },

  updateTotal: function () {
    const total = this.pedido.productos.reduce((sum, producto) => {
      return sum + producto.precio * producto.cantidad;
    }, 0);

    if (this.elements.pedidoTotal) {
      this.elements.pedidoTotal.textContent = `$ ${total.toLocaleString()}`;
    }
  },

  submitPedido: function (event) {
    event.preventDefault();

    if (!this.pedido.usuario_id) {
      window.toast.error("Por favor, selecciona un cliente");
      return;
    }

    if (this.pedido.productos.length === 0) {
      window.toast.error("Por favor, agrega al menos un producto");
      return;
    }

    const data = {
      usuario_id: this.pedido.usuario_id,
      productos: this.pedido.productos.map((p) => ({
        id: p.id,
        cantidad: p.cantidad,
        precio: p.precio,
      })),
    };

    let url = this.submitUrl; // Usar la URL configurable
    let method = "POST";
    let successMessage = this.isVentaMode ? "Venta creada exitosamente" : "Pedido creado exitosamente";

    if (this.isEditMode) {
      url = `/admin/api/pedidos/${this.editingPedidoId}`;
      method = "PUT";
      successMessage = "Pedido actualizado exitosamente";
    }

    fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken":
          document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content") || "",
      },
      body: JSON.stringify(data),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          window.toast.success(successMessage);
          this.closeModal();
          // MEJORA PROFESIONAL: Determinar qué vista recargar.
          if (this.isVentaMode && window.VentasPageModule) {
            // Si se creó una venta, recargar el módulo de ventas.
            window.VentasPageModule.loadEstadisticas(); // Actualiza solo las estadísticas y el gráfico.
            window.VentasPageModule.loadVentas(1, window.VentasPageModule.currentPerPage, true); // Actualiza la tabla de ventas.
          } else if (!this.isVentaMode && window.pedidosApp) {
            // Si se creó/editó un pedido, recargar el módulo de pedidos.
            window.pedidosApp.loadPedidos();
          } else {
            window.location.reload();
          }
        } else {
          window.toast.error(data.message || "Error al procesar el pedido");
        }
      })
      .catch((error) => {
        console.error("Error al procesar el pedido:", error);
        window.toast.error("Error al procesar el pedido");
      });
  },

  closeModal: function () {
    this.elements.modal.classList.add("hidden");
    this.isEditMode = false;
    this.editingPedidoId = null;
    this.pedido = {
      usuario_id: null,
      productos: [],
    };
    this.elements.customerSearchInput.value = "";
    this.elements.productSearchInput.value = "";
    this.elements.selectedCustomer.classList.add("hidden");
    this.renderPedidoItems();
    this.updateTotal();
  },

  debounce: function (func, wait) {
    let timeout;
    return function (...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  },
};

function initializePedidosApp() {
  console.log("Running initializePedidosApp...");

  // MEJORA PROFESIONAL: Verificación de contexto para SPA.
  // Antes de inicializar, nos aseguramos de que estamos en la página de pedidos
  // buscando un elemento clave que solo existe en `lista_pedidos.html`.
  if (!document.getElementById("pedidosTableBody")) {
    console.log("Not on the pedidos page. Skipping initialization.");
    return; // Salir si no estamos en la página correcta.
  }

  let paginationData = {};
  const paginationScript = document.getElementById("pagination-data");
  if (paginationScript) {
    try {
      paginationData = JSON.parse(paginationScript.textContent);
    } catch (e) {
      console.error("Error parsing pagination data", e);
    }
  }

  if (typeof pedidosApp !== "undefined") {
    pedidosApp.init(paginationData);
  }

  // El objeto crearPedidoApp ahora se inicializa desde su propio script,
  // por lo que no es necesario inicializarlo aquí. Solo nos aseguramos
  // de que el botón de "Agregar Pedido" funcione correctamente.
  if (typeof crearPedidoApp !== "undefined") {
    crearPedidoApp.init();

    // Re-adjuntar el listener del botón de "Agregar Pedido" para evitar duplicados en SPA.
    // Ya no es necesario con delegación de eventos, pero lo mantenemos por si crearPedidoApp tiene su propia lógica.
    document
      .getElementById("addPedidoBtn")
      ?.addEventListener("click", () => crearPedidoApp.openModal());
  }
}

const runPedidosInitialization = () => {
  // La función `initializePedidosApp` ya tiene una guardia de contexto, por lo que es seguro llamarla.
  initializePedidosApp();
};

const destroyPedidosModule = () => {
    // Aunque pedidosApp no tiene timers, es una buena práctica tener una función de limpieza.
    // Si en el futuro se añaden, se colocarían aquí.
    if (window.pedidosApp && window.pedidosApp.initialized) {
        console.log("Destroying PedidosApp module (placeholder).");
        window.pedidosApp.initialized = false; // Marcar como no inicializado.
    }
};

// --- MEJORA PROFESIONAL: GESTIÓN DEL CICLO DE VIDA SPA ---
document.addEventListener("content-will-load", destroyPedidosModule);
document.addEventListener("content-loaded", runPedidosInitialization);

// Para la carga inicial de la página (no SPA).
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runPedidosInitialization);
} else {
  runPedidosInitialization();
}
