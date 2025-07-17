import React, { useEffect, useState, useRef } from 'react';
import { categoriasService } from '../../../services/api';
import SkeletonLoader from '../ui/SkeletonLoader';

interface Categoria {
  id: number;
  nombre: string;
  descripcion: string;
  imagen?: string | null;
  subcategorias_count?: number;
}
interface Subcategoria {
  id: number;
  nombre: string;
  descripcion: string;
}

const fallbackImg = '/yc-logo.svg';

const CategoriasSection: React.FC = () => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [showSub, setShowSub] = useState(false);
  const [catSeleccionada, setCatSeleccionada] = useState<Categoria | null>(null);
  const [subcategoriasLoading, setSubcategoriasLoading] = useState(false);
  const [subcategoriasError, setSubcategoriasError] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const subcategoriasCache = useRef<Map<number, Subcategoria[]>>(new Map());
  const modalRef = useRef<HTMLDivElement>(null);

  // 1. Agregar estado y lógica para navegación del carrusel
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // 1. Estados y refs para el carrusel de subcategorías
  const subCarouselRef = useRef<HTMLDivElement>(null);
  const [canSubScrollLeft, setCanSubScrollLeft] = useState(false);
  const [canSubScrollRight, setCanSubScrollRight] = useState(false);

  const loadCategorias = async (forceRefresh: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await categoriasService.getCategorias(forceRefresh);
      setCategorias(data);
      setError(null);
    } catch (err) {
      setError('No se pudieron cargar las categorías.');
      console.error('Error cargando categorías:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategorias();
  }, []);

  const handleCategoriaHover = async (cat: Categoria) => {
    if (!subcategoriasCache.current.has(cat.id)) {
      try {
        const subcats = await categoriasService.getSubcategorias(cat.id);
        subcategoriasCache.current.set(cat.id, subcats);
      } catch (error) {
        // No mostrar error aquí, solo prefetch
      }
    }
  };

  const handleCategoriaClick = async (cat: Categoria) => {
    setCatSeleccionada(cat);
    setShowSub(true);
    setSubcategoriasLoading(true);
    setSubcategoriasError(null);
    if (subcategoriasCache.current.has(cat.id)) {
      setSubcategorias(subcategoriasCache.current.get(cat.id)!);
      setSubcategoriasLoading(false);
      return;
    }
    try {
      const subcats = await categoriasService.getSubcategorias(cat.id);
      setSubcategorias(subcats);
      subcategoriasCache.current.set(cat.id, subcats);
    } catch (error) {
      setSubcategorias([]);
      setSubcategoriasError('No se pudieron cargar las subcategorías.');
      console.error('Error cargando subcategorías:', error);
    } finally {
      setSubcategoriasLoading(false);
    }
  };

  const handleRefreshData = () => {
    categoriasService.clearCache();
    loadCategorias(true);
  };

  useEffect(() => {
    if (!showSub) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSub(false);
      if (e.key === 'Tab' && modalRef.current) {
        const focusableEls = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstEl = focusableEls[0];
        const lastEl = focusableEls[focusableEls.length - 1];
        if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        } else if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    setTimeout(() => {
      modalRef.current?.focus();
    }, 100);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSub]);

  // 2. Funciones para scroll del carrusel
  const scrollCarousel = (dir: 'left' | 'right') => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const scrollAmount = carousel.offsetWidth * 0.7;
    carousel.scrollBy({ left: dir === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  };

  // 3. Actualizar visibilidad de botones
  const updateScrollButtons = () => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    setCanScrollLeft(carousel.scrollLeft > 10);
    setCanScrollRight(carousel.scrollLeft + carousel.offsetWidth < carousel.scrollWidth - 10);
  };

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    updateScrollButtons();
    const onScroll = () => updateScrollButtons();
    carousel.addEventListener('scroll', onScroll);
    window.addEventListener('resize', updateScrollButtons);
    return () => {
      carousel.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [loading]);

  // 2. Funciones para scroll del carrusel de subcategorías
  const scrollSubCarousel = (dir: 'left' | 'right') => {
    const carousel = subCarouselRef.current;
    if (!carousel) return;
    const scrollAmount = carousel.offsetWidth * 0.7;
    carousel.scrollBy({ left: dir === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  };

  const updateSubScrollButtons = () => {
    const carousel = subCarouselRef.current;
    if (!carousel) return;
    setCanSubScrollLeft(carousel.scrollLeft > 10);
    setCanSubScrollRight(carousel.scrollLeft + carousel.offsetWidth < carousel.scrollWidth - 10);
  };

  useEffect(() => {
    if (!showSub) return;
    const carousel = subCarouselRef.current;
    if (!carousel) return;
    updateSubScrollButtons();
    const onScroll = () => updateSubScrollButtons();
    carousel.addEventListener('scroll', onScroll);
    window.addEventListener('resize', updateSubScrollButtons);
    return () => {
      carousel.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateSubScrollButtons);
    };
  }, [showSub, subcategorias]);

  return (
    <section className="w-full py-16 bg-gradient-to-r from-pink-50 to-pink-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-pink-700 mb-4 tracking-tight">
            Explora Nuestras <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-500">Categorías</span>
          </h2>
          <div className="flex items-center justify-center gap-2 max-w-2xl mx-auto">
            <svg className="w-5 h-5 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
            <p className="text-pink-700 font-medium text-lg md:text-xl text-center drop-shadow-sm">
              Explora nuestra <span className="font-semibold text-rose-600">curated collection</span> de productos premium de belleza
            </p>
          </div>
        </div>
        
        {loading ? (
          <div className="flex gap-6 overflow-x-auto pb-4">
            {[...Array(4)].map((_, i) => (
              <SkeletonLoader key={i} className="w-56 h-64 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center text-red-500 flex flex-col items-center gap-4" role="alert" aria-live="polite">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4a2 2 0 100 4m0-4a2 2 0 110 4" />
              </svg>
              <span className="font-semibold">Error al cargar categorías</span>
            </div>
            <p className="text-sm text-gray-600 max-w-md">{error}</p>
            <div className="flex gap-2">
              <button
                className="mt-2 px-4 py-2 bg-pink-500 text-white rounded-lg shadow hover:bg-pink-700 transition focus:outline-none focus:ring-2 focus:ring-pink-400"
                onClick={() => loadCategorias()}
                aria-label="Reintentar cargar categorías"
              >
                Reintentar
              </button>
              <button
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
                onClick={handleRefreshData}
                aria-label="Actualizar datos de categorías"
              >
                Actualizar Datos
              </button>
            </div>
          </div>
        ) : categorias.length === 0 ? (
          <div className="text-center text-gray-500 flex flex-col items-center gap-4" role="status" aria-live="polite">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
              </svg>
              <span className="font-semibold">No hay categorías disponibles</span>
            </div>
            <p className="text-sm text-gray-600 max-w-md">
              En este momento no hay categorías de productos disponibles. Intenta más tarde.
            </p>
            <button
              className="mt-2 px-4 py-2 bg-pink-500 text-white rounded-lg shadow hover:bg-pink-700 transition focus:outline-none focus:ring-2 focus:ring-pink-400"
              onClick={() => loadCategorias(true)}
              aria-label="Recargar categorías"
            >
              Recargar
            </button>
          </div>
        ) : (
          <div className="relative">
            {canScrollLeft && (
              <button
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-gradient-to-br from-pink-400 via-fuchsia-400 to-rose-400 text-white shadow-xl rounded-full p-3 hover:scale-110 hover:shadow-2xl transition-all border-4 border-white focus:outline-none focus:ring-2 focus:ring-pink-300 animate-glow"
                style={{ boxShadow: '0 4px 24px 0 rgba(236, 72, 153, 0.25)' }}
                onClick={() => scrollCarousel('left')}
                aria-label="Desplazar categorías a la izquierda"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
            )}
            <div
              ref={carouselRef}
              className="flex gap-12 overflow-x-auto pb-8 px-2 cursor-grab select-none scrollbar-thin scrollbar-thumb-pink-200 scrollbar-track-pink-50 categories-carousel"
              tabIndex={0}
              aria-label="Carrusel de categorías"
              style={{ scrollSnapType: 'x mandatory', paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
            >
              {categorias.map((cat, idx) => {
                const descripcionCategoria = cat.descripcion?.trim() ? cat.descripcion : 'Descubre nuestra exclusiva selección de productos pensados para ti.';
                return (
                  <div
                    key={cat.id}
                    className="flex-shrink-0 w-56 rounded-2xl p-6 flex flex-col items-center gap-4 cursor-pointer relative group bg-white/70 backdrop-blur-md shadow-2xl hover:shadow-rose-300 transition-all duration-300 hover:-translate-y-1 category-card animate-fadeIn"
                    style={{ scrollSnapAlign: idx === 0 ? 'start' : idx === categorias.length - 1 ? 'end' : 'center', marginRight: idx === categorias.length - 1 ? 0 : '-2rem' }}
                    onClick={() => handleCategoriaClick(cat)}
                    onMouseEnter={() => handleCategoriaHover(cat)}
                    tabIndex={0}
                    role="button"
                    aria-label={`Explorar colecciones de ${cat.nombre}`}
                    onKeyDown={e => { if (e.key === 'Enter') handleCategoriaClick(cat); }}
                  >
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-pink-100 via-fuchsia-100 to-rose-100 flex items-center justify-center border-4 border-white shadow-lg group-hover:shadow-xl transition-all category-image-container">
                      {cat.imagen ? (
                        <img
                          src={cat.imagen}
                          alt={cat.nombre}
                          className="object-cover w-full h-full"
                          loading="lazy"
                        />
                      ) : (
                        <img
                          src={fallbackImg}
                          alt="Categoría"
                          className="object-contain w-12 h-12 opacity-60"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="text-center">
                      <h3 className="font-bold text-pink-800 text-xl mb-2 line-clamp-2">
                        {cat.nombre}
                      </h3>
                      <p className="text-gray-600 text-sm line-clamp-2">
                        {descripcionCategoria}
                      </p>
                    </div>
                    {/* Badge descriptivo para colecciones */}
                    {typeof cat.subcategorias_count === 'number' && cat.subcategorias_count > 0 && (
                      <span className="absolute top-0 right-0 transform translate-x-2 -translate-y-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg border-2 border-white flex items-center gap-1 animate-fadeIn">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        Explorar colecciones
                      </span>
                    )}
                    {/* Tooltip o texto visible para acción */}
                    {typeof cat.subcategorias_count === 'number' && cat.subcategorias_count > 0 && (
                      <span className="mt-2 text-xs text-pink-500 font-medium group-hover:underline">Haz clic para descubrir más</span>
                    )}
                  </div>
                );
              })}
            </div>
            {canScrollRight && (
              <button
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-gradient-to-br from-pink-400 via-fuchsia-400 to-rose-400 text-white shadow-xl rounded-full p-3 hover:scale-110 hover:shadow-2xl transition-all border-4 border-white focus:outline-none focus:ring-2 focus:ring-pink-300 animate-glow"
                style={{ boxShadow: '0 4px 24px 0 rgba(236, 72, 153, 0.25)' }}
                onClick={() => scrollCarousel('right')}
                aria-label="Desplazar categorías a la derecha"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            )}
          </div>
        )}
        
        {/* Modal mejorada con mensaje contextual y tarjetas de colección mejoradas */}
        {showSub && catSeleccionada && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[3px] flex items-center justify-center z-50 p-4 subcategories-modal"
            onClick={e => {
              if (e.target === e.currentTarget) setShowSub(false);
            }}
            tabIndex={-1}
          >
            <div
              ref={modalRef}
              tabIndex={-1}
              className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border-2 border-pink-100 animate-modalContentIn"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-pink-500 via-fuchsia-400 to-rose-500 p-7 text-white relative">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <svg className="w-10 h-10 text-yellow-300 drop-shadow-lg" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="#fef3c7" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01" /></svg>
                    <h3 className="text-2xl md:text-3xl font-bold drop-shadow-lg">
                      {catSeleccionada.nombre}
                    </h3>
                  </div>
                  <button
                    className="text-white hover:text-yellow-200 text-3xl font-bold focus:outline-none transition-colors px-2 py-1 rounded-full hover:bg-white/10 focus:ring-2 focus:ring-yellow-200"
                    onClick={() => setShowSub(false)}
                    aria-label="Cerrar modal"
                  >
                    &times;
                  </button>
                </div>
                <p className="text-pink-100 mt-2">
                  {catSeleccionada.descripcion?.trim() ? catSeleccionada.descripcion : 'Descubre las colecciones más exclusivas y productos irresistibles pensados para ti.'}
                </p>
              </div>
              <div className="p-8 overflow-y-auto flex-1">
                {/* Mensaje contextual */}
                <div className="mb-6 text-center">
                  <span className="inline-block bg-gradient-to-r from-pink-100 via-fuchsia-100 to-rose-100 text-pink-700 px-4 py-2 rounded-full font-semibold shadow-sm animate-fadeIn">
                    Selecciona una colección para descubrir productos únicos
                  </span>
                </div>
                {subcategoriasLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
                  </div>
                ) : subcategoriasError ? (
                  <div className="text-center text-red-500 text-lg py-12">
                    {subcategoriasError}
                  </div>
                ) : subcategorias.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-12">
                    <svg className="w-16 h-16 mb-4 text-pink-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-lg">No hay colecciones disponibles</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Carrusel de subcategorías con botones de navegación solo en desktop */}
                    {subcategorias.length > 0 && (
                      <div className="relative">
                        {/* Botones solo visibles en md+ */}
                        {canSubScrollLeft && (
                          <button
                            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-gradient-to-br from-pink-400 via-fuchsia-400 to-rose-400 text-white shadow-xl rounded-full p-3 hover:scale-110 hover:shadow-2xl transition-all border-4 border-white focus:outline-none focus:ring-2 focus:ring-pink-300 animate-glow"
                            style={{ boxShadow: '0 4px 24px 0 rgba(236, 72, 153, 0.25)' }}
                            onClick={() => scrollSubCarousel('left')}
                            aria-label="Desplazar colecciones a la izquierda"
                          >
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                          </button>
                        )}
                        <div
                          ref={subCarouselRef}
                          className="flex flex-col md:flex-row gap-6 overflow-x-visible md:overflow-x-auto pb-4 px-2 cursor-pointer select-none scrollbar-thin scrollbar-thumb-pink-200 scrollbar-track-pink-50 subcategories-carousel"
                          style={{ scrollSnapType: 'x mandatory', paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                          tabIndex={0}
                          aria-label="Carrusel de colecciones"
                        >
                          {subcategorias.map((sub, idx) => {
                            const descripcionSub = sub.descripcion?.trim() ? sub.descripcion : 'Explora productos seleccionados especialmente para ti en esta colección.';
                            return (
                              <div
                                key={sub.id}
                                className="w-full md:w-64 flex-shrink-0 rounded-2xl p-6 cursor-pointer text-center bg-white/70 backdrop-blur-md border-2 border-pink-100 hover:bg-gradient-to-br hover:from-pink-50 hover:to-rose-100 hover:shadow-2xl transition-all subcategory-item animate-fadeIn group"
                                style={{ scrollSnapAlign: idx === 0 ? 'start' : idx === subcategorias.length - 1 ? 'end' : 'center', animationDelay: `${idx * 60}ms` }}
                                onClick={() => window.location.href = `/subcategoria/${sub.id}`}
                                tabIndex={0}
                                role="button"
                                aria-label={`Ver productos de la colección ${sub.nombre}`}
                                onKeyDown={e => { if (e.key === 'Enter') window.location.href = `/subcategoria/${sub.id}`; }}
                              >
                                <div className="flex justify-center mb-2">
                                  <svg className="w-8 h-8 text-pink-400 group-hover:scale-110 group-hover:text-rose-400 transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="#fce7f3" /></svg>
                                </div>
                                <h4 className="font-bold text-pink-700 text-lg mb-1">
                                  {sub.nombre}
                                </h4>
                                <p className="text-gray-600 text-sm line-clamp-2 mb-2">
                                  {descripcionSub}
                                </p>
                                {/* Icono de acción y texto */}
                                <div className="flex flex-col items-center gap-1 mt-2">
                                  <span className="inline-flex items-center gap-1 text-pink-500 text-xs font-semibold bg-pink-50 px-3 py-1 rounded-full shadow-sm animate-fadeIn">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m6 0l-3-3m3 3l-3 3" /></svg>
                                    Haz clic para descubrir productos
                                  </span>
                                </div>
                                {/* Badge ejemplo para colección destacada */}
                                {idx === 0 && (
                                  <span className="inline-block mt-2 px-3 py-1 bg-gradient-to-r from-yellow-200 via-pink-200 to-rose-200 text-yellow-900 text-xs font-semibold rounded-full shadow border border-yellow-300 animate-bounce">¡Popular!</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {canSubScrollRight && (
                          <button
                            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-gradient-to-br from-pink-400 via-fuchsia-400 to-rose-400 text-white shadow-xl rounded-full p-3 hover:scale-110 hover:shadow-2xl transition-all border-4 border-white focus:outline-none focus:ring-2 focus:ring-pink-300 animate-glow"
                            style={{ boxShadow: '0 4px 24px 0 rgba(236, 72, 153, 0.25)' }}
                            onClick={() => scrollSubCarousel('right')}
                            aria-label="Desplazar colecciones a la derecha"
                          >
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="border-t border-gray-100 p-4 flex justify-center bg-white/60">
                <button
                  onClick={() => setShowSub(false)}
                  className="px-6 py-2 rounded-full bg-gradient-to-r from-pink-100 via-fuchsia-100 to-rose-100 text-pink-700 hover:bg-pink-200 transition-colors font-medium shadow-md"
                >
                  Volver a categorías
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default CategoriasSection;