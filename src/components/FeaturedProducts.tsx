import ProductCard from './ProductCard';

const FeaturedProducts = () => {
  const featuredProducts = [
    {
      id: '1',
      name: 'Serum Facial Hidratante con Vitamina C',
      price: 45.99,
      originalPrice: 59.99,
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80',
      category: 'Cuidado Facial',
      rating: 4.8,
      isNew: true,
      isOnSale: true
    },
    {
      id: '2',
      name: 'Paleta de Sombras Profesional',
      price: 32.50,
      image: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=715&q=80',
      category: 'Maquillaje',
      rating: 4.6
    },
    {
      id: '3',
      name: 'Crema Hidratante con Ácido Hialurónico',
      price: 28.99,
      originalPrice: 35.99,
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80',
      category: 'Cuidado Facial',
      rating: 4.9,
      isOnSale: true
    },
    {
      id: '4',
      name: 'Set de Pinceles Profesionales',
      price: 55.00,
      image: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=715&q=80',
      category: 'Herramientas',
      rating: 4.7,
      isNew: true
    },
    {
      id: '5',
      name: 'Mascarilla Facial de Arcilla',
      price: 18.99,
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80',
      category: 'Cuidado Facial',
      rating: 4.5
    },
    {
      id: '6',
      name: 'Labial Mate de Larga Duración',
      price: 22.50,
      originalPrice: 28.00,
      image: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=715&q=80',
      category: 'Maquillaje',
      rating: 4.4,
      isOnSale: true
    }
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Productos Destacados
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Descubre nuestros productos más populares y mejor valorados por nuestros clientes
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuredProducts.map((product, index) => (
            <div 
              key={product.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <ProductCard {...product} />
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <button className="btn-primary">
            Ver Todos los Productos
          </button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts; 