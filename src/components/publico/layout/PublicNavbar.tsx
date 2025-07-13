import React from 'react';

const PublicNavbar: React.FC = () => (
  <nav className="w-full bg-white shadow flex items-center justify-between px-6 py-3">
    <div className="flex items-center gap-2">
      <img src="/yc-logo.svg" alt="Ye&Cy Cosmetic Logo" className="h-10 w-10" />
      <span className="font-bold text-2xl text-pink-600 tracking-wide">Ye&Cy Cosmetic</span>
    </div>
    <ul className="flex gap-6 text-gray-700 font-medium">
      <li className="hover:text-pink-600 cursor-pointer">Tienda</li>
      <li className="hover:text-pink-600 cursor-pointer">Sobre Nosotros</li>
      <li className="hover:text-pink-600 cursor-pointer">Contacto</li>
    </ul>
    <div className="flex gap-3">
      <button className="px-4 py-2 rounded bg-pink-500 text-white hover:bg-pink-600 font-semibold">Iniciar sesión</button>
      <button className="px-4 py-2 rounded border border-pink-500 text-pink-500 hover:bg-pink-50 font-semibold">Registrarse</button>
    </div>
  </nav>
);

export default PublicNavbar; 