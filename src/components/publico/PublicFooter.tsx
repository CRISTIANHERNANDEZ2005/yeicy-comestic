import React from 'react';

const PublicFooter: React.FC = () => (
  <footer className="w-full bg-pink-600 text-white py-6 mt-8">
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between px-4">
      <div className="flex items-center gap-2 mb-4 md:mb-0">
        <img src="/yc-logo.svg" alt="Ye&Cy Cosmetic Logo" className="h-8 w-8" />
        <span className="font-bold text-lg">Ye&Cy Cosmetic</span>
      </div>
      <div className="flex gap-6">
        <a href="#" className="hover:underline">Instagram</a>
        <a href="#" className="hover:underline">Facebook</a>
        <a href="#" className="hover:underline">WhatsApp</a>
      </div>
      <div className="text-sm mt-4 md:mt-0">© 2024 Ye&Cy Cosmetic. Todos los derechos reservados.</div>
    </div>
  </footer>
);

export default PublicFooter; 