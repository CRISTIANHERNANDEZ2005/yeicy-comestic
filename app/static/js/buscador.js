/**
 * Módulo de Búsqueda Avanzada y Sugerencias.
 *
 * Este script gestiona la funcionalidad de búsqueda de productos en todo el sitio,
 * proporcionando una experiencia de usuario interactiva y en tiempo real a través de un modal.
 * Además, implementa un sistema de analítica para registrar y sincronizar los
 * términos de búsqueda que conducen a clics en productos.
 *
 * Funcionalidades Clave:
 * 1.  **Modal de Búsqueda Interactivo:** Activa un modal al interactuar con el campo de
 *     búsqueda, mejorando la experiencia y centrando la atención del usuario.
 * 2.  **Búsqueda en Tiempo Real (Debounced):** Realiza peticiones asíncronas con un retardo
 *     'debounce' para optimizar el rendimiento y no sobrecargar el servidor con cada
 *     pulsación de tecla.
 * 3.  **Sugerencias Dinámicas:** Carga y muestra términos de búsqueda populares o sugerencias
 *     cuando el campo de búsqueda está vacío para guiar al usuario.
 * 4.  **Registro de Analíticas de Búsqueda:** Cuando un usuario hace clic en un resultado,
 *     el término de búsqueda y el ID del producto se guardan en una cola en `localStorage`.
 * 5.  **Sincronización por Lotes (Batch Syncing):** Los datos de analítica se envían al
 *     servidor periódicamente y de forma eficiente usando `navigator.sendBeacon` para
 *     garantizar la entrega de datos incluso si el usuario abandona la página.
 */
