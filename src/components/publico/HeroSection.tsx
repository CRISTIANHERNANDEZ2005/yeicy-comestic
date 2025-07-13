import React from 'react';

const HeroSection: React.FC = () => (
  <section className="relative w-full h-[65vh] md:h-[75vh] flex items-center justify-center overflow-hidden animate-fade-in">
    <img
      src="https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80"
      alt="Cosméticos hero"
      className="absolute inset-0 w-full h-full object-cover object-center z-0 scale-105 transition-transform duration-700"
      style={{ filter: 'brightness(0.6)' }}
    />
    <div className="absolute inset-0 bg-gradient-to-br from-pink-700/70 to-pink-300/40 z-10" />
    <div className="relative z-20 flex flex-col items-center text-center text-white px-4 animate-fade-in-up">
      <h1 className="text-4xl md:text-6xl font-extrabold mb-4 drop-shadow-lg">
        Descubre tu Belleza <br />
        <span className="text-pink-200">con Ye&Cy Cosmetic</span>
      </h1>
      <p className="text-lg md:text-2xl mb-8 max-w-2xl drop-shadow">
        Productos de alta calidad, seleccionados para realzar tu confianza y cuidar tu piel. Vive la experiencia de una tienda online pensada para ti.
      </p>
      <a href="#destacados" className="px-8 py-3 bg-white text-pink-700 font-bold rounded-lg shadow-lg hover:bg-pink-100 transition-all text-lg animate-bounce">
        ¡Empieza a brillar hoy!
      </a>
    </div>
  </section>
);

export default HeroSection; 