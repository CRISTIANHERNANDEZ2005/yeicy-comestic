import React from 'react';

const InfoSection: React.FC = () => (
  <section className="info-section w-full py-16 md:py-20">
    <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-8 md:gap-10">
      {/* Tarjeta 1 - Envíos */}
      <div className="info-card">
        <div className="icon-container">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <h4 className="text-2xl font-bold mb-4 text-gray-800">Envíos a Todo Colombia</h4>
        <p className="text-gray-600 leading-relaxed">
          Recibe tus productos de belleza directamente en tu hogar. Envíos rápidos y seguros con seguimiento en tiempo real.
        </p>
        <div className="mt-4 text-sm font-medium text-pink-500">
          *Contra entrega disponible
        </div>
      </div>

      {/* Tarjeta 2 - Pagos */}
      <div className="info-card">
        <div className="icon-container">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <h4 className="text-2xl font-bold mb-4 text-gray-800">Pago Contra Entrega</h4>
        <p className="text-gray-600 leading-relaxed">
          Compra con total confianza. Paga solo cuando recibas tus productos, sin riesgos y con total seguridad.
        </p>
        <div className="mt-4 text-sm font-medium text-pink-500">
          Sin costos adicionales
        </div>
      </div>

      {/* Tarjeta 3 - Atención */}
      <div className="info-card">
        <div className="icon-container">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <h4 className="text-2xl font-bold mb-4 text-gray-800">Asesoría Profesional</h4>
        <p className="text-gray-600 leading-relaxed">
          Nuestros expertos en belleza te guiarán para elegir los mejores productos según tus necesidades.
        </p>
        <div className="mt-4 text-sm font-medium text-pink-500">
          Soporte 24/7 por WhatsApp
        </div>
      </div>
    </div>
  </section>
);

export default InfoSection;