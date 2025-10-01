/**
 * @file Módulo de la Página de Inicio (Index).
 * @description Gestiona la interactividad de la página principal, incluyendo la carga
 *              dinámica de contenido exclusivo para usuarios autenticados y la gestión
 *              de modales para interacciones de usuarios no autenticados.
 *
 * @class SimpleCarousel - Clase reutilizable para carruseles básicos.
 * @class HomePageManager - Gestiona la lógica específica de la página de inicio.
 */

class SimpleCarousel {
  constructor(options) {
    this.track = document.getElementById(options.trackId);
    this.prevBtn = document.getElementById(options.prevBtnId);
    this.nextBtn = document.getElementById(options.nextBtnId);
    this.indicatorsContainer = document.getElementById(options.indicatorsId);
    this.products = [];
    this.slides = [];
    this.currentIndex = 0;

    // MEJORA PROFESIONAL: Código defensivo.
    // Solo añadir listeners si los elementos existen para evitar errores.
    if (this.track && this.prevBtn && this.nextBtn) {
      this.prevBtn.addEventListener('click', () => this.navigate('prev'));
      this.nextBtn.addEventListener('click', () => this.navigate('next'));
      window.addEventListener('resize', () => this.updateSlides());
    } else {
      console.warn(`Carousel elements not found for trackId: ${options.trackId}. Carousel will not be initialized.`);
    }
  }

  /**
   * MEJORA: Construye las diapositivas del carrusel de forma responsiva.
   * Agrupa los productos en diapositivas de 2 en móvil y 4 en escritorio.
   */
  updateSlides() {
    if (this.products.length === 0) return;

    const isMobile = window.innerWidth < 768;
    const itemsPerSlide = isMobile ? 2 : 4;

    this.slides = [];
    for (let i = 0; i < this.products.length; i += itemsPerSlide) {
      const slide = document.createElement('div');
      // MEJORA: Se añade la clase 'carousel-slide' para que coincida con el carrusel principal.
      slide.className = 'carousel-slide w-full flex-shrink-0';

      const grid = document.createElement('div');
      // Clases responsivas para la cuadrícula dentro de la diapositiva.
      grid.className = 'grid grid-cols-2 md:grid-cols-4 gap-4 px-2';
      
      const slideProducts = this.products.slice(i, i + itemsPerSlide);
      slideProducts.forEach(producto => {
        if (typeof renderProductCard === 'function') {
          const card = renderProductCard(producto);
          grid.appendChild(card);
        }
      });
      // CORRECCIÓN: Añadir la cuadrícula (con los productos) a la diapositiva.
      slide.appendChild(grid);
      this.slides.push(slide);
    }

    this.track.innerHTML = '';
    this.slides.forEach(slide => this.track.appendChild(slide));
    this.currentIndex = 0; // Reset index on rebuild
    this.update();
  }

  navigate(direction) {
    const newIndex = direction === 'next' ? this.currentIndex + 1 : this.currentIndex - 1;
    this.currentIndex = (newIndex + this.slides.length) % this.slides.length;
    this.update();
  }

  update() {
    this.track.style.transform = `translateX(-${this.currentIndex * 100}%)`;
    this.updateIndicators();
  }

  updateIndicators() {
    if (!this.indicatorsContainer) return;
    const isMobile = window.innerWidth < 768;
    this.indicatorsContainer.innerHTML = '';

    // Ocultar controles e indicadores si solo hay una diapositiva o menos
    if (this.slides.length <= 1) {
      this.indicatorsContainer.style.display = 'none';
      this.prevBtn.classList.add('opacity-0', 'scale-90', 'pointer-events-none');
      this.nextBtn.classList.add('opacity-0', 'scale-90', 'pointer-events-none');
      return;
    }
    
    // Mostrar indicadores solo en móvil
    // MEJORA PROFESIONAL: Mostrar indicadores en todas las resoluciones si hay más de una diapositiva.
    // Esto proporciona una navegación consistente tanto en móvil como en escritorio.
    //  Animar la aparición de los botones.
    this.prevBtn.classList.remove('opacity-0', 'scale-90', 'pointer-events-none');
    // Forzar reflow para que la transición se aplique
    void this.prevBtn.offsetWidth;
    void this.nextBtn.offsetWidth;
    this.nextBtn.classList.remove('opacity-0', 'scale-90', 'pointer-events-none');
    this.indicatorsContainer.style.display = 'flex';

    this.slides.forEach((_, index) => {
      const indicator = document.createElement('button');
      indicator.className = `w-2.5 h-2.5 rounded-full transition-all duration-300 ${index === this.currentIndex ? 'bg-pink-500 scale-125' : 'bg-gray-300'}`;
      indicator.onclick = () => {
        this.currentIndex = index;
        this.update();
      };
      this.indicatorsContainer.appendChild(indicator);
    });
  }
}

