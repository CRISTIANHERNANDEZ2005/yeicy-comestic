import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import SkeletonLoader from './ui/SkeletonLoader';
import Badge from './ui/Badge';
import RatingStars from './ui/RatingStars';

interface ImagenProducto {
  id: number;
  imagen_url: string;
  descripcion: string | null;
  es_principal: boolean;
}

interface Producto {
  id: number;
  nombre: string;
  descripcion: string;
  precio: string;
  imagenes: ImagenProducto[];
  destacado?: boolean;
}

const ProductosDestacadosSection: React.FC = () => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.get('/cliente/productos/destacados/')
      .then(res => {
        setProductos(res.data.results || []);
        setError(null);
      })
      .catch(() => {
        setError('No se pudieron cargar los productos destacados.');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="destacados" className="w-full py-16 bg-white animate-fade-in">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-pink-600 mb-8 text-center animate-fade-in">Productos Destacados</h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[...Array(3)].map((_, i) => (
              <SkeletonLoader key={i} className="w-full h-72" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center text-red-500">{error}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {productos.map((producto) => {
              const imagen = producto.imagenes.find(img => img.es_principal) || producto.imagenes[0];
              return (
                <div
                  key={producto.id}
                  className="relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 flex flex-col items-center group animate-fade-in-up"
                >
                  {producto.destacado && <Badge color="bg-pink-600 absolute top-4 left-4">Destacado</Badge>}
                  <div className="w-32 h-32 mb-4 rounded-full overflow-hidden bg-pink-100 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
                    {imagen ? (
                      <img src={imagen.imagen_url} alt={producto.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-16 h-16 text-pink-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M8 12l2 2 4-4" /></svg>
                    )}
                  </div>
                  <h3 className="text-xl font-semibold text-pink-700 mb-1 text-center">{producto.nombre}</h3>
                  <RatingStars rating={4.5} />
                  <p className="text-gray-600 mb-2 text-center text-sm">{producto.descripcion}</p>
                  <span className="text-lg font-bold text-pink-600 mb-4">${parseFloat(producto.precio).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</span>
                  <button className="px-4 py-2 bg-pink-500 text-white rounded hover:bg-pink-600 font-semibold shadow transition-all duration-200 w-full mt-auto">Agregar al carrito</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductosDestacadosSection; 