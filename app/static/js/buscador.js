// static/js/buscador.js - Versión simplificada sin duplicación
(function() {
    'use strict';
    
    // Esperar a que el DOM esté completamente cargado
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBuscador);
    } else {
        initBuscador();
    }
    
    function initBuscador() {
        const searchInput = document.getElementById('searchInput');
        const searchModal = document.getElementById('searchModal');
        const searchOverlay = document.getElementById('searchOverlay');
        const closeModalBtn = document.getElementById('closeModalBtn');
        const sugerenciasList = document.getElementById('sugerenciasList');
        const resultadosList = document.getElementById('resultadosList');
        const loadingIndicator = document.getElementById('loadingIndicator');
        
        let searchTimeout;
        let selectedIndex = -1;
        
        // Funciones de modal
        function abrirModal() {
            if (searchModal.classList.contains('hidden')) {
                searchModal.classList.remove('hidden');
                searchModal.classList.add('show');
                document.body.style.overflow = 'hidden';
                setTimeout(() => searchInput.focus(), 100);
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
            resultadosList.innerHTML = '<p class="text-gray-500 col-span-2 text-center py-8">Empieza a escribir para buscar productos</p>';
        }
        
        // Eventos
        searchInput.addEventListener('click', abrirModal);
        searchInput.addEventListener('focus', abrirModal);
        closeModalBtn.addEventListener('click', cerrarModal);
        searchOverlay.addEventListener('click', cerrarModal);
        
        // Búsqueda
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.trim();
            clearTimeout(searchTimeout);
            
            if (query.length === 0) {
                cargarSugerencias();
                return;
            }
            
            searchTimeout = setTimeout(() => buscarProductos(query), 300);
        });
        
        // Cerrar con ESC
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && !searchModal.classList.contains('hidden')) {
                cerrarModal();
            }
        });
        
        async function buscarProductos(query) {
            loadingIndicator.classList.remove('hidden');
            resultadosList.innerHTML = '';
            
            try {
                const response = await fetch(`/buscar?q=${encodeURIComponent(query)}`);
                const data = await response.json();
                
                loadingIndicator.classList.add('hidden');
                
                if (data.resultados) {
                    mostrarResultados(data.resultados);
                }
            } catch (error) {
                loadingIndicator.classList.add('hidden');
                resultadosList.innerHTML = '<p class="text-red-500 col-span-2 text-center">Error al buscar</p>';
            }
        }
        
        function mostrarResultados(productos) {
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
                        <p class="text-pink-600 font-bold text-sm">$${producto.precio.toLocaleString()}</p>
                        ${producto.marca ? `<p class="text-xs text-gray-500">${producto.marca}</p>` : ''}
                    </div>
                `;
                div.addEventListener('click', () => {
                    window.location.href = `/producto/${producto.id}`;
                });
                resultadosList.appendChild(div);
            });
        }
        
        async function cargarSugerencias() {
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
        
        // Cargar sugerencias al inicio
        cargarSugerencias();
    }
    // Agrega estas líneas en buscador.js
console.log('🎯 Buscador iniciado');
console.log('Modal encontrado:', document.getElementById('searchModal'));
console.log('Overlay encontrado:', document.getElementById('searchOverlay'));

// En la función abrirModal:
console.log('📱 Abriendo modal...');
console.log('Modal hidden:', searchModal.classList.contains('hidden'));
})();