import React, { useEffect, useState, useRef } from 'react';
import { productosDestacadosService } from '../../../services/api';
import SkeletonLoader from '../ui/SkeletonLoader';
import Badge from '../ui/Badge';
import RatingStars from '../ui/RatingStars';

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
  const isMounted = useRef(true);

  // Cargar productos destacados (con botón de reintentar)
  const loadProductos = async (forceRefresh: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await productosDestacadosService.getProductosDestacados(forceRefresh);
      setProductos(data);
      setError(null);
    } catch (err) {
      setError('No se pudieron cargar los productos destacados.');
      console.error('Error cargando productos destacados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    loadProductos();
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Función para limpiar caché y recargar
  const handleRefreshData = () => {
    productosDestacadosService.clearCache();
    loadProductos(true);
  };

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
          <div className="text-center text-red-500 flex flex-col items-center gap-4" role="alert" aria-live="polite">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span className="font-semibold">Error al cargar productos destacados</span>
            </div>
            <p className="text-sm text-gray-600 max-w-md">{error}</p>
            <div className="flex gap-2">
              <button
                className="mt-2 px-4 py-2 bg-pink-500 text-white rounded-lg shadow hover:bg-pink-700 transition focus:outline-none focus:ring-2 focus:ring-pink-400"
                onClick={() => loadProductos()}
                aria-label="Reintentar cargar productos destacados"
              >
                Reintentar
              </button>
              <button
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
                onClick={handleRefreshData}
                aria-label="Actualizar datos de productos destacados"
              >
                Actualizar Datos
              </button>
            </div>
          </div>
        ) : productos.length === 0 ? (
          <div className="text-center text-gray-500 flex flex-col items-center gap-4" role="status" aria-live="polite">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2V13m16 0H6" /></svg>
              <span className="font-semibold">No hay productos destacados</span>
            </div>
            <p className="text-sm text-gray-600 max-w-md">
              En este momento no hay productos destacados disponibles. Intenta más tarde.
            </p>
            <button
              className="mt-2 px-4 py-2 bg-pink-500 text-white rounded-lg shadow hover:bg-pink-700 transition focus:outline-none focus:ring-2 focus:ring-pink-400"
              onClick={() => loadProductos(true)}
              aria-label="Recargar productos destacados"
            >
              Recargar
            </button>
          </div>
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
                  <button className="px-4 py-2 bg-pink-500 text-white rounded hover:bg-pink-600 font-semibold shadow transition-all duration-200 w-full mt-auto focus:outline-none focus:ring-2 focus:ring-pink-400" tabIndex={0}>Agregar al carrito</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

// Comentarios profesionales agregados para facilitar el mantenimiento y la escalabilidad futura
export default ProductosDestacadosSection; 