document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    let currentTab = 'pedidos';
    let currentView = {
        'pedidos': 'tabla',
        'productos-comprados': 'tabla',
        'productos-frecuentes': 'tabla'
    };
    let currentPage = {
        'pedidos': 1,
        'productos-comprados': 1,
        'productos-frecuentes': 1,
        'reseñas': 1
    };
    let filters = {
        'pedidos': {
            search: '',
            estado: '',
            fecha_inicio: '',
            fecha_fin: ''
        },
        'productos-comprados': {
            search: '',
            categoria: '',
            orden: 'veces_comprado'
        },
        'productos-frecuentes': {
            search: '',
            categoria: '',
            orden: 'veces_comprado'
        },
        'reseñas': {
            search: '',
            calificacion: '',
            orden: 'fecha'
        }
    };
    
    // CORRECCIÓN: Obtener el ID de usuario correctamente. El ID es el penúltimo segmento de la URL.
    const pathParts = window.location.pathname.split('/');
    const usuarioId = pathParts[pathParts.length - 2];
    
    // MEJORA: Almacenar instancias de gráficos para poder destruirlas antes de volver a dibujar.
    let categoriasChartInstance = null;
    let tendenciaChartInstance = null;

    // Sistema de Tabs
    document.querySelectorAll('[data-tab]').forEach(tab => {
        tab.addEventListener('click', function() {
            // Remover active de todos los tabs
            document.querySelectorAll('[data-tab]').forEach(t => {
                t.classList.remove('active', 'text-blue-600', 'bg-blue-50');
                t.classList.add('text-gray-500');
            });
            
            // Agregar active al tab actual
            this.classList.add('active', 'text-blue-600', 'bg-blue-50');
            this.classList.remove('text-gray-500');
            
            // Ocultar todos los contenidos
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.add('hidden');
            });
            
            // Mostrar el contenido actual
            const target = this.getAttribute('data-tab');
            document.getElementById(target + '-content').classList.remove('hidden');
            
            // Actualizar tab actual
            currentTab = target;
            
            // Cargar datos si es necesario
            if (target === 'pedidos') {
                loadPedidos();
            } else if (target === 'productos-comprados') {
                loadProductosComprados();
            } else if (target === 'productos-frecuentes') {
                loadProductosFrecuentes();
            } else if (target === 'reseñas') {
                loadReseñas();
            }
        });
    });

    // Sistema de Vista (Tabla/Carta)
    document.querySelectorAll('.vista-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const vista = this.getAttribute('data-vista');
            const target = this.getAttribute('data-target');
            
            // Remover active de todos los botones del mismo grupo
            document.querySelectorAll(`[data-target="${target}"].vista-btn`).forEach(b => {
                b.classList.remove('active', 'bg-blue-600', 'text-white');
                b.classList.add('text-gray-700', 'hover:bg-gray-200');
            });
            
            // Agregar active al botón actual
            this.classList.add('active', 'bg-blue-600', 'text-white');
            this.classList.remove('text-gray-700', 'hover:bg-gray-200');
            
            // Ocultar todas las vistas del mismo grupo
            document.querySelectorAll(`#${target}-tabla, #${target}-carta`).forEach(panel => {
                panel.classList.add('hidden');
            });
            
            // Mostrar la vista actual
            document.getElementById(`${target}-${vista}`).classList.remove('hidden');
            
            // Actualizar vista actual
            currentView[target] = vista;
            
            // Recargar datos si es necesario
            if (target === 'pedidos') {
                loadPedidos();
            } else if (target === 'productos-comprados') {
                loadProductosComprados();
            } else if (target === 'productos-frecuentes') {
                loadProductosFrecuentes();
            }
        });
    });

    // Sistema de Filtros para Pedidos
    document.querySelectorAll('.filter-button').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault(); // Prevenir cualquier comportamiento por defecto
            const estado = this.getAttribute('data-filter');
    
            // Remover active de todos los botones de filtro
            document.querySelectorAll('.filter-button').forEach(b => {
                b.classList.remove('active', 'bg-blue-600', 'text-white', 'shadow-md');
                b.classList.add('bg-white', 'border', 'border-gray-300', 'hover:bg-gray-50');
            });
    
            // Agregar active al botón actual
            this.classList.add('active');
            this.classList.remove('bg-white', 'border', 'border-gray-300', 'hover:bg-gray-50');
            this.classList.add('bg-blue-600', 'text-white', 'shadow-md');
    
            // MEJORA PROFESIONAL: Unificar la lógica de filtrado.
            // El botón rápido actualiza el dropdown Y el estado del filtro.
            // CORRECCIÓN FINAL: El backend espera el valor con espacio (ej. 'en proceso').
            // El HTML ahora proporciona este valor directamente.
            filters.pedidos.estado = (estado === 'todos') ? '' : estado; 
            console.log(`[Filtro Rápido] Estado cambiado a: '${filters.pedidos.estado}'`);
            document.getElementById('filter-estado').value = filters.pedidos.estado;
            
            // Aplicamos el filtro inmediatamente para una mejor experiencia de usuario.
            currentPage.pedidos = 1;
            loadPedidos();
        });
    });

    // Aplicar Filtros
    document.getElementById('apply-filters').addEventListener('click', function() {
        // MEJORA: Leer todos los filtros y asignarlos al estado.
        filters.pedidos.search = document.getElementById('search-pedido').value;
        filters.pedidos.estado = document.getElementById('filter-estado').value;
        filters.pedidos.fecha_inicio = document.getElementById('filter-fecha-inicio').value;
        filters.pedidos.fecha_fin = document.getElementById('filter-fecha-fin').value;
        console.log('[Aplicar Filtros] Estado actual de los filtros:', JSON.stringify(filters.pedidos));

        // Sincronizar el botón rápido con el estado del dropdown para consistencia visual.
        document.querySelectorAll('.filter-button').forEach(b => {
            b.classList.remove('active', 'bg-blue-600', 'text-white', 'shadow-md');
            b.classList.add('bg-white', 'border', 'border-gray-300', 'hover:bg-gray-50');
        });
        const activeFilterButton = document.querySelector(`.filter-button[data-filter="${filters.pedidos.estado || 'todos'}"]`);
        if (activeFilterButton) {
            activeFilterButton.classList.add('active', 'bg-blue-600', 'text-white', 'shadow-md');
            activeFilterButton.classList.remove('bg-white', 'border', 'border-gray-300', 'hover:bg-gray-50');
        }

        // Resetear página actual
        currentPage.pedidos = 1;
        // Recargar datos
        loadPedidos();
    });

    // Restablecer Filtros
    document.getElementById('reset-filters').addEventListener('click', function() {
        document.getElementById('search-pedido').value = '';
        document.getElementById('filter-estado').value = '';
        document.getElementById('filter-fecha-inicio').value = '';
        document.getElementById('filter-fecha-fin').value = '';
        
        // Resetear filtros
        filters.pedidos = {
            search: '',
            estado: '',
            fecha_inicio: '',
            fecha_fin: ''
        };
        
        // Resetear página actual
        currentPage.pedidos = 1;
        
        // Resetear botones de filtro
        document.querySelectorAll('.filter-button').forEach(b => {
            b.classList.remove('active', 'bg-blue-600', 'text-white', 'shadow-md');
            b.classList.add('bg-white', 'border', 'border-gray-300', 'hover:bg-gray-50');
        });
        const todosButton = document.querySelector('.filter-button[data-filter="todos"]');
        todosButton.classList.add('active', 'bg-blue-600', 'text-white', 'shadow-md');
        todosButton.classList.remove('bg-white', 'border', 'border-gray-300', 'hover:bg-gray-50');
        
        // Recargar datos
        loadPedidos();
    });

    // Botones de período para gráfico de tendencia
    document.querySelectorAll('.periodo-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Remover active de todos los botones
            document.querySelectorAll('.periodo-btn').forEach(b => {
                b.classList.remove('bg-blue-600', 'text-white');
                b.classList.add('bg-gray-100', 'text-gray-700');
            });
            
            // Agregar active al botón actual
            this.classList.add('bg-blue-600', 'text-white');
            this.classList.remove('bg-gray-100', 'text-gray-700');
            
            // Actualizar gráfico
            const periodo = this.getAttribute('data-periodo');
            loadTendenciaChart(periodo);
        });
    });

    // Función para cargar pedidos
    function loadPedidos() {
        const view = currentView['pedidos'];
        const page = currentPage['pedidos'];
        const f = filters['pedidos'];
        
        // Construir URL con parámetros
        // MEJORA: Se unifica el filtro de estado a un solo parámetro 'estado'.
        let url = `/api/usuarios/${usuarioId}/pedidos?page=${page}`;
        if (f.search) url += `&search=${encodeURIComponent(f.search)}`;
        if (f.estado) url += `&estado=${encodeURIComponent(f.estado)}`;
        if (f.fecha_inicio) url += `&fecha_inicio=${encodeURIComponent(f.fecha_inicio)}`;
        if (f.fecha_fin) url += `&fecha_fin=${encodeURIComponent(f.fecha_fin)}`;

        console.log(`[loadPedidos] Realizando petición a: ${url}`);
        
        // Mostrar indicador de carga
        // MEJORA PROFESIONAL: Implementar esqueletos de carga (skeletons) para una mejor UX.
        // En lugar de un contenedor vacío, el usuario ve una estructura que simula el contenido final.
        const skeletonRows = 5;
        const skeletonCols = 6;
        renderSkeleton(view, 'pedidos', skeletonRows, skeletonCols);
        
        // Realizar petición fetch
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('[loadPedidos] Datos recibidos:', data);
                    //  La lógica de paginación se mueve aquí para que funcione en ambas vistas.
                    // MEJORA PROFESIONAL: Se obtiene el contenedor principal de paginación.
                    // La función `renderPagination` se encargará de poblar los hijos correctos.
                    const paginationContainer = document.getElementById(`pagination-container-pedidos`);
                    renderPagination(data.pagination, 'pedidos');
                    paginationContainer.classList.toggle('hidden', !data.pedidos || data.pedidos.length === 0 || data.pagination.pages <= 1);

                    if (view === 'tabla') {
                        renderPedidosTabla(data.pedidos);
                    } else {
                        renderPedidosCarta(data.pedidos);
                    }
                } else {
                    console.error('Error al cargar pedidos:', data.message);
                    if (view === 'tabla') {
                        document.getElementById('pedidos-table-body').innerHTML = `
                            <tr>
                                <td colspan="6" class="px-6 py-4 text-center text-red-600">
                                    Error al cargar los pedidos. Por favor, inténtalo de nuevo.
                                </td>
                            </tr>
                        `;
                    } else {
                        document.getElementById('pedidos-carta-container').innerHTML = `
                            <div class="col-span-full text-center py-8 text-red-600">
                                Error al cargar los pedidos. Por favor, inténtalo de nuevo.
                            </div>
                        `;
                    }
                }
            })
            .catch(error => {
                console.error('Error en la petición:', error);
                if (view === 'tabla') {
                    document.getElementById('pedidos-table-body').innerHTML = `
                        <tr>
                            <td colspan="6" class="px-6 py-4 text-center text-red-600">
                                Error de conexión. Por favor, verifica tu conexión a internet.
                            </td>
                        </tr>
                    `;
                } else {
                    document.getElementById('pedidos-carta-container').innerHTML = `
                        <div class="col-span-full text-center py-8 text-red-600">
                            Error de conexión. Por favor, verifica tu conexión a internet.
                        </div>
                    `;
                }
            });
    }

    // Función para renderizar pedidos en vista tabla
    function renderPedidosTabla(pedidos) {
        const tbody = document.getElementById('pedidos-table-body');
        tbody.innerHTML = '';
        
        if (pedidos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6">${getNoDataHTML({
                icon: 'fa-history',
                title: 'Sin Historial de Pedidos',
                message: 'Este cliente aún no ha realizado ningún pedido que coincida con los filtros aplicados.'
            })}</td></tr>`;
            return;
        }
        
        pedidos.forEach(pedido => {
            const tr = document.createElement('tr');
            tr.className = 'table-row';
            
            // Determinar clase de estado
            let statusClass = '';
            let statusIcon = '';
            let statusText = '';
            
            // LOGGING PROFESIONAL: Imprimir el valor recibido para depuración.
            console.log(`Renderizando TABLA para pedido ${pedido.id}: estado_pedido recibido es '${pedido.estado_pedido}'`);

            if (pedido.estado_pedido === 'completado') {
                statusClass = 'status-completed';
                statusIcon = 'fa-check-circle';
                statusText = 'Completado';
            } else if (pedido.estado_pedido === 'en proceso') {
                // CORRECCIÓN: La clase CSS correcta para el estado "En Proceso" es 'status-pending'.
                statusClass = 'status-pending';
                statusIcon = 'fa-clock';
                statusText = 'En Proceso';
            } else if (pedido.estado_pedido === 'cancelado') {
                statusClass = 'status-cancelled';
                statusIcon = 'fa-times-circle';
                statusText = 'Cancelado';
            }
            
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">#${pedido.id}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(pedido.created_at)}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="status-badge ${statusClass}">
                        <i class="fas ${statusIcon} mr-1"></i>${statusText}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${pedido.productos_count} productos</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">${formatCurrency(pedido.total)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <button class="text-blue-600 hover:text-blue-800 font-medium flex items-center" onclick="verDetallePedido('${pedido.id}')">
                        <i class="fas fa-eye mr-1"></i>Ver
                    </button>
                </td>
            `;
            
            tbody.appendChild(tr);
        });
    }

    // Función para renderizar pedidos en vista carta
    function renderPedidosCarta(pedidos) {
        const container = document.getElementById('pedidos-carta-container');
        container.innerHTML = '';
        
        if (pedidos.length === 0) {
            container.innerHTML = getNoDataHTML({
                icon: 'fa-history',
                title: 'Sin Historial de Pedidos',
                message: 'Este cliente aún no ha realizado ningún pedido que coincida con los filtros aplicados.'
            });
            return;
        }
        
        pedidos.forEach(pedido => {
            // Determinar clase de estado
            let statusClass = '';
            let statusIcon = '';
            let statusText = '';
            let bgClass = '';
            
            // LOGGING PROFESIONAL: Imprimir el valor recibido para depuración.
            console.log(`Renderizando CARTA para pedido ${pedido.id}: estado_pedido recibido es '${pedido.estado_pedido}'`);

            if (pedido.estado_pedido === 'completado') {
                statusClass = 'bg-green-100 text-green-800';
                statusIcon = 'fa-check-circle';
                statusText = 'Completado';
                bgClass = 'from-white to-green-50 hover:border-green-300';
            } else if (pedido.estado_pedido === 'en proceso') { // CORRECCIÓN: Aseguramos consistencia en la vista de carta también.
                statusClass = 'bg-yellow-100 text-yellow-800';
                statusIcon = 'fa-clock';
                statusText = 'En Proceso';
                bgClass = 'from-white to-yellow-50 hover:border-yellow-300';
            } else if (pedido.estado_pedido === 'cancelado') {
                statusClass = 'bg-red-100 text-red-800';
                statusIcon = 'fa-times-circle';
                statusText = 'Cancelado';
                bgClass = 'from-white to-red-50 hover:border-red-300';
            }
            
            const card = document.createElement('div');
            card.className = `border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all duration-300 ${bgClass} card-hover fade-in`;
            
            card.innerHTML = `
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div class="flex-1">
                        <div class="flex items-center mb-3">
                            <span class="${statusClass} px-3 py-1 rounded-full text-sm font-medium flex items-center">
                                <i class="fas ${statusIcon} mr-2"></i>${statusText}
                            </span>
                            <span class="ml-3 text-gray-500 text-sm font-mono">#${pedido.id}</span>
                            <span class="ml-3 text-gray-400 text-xs">${formatDate(pedido.created_at)}</span>
                        </div>
                        <h3 class="font-semibold text-gray-800 text-lg mb-1">${pedido.productos_nombre || 'Varios productos'}</h3>
                        <p class="text-sm text-gray-600 mb-2">${pedido.productos_count} productos</p>
                    </div>
                    <div class="mt-4 md:mt-0 text-right">
                        <p class="text-2xl font-bold text-gray-800 mb-2">${formatCurrency(pedido.total)}</p>
                        <button class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300 text-sm font-medium shadow-md hover:shadow-lg" onclick="verDetallePedido('${pedido.id}')">
                            <i class="fas fa-eye mr-2"></i>Ver Detalles
                        </button>
                    </div>
                </div>
            `;
            
            container.appendChild(card);
        });
    }

    // Función para cargar productos comprados
    function loadProductosComprados() {
        const view = currentView['productos-comprados'];
        const page = currentPage['productos-comprados'];
        const f = filters['productos-comprados'];
        
        // Construir URL con parámetros
        let url = `/api/usuarios/${usuarioId}/productos-comprados?page=${page}`;
        if (f.search) url += `&search=${encodeURIComponent(f.search)}`;
        if (f.categoria) url += `&categoria=${encodeURIComponent(f.categoria)}`;
        if (f.orden) url += `&orden=${encodeURIComponent(f.orden)}`;
        
        // Mostrar indicador de carga
        const skeletonRows = 4;
        const skeletonCols = 6;
        renderSkeleton(view, 'productos-comprados', skeletonRows, skeletonCols);
        
        // Realizar petición fetch
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    //  La lógica de paginación se mueve aquí.
                    const paginationContainer = document.getElementById(`pagination-container-productos-comprados`);
                    renderPagination(data.pagination, 'productos-comprados');
                    paginationContainer.classList.toggle('hidden', !data.productos || data.productos.length === 0 || data.pagination.pages <= 1);

                    if (view === 'tabla') {
                        renderProductosCompradosTabla(data.productos);
                    } else {
                        renderProductosCompradosCarta(data.productos);
                    }
                } else {
                    console.error('Error al cargar productos comprados:', data.message);
                    if (view === 'tabla') {
                        document.getElementById('productos-comprados-table-body').innerHTML = `
                            <tr>
                                <td colspan="6" class="px-6 py-4 text-center text-red-600">
                                    Error al cargar los productos. Por favor, inténtalo de nuevo.
                                </td>
                            </tr>
                        `;
                    } else {
                        document.getElementById('productos-comprados-carta-container').innerHTML = `
                            <div class="col-span-full text-center py-8 text-red-600">
                                Error al cargar los productos. Por favor, inténtalo de nuevo.
                            </div>
                        `;
                    }
                }
            })
            .catch(error => {
                console.error('Error en la petición:', error);
                if (view === 'tabla') {
                    document.getElementById('productos-comprados-table-body').innerHTML = `
                        <tr>
                            <td colspan="6" class="px-6 py-4 text-center text-red-600">
                                Error de conexión. Por favor, verifica tu conexión a internet.
                            </td>
                        </tr>
                    `;
                } else {
                    document.getElementById('productos-comprados-carta-container').innerHTML = `
                        <div class="col-span-full text-center py-8 text-red-600">
                            Error de conexión. Por favor, verifica tu conexión a internet.
                        </div>
                    `;
                }
            });
    }

    // Función para renderizar productos comprados en vista tabla
    function renderProductosCompradosTabla(productos) {
        const tbody = document.getElementById('productos-comprados-table-body');
        tbody.innerHTML = '';
        
        if (productos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6">${getNoDataHTML({
                icon: 'fa-shopping-bag',
                title: 'Sin Productos Comprados',
                message: 'Este cliente no ha comprado productos que coincidan con los filtros.'
            })}</td></tr>`;
            return;
        }
        
        productos.forEach(producto => {
            const tr = document.createElement('tr');
            tr.className = 'table-row';
            
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <img src="${producto.imagen_url || 'https://via.placeholder.com/40x40'}" alt="Producto" class="w-10 h-10 object-cover rounded-lg mr-3">
                        <div>
                            <div class="text-sm font-medium text-gray-900">${producto.nombre || 'N/A'}</div>
                            <div class="text-sm text-gray-500">Marca: ${producto.marca || 'N/A'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">${producto.categoria || 'N/A'}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">${producto.veces_comprado} veces</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(producto.ultima_compra)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">${formatCurrency(producto.total_gastado)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <button class="text-blue-600 hover:text-blue-800 font-medium flex items-center" onclick="verDetalleProducto('${producto.id}')">
                        <i class="fas fa-eye mr-1"></i>Ver
                    </button>
                </td>
            `;
            
            tbody.appendChild(tr);
        });

    }

    // Función para renderizar productos comprados en vista carta
    function renderProductosCompradosCarta(productos) {
        const container = document.getElementById('productos-comprados-carta-container');
        container.innerHTML = '';
        
        if (productos.length === 0) {
            container.innerHTML = getNoDataHTML({
                icon: 'fa-shopping-bag',
                title: 'Sin Productos Comprados',
                message: 'Este cliente no ha comprado productos que coincidan con los filtros.'
            });
            return;
        }
        
        productos.forEach(producto => {
            const card = document.createElement('div');
            card.className = 'border border-gray-200 rounded-xl hover:shadow-lg transition-all duration-300 hover:border-blue-300 group card-hover bg-white fade-in overflow-hidden flex flex-col';
            
            card.innerHTML = `
                <div class="p-5 flex-grow">
                    <div class="flex items-start mb-4">
                        <img src="${producto.imagen_url || 'https://via.placeholder.com/60x60'}" alt="Producto" class="w-16 h-16 object-cover rounded-lg group-hover:scale-105 transition-transform duration-300 shadow-md">
                        <div class="ml-4 flex-1">
                            <h3 class="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">${producto.nombre}</h3>
                            <p class="text-sm text-gray-500">Marca: ${producto.marca || 'N/A'}</p>
                            <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs mt-2 inline-block">${producto.categoria || 'N/A'}</span>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p class="text-xs text-gray-500">Veces comprado</p>
                            <p class="font-semibold text-gray-800">${producto.veces_comprado} veces</p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500">Última compra</p>
                            <p class="font-semibold text-gray-800">${formatDate(producto.ultima_compra)}</p>
                        </div>
                        <div class="col-span-2 mt-2">
                            <p class="text-xs text-gray-500">Total gastado en este producto</p>
                            <p class="font-bold text-green-600 text-xl">${formatCurrency(producto.total_gastado)}</p>
                        </div>
                    </div>
                </div>
                <div class="bg-gray-50 px-5 py-3 border-t border-gray-200">
                    <button class="w-full text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center text-sm" onclick="verDetalleProducto('${producto.id}')">
                        <i class="fas fa-eye mr-2"></i>Ver Detalles del Producto
                    </button>
                </div>
            `;
            
            container.appendChild(card);
        });
    }

    // Función para cargar productos más comprados
    function loadProductosFrecuentes() {
        const view = currentView['productos-frecuentes'];
        const page = currentPage['productos-frecuentes'];
        const f = filters['productos-frecuentes'];
        
        // Construir URL con parámetros
        let url = `/api/usuarios/${usuarioId}/productos-frecuentes?page=${page}`;
        if (f.search) url += `&search=${encodeURIComponent(f.search)}`;
        if (f.categoria) url += `&categoria=${encodeURIComponent(f.categoria)}`;
        if (f.orden) url += `&orden=${encodeURIComponent(f.orden)}`;
        
        // Mostrar indicador de carga
        const skeletonRows = 5;
        const skeletonCols = 6;
        renderSkeleton(view, 'productos-frecuentes', skeletonRows, skeletonCols);
        
        // Realizar petición fetch
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    //  La lógica de paginación se mueve aquí.
                    const paginationContainer = document.getElementById(`pagination-container-productos-frecuentes`);
                    renderPagination(data.pagination, 'productos-frecuentes');
                    paginationContainer.classList.toggle('hidden', !data.productos || data.productos.length === 0 || data.pagination.pages <= 1);

                    if (view === 'tabla') {
                        renderProductosFrecuentesTabla(data.productos);
                    } else {
                        renderProductosFrecuentesCarta(data.productos);
                    }
                } else {
                    console.error('Error al cargar productos frecuentes:', data.message);
                    if (view === 'tabla') {
                        document.getElementById('productos-frecuentes-table-body').innerHTML = `
                            <tr>
                                <td colspan="6" class="px-6 py-4 text-center text-red-600">
                                    Error al cargar los productos. Por favor, inténtalo de nuevo.
                                </td>
                            </tr>
                        `;
                    } else {
                        document.getElementById('productos-frecuentes-carta-container').innerHTML = `
                            <div class="col-span-full text-center py-8 text-red-600">
                                Error al cargar los productos. Por favor, inténtalo de nuevo.
                            </div>
                        `;
                    }
                }
            })
            .catch(error => {
                console.error('Error en la petición:', error);
                if (view === 'tabla') {
                    document.getElementById('productos-frecuentes-table-body').innerHTML = `
                        <tr>
                            <td colspan="6" class="px-6 py-4 text-center text-red-600">
                                Error de conexión. Por favor, verifica tu conexión a internet.
                            </td>
                        </tr>
                    `;
                } else {
                    document.getElementById('productos-frecuentes-carta-container').innerHTML = `
                        <div class="col-span-full text-center py-8 text-red-600">
                            Error de conexión. Por favor, verifica tu conexión a internet.
                        </div>
                    `;
                }
            });
    }

    // Función para renderizar productos frecuentes en vista tabla
    function renderProductosFrecuentesTabla(productos) {
        const tbody = document.getElementById('productos-frecuentes-table-body');
        tbody.innerHTML = '';
        
        if (productos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6">${getNoDataHTML({
                icon: 'fa-star',
                title: 'Sin Productos Frecuentes',
                message: 'No hay productos comprados frecuentemente que coincidan con los filtros.'
            })}</td></tr>`;
            return;
        }
        
        productos.forEach(producto => {
            const tr = document.createElement('tr');
            tr.className = 'table-row';
            
            // Generar estrellas de calificación
            let starsHtml = '';
            for (let i = 1; i <= 5; i++) {
                if (i <= Math.floor(producto.calificacion_promedio)) {
                    starsHtml += '<i class="fas fa-star"></i>';
                } else if (i - 0.5 <= producto.calificacion_promedio) {
                    starsHtml += '<i class="fas fa-star-half-alt"></i>';
                } else {
                    starsHtml += '<i class="far fa-star"></i>';
                }
            }
            
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <img src="${producto.imagen_url || 'https://via.placeholder.com/40x40'}" alt="Producto" class="w-10 h-10 object-cover rounded-lg mr-3">
                        <div>
                            <div class="text-sm font-medium text-gray-900">${producto.nombre || 'N/A'}</div>
                            <div class="text-sm text-gray-500">Marca: ${producto.marca || 'N/A'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">${producto.categoria || 'N/A'}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm font-semibold">${producto.veces_comprado} veces</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex text-yellow-400 text-sm mr-1">
                            ${starsHtml}
                        </div>
                        <span class="text-sm text-gray-600">(${producto.calificacion_promedio})</span>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(producto.ultima_compra)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <button class="text-blue-600 hover:text-blue-800 font-medium flex items-center" onclick="verDetalleProducto('${producto.id}')">
                        <i class="fas fa-eye mr-1"></i>Ver
                    </button>
                </td>
            `;
            
            tbody.appendChild(tr);
        });
    }

    // Función para renderizar productos frecuentes en vista carta
    function renderProductosFrecuentesCarta(productos) {
        const container = document.getElementById('productos-frecuentes-carta-container');
        container.innerHTML = '';
        
        if (productos.length === 0) {
            container.innerHTML = getNoDataHTML({
                icon: 'fa-star',
                title: 'Sin Productos Frecuentes',
                message: 'No hay productos comprados frecuentemente que coincidan con los filtros.'
            });
            return;
        }
        
        productos.forEach(producto => {
            // Generar estrellas de calificación
            let starsHtml = '';
            for (let i = 1; i <= 5; i++) {
                if (i <= Math.floor(producto.calificacion_promedio)) {
                    starsHtml += '<i class="fas fa-star"></i>';
                } else if (i - 0.5 <= producto.calificacion_promedio) {
                    starsHtml += '<i class="fas fa-star-half-alt"></i>';
                } else {
                    starsHtml += '<i class="far fa-star"></i>';
                }
            }
            
            const card = document.createElement('div');
            card.className = 'flex items-center p-4 border border-gray-200 rounded-xl hover:shadow-lg transition-all duration-300 hover:border-yellow-300 group card-hover bg-gradient-to-r from-white to-yellow-50 fade-in';
            
            card.innerHTML = `
                <img src="${producto.imagen_url || 'https://via.placeholder.com/80x80'}" alt="Producto" class="w-20 h-20 object-cover rounded-lg group-hover:scale-105 transition-transform duration-300 shadow-md">
                <div class="ml-4 flex-1">
                    <h3 class="font-semibold text-gray-800 group-hover:text-yellow-600 transition-colors">${producto.nombre}</h3>
                    <p class="text-sm text-gray-600 mb-1">Comprado ${producto.veces_comprado} veces</p>
                    <p class="text-lg font-bold text-green-600">${formatCurrency(producto.precio)}</p>
                    <div class="flex items-center mt-1">
                        <div class="flex text-yellow-400 text-sm mr-2">
                            ${starsHtml}
                        </div>
                        <span class="text-xs text-gray-500">(${producto.calificacion_promedio})</span>
                    </div>
                </div>
                <div class="text-right">
                    <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium mb-2 inline-block">
                        Más vendido
                    </span>
                    <div class="text-xs text-gray-500">
                        <p>Última compra:</p>
                        <p>${formatDate(producto.ultima_compra)}</p>
                    </div>
                </div>
            `;
            
            container.appendChild(card);
        });
    }

    // Función para cargar reseñas
    function loadReseñas() {
        const page = currentPage['reseñas'];
        const f = filters['reseñas'];
        
        // Construir URL con parámetros
        let url = `/api/usuarios/${usuarioId}/reviews?page=${page}`;
        if (f.search) url += `&search=${encodeURIComponent(f.search)}`;
        if (f.calificacion) url += `&calificacion=${encodeURIComponent(f.calificacion)}`;
        if (f.orden) url += `&orden=${encodeURIComponent(f.orden)}`;
        
        // Mostrar indicador de carga
        console.log("[loadReseñas] Iniciando carga. Llamando a renderSkeleton para la pestaña 'reseñas'.");
        const skeletonRows = 2;
        const skeletonCols = 1; // Las reseñas son una sola columna de tarjetas
        renderSkeleton('carta', 'reseñas', skeletonRows, skeletonCols);
        
        // Realizar petición fetch
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // MEJORA PROFESIONAL: La lógica de paginación se mueve aquí.
                    const paginationContainer = document.getElementById(`pagination-container-reseñas`);
                    renderPagination(data.pagination, 'reseñas');
                    paginationContainer.classList.toggle('hidden', !data.reseñas || data.reseñas.length === 0 || data.pagination.pages <= 1);
                    renderReseñas(data.reseñas);
                } else {
                    console.error('Error al cargar reseñas:', data.message);
                    document.getElementById('reseñas-container').innerHTML = `
                        <div class="col-span-full text-center py-8 text-red-600">
                            Error al cargar las reseñas. Por favor, inténtalo de nuevo.
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error('Error en la petición:', error);
                document.getElementById('reseñas-container').innerHTML = `
                    <div class="col-span-full text-center py-8 text-red-600">
                        Error de conexión. Por favor, verifica tu conexión a internet.
                    </div>
                `;
            });
    }

    // Función para renderizar reseñas
    function renderReseñas(reseñas) {
        const container = document.getElementById('reseñas-container');
        container.innerHTML = '';
        
        if (reseñas.length === 0) {
            container.innerHTML = getNoDataHTML({
                icon: 'fa-comments',
                title: 'Sin Reseñas',
                message: 'Este cliente no ha dejado ninguna reseña que coincida con los filtros.'
            });
            return;
        }
        
        reseñas.forEach(resena => {
            const card = document.createElement('div');
            card.className = 'border border-gray-200 rounded-xl hover:shadow-lg transition-all duration-300 hover:border-blue-300 group card-hover bg-white fade-in overflow-hidden flex flex-col';
            
            card.innerHTML = `
                <div class="p-5 flex-grow">
                    <div class="flex items-start mb-4">
                        <img src="${resena.producto.imagen_url || 'https://via.placeholder.com/60x60'}" alt="Producto" class="w-16 h-16 object-cover rounded-lg group-hover:scale-105 transition-transform duration-300 shadow-md">
                        <div class="ml-4 flex-1">
                            <h3 class="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">${resena.producto.nombre}</h3>
                            <p class="text-sm text-gray-500">Marca: ${resena.producto.marca || 'N/A'}</p>
                            <div class="flex text-yellow-400 text-sm mt-2">
                                ${renderStars(resena.calificacion)}
                                <span class="ml-2 text-gray-600 text-xs">(${resena.calificacion})</span>
                            </div>
                        </div>
                    </div>
                    <div class="mb-4">
                        <h4 class="font-semibold text-gray-700 text-base mb-1">${resena.titulo || 'Reseña'}</h4>
                        <p class="text-gray-600 text-sm italic">"${resena.texto}"</p>
                    </div>
                    <div class="flex justify-between items-center text-xs text-gray-500 border-t pt-3">
                        <div class="flex items-center" title="Votos útiles">
                            <i class="fas fa-thumbs-up mr-1"></i>
                            <span>${resena.votos_utiles_count || 0}</span>
                        </div>
                        <div class="flex items-center" title="Vistas de la reseña">
                            <i class="fas fa-eye mr-1"></i>
                            <span>${resena.visitas || 0}</span>
                        </div>
                        <span>${formatDate(resena.created_at)}</span>
                    </div>
                </div>
                <div class="bg-gray-50 px-5 py-3 border-t border-gray-200">
                    <a href="/admin/producto/${resena.producto.slug}" class="w-full text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center text-sm action-link">
                        <span class="action-link-text">
                            <i class="fas fa-external-link-alt mr-2"></i>Ver Detalles del Producto
                        </span>
                        <i class="fas fa-arrow-right action-link-arrow"></i>
                    </a>
                </div>
            `;
            
            container.appendChild(card);
        });
    }

    // Función para renderizar estrellas
    function renderStars(rating) {
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                starsHtml += '<i class="fas fa-star"></i>';
            } else if (i - 0.5 <= rating) {
                starsHtml += '<i class="fas fa-star-half-alt"></i>';
            } else {
                starsHtml += '<i class="far fa-star"></i>';
            }
        }
        return starsHtml;
    }

    // Función para renderizar paginación
    function renderPagination(pagination, tab) {
        // MEJORA PROFESIONAL: Se obtienen los contenedores específicos para la información y los botones.
        // Esto desacopla la lógica de la estructura exacta del HTML.
        const infoContainer = document.getElementById(`pagination-info-${tab}`);
        const buttonsContainer = document.getElementById(`pagination-buttons-${tab}`);
        const mainContainer = document.getElementById(`pagination-container-${tab}`);

        if (!infoContainer || !buttonsContainer || !mainContainer) {
            console.error(`Contenedores de paginación no encontrados para la pestaña: ${tab}`);
            return;
        }

        // Mostrar el contenedor principal
        mainContainer.style.display = 'flex';

        // Limpiar contenedores
        infoContainer.innerHTML = '<span class="text-gray-500 italic">Cargando...</span>';
        buttonsContainer.innerHTML = '';
        
        const { page, pages, per_page, total, has_prev, has_next } = pagination;
        
        // Actualizar información de resultados
        const start = (page - 1) * per_page + 1;
        const end = Math.min(page * per_page, total);
        // MEJORA PROFESIONAL: Se ajusta el formato del texto para que coincida con el requerido: "Mostrando Y de Z".
        infoContainer.innerHTML = `
            Mostrando <span class="font-medium">${end}</span> de <span class="font-medium">${total}</span> resultados
        `;

        // MEJORA PROFESIONAL: Se añade espaciado entre los botones para una mejor apariencia.
        buttonsContainer.className = 'flex items-center space-x-2';
        // Botón Anterior
        const prevBtn = document.createElement('button');
        prevBtn.className = `px-3 py-1 rounded-md transition-colors ${has_prev ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`;
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.disabled = !has_prev;
        if (has_prev) {
            prevBtn.addEventListener('click', () => {
                currentPage[tab] = page - 1;
                if (tab === 'pedidos') loadPedidos();
                else if (tab === 'productos-comprados') loadProductosComprados();
                else if (tab === 'productos-frecuentes') loadProductosFrecuentes();
                else if (tab === 'reseñas') loadReseñas();
            });
        }
        buttonsContainer.appendChild(prevBtn);
        
        // Números de página
        const maxVisiblePages = 5;
        let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(pages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        if (startPage > 1) {
            const firstBtn = document.createElement('button');
            firstBtn.className = 'px-3 py-1 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors';
            firstBtn.textContent = '1';
            firstBtn.addEventListener('click', () => {
                currentPage[tab] = 1;
                if (tab === 'pedidos') loadPedidos();
                else if (tab === 'productos-comprados') loadProductosComprados();
                else if (tab === 'productos-frecuentes') loadProductosFrecuentes();
                else if (tab === 'reseñas') loadReseñas();
            });
            buttonsContainer.appendChild(firstBtn);
            
            if (startPage > 2) {
                const ellipsisBtn = document.createElement('button');
                ellipsisBtn.className = 'px-3 py-1 rounded-md text-gray-500';
                ellipsisBtn.innerHTML = '<i class="fas fa-ellipsis-h"></i>';
                ellipsisBtn.disabled = true;
                buttonsContainer.appendChild(ellipsisBtn);
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `px-3 py-1 rounded-md transition-colors ${i === page ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => {
                currentPage[tab] = i;
                if (tab === 'pedidos') loadPedidos();
                else if (tab === 'productos-comprados') loadProductosComprados();
                else if (tab === 'productos-frecuentes') loadProductosFrecuentes();
                else if (tab === 'reseñas') loadReseñas();
            });
            buttonsContainer.appendChild(pageBtn);
        }
        
        if (endPage < pages) {
            if (endPage < pages - 1) {
                const ellipsisBtn = document.createElement('button');
                ellipsisBtn.className = 'px-3 py-1 rounded-md text-gray-500';
                ellipsisBtn.innerHTML = '<i class="fas fa-ellipsis-h"></i>';
                ellipsisBtn.disabled = true;
                buttonsContainer.appendChild(ellipsisBtn);
            }
            
            const lastBtn = document.createElement('button');
            lastBtn.className = 'px-3 py-1 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors';
            lastBtn.textContent = pages;
            lastBtn.addEventListener('click', () => {
                currentPage[tab] = pages;
                if (tab === 'pedidos') loadPedidos();
                else if (tab === 'productos-comprados') loadProductosComprados();
                else if (tab === 'productos-frecuentes') loadProductosFrecuentes();
                else if (tab === 'reseñas') loadReseñas();
            });
            buttonsContainer.appendChild(lastBtn);
        }
        
        // Botón siguiente
        const nextBtn = document.createElement('button');
        nextBtn.className = `px-3 py-1 rounded-md transition-colors ${has_next ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`;
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.disabled = !has_next;
        if (has_next) {
            nextBtn.addEventListener('click', () => {
                currentPage[tab] = page + 1;
                if (tab === 'pedidos') loadPedidos();
                else if (tab === 'productos-comprados') loadProductosComprados();
                else if (tab === 'productos-frecuentes') loadProductosFrecuentes();
                else if (tab === 'reseñas') loadReseñas();
            });
        }
        buttonsContainer.appendChild(nextBtn);
    }

    // Función para cargar gráfico de categorías
    function loadCategoriasChart() {
        // MEJORA PROFESIONAL: Gestionar la visibilidad del esqueleto y el contenido.
        const skeleton = document.getElementById('categorias-preferidas-skeleton');
        const content = document.getElementById('categorias-preferidas-content');
        if (skeleton) skeleton.classList.add('hidden');
        if (content) content.classList.remove('hidden');

        // MEJORA PROFESIONAL: Los datos ahora se inyectan directamente en el HTML.
        // Verificamos si el canvas del gráfico existe. Si no existe, es porque
        // Jinja2 renderizó el mensaje de "sin datos" en su lugar.
        const canvas = document.getElementById('categoriasChart');
        if (!canvas) {
            console.log("No se encontró el canvas 'categoriasChart'. Mostrando mensaje de 'sin datos'.");
            return;
        }

        // MEJORA: Inyectar los datos directamente desde el backend para evitar una llamada AJAX redundante.
        // Se crea un script tag en el HTML para pasar los datos.
        const categoriasPreferidasData = JSON.parse(document.getElementById('categorias-data').textContent);

        const ctx = canvas.getContext('2d');

        // MEJORA: Destruir la instancia anterior del gráfico si existe.
        if (categoriasChartInstance) {
            categoriasChartInstance.destroy();
        }

        categoriasChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categoriasPreferidasData.map(c => c.nombre),
                datasets: [{
                    data: categoriasPreferidasData.map(c => c.porcentaje),
                    backgroundColor: categoriasPreferidasData.map(c => c.color),
                    borderWidth: 0,
                    hoverOffset: 15
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        titleColor: '#1F2937',
                        bodyColor: '#1F2937',
                        borderColor: '#E5E7EB',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        boxPadding: 6,
                        usePointStyle: true,
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.raw}%`;
                            }
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true
                }
            }
        });
    }

    // Función para cargar gráfico de tendencia
    function loadTendenciaChart(periodo = '6M') {
        // MEJORA PROFESIONAL: Gestionar la visibilidad con transiciones de opacidad para un efecto "cross-fade".
        const skeleton = document.getElementById('tendencia-chart-skeleton');
        const canvas = document.getElementById('tendenciaChart');
        const noDataContainer = document.getElementById('tendencia-chart-no-data');
        
        // MEJORA PROFESIONAL: Estado de carga limpio usando opacidad.
        // Ocultamos el canvas y el mensaje de "sin datos" y mostramos el esqueleto.
        if (canvas) canvas.style.opacity = '0';
        if (noDataContainer) noDataContainer.style.opacity = '0';
        if (skeleton) skeleton.style.opacity = '1';
        

        // Pequeña demora para asegurar que la transición de opacidad se aplique antes de la petición.

        const ctx = document.getElementById('tendenciaChart').getContext('2d');
        
        // MEJORA: Destruir la instancia anterior del gráfico si existe.
        if (tendenciaChartInstance) {
            tendenciaChartInstance.destroy();
        }

        // Obtener datos de tendencia
        fetch(`/api/usuarios/${usuarioId}/tendencia-compras?periodo=${periodo}`)
            .then(response => response.json())
            .then(data => {
                // MEJORA PROFESIONAL: Ocultar el esqueleto de carga tan pronto como tengamos una respuesta.
                // Esto asegura que el esqueleto desaparezca tanto en caso de éxito como de error.
                if (skeleton) skeleton.style.opacity = '0';

                if (data.success) {
                    // MEJORA PROFESIONAL: Verificar si hay datos para graficar.
                    // CORRECCIÓN: La condición debe ser si no hay valores o si todos los valores son cero.
                    const hasData = data.valores && data.valores.some(v => v > 0);
                    if (!hasData) {
                        console.log("No hay datos de tendencia para mostrar.");
                        // Ocultar esqueleto y mostrar el mensaje de "sin datos".
                        if (noDataContainer) {
                            noDataContainer.classList.remove('hidden'); // Asegurarse de que no esté oculto por display:none
                            noDataContainer.style.opacity = '1';
                        }
                        return; // Detener la ejecución si no hay datos.
                    }

                    tendenciaChartInstance = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: data.labels,
                            datasets: [{
                                label: 'Compras ($)',
                                data: data.valores,
                                borderColor: '#3B82F6',
                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                tension: 0.4,
                                fill: true,
                                pointBackgroundColor: '#3B82F6',
                                pointBorderColor: '#ffffff',
                                pointBorderWidth: 3,
                                pointRadius: 6,
                                pointHoverRadius: 8,
                                pointHoverBackgroundColor: '#3B82F6',
                                pointHoverBorderColor: '#ffffff',
                                pointHoverBorderWidth: 3
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    display: false
                                },
                                tooltip: {
                                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                    titleColor: '#1F2937',
                                    bodyColor: '#1F2937',
                                    borderColor: '#E5E7EB',
                                    borderWidth: 1,
                                    padding: 12,
                                    cornerRadius: 8,
                                    boxPadding: 6,
                                    callbacks: {
                                        label: function(context) {
                                            return `Compras: $${context.raw.toLocaleString()}`;
                                        }
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        callback: function(value) {
                                            return '$' + (value / 1000000).toFixed(1) + 'M';
                                        },
                                        color: '#6B7280',
                                        font: {
                                            size: 12
                                        }
                                    },
                                    grid: {
                                        color: 'rgba(229, 231, 235, 0.5)'
                                    }
                                },
                                x: {
                                    ticks: {
                                        color: '#6B7280',
                                        font: {
                                            size: 12
                                        }
                                    },
                                    grid: {
                                        display: false
                                    }
                                }
                            },
                            interaction: {
                                intersect: false,
                                mode: 'index'
                            },
                            animation: {
                                duration: 2000,
                                easing: 'easeOutQuart'
                            }
                        }
                    });
                } else {
                    console.error('Error al cargar tendencia de compras:', data.message);
                }
            })
            .catch(error => {
                console.error('Error en la petición de tendencia:', error);
                if (skeleton) skeleton.style.opacity = '0';
                if (noDataContainer) {
                    noDataContainer.classList.remove('hidden');
                    noDataContainer.style.opacity = '1'; // Mostrar mensaje de error/sin datos
                }
            })
            .finally(() => {
                // CORRECCIÓN: Mostrar el canvas del gráfico si se ha renderizado y contiene datos.
                const hasData = tendenciaChartInstance && tendenciaChartInstance.data.datasets[0].data.some(v => v > 0);
                if (hasData && canvas) canvas.style.opacity = '1';
            });
    }

    // Función para formatear fecha
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    // Función para formatear moneda
    function formatCurrency(amount) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount).replace('COP', '').trim();
    }

    // Función para ver detalle de pedido
    function verDetallePedido(pedidoId) {
        window.open(`/admin/pedidos/${pedidoId}`, '_blank');
    }

    // Función para ver detalle de producto
    function verDetalleProducto(productoId) {
        window.open(`/admin/productos/${productoId}`, '_blank');
    }

    // --- MEJORA PROFESIONAL: Función reutilizable para generar HTML de "sin datos" ---
    function getNoDataHTML({ icon, title, message }) {
        return `
            <div class="no-data-container">
                <div class="no-data-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <h3 class="no-data-title">${title}</h3>
                <p class="no-data-message">${message}</p>
            </div>
        `;
    }


    // --- MEJORA PROFESIONAL: Función unificada para renderizar Skeletons ---

    /**
     * Renderiza un esqueleto de carga para una tabla o una vista de tarjetas.
     * @param {string} view - La vista actual ('tabla' o 'carta').
     * @param {string} tab - La pestaña actual (ej. 'pedidos', 'productos-comprados').
     * @param {number} rows - El número de filas/tarjetas de esqueleto a generar.
     * @param {number} cols - El número de columnas (solo para tablas).
     */
    function renderSkeleton(view, tab, rows, cols) {
        // MEJORA PROFESIONAL: Corregir el ID del contenedor para las reseñas.
        // El contenedor de reseñas tiene un ID específico ('reseñas-container') que no sigue el patrón general.
        let containerId;
        if (tab === 'reseñas') {
            containerId = 'reseñas-container';
        } else {
            containerId = (view === 'tabla') ? `${tab}-table-body` : `${tab}-carta-container`;
        }

        const container = document.getElementById(containerId);
        console.log(`[renderSkeleton] Intentando renderizar esqueleto en el contenedor: #${containerId}`);
        if (!container) { console.error(`[renderSkeleton] Contenedor #${containerId} no encontrado.`); return; }

        let skeletonHTML = '';
        if (view === 'tabla') {
            for (let i = 0; i < rows; i++) {
                skeletonHTML += '<tr class="table-row">';
                for (let j = 0; j < cols; j++) {
                    skeletonHTML += '<td class="px-6 py-4 whitespace-nowrap"><div class="skeleton skeleton-text w-3/4"></div></td>';
                }
                skeletonHTML += '</tr>';
            }
        } else { // 'carta'
            for (let i = 0; i < rows; i++) {
                skeletonHTML += getSkeletonCardHTML(tab);
            }
        }
        container.innerHTML = skeletonHTML;
    }

    /**
     * Devuelve el HTML para un tipo específico de tarjeta de esqueleto.
     * @param {string} tab - La pestaña actual, que determina el tipo de tarjeta.
     * @returns {string} El HTML de la tarjeta de esqueleto.
     */
    function getSkeletonCardHTML(tab) {
        // El tipo de tarjeta se basa en la pestaña actual.
        switch (tab) { // CORRECCIÓN: Usar los nombres correctos de las pestañas.
            case 'pedidos':
                return `
                    <div class="skeleton-card-pedido">
                        <div class="flex justify-between items-start mb-4">
                            <div class="skeleton skeleton-text w-28 h-7 rounded-full"></div>
                            <div class="skeleton skeleton-text w-20"></div>
                        </div>
                        <div class="skeleton skeleton-text w-3/4 mb-2"></div>
                        <div class="skeleton skeleton-text w-1/4"></div>
                    </div>
                `;
            case 'productos-comprados':
                return `
                    <div class="skeleton-card">
                        <div class="flex items-center mb-3">
                            <div class="skeleton w-16 h-16 rounded-lg mr-3"></div>
                            <div class="flex-1">
                                <div class="skeleton skeleton-text w-3/4 mb-2"></div>
                                <div class="skeleton skeleton-text w-1/2"></div>
                            </div>
                        </div>
                        <div class="skeleton skeleton-text w-full"></div>
                    </div>
                `;
            case 'productos-frecuentes':
                return `
                    <div class="skeleton-card">
                        <div class="flex items-center mb-4">
                            <div class="skeleton w-16 h-16 rounded-lg mr-3"></div>
                            <div class="flex-1">
                                <div class="skeleton skeleton-text w-full mb-2"></div>
                                <div class="skeleton skeleton-text w-1/2"></div>
                            </div>
                        </div>
                        <div class="skeleton skeleton-text w-full mb-2"></div>
                        <div class="skeleton skeleton-text w-3/4"></div>
                    </div>
                `;
            // MEJORA: Esqueleto específico y más detallado para las tarjetas de reseñas.
            case 'reseñas':
                return `
                    <div class="skeleton-card-reseña p-5">
                        <div class="flex items-start mb-4">
                            <div class="skeleton w-16 h-16 rounded-lg mr-4"></div>
                            <div class="flex-1">
                                <div class="skeleton skeleton-text w-3/4 mb-2"></div>
                                <div class="skeleton skeleton-text w-1/2 mb-3"></div>
                                <div class="skeleton skeleton-text w-24 h-4"></div>
                            </div>
                        </div>
                        <div class="space-y-2">
                            <div class="skeleton skeleton-text w-1/2 h-5 mb-3"></div>
                            <div class="skeleton skeleton-text w-full"></div>
                            <div class="skeleton skeleton-text w-5/6"></div>
                        </div>
                    </div>
                `;
            default: return '';
        }
    }

    // Cargar datos iniciales
    loadPedidos();
    loadCategoriasChart();
    loadTendenciaChart('6M');
});