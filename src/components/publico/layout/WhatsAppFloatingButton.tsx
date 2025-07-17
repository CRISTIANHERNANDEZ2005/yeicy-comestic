import React, { useState } from 'react';

const whatsappNumber = '+573044931438';
const whatsappLink = `https://wa.me/${whatsappNumber.replace('+', '')}`;

const WhatsAppFloatingButton: React.FC = () => {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="fixed z-50 right-4 bottom-4 md:right-8 md:bottom-8 flex flex-col items-end">
      {/* Tooltip mejorado */}
      <div
        className={`mb-2 px-4 py-2 rounded-lg shadow-lg bg-white text-green-700 font-medium text-sm transition-all duration-300 whitespace-nowrap
        ${hovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}
        `}
        style={{ 
          boxShadow: '0 4px 24px 0 rgba(0,0,0,0.10)',
          backdropFilter: 'blur(4px)',
          backgroundColor: 'rgba(255, 255, 255, 0.9)'
        }}
      >
        ¿Necesitas ayuda? <span className="font-bold text-green-600">¡Chatea con atención al cliente!</span>
      </div>
      
      {/* Botón con animaciones mejoradas */}
      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chatea con atención al cliente por WhatsApp"
        className={`rounded-full bg-[#25D366] hover:bg-[#1ebe57] focus:bg-[#1ebe57] shadow-2xl p-4 flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 relative overflow-hidden group ${hovered ? 'scale-105' : ''}`}
        style={{ 
          boxShadow: '0 6px 30px 0 rgba(37, 211, 102, 0.3)',
          width: '60px',
          height: '60px'
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        {/* Efecto de onda al hacer hover */}
        <span className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-10 group-hover:scale-150 transition-all duration-500"></span>
        
        {/* Logo WhatsApp mejorado con animación */}
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className={`w-8 h-8 transform transition-transform duration-300 ${hovered ? 'rotate-12 scale-110' : 'rotate-0 scale-100'}`} 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          {/* Fondo con gradiente sutil */}
          <defs>
            <linearGradient id="whatsappGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#25D366" />
              <stop offset="100%" stopColor="#128C7E" />
            </linearGradient>
          </defs>
          
          {/* Círculo de fondo con gradiente */}
          <circle cx="12" cy="12" r="12" fill="url(#whatsappGradient)"/>
          
          {/* Icono principal con detalles mejorados */}
          <path 
            fill="#FFF" 
            fillRule="evenodd" 
            d="M17.472 14.621c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
          />
          
          {/* Detalle interior para mayor profundidad */}
          <path 
            fill="#FFF" 
            fillOpacity="0.8" 
            d="M12.026 4c-4.366 0-7.918 3.553-7.918 7.919 0 1.736.566 3.428 1.646 4.817L6.6 18.728l2.339-.614a7.88 7.88 0 003.087.614c4.366 0 7.918-3.553 7.918-7.919C19.944 7.553 16.392 4 12.026 4m0 14.262a6.343 6.343 0 01-3.229-.882l-.229-.136-2.377.623.634-2.315-.15-.237a6.336 6.336 0 01-.971-3.376c0-3.515 2.86-6.375 6.375-6.375s6.375 2.86 6.375 6.375-2.86 6.375-6.375 6.375"
          />
        </svg>
      </a>
    </div>
  );
};

export default WhatsAppFloatingButton;