/**
 * @description Gestiona la interactividad de la página principal, incluyendo la carga
 *              dinámica de contenido exclusivo para usuarios autenticados y la gestión
 *              de modales para interacciones de usuarios no autenticados.
 *
 * @class HomePageManager
 */

class HomePageManager {
  constructor() {
    this.likeAuthModalTimeout = null;
    // MEJORA: Inicializar la propiedad del carrusel como null.
    // Se creará solo si el usuario está autenticado.
    this.recomendacionesCarousel = null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.updateLikeBtnStyles();
    // Inicia la carga de recomendaciones si el usuario está autenticado.
    // La inicialización del carrusel se mueve aquí, dentro de la condición.
    if (window.USUARIO_AUTENTICADO) {
      this.recomendacionesCarousel = new SimpleCarousel({
        trackId: 'recomendaciones-track',
        prevBtnId: 'recomendaciones-prev',
        nextBtnId: 'recomendaciones-next',
        indicatorsId: 'recomendaciones-indicators',
      });
      this.initRecomendaciones();
    }
  }

  bindEvents() {
    const loginBtn = document.getElementById("like-auth-login-btn");
    if (loginBtn) {
      loginBtn.addEventListener("click", () => this.hideLikeAuthModal());
    }

    document.addEventListener("click", (e) => {
      const likeBtn = e.target.closest(".like-btn");
      if (likeBtn && !window.USUARIO_AUTENTICADO) {
        e.preventDefault();
        this.showLikeAuthModal();
      }
    });

    window.addEventListener("resize", () => this.updateLikeBtnStyles());
  }

  showLikeAuthModal(msg) {
    const modal = document.getElementById("like-auth-modal");
    const modalInner = document.getElementById("like-auth-modal-inner");
    const modalMsg = document.getElementById("like-auth-modal-msg");

    if (modal && modalMsg && modalInner) {
      modalMsg.textContent = msg || "Debes iniciar sesión para guardar productos.";
      
      if (window.innerWidth < 768) {
        modal.classList.remove("items-end", "justify-start");
        modal.classList.add("items-end", "justify-center");
        modal.style.bottom = "70px";
        modal.style.left = "0";
        modal.style.right = "0";
      } else {
        modal.classList.remove("items-end", "justify-center");
        modal.classList.add("items-end", "justify-start");
        modal.style.bottom = "40px";
        modal.style.left = "40px";
        modal.style.right = "";
      }

      modal.style.display = "flex";
      modalInner.classList.remove("modal-animate-out");
      modalInner.classList.add("modal-animate-in");

      clearTimeout(this.likeAuthModalTimeout);
      this.likeAuthModalTimeout = setTimeout(() => this.hideLikeAuthModal(), 5000);
    }
  }

  hideLikeAuthModal() {
    const modal = document.getElementById("like-auth-modal");
    const modalInner = document.getElementById("like-auth-modal-inner");

    if (modal && modalInner) {
      modalInner.classList.remove("modal-animate-in");
      modalInner.classList.add("modal-animate-out");
      setTimeout(() => {
        modal.style.display = "none";
      }, 450);
    }
    clearTimeout(this.likeAuthModalTimeout);
  }

  updateLikeBtnStyles() {
    const isMobile = window.innerWidth < 768;
    document.querySelectorAll(".like-btn .like-icon").forEach((icon) => {
      if (isMobile) {
        icon.classList.add("w-9", "h-9");
        icon.classList.remove("w-7", "h-7", "w-6", "h-6", "w-5", "h-5");
      } else {
        icon.classList.remove("w-9", "h-9");
        icon.classList.add("w-6", "h-6", "md:w-5", "md:h-5");
      }
    });
  }

  /**
   * Carga y renderiza productos recomendados para el usuario autenticado.
   */
  async initRecomendaciones() {
    const container = document.getElementById("recomendaciones-container");
    const loader = document.getElementById("recomendaciones-loader");
    const noRecomendaciones = document.getElementById("no-recomendaciones");

    if (!container || !loader || !noRecomendaciones || !this.recomendacionesCarousel) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch('/api/productos/recomendados', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Error al cargar recomendaciones desde la API.');
      
      const productos = await response.json();

      loader.style.display = "none";

      if (productos && productos.length > 0) {
        // MEJORA: Pasamos los productos al carrusel y él se encarga de la lógica responsiva.
        this.recomendacionesCarousel.products = productos;
        this.recomendacionesCarousel.updateSlides();

      } else {
        noRecomendaciones.style.display = 'block';
      }
    } catch (error) {
      console.error("Error al cargar recomendaciones:", error);
      // MEJORA PROFESIONAL: Si hay un error, ocultar toda la sección de recomendaciones.
      // Es una mejor experiencia de usuario que mostrar un mensaje de error persistente.
      if (container) {
        container.style.display = 'none';
      }
    }
  }
}
document.addEventListener("DOMContentLoaded", () => {
  new HomePageManager();
});
