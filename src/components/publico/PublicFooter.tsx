import React from 'react';

const redes = [
  {
    name: 'Instagram',
    href: '#',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.5" y2="6.5" /></svg>
    )
  },
  {
    name: 'Facebook',
    href: '#',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 2h-3a4 4 0 0 0-4 4v3H7v4h4v8h4v-8h3l1-4h-4V6a1 1 0 0 1 1-1h3z" /></svg>
    )
  },
  {
    name: 'WhatsApp',
    href: '#',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21.67 20.13A10 10 0 1 0 3.87 21.67l2.2-.61a1 1 0 0 1 .94.21l2.13 1.6a1 1 0 0 0 1.18.06 8.12 8.12 0 0 0 3.9-3.9 1 1 0 0 0-.06-1.18l-1.6-2.13a1 1 0 0 1-.21-.94l.61-2.2z" /></svg>
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
  <footer className="w-full bg-pink-700 text-white pt-12 pb-6 animate-fade-in">
    <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-10 border-b border-pink-400 pb-8">
      <div className="flex flex-col items-start gap-3">
        <div className="flex items-center gap-2 mb-2">
          <img src="/yc-logo.svg" alt="Ye&Cy Cosmetic Logo" className="h-10 w-10" />
          <span className="font-bold text-2xl">Ye&Cy Cosmetic</span>
        </div>
        <p className="text-pink-100 text-sm max-w-xs">Belleza, cuidado y confianza en cada producto. La mejor tienda online de cosméticos en Colombia.</p>
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-semibold text-lg mb-2">Enlaces útiles</span>
        {enlaces.map((e) => (
          <a key={e.name} href={e.href} className="text-pink-100 hover:text-white transition-colors text-sm">{e.name}</a>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-semibold text-lg mb-2">Contáctanos</span>
        <span className="text-pink-100 text-sm">Correo: contacto@yecycosmetic.com</span>
        <span className="text-pink-100 text-sm">Teléfono: +57 300 000 0000</span>
        <div className="flex gap-4 mt-2">
          {redes.map((r) => (
            <a key={r.name} href={r.href} className="hover:text-pink-300 transition-colors" aria-label={r.name}>{r.icon}</a>
          ))}
        </div>
      </div>
    </div>
    <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between pt-6 text-pink-200 text-xs">
      <span>© 2024 Ye&Cy Cosmetic. Todos los derechos reservados.</span>
      <span>Desarrollado profesionalmente para una experiencia única.</span>
    </div>
  </footer>
);

export default PublicFooter; 