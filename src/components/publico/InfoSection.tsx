import React from 'react';

const InfoSection: React.FC = () => (
  <section className="w-full py-12 bg-pink-100">
    <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-3 gap-8 text-center">
      <div>
        <h4 className="text-pink-600 text-2xl font-bold mb-2">Envíos a todo el país</h4>
        <p className="text-gray-700">Recibe tus productos en la puerta de tu casa, estés donde estés en Colombia.</p>
      </div>
      <div>
        <h4 className="text-pink-600 text-2xl font-bold mb-2">Pago seguro</h4>
        <p className="text-gray-700">Tus compras protegidas con los mejores métodos de pago y seguridad.</p>
      </div>
      <div>
        <h4 className="text-pink-600 text-2xl font-bold mb-2">Atención personalizada</h4>
        <p className="text-gray-700">Nuestro equipo está listo para ayudarte en cada paso de tu compra.</p>
      </div>
    </div>
  </section>
);

export default InfoSection; 