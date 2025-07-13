import React from 'react';
import LandingLayout from '../../components/publico/layout/LandingLayout';
import PublicButton from '../../components/publico/ui/PublicButton';

const Landing: React.FC = () => (
  <LandingLayout>
    <h1 className="text-3xl font-bold mb-4">¡Bienvenido a Yecy Cosmetic!</h1>
    <p className="mb-6">Descubre los mejores productos de belleza y cuidado personal.</p>
    <PublicButton>Explorar Tienda</PublicButton>
  </LandingLayout>
);

export default Landing; 