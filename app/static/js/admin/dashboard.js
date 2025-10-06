/**
 * @file Módulo del Dashboard de Administración.
 * @description Gestiona la carga de datos, la renderización de gráficos y la interactividad
 *              del dashboard principal, permitiendo una experiencia en tiempo real.
 *
 * @funcionalidadesClave
 * 1.  **Carga de Datos Asíncrona:** Obtiene todas las estadísticas del dashboard desde un único endpoint de API.
 * 2.  **Renderizado de Gráficos:** Utiliza Chart.js para visualizar la evolución de ganancias y la distribución de ventas por categoría.
 * 3.  **Interactividad:** Permite al usuario cambiar el período de tiempo (7d, 30d, etc.) y recarga los datos dinámicamente.
 * 4.  **Actualización de UI:** Refresca las tarjetas de estadísticas y la tabla de productos más vendidos sin recargar la página.
 * 5.  **Gestión de Estado de Carga:** Muestra esqueletos de carga (skeletons) para una mejor experiencia de usuario.
 */
const DashboardModule = (() => {
    let profitsChart = null;
    let categoriesChart = null;
    let isInitialized = false;

    // --- Funciones de Utilidad ---

    function formatCurrency(value) {
        if (value === null || value === undefined) return '$ 0';
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    }

    // --- Funciones de Renderizado y UI ---

    function renderSkeletons(show) {
        document.querySelectorAll('.skeleton-loader').forEach(el => {
            el.style.display = show ? 'block' : 'none';
        });
        document.querySelectorAll('.data-content').forEach(el => {
            el.style.visibility = show ? 'hidden' : 'visible';
        });
    }

    function updateStatCards(stats) {
        document.getElementById('total-ingresos').textContent = formatCurrency(stats.total_ingresos);
        document.getElementById('total-utilidad').textContent = formatCurrency(stats.total_utilidad);
        document.getElementById('total-inversion').textContent = formatCurrency(stats.total_inversion);
        document.getElementById('margen-ganancia').textContent = `${stats.margen_ganancia.toFixed(1)}%`;
    }

    function updateTopProducts(products) {
        const container = document.getElementById('top-products-list');
        if (!container) return;

        if (products.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="3" class="px-6 py-8 text-center text-gray-500">
                        <div class="flex flex-col items-center">
                            <i class="fas fa-box-open fa-3x text-gray-300 mb-3"></i>
                            <p>No hay datos de ventas en este período.</p>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        container.innerHTML = products.map(p => `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="p-4">
                    <div class="flex items-center">
                        <img src="${p.imagen_url}" alt="${p.nombre}" class="w-10 h-10 rounded-lg object-cover mr-4 shadow-sm">
                        <div>
                            <p class="font-semibold text-gray-800 text-sm">${p.nombre}</p>
                            <p class="text-xs text-gray-500">${p.marca}</p>
                        </div>
                    </div>
                </td>
                <td class="p-4 text-center">
                    <span class="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">${p.unidades_vendidas}</span>
                </td>
                <td class="p-4 text-right">
                    <a href="/admin/producto/${p.slug}" class="text-blue-600 hover:text-blue-800 text-sm font-medium spa-link">
                        Ver &rarr;
                    </a>
                </td>
            </tr>
        `).join('');
    }

    function createProfitsChart(data) {
        const ctx = document.getElementById('profitsChart')?.getContext('2d');
        if (!ctx) return;

        if (profitsChart) {
            profitsChart.destroy();
        }

        profitsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Utilidad',
                    data: data.values,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3b82f6',
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => formatCurrency(value)
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: context => `Utilidad: ${formatCurrency(context.raw)}`
                        }
                    }
                }
            }
        });
    }

    function createCategoriesChart(data) {
        const ctx = document.getElementById('categoriesChart')?.getContext('2d');
        if (!ctx) return;

        if (categoriesChart) {
            categoriesChart.destroy();
        }

        const hasData = data.values && data.values.some(v => v > 0);

        document.getElementById('categories-chart-container').style.display = hasData ? 'block' : 'none';
        document.getElementById('categories-chart-nodata').style.display = hasData ? 'none' : 'flex';

        if (!hasData) return;

        categoriesChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'],
                    borderColor: '#fff',
                    borderWidth: 2,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            boxWidth: 12,
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: context => `${context.label}: ${context.raw} unidades`
                        }
                    }
                }
            }
        });
    }

    // --- Lógica de Carga de Datos ---

    async function loadDashboardData(period = '30d') {
        renderSkeletons(true);

        try {
            const response = await fetch(`/admin/api/dashboard-stats?period=${period}`);
            if (!response.ok) {
                throw new Error(`Error en la respuesta de la API: ${response.statusText}`);
            }
            const data = await response.json();

            if (data.success) {
                updateStatCards(data.stats);
                updateTopProducts(data.top_products);
                createProfitsChart(data.profits_chart);
                createCategoriesChart(data.categories_chart);
            } else {
                throw new Error(data.message || 'No se pudieron cargar los datos del dashboard.');
            }
        } catch (error) {
            console.error("Error al cargar datos del dashboard:", error);
            const errorContainer = document.getElementById('dashboard-error');
            if (errorContainer) {
                errorContainer.classList.remove('hidden');
                errorContainer.querySelector('p').textContent = error.message;
            }
        } finally {
            renderSkeletons(false);
        }
    }

    // --- Inicialización y Eventos ---

    function setupEventListeners() {
        const periodSelector = document.getElementById('dashboard-period-selector');
        if (periodSelector) {
            periodSelector.addEventListener('click', (e) => {
                const button = e.target.closest('.period-btn');
                if (button && !button.classList.contains('active')) {
                    document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    const period = button.dataset.period;
                    loadDashboardData(period);
                }
            });
        }
    }

    function init() {
        // Guardia de contexto: si no estamos en la página del dashboard, no hacer nada.
        if (!document.getElementById('dashboard-container')) {
            return;
        }
        if (isInitialized) {
            return;
        }
        console.log("🚀 Initializing Dashboard Module...");

        setupEventListeners();
        loadDashboardData('30d'); // Carga inicial con 30 días

        isInitialized = true;
    }

    function destroy() {
        if (!isInitialized) {
            return;
        }
        console.log("🔥 Destroying Dashboard Module...");

        if (profitsChart) {
            profitsChart.destroy();
            profitsChart = null;
        }
        if (categoriesChart) {
            categoriesChart.destroy();
            categoriesChart = null;
        }
        // No es necesario remover los listeners si el contenedor principal se va a eliminar.
        // Si el contenedor persiste, aquí se deberían remover.

        isInitialized = false;
    }

    return {
        init,
        destroy
    };
})();

// --- Integración con el ciclo de vida de la SPA ---
document.addEventListener('content-loaded', DashboardModule.init);
document.addEventListener('content-will-load', DashboardModule.destroy);

// Carga inicial si no es una navegación SPA
if (document.readyState !== 'loading') {
    DashboardModule.init();
} else {
    document.addEventListener('DOMContentLoaded', DashboardModule.init);
}