(function() {
    'use strict';

    const SEARCH_SYNC_INTERVAL = 15000; // Intervalo de sincronización: 15 segundos.
    const SEARCH_QUEUE_KEY = 'searchQueue'; // Clave para la cola de búsqueda en localStorage.

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBuscador);
    } else {
        initBuscador();
    }

    function initBuscador() {
        // --- Selección de Elementos del DOM ---
        const searchInput = document.getElementById('searchInput');
        const searchModal = document.getElementById('searchModal');
        const searchOverlay = document.getElementById('searchOverlay');
        const closeModalBtn = document.getElementById('closeModalBtn');
        const sugerenciasList = document.getElementById('sugerenciasList');
        const resultadosList = document.getElementById('resultadosList');
        const loadingIndicator = document.getElementById('loadingIndicator');

        let searchTimeout;

        function abrirModal() {
            // Evita abrir si ya está visible.
            if (searchModal.classList.contains('hidden')) {
                searchModal.classList.remove('hidden');
                searchModal.classList.add('show');
                document.body.style.overflow = 'hidden';
                setTimeout(() => searchInput.focus(), 100);
                cargarSugerencias();
            }
        }

        function cerrarModal() {
            searchModal.classList.remove('show');
            setTimeout(() => {
                searchModal.classList.add('hidden');
                document.body.style.overflow = '';
                limpiarBusqueda();
            }, 300);
        }

        function limpiarBusqueda() {
            // Restaura el mensaje inicial en la lista de resultados.
            resultadosList.innerHTML = '<p class="text-gray-500 col-span-2 text-center py-8">Empieza a escribir para buscar productos</p>';
        }

        searchInput.addEventListener('click', abrirModal);
        searchInput.addEventListener('focus', abrirModal);
        closeModalBtn.addEventListener('click', cerrarModal);
        searchOverlay.addEventListener('click', cerrarModal);

        searchInput.addEventListener('input', function(e) {
            // Lógica de búsqueda con debounce para optimizar rendimiento.
            const query = e.target.value.trim();
            clearTimeout(searchTimeout);

            if (query.length === 0) {
                cargarSugerencias();
                return;
            }

            searchTimeout = setTimeout(() => buscarProductos(query), 300);
        });

        document.addEventListener('keydown', function(e) {
            // Cierra el modal al presionar la tecla Escape.
            if (e.key === 'Escape' && !searchModal.classList.contains('hidden')) {
                cerrarModal();
            }
        });

        async function buscarProductos(query) {
            loadingIndicator.classList.remove('hidden');
            resultadosList.innerHTML = '';

            try {
                // Realiza la petición al endpoint de búsqueda.
                const response = await fetch(`/buscar?q=${encodeURIComponent(query)}`);
                const data = await response.json();
                loadingIndicator.classList.add('hidden');
                if (data.resultados) {
                    mostrarResultados(data.resultados, query);
                }
            } catch (error) {
                loadingIndicator.classList.add('hidden');
                resultadosList.innerHTML = '<p class="text-red-500 col-span-2 text-center">Error al buscar</p>';
            }
        }

        function mostrarResultados(productos, query) {
            // Renderiza los productos encontrados o un mensaje de "no resultados".
            if (!productos || productos.length === 0) {
                resultadosList.innerHTML = '<p class="text-gray-500 col-span-2 text-center py-8">No se encontraron productos</p>';
                return;
            }

            resultadosList.innerHTML = '';
            productos.forEach(producto => {
                const div = document.createElement('div');
                div.className = 'flex items-center gap-3 p-3 hover:bg-pink-50 rounded-lg cursor-pointer';
                div.innerHTML = `
                    <img src="${producto.imagen_url}" alt="${producto.nombre}" class="w-16 h-16 object-cover rounded-lg">
                    <div class="flex-1 min-w-0">
                        <p class="font-medium text-sm text-gray-900 truncate">${producto.nombre}</p>
                        <p class="text-pink-600 font-bold text-sm">${producto.precio.toLocaleString()}</p>
                        ${producto.marca ? `<p class="text-xs text-gray-500">${producto.marca}</p>` : ''}
                    </div>
                `;
                div.addEventListener('click', () => {
                    // Al hacer clic, registra el término para análisis y redirige.
                    logSearchClick(producto, query);
                    window.location.href = `/producto/${producto.id}`;
                });
                resultadosList.appendChild(div);
            });
        }

        function logSearchClick(producto, query) {
            // Añade el término de búsqueda y el producto a una cola en localStorage.
            const queue = JSON.parse(localStorage.getItem(SEARCH_QUEUE_KEY) || '[]');
            queue.push({
                product_id: producto.id,
                query: query,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem(SEARCH_QUEUE_KEY, JSON.stringify(queue));
            console.log(`[Búsqueda] Término '${query}' para producto ${producto.id} encolado para sincronización.`);
        }

        async function cargarSugerencias() {
            // Carga y muestra sugerencias de búsqueda cuando el input está vacío.
            try {
                const response = await fetch('/buscar?q=');
                const data = await response.json();
                if (data.sugerencias) {
                    sugerenciasList.innerHTML = '';
                    data.sugerencias.slice(0, 6).forEach(termino => {
                        const span = document.createElement('span');
                        span.className = 'px-3 py-1.5 bg-pink-100 text-pink-700 rounded-full text-sm cursor-pointer hover:bg-pink-200';
                        span.textContent = termino;
                        span.addEventListener('click', () => {
                            searchInput.value = termino;
                            buscarProductos(termino);
                        });
                        sugerenciasList.appendChild(span);
                    });
                }
            } catch (error) {
                console.error('Error al cargar sugerencias:', error);
            }
        }

        function syncSearchTerms() {
            const queue = JSON.parse(localStorage.getItem(SEARCH_QUEUE_KEY) || '[]');
            if (queue.length === 0) {
                return;
            }

            console.log(`[Búsqueda] Sincronizando ${queue.length} términos de búsqueda.`);

            const data = {
                terminos: queue
            };

            // Usa navigator.sendBeacon si está disponible para una sincronización más fiable,
            // especialmente cuando el usuario abandona la página.
            if (navigator.sendBeacon) {
                const headers = { type: 'application/json' };
                const blob = new Blob([JSON.stringify(data)], headers);
                navigator.sendBeacon('/log_search_terms_batch', blob);
                localStorage.removeItem(SEARCH_QUEUE_KEY);
            } else {
                 fetch('/log_search_terms_batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                    keepalive: true
                }).then(response => {
                    if (response.ok) {
                        localStorage.removeItem(SEARCH_QUEUE_KEY);
                        console.log('[Búsqueda] Sincronización exitosa.');
                    } else {
                        console.error('[Búsqueda] La sincronización falló.');
                    }
                }).catch(error => {
                    console.error('[Búsqueda] Error de sincronización:', error);
                });
            }
        }

        // Sincroniza al cargar la página y luego periódicamente.
        syncSearchTerms();
        setInterval(syncSearchTerms, SEARCH_SYNC_INTERVAL);

        // Asegura la sincronización antes de que el usuario abandone la página.
        window.addEventListener('pagehide', syncSearchTerms);
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                syncSearchTerms();
            }
        });

        console.log('🎯 Buscador optimizado iniciado');
    }
})();
