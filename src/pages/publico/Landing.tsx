import React from 'react';
import PublicNavbar from '../../components/publico/layout/PublicNavbar';
import HeroSection from '../../components/publico/HeroSection';
import CategoriasSection from '../../components/publico/CategoriasSection';
import ProductosDestacadosSection from '../../components/publico/ProductosDestacadosSection';
import InfoSection from '../../components/publico/InfoSection';
import PublicFooter from '../../components/publico/PublicFooter';

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