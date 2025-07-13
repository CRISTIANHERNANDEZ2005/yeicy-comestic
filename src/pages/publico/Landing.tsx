import React from 'react';
import PublicNavbar from '../../components/publico/layout/PublicNavbar';
import Hero from '../../components/publico/Hero';
import ProductosDestacados from '../../components/publico/ProductosDestacados';
import InfoSection from '../../components/publico/InfoSection';
import PublicFooter from '../../components/publico/PublicFooter';

const Landing: React.FC = () => (
  <>
    <PublicNavbar />
    <Hero />
    <ProductosDestacados />
    <InfoSection />
    <PublicFooter />
  </>
);

export default Landing; 