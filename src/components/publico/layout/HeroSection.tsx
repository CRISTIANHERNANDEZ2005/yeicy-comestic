import React from 'react';

const HeroSection: React.FC = () => (
  <section className="relative w-full h-[70vh] md:h-[80vh] flex items-center justify-center overflow-hidden animate-fade-in">
    {/* Collage de imágenes de productos cosméticos */}
    <div className="absolute inset-0 w-full h-full z-0 flex">
      <img
        src="https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80"
        alt="Cosméticos fondo 1"
        className="w-1/2 h-full object-cover object-center opacity-80 scale-105 blur-[1px]"
        style={{ filter: 'brightness(0.7)' }}
      />
      <img
        src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80"
        alt="Cosméticos fondo 2"
        className="w-1/2 h-full object-cover object-center opacity-80 scale-105 blur-[1px] hidden md:block"
        style={{ filter: 'brightness(0.7)' }}
      />
    </div>
    {/* Overlay degradado glamoroso */}
    <div className="absolute inset-0 bg-gradient-to-br from-pink-700/80 via-pink-300/40 to-fuchsia-200/60 z-10" />
    {/* Detalles visuales: brillos/partículas */}
    <div className="absolute left-1/4 top-10 w-24 h-24 bg-pink-200/40 rounded-full blur-2xl z-20 animate-pulse" />
    <div className="absolute right-10 bottom-10 w-16 h-16 bg-fuchsia-300/40 rounded-full blur-xl z-20 animate-pulse" />
    <div className="absolute left-10 bottom-1/4 w-10 h-10 bg-pink-400/30 rounded-full blur-lg z-20 animate-pulse" />
    {/* Contenido principal */}
    <div className="relative z-40 flex flex-col items-center text-center text-white px-4 animate-fade-in-up">
      <h1 className="text-4xl md:text-6xl font-extrabold mb-4 drop-shadow-xl tracking-tight">
        Belleza que Inspira <br />
        <span className="bg-gradient-to-r from-pink-200 via-fuchsia-300 to-pink-400 bg-clip-text text-transparent drop-shadow-lg animate-gradient-x">Ye&Cy Cosmetic</span>
      </h1>
      <p className="text-lg md:text-2xl mb-8 max-w-2xl drop-shadow-md font-medium">
        Cosméticos de alta calidad, seleccionados para realzar tu confianza y cuidar tu piel. Vive la experiencia de una tienda online pensada para ti.
      </p>
      <a href="#destacados" className="px-10 py-3 bg-white text-pink-700 font-extrabold rounded-full shadow-xl hover:bg-pink-100 hover:scale-105 transition-all text-lg md:text-xl focus:outline-none focus:ring-2 focus:ring-pink-400 flex items-center gap-2">
        <svg className="w-6 h-6 text-pink-400 animate-bounce" fill="currentColor" viewBox="0 0 20 20"><path d="M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        ¡Empieza a brillar!
      </a>
    </div>
  </section>
);

export default HeroSection; 