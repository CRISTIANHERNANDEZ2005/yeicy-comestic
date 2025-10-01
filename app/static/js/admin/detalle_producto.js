document.addEventListener('DOMContentLoaded', function () {
    const reviewsSection = document.getElementById('reviews-section');
    if (!reviewsSection) return;

    const productId = reviewsSection.dataset.productId;
    const reviewsList = document.getElementById('reviews-list');
    const reviewTemplate = document.getElementById('review-template');
    const loader = document.getElementById('reviews-loader');
    const noReviewsMessage = document.getElementById('no-reviews-message');
    const paginationContainer = document.getElementById('reviews-pagination');
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    // MEJORA: Obtener los elementos de los filtros
    const ratingFilter = document.getElementById('rating-filter');
    const sortFilter = document.getElementById('sort-filter');

    let currentPage = 1;
    let totalPages = 1;

    /**
     * Función principal para obtener y renderizar las reseñas.
     * @param {number} page - El número de página a solicitar.
     * @param {string} rating - El filtro de calificación.
     * @param {string} sort - El criterio de ordenamiento.
     */
    async function fetchAndRenderReviews(page = 1, rating = 'all', sort = 'newest') {
        if (!productId) return;

        // Mostrar el loader y ocultar contenido anterior
        loader.classList.remove('hidden');
        reviewsList.classList.add('hidden');
        noReviewsMessage.classList.add('hidden');
        paginationContainer.classList.add('hidden');

        // MEJORA: Construir la URL con todos los parámetros de filtro.
        const params = new URLSearchParams({
            page: page,
            sort: sort
        });
        if (rating && rating !== 'all') {
            params.append('rating', rating);
        }
        const apiUrl = `/admin/api/producto/${productId}/reviews?${params.toString()}`;

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.statusText}`);
            }
            const data = await response.json();

            if (data.success) {
                currentPage = data.pagination.page;
                totalPages = data.pagination.pages;
                renderReviews(data.reviews);
                updatePaginationControls(data.pagination);
            } else {
                showErrorState('No se pudieron cargar las reseñas.');
            }
        } catch (error) {
            console.error('Error al obtener reseñas:', error);
            showErrorState('Error de conexión al cargar las reseñas.');
        } finally {
            // Ocultar el loader
            loader.classList.add('hidden');
        }
    }

    /**
     * Renderiza la lista de reseñas en el DOM.
     * @param {Array} reviews - Un array de objetos de reseña.
     */
    function renderReviews(reviews) {
        reviewsList.innerHTML = ''; // Limpiar la lista

        if (reviews.length === 0) {
            noReviewsMessage.classList.remove('hidden');
            reviewsList.classList.add('hidden');
        } else {
            reviews.forEach(review => {
                const clone = reviewTemplate.content.cloneNode(true);
                const reviewItem = clone.querySelector('.review-item');

                // Poblar datos de la reseña
                const user = review.usuario;
                const initials = (user.nombre?.[0] || '') + (user.apellido?.[0] || '');
                reviewItem.querySelector('.review-initials').textContent = initials;
                reviewItem.querySelector('.review-user').textContent = `${user.nombre} ${user.apellido}`;
                reviewItem.querySelector('.review-title').textContent = review.titulo || 'Sin título';
                reviewItem.querySelector('.review-text').textContent = review.texto;

                // Formatear fecha
                const date = new Date(review.created_at);
                reviewItem.querySelector('.review-date').textContent = date.toLocaleDateString('es-CO', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                // Renderizar estrellas
                const starsContainer = reviewItem.querySelector('.review-stars');
                starsContainer.innerHTML = ''; // Limpiar estrellas
                for (let i = 1; i <= 5; i++) {
                    const star = document.createElement('i');
                    star.className = `fas fa-star ${i <= review.calificacion ? 'text-amber-400' : 'text-gray-300'}`;
                    starsContainer.appendChild(star);
                }

                reviewsList.appendChild(clone);
            });
            reviewsList.classList.remove('hidden');
            noReviewsMessage.classList.add('hidden');
        }
    }

    /**
     * Actualiza el estado y la visibilidad de los controles de paginación.
     * @param {object} pagination - El objeto de paginación de la API.
     */
    function updatePaginationControls(pagination) {
        if (pagination.pages > 1) {
            paginationContainer.classList.remove('hidden');
            pageInfo.textContent = `Página ${pagination.page} de ${pagination.pages}`;

            // Habilitar/deshabilitar botón "Anterior"
            prevButton.disabled = !pagination.has_prev;
            prevButton.classList.toggle('disabled', !pagination.has_prev);

            // Habilitar/deshabilitar botón "Siguiente"
            nextButton.disabled = !pagination.has_next;
            nextButton.classList.toggle('disabled', !pagination.has_next);

        } else {
            paginationContainer.classList.add('hidden');
        }
    }

    /**
     * Muestra un mensaje de error en el contenedor de reseñas.
     * @param {string} message - El mensaje de error a mostrar.
     */
    function showErrorState(message) {
        reviewsList.innerHTML = '';
        noReviewsMessage.classList.remove('hidden');
        noReviewsMessage.innerHTML = `
            <div class="text-center py-10 text-red-500">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <p>${message}</p>
            </div>
        `;
    }

    // --- Event Listeners ---

    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            // MEJORA: Pasar los filtros actuales al cambiar de página.
            fetchAndRenderReviews(currentPage - 1, ratingFilter.value, sortFilter.value);
        }
    });

    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            // MEJORA: Pasar los filtros actuales al cambiar de página.
            fetchAndRenderReviews(currentPage + 1, ratingFilter.value, sortFilter.value);
        }
    });

    // MEJORA: Añadir listeners para los filtros.
    // Al cambiar un filtro, siempre se vuelve a la página 1.
    ratingFilter.addEventListener('change', () => {
        fetchAndRenderReviews(1, ratingFilter.value, sortFilter.value);
    });

    sortFilter.addEventListener('change', () => {
        fetchAndRenderReviews(1, ratingFilter.value, sortFilter.value);
    });

    // Carga inicial de las reseñas
    if (reviewsSection) {
        // MEJORA: La carga inicial también respeta los valores por defecto de los filtros.
        fetchAndRenderReviews(1, ratingFilter.value, sortFilter.value);
    }

    // --- Lógica para el botón de editar en productos inactivos ---
    const editInactiveButton = document.getElementById('edit-product-inactive-button');
    if (editInactiveButton) {
        editInactiveButton.addEventListener('click', function() {
            // Usamos el sistema de notificaciones global para mostrar una advertencia.
            if (window.toast && typeof window.toast.warning === 'function') {
                window.toast.warning('Para editar, el producto debe estar activo.', 4000);
            }
        });
    }
});