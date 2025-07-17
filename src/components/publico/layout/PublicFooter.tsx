import React from 'react';

const redes = [
  {
    name: 'Instagram',
    href: '#',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.5" y2="6.5" /></svg>
    )
  },
  {
    name: 'Facebook',
    href: '#',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 2h-3a4 4 0 0 0-4 4v3H7v4h4v8h4v-8h3l1-4h-4V6a1 1 0 0 1 1-1h3z" /></svg>
    )
  },
  {
    name: 'WhatsApp',
    href: '#',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21.67 20.13A10 10 0 1 0 3.87 21.67l2.2-.61a1 1 0 0 1 .94.21l2.13 1.6a1 1 0 0 0 1.18.06 8.12 8.12 0 0 0 3.9-3.9 1 1 0 0 0-.06-1.18l-1.6-2.13a1 1 0 0 1-.21-.94l.61-2.2z" /></svg>
    )
  }
];

const enlaces = [
  { name: 'Tienda', href: '#' },
  { name: 'Sobre Nosotros', href: '#' },
  { name: 'Contacto', href: '#' },
  { name: 'Política de Privacidad', href: '#' },
  { name: 'Términos y Condiciones', href: '#' },
];

const PublicFooter: React.FC = () => (
  <footer className="w-full bg-gray-900 text-white pt-14 pb-6 animate-fade-in">
    <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-10 border-b border-pink-400/30 pb-10">
      {/* Branding */}
      <div className="flex flex-col items-start gap-4">
        <div className="flex items-center gap-3 mb-2">
          <img src="/yc-logo.svg" alt="Ye&Cy Cosmetic Logo" className="h-12 w-12 drop-shadow-lg" />
          <span className="font-extrabold text-2xl md:text-3xl bg-gradient-to-r from-pink-400 via-fuchsia-400 to-pink-600 bg-clip-text text-transparent drop-shadow">Ye&Cy Cosmetic</span>
        </div>
        <p className="text-pink-100 text-sm max-w-xs leading-relaxed">Belleza, cuidado y confianza en cada producto. La mejor tienda online de cosméticos en Colombia.</p>
      </div>
      {/* Enlaces útiles */}
      <div className="flex flex-col gap-2 items-start md:items-center">
        <span className="font-semibold text-lg mb-2 text-pink-200">Enlaces útiles</span>
        <div className="flex flex-col gap-1 w-full">
        {enlaces.map((e) => (
            <a key={e.name} href={e.href} className="text-pink-100 hover:text-white transition-colors text-sm py-1 px-2 rounded hover:bg-pink-700/30 focus:outline-none focus:ring-2 focus:ring-pink-400 w-fit">{e.name}</a>
        ))}
        </div>
      </div>
      {/* Contacto y redes */}
      <div className="flex flex-col gap-2 items-start md:items-end">
        <span className="font-semibold text-lg mb-2 text-pink-200">Contáctanos</span>
        <span className="flex items-center gap-2 text-pink-100 text-sm"><svg className="w-4 h-4 text-pink-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" /><path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.07 7.07l-1.42-1.42M6.34 6.34l-1.42-1.42m12.02 0l-1.42 1.42M6.34 17.66l-1.42 1.42" /></svg> contacto@yecycosmetic.com</span>
        <span className="flex items-center gap-2 text-pink-100 text-sm"><svg className="w-4 h-4 text-pink-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zm0 0v14a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2zm16-2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2zm0 0v14a2 2 0 0 0 2 2h-2a2 2 0 0 0-2-2v-2a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2v2z" /></svg> +57 300 000 0000</span>
        <div className="flex gap-3 mt-3">
          {redes.map((r) => (
            <a key={r.name} href={r.href} className="rounded-full bg-pink-700/30 hover:bg-pink-500/80 transition-colors p-3 shadow-md focus:outline-none focus:ring-2 focus:ring-pink-400" aria-label={r.name} target="_blank" rel="noopener noreferrer">
              {r.icon}
            </a>
          ))}
        </div>
      </div>
    </div>
    {/* Separador visual */}
    <div className="max-w-7xl mx-auto px-4 my-6 border-t border-pink-400/20" />
    {/* Legal y créditos */}
    <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between pt-4 text-pink-200 text-xs gap-2">
      <span>© 2024 Ye&Cy Cosmetic. Todos los derechos reservados.</span>
      <span>Desarrollado profesionalmente para una experiencia única.</span>
    </div>
  </footer>
);

export default PublicFooter; 