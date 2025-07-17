import React from 'react';
import PublicNavbar from '../../components/publico/layout/PublicNavbar';
import HeroSection from '../../components/publico/layout/HeroSection';
import CategoriasSection from '../../components/publico/layout/CategoriasSection';
import ProductosDestacadosSection from '../../components/publico/layout/ProductosDestacadosSection';
import InfoSection from '../../components/publico/layout/InfoSection';
import PublicFooter from '../../components/publico/layout/PublicFooter';

const Landing: React.FC = () => (
  <>
    <PublicNavbar />
    <HeroSection />
    <CategoriasSection />
    <ProductosDestacadosSection />
    <InfoSection />
    <PublicFooter />
  </>
);

export default Landing; 