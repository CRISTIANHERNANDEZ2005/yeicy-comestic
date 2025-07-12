import { Link } from 'react-router-dom';

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background with gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50"></div>
      
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-slow"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="animate-fade-in-up">
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6">
            Descubre tu
            <span className="bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent"> Belleza</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Productos de cosméticos de alta calidad que realzan tu belleza natural. 
            Descubre nuestra colección exclusiva diseñada para ti.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/productos" className="btn-primary text-lg px-8 py-4">
              Explorar Productos
            </Link>
            <Link to="/categorias" className="btn-secondary text-lg px-8 py-4">
              Ver Categorías
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="animate-slide-in-left" style={{ animationDelay: '0.2s' }}>
              <div className="text-3xl font-bold text-purple-600 mb-2">500+</div>
              <div className="text-gray-600">Productos</div>
            </div>
            <div className="animate-slide-in-left" style={{ animationDelay: '0.4s' }}>
              <div className="text-3xl font-bold text-pink-600 mb-2">10K+</div>
              <div className="text-gray-600">Clientes Satisfechos</div>
            </div>
            <div className="animate-slide-in-left" style={{ animationDelay: '0.6s' }}>
              <div className="text-3xl font-bold text-indigo-600 mb-2">50+</div>
              <div className="text-gray-600">Marcas Premium</div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-gray-400 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-gray-400 rounded-full mt-2 animate-pulse"></div>
        </div>
      </div>
    </section>
  );
};

export default Hero; 