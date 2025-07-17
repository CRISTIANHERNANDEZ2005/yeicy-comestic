import React, { useRef, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface CarouselProps {
  children: ReactNode;
  className?: string;
  scrollAmount?: number;
  itemClassName?: string;
  ariaLabel?: string;
}

const Carousel: React.FC<CarouselProps> = ({
  children,
  className = '',
  scrollAmount,
  itemClassName = '',
  ariaLabel = 'Carrusel',
}) => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showNav, setShowNav] = useState(false);
  // Eliminar estados y funciones de drag to scroll

  // Solo mostrar botones si hay scroll horizontal y hay al menos 2 ítems
  const updateScrollButtons = () => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const itemCount = React.Children.count(children);
    if (itemCount < 2) {
      setShowNav(false);
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    // Espera a que el DOM se actualice para obtener el scrollWidth correcto
    setTimeout(() => {
      if (!carousel) return;
      const canScroll = carousel.scrollWidth > carousel.offsetWidth + 2;
      setShowNav(canScroll);
      setCanScrollLeft(canScroll && carousel.scrollLeft > 10);
      setCanScrollRight(canScroll && carousel.scrollLeft + carousel.offsetWidth < carousel.scrollWidth - 10);
    }, 0);
  };

  // Utilidad para ease-in-out expo
  function easeInOutExpo(t: number) {
    return t === 0
      ? 0
      : t === 1
      ? 1
      : t < 0.5
      ? Math.pow(2, 20 * t - 10) / 2
      : (2 - Math.pow(2, -20 * t + 10)) / 2;
  }

  // Variable para guardar el id de la animación previa
  let currentAnimationId: number | null = null;

  // Animación personalizada de scroll, cancela la previa si existe
  function smoothScrollTo(element: HTMLElement, to: number, duration = 1200) {
    if (currentAnimationId !== null) {
      cancelAnimationFrame(currentAnimationId);
      currentAnimationId = null;
    }
    const start = element.scrollLeft;
    const change = to - start;
    const startTime = performance.now();

    function animateScroll(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = easeInOutExpo(progress);
      element.scrollLeft = start + change * ease;
      if (progress < 1) {
        currentAnimationId = requestAnimationFrame(animateScroll);
      } else {
        currentAnimationId = null;
      }
    }
    currentAnimationId = requestAnimationFrame(animateScroll);
  }

  const scroll = (dir: 'left' | 'right') => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const childrenArray = Array.from(carousel.children) as HTMLElement[];
    const scrollLeft = carousel.scrollLeft;
    let targetIndex = -1;
    if (dir === 'right') {
      // Encuentra el primer elemento que no está completamente visible a la derecha
      targetIndex = childrenArray.findIndex(child => child.offsetLeft > scrollLeft + 1);
      if (targetIndex === -1) targetIndex = childrenArray.length - 1;
    } else {
      // Encuentra el último elemento que no está completamente visible a la izquierda
      for (let i = childrenArray.length - 1; i >= 0; i--) {
        if (childrenArray[i].offsetLeft + childrenArray[i].offsetWidth < scrollLeft - 1) {
          targetIndex = i;
          break;
        }
      }
      if (targetIndex === -1) targetIndex = 0;
    }
    const target = childrenArray[targetIndex];
    if (target && carousel) {
      // Calcula el destino para alinear el elemento perfectamente a la izquierda
      const targetScroll = target.offsetLeft;
      smoothScrollTo(carousel, targetScroll, 1200);
    }
  };

  useEffect(() => {
    updateScrollButtons();
    const handleResize = () => updateScrollButtons();
    const handleScroll = () => updateScrollButtons();
    window.addEventListener('resize', handleResize);
    const carousel = carouselRef.current;
    if (carousel) {
      carousel.addEventListener('scroll', handleScroll);
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      if (carousel) {
        carousel.removeEventListener('scroll', handleScroll);
      }
    };
    // eslint-disable-next-line
  }, [children]);

  // Extrae clases de gap-x de className y las aplica al contenedor de la lista
  const gapClass = className.split(' ').find(c => c.startsWith('gap-')) || '';
  const outerClass = className.replace(gapClass, '').trim();

  return (
    <div className={`carousel-container relative ${outerClass}`}>
      {/* Botón izquierdo */}
      {showNav && (
        <button
          className={`carousel-nav left ${canScrollLeft ? 'active' : 'disabled'} bg-gradient-to-br from-pink-400 via-fuchsia-400 to-rose-400 text-white shadow-xl rounded-full p-3 border-4 border-white focus:outline-none focus:ring-2 focus:ring-pink-300 transition-all animate-glow ${canScrollLeft ? 'hover:scale-110 hover:shadow-2xl' : ''}`}
          style={{ boxShadow: '0 4px 24px 0 rgba(236, 72, 153, 0.25)' }}
          onClick={() => scroll('left')}
          aria-label="Desplazar carrusel a la izquierda"
          disabled={!canScrollLeft}
          type="button"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
      )}
      <div
        className={`carousel-list flex overflow-x-auto pb-6 snap-x snap-mandatory ${gapClass}`}
        ref={carouselRef}
        tabIndex={0}
        aria-label={ariaLabel}
        // Eliminados onMouseDown, onMouseMove, onMouseUp, onMouseLeave y style de cursor
      >
        {React.Children.map(children, child => (
          <div className={itemClassName}>{child}</div>
        ))}
      </div>
      {/* Botón derecho */}
      {showNav && (
        <button
          className={`carousel-nav right ${canScrollRight ? 'active' : 'disabled'} bg-gradient-to-br from-pink-400 via-fuchsia-400 to-rose-400 text-white shadow-xl rounded-full p-3 border-4 border-white focus:outline-none focus:ring-2 focus:ring-pink-300 transition-all animate-glow ${canScrollRight ? 'hover:scale-110 hover:shadow-2xl' : ''}`}
          style={{ boxShadow: '0 4px 24px 0 rgba(236, 72, 153, 0.25)' }}
          onClick={() => scroll('right')}
          aria-label="Desplazar carrusel a la derecha"
          disabled={!canScrollRight}
          type="button"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      )}
    </div>
  );
};

export default Carousel; 