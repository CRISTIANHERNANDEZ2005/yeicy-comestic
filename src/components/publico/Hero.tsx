import React from 'react';

const Hero: React.FC = () => (
  <section className="w-full bg-gradient-to-br from-pink-100 to-pink-300 flex flex-col md:flex-row items-center justify-between px-8 py-16 gap-8">
    <div className="flex-1 flex flex-col items-start justify-center">
      <h1 className="text-4xl md:text-5xl font-extrabold text-pink-700 mb-4 leading-tight">
        Belleza y Cuidado <br />
        <span className="text-pink-500">a tu Alcance</span>
      </h1>
      <p className="text-lg text-gray-700 mb-6 max-w-lg">
        Descubre productos exclusivos, ofertas irresistibles y una experiencia de compra única en Ye&Cy Cosmetic.
      </p>
      <a href="#destacados" className="px-6 py-3 bg-pink-500 text-white rounded-lg font-bold text-lg shadow hover:bg-pink-600 transition">Explorar tienda</a>
    </div>
    <div className="flex-1 flex justify-center">
      <img src="/yc-logo.svg" alt="Cosmetic Hero" className="w-64 h-64 object-contain drop-shadow-xl" />
    </div>
  </section>
);

export default Hero; 