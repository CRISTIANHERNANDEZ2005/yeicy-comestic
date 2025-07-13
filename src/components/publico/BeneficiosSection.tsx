import React from 'react';

const beneficios = [
  {
    icon: (
      <svg className="w-10 h-10 text-pink-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3v18" /></svg>
    ),
    titulo: 'Envíos rápidos',
    desc: 'Recibe tus productos en tiempo récord en cualquier parte de Colombia.'
  },
  {
    icon: (
      <svg className="w-10 h-10 text-pink-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
    ),
    titulo: 'Pago seguro',
    desc: 'Tus compras protegidas con los mejores métodos de pago.'
  },
  {
    icon: (
      <svg className="w-10 h-10 text-pink-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" /></svg>
    ),
    titulo: 'Atención personalizada',
    desc: 'Soporte y asesoría en cada paso de tu compra.'
  },
];

const BeneficiosSection: React.FC = () => (
  <section className="w-full py-12 bg-white animate-fade-in">
    <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-3 gap-8 text-center">
      {beneficios.map((b, i) => (
        <div key={i} className="flex flex-col items-center gap-3 p-6 rounded-xl shadow hover:shadow-xl transition-all duration-300 bg-pink-50 animate-fade-in">
          {b.icon}
          <h4 className="text-pink-600 text-xl font-bold mb-1">{b.titulo}</h4>
          <p className="text-gray-700">{b.desc}</p>
        </div>
      ))}
    </div>
  </section>
);

export default BeneficiosSection; 