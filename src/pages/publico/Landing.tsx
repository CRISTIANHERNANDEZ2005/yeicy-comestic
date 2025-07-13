import React from 'react';
import PublicNavbar from '../../components/publico/layout/PublicNavbar';
import HeroSection from '../../components/publico/HeroSection';
import CategoriasSection from '../../components/publico/CategoriasSection';
import ProductosDestacadosSection from '../../components/publico/ProductosDestacadosSection';
import BeneficiosSection from '../../components/publico/BeneficiosSection';
import PublicFooter from '../../components/publico/PublicFooter';

const Landing: React.FC = () => (
  <>
    <PublicNavbar />
    <HeroSection />
    <CategoriasSection />
    <ProductosDestacadosSection />
    <BeneficiosSection />
    <PublicFooter />
  </>
);

export default Landing; 