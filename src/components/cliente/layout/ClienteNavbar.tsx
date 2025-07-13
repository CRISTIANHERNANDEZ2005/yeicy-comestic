import React from 'react';

const ClienteNavbar: React.FC = () => (
  <nav className="w-full bg-blue-600 text-white p-4 flex justify-between items-center">
    <div className="flex items-center gap-2">
      <img src="/yc-logo.svg" alt="Yecy Cosmetic Logo" className="h-8 w-8" />
      <span className="font-bold text-lg">Yecy Cosmetic</span>
    </div>
    <ul className="flex gap-4">
      <li>Inicio</li>
      <li>Productos</li>
      <li>Perfil</li>
    </ul>
  </nav>
);

export default ClienteNavbar; 