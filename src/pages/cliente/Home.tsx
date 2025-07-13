import React from 'react';
import ClienteNavbar from '../../components/cliente/layout/ClienteNavbar';
import ClienteCard from '../../components/cliente/ui/ClienteCard';

const Home: React.FC = () => (
  <div className="min-h-screen bg-blue-50">
    <ClienteNavbar />
    <main className="p-8 flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold mb-4">Bienvenido Cliente</h1>
      <ClienteCard title="Producto Destacado" description="Descripción del producto destacado." />
    </main>
  </div>
);

export default Home; 