import { Link } from 'react-router-dom';

const Categories = () => {
  const categories = [
    {
      id: 'facial',
      name: 'Cuidado Facial',
      description: 'Productos para el cuidado diario de tu piel',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80',
      productCount: 150,
      color: 'from-pink-400 to-pink-600'
    },
    {
      id: 'maquillaje',
      name: 'Maquillaje',
      description: 'Productos para realzar tu belleza natural',
      image: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=715&q=80',
      productCount: 200,
      color: 'from-purple-400 to-purple-600'
    },
    {
      id: 'cabello',
      name: 'Cuidado del Cabello',
      description: 'Productos para mantener tu cabello saludable',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80',
      productCount: 120,
      color: 'from-indigo-400 to-indigo-600'
    },
    {
      id: 'fragrancias',
      name: 'Fragancias',
      description: 'Perfumes y colonias para cada ocasión',
      image: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=715&q=80',
      productCount: 80,
      color: 'from-yellow-400 to-orange-500'
    },
    {
      id: 'herramientas',
      name: 'Herramientas',
      description: 'Pinceles, esponjas y accesorios profesionales',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80',
      productCount: 95,
      color: 'from-green-400 to-green-600'
    },
    {
      id: 'corporal',
      name: 'Cuidado Corporal',
      description: 'Productos para el cuidado de todo tu cuerpo',
      image: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=715&q=80',
      productCount: 110,
      color: 'from-red-400 to-red-600'
    }
  ];

  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Explora por Categorías
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Encuentra exactamente lo que necesitas en nuestras categorías especializadas
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {categories.map((category, index) => (
            <Link
              key={category.id}
              to={`/categorias/${category.id}`}
              className="group block animate-fade-in-up hover-lift"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="relative overflow-hidden rounded-2xl bg-white shadow-lg">
                {/* Image */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={category.image}
                    alt={category.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                      {category.name}
                    </h3>
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${category.color} flex items-center justify-center`}>
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 mb-4 line-clamp-2">
                    {category.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {category.productCount} productos
                    </span>
                    <span className="text-sm font-medium text-purple-600 group-hover:text-purple-700">
                      Explorar →
                    </span>
                  </div>
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link to="/categorias" className="btn-secondary">
            Ver Todas las Categorías
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Categories; 