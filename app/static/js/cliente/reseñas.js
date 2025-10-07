document.addEventListener('DOMContentLoaded', function () {
    const track = document.getElementById('reseñas-track');
    const loader = document.getElementById('reseñas-loader');
    const prevButton = document.getElementById('reseñas-prev');
    const nextButton = document.getElementById('reseñas-next');
    const indicatorsContainer = document.getElementById('reseñas-indicators');
    const noReseñas = document.getElementById('no-reseñas');
    const seccionReseñas = document.getElementById('seccion-reseñas-container');
    const template = document.getElementById('review-card-template');

    if (!seccionReseñas || !template) {
        return;
    }

    let currentIndex = 0;
    let itemsPerPage = 3; // Por defecto para escritorio
    let totalItems = 0;
    let autoSlideInterval;

    function updateItemsPerPage() {
        if (window.innerWidth < 768) {
            itemsPerPage = 1;
        } else if (window.innerWidth < 1024) {
            itemsPerPage = 2;
        } else {
            itemsPerPage = 3;
        }
    }

    function timeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return `Hace ${Math.floor(interval)} años`;
        interval = seconds / 2592000;
        if (interval > 1) return `Hace ${Math.floor(interval)} meses`;
        interval = seconds / 86400;
        if (interval > 1) return `Hace ${Math.floor(interval)} días`;
        interval = seconds / 3600;
        if (interval > 1) return `Hace ${Math.floor(interval)} horas`;
        interval = seconds / 60;
        if (interval > 1) return `Hace ${Math.floor(interval)} minutos`;
        return `Hace ${Math.floor(seconds)} segundos`;
    }

    function createStarRating(rating) {
        let stars = '';
        for (let i = 0; i < 5; i++) {
            stars += `<svg class="w-5 h-5 ${i < rating ? 'text-yellow-400' : 'text-gray-300'}" fill="currentColor" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>`;
        }
        return stars;
    }

    function updateCarousel() {
        if (!track) return;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        if (currentIndex >= totalPages) {
            currentIndex = 0;
        }
        if (currentIndex < 0) {
            currentIndex = totalPages - 1;
        }
        const offset = -currentIndex * 100;
        track.style.transform = `translateX(${offset}%)`;

        if (indicatorsContainer) {
            Array.from(indicatorsContainer.children).forEach((indicator, index) => {
                indicator.classList.toggle('bg-pink-500', index === currentIndex);
                indicator.classList.toggle('bg-gray-300', index !== currentIndex);
            });
        }
    }

    function setupIndicators() {
        if (!indicatorsContainer) return;
        indicatorsContainer.innerHTML = '';
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        for (let i = 0; i < totalPages; i++) {
            const button = document.createElement('button');
            button.classList.add('w-3', 'h-3', 'rounded-full', 'transition-all', 'duration-300');
            button.classList.toggle('bg-pink-500', i === 0);
            button.classList.toggle('bg-gray-300', i !== 0);
            button.addEventListener('click', () => {
                currentIndex = i;
                updateCarousel();
                resetAutoSlide();
            });
            indicatorsContainer.appendChild(button);
        }
    }

    function startAutoSlide() {
        autoSlideInterval = setInterval(() => {
            currentIndex++;
            updateCarousel();
        }, 5000);
    }

    function resetAutoSlide() {
        clearInterval(autoSlideInterval);
        startAutoSlide();
    }

    fetch('/api/main/featured-reviews')
        .then(response => response.json())
        .then(data => {
            if (loader) loader.style.display = 'none';
            if (data.success && data.reviews.length > 0) {
                totalItems = data.reviews.length;
                if (track) {
                    track.innerHTML = '';
                    data.reviews.forEach(review => {
                        const card = template.content.cloneNode(true);
                        const link = card.querySelector('.review-card-link');
                        const producto = review.producto;
                        
                        const url = `/${producto.categoria_slug}/${producto.subcategoria_slug}/${producto.seudocategoria_slug}/${producto.slug}`;
                        link.href = url;
                        link.dataset.slug = producto.slug;

                        card.querySelector('.user-initials').textContent = review.usuario.nombre.charAt(0);
                        card.querySelector('.user-name').textContent = review.usuario.nombre;
                        card.querySelector('.review-rating').innerHTML = createStarRating(review.calificacion);
                        const timeElement = card.querySelector('.text-sm.text-gray-500');
                        timeElement.textContent = timeAgo(review.created_at);

                        const reviewText = card.querySelector('.review-text');
                        reviewText.textContent = `"${review.comentario}"`;

                        const productImage = card.querySelector('.product-image');
                        productImage.src = producto.imagen_url;
                        productImage.alt = producto.nombre;
                        card.querySelector('.product-name').textContent = producto.nombre;

                        track.appendChild(card);
                    });
                }
                
                if (seccionReseñas) seccionReseñas.classList.remove('hidden');

                if (totalItems > 1) {
                    if (prevButton) prevButton.classList.remove('hidden');
                    if (nextButton) nextButton.classList.remove('hidden');
                    setupIndicators();
                    startAutoSlide();
                }

            } else {
                if (noReseñas) noReseñas.classList.remove('hidden');
            }
            updateItemsPerPage();
            updateCarousel();
        })
        .catch(error => {
            console.error('Error al cargar las reseñas:', error);
            if (loader) loader.style.display = 'none';
            if (noReseñas) noReseñas.classList.remove('hidden');
        });

    if (nextButton) {
        nextButton.addEventListener('click', () => {
            currentIndex++;
            updateCarousel();
            resetAutoSlide();
        });
    }

    if (prevButton) {
        prevButton.addEventListener('click', () => {
            currentIndex--;
            updateCarousel();
            resetAutoSlide();
        });
    }

    window.addEventListener('resize', () => {
        updateItemsPerPage();
        setupIndicators();
        updateCarousel();
    });
});