import React, { useEffect, useState } from 'react';
import { productosDestacadosService } from '../../../services/api';
import SkeletonLoader from '../ui/SkeletonLoader';
import Badge from '../ui/Badge';
import RatingStars from '../ui/RatingStars';
import Carousel from '../ui/Carousel';

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
  subcategoria_nombre?: string;
  total_reseñas?: number;
  total_likes?: number;
  calificacion_promedio?: number;
  fecha_creacion?: string;
}

const ProductosDestacadosSection: React.FC = () => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar productos destacados
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
    loadProductos();
  }, []);

  // Badge "Nuevo" si el producto fue creado hace menos de 15 días
  const isNuevo = (fecha?: string) => {
    if (!fecha) return false;
    const creado = new Date(fecha);
    const ahora = new Date();
    const diff = (ahora.getTime() - creado.getTime()) / (1000 * 3600 * 24);
    return diff < 15;
  };

  return (
    <section id="destacados" className="w-full py-16 bg-white animate-fadeIn">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="section-title text-3xl font-bold text-pink-600 mb-8 text-center animate-fadeIn">
          Productos Destacados
        </h2>
        {loading ? (
          <div className="flex gap-6 overflow-x-auto pb-6">
            {[...Array(3)].map((_, i) => (
              <SkeletonLoader key={i} className="w-80 h-96" />
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
          <Carousel className="mb-8 gap-12" ariaLabel="Carrusel de productos destacados">
            {productos.map((producto) => {
              const imagen = producto.imagenes.find(img => img.es_principal) || producto.imagenes[0];
              return (
                <div
                  key={producto.id}
                    className="producto-card group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 w-80 min-w-[20rem] max-w-xs flex-shrink-0 flex flex-col animate-fadeIn"
                  >
                    {/* Badges profesionales */}
                    {producto.destacado && <Badge color="bg-pink-600 absolute top-4 left-4 animate-bounce">Destacado</Badge>}
                    {isNuevo(producto.fecha_creacion) && <span className="badge-nuevo absolute top-4 right-4 animate-glow">Nuevo</span>}
                    {/* Imagen principal */}
                    <div className="producto-img-container w-full h-56 rounded-2xl overflow-hidden bg-pink-100 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
                    {imagen ? (
                        <img src={imagen.imagen_url} alt={producto.nombre} className="w-full h-full object-cover transition-transform duration-300" />
                    ) : (
                      <svg className="w-16 h-16 text-pink-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M8 12l2 2 4-4" /></svg>
                    )}
                  </div>
                    {/* Info principal */}
                    <div className="flex flex-col gap-1 px-4 pt-4 pb-2">
                      <h3 className="text-xl font-semibold text-pink-700 mb-0.5 text-center truncate" title={producto.nombre}>{producto.nombre}</h3>
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <span className="text-xs font-medium text-pink-500 bg-pink-50 rounded px-2 py-0.5 shadow animate-fadeIn">
                          <svg className="inline w-4 h-4 mr-1 -mt-0.5 text-pink-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 018 0v2" /><circle cx="12" cy="7" r="4" /></svg>
                          {producto.subcategoria_nombre || 'Sin subcategoría'}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <RatingStars rating={producto.calificacion_promedio || 0} />
                        <span className="text-xs text-gray-500">({producto.calificacion_promedio || '0.0'})</span>
                      </div>
                      <div className="flex items-center justify-center gap-3 mb-1">
                        <span className="flex items-center gap-1 text-gray-500 text-xs">
                          <svg className="w-4 h-4 text-pink-400 animate-glow" fill="currentColor" viewBox="0 0 20 20"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" /></svg>
                          {producto.total_likes || 0} Likes
                        </span>
                        <span className="flex items-center gap-1 text-gray-500 text-xs">
                          <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M13.293 2.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-9 9a1 1 0 01-.293.207l-4 2a1 1 0 01-1.316-1.316l2-4a1 1 0 01.207-.293l9-9z" /></svg>
                          {producto.total_reseñas || 0} Reseñas
                        </span>
                      </div>
                      <p className="text-gray-600 mb-2 text-center text-sm line-clamp-2 min-h-[2.5rem]">{producto.descripcion}</p>
                      <span className="text-lg font-bold text-pink-600 mb-2 block text-center">{parseFloat(producto.precio).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</span>
                    </div>
                    {/* Botón visual */}
                    <div className="px-4 pb-4 mt-auto">
                      <button className="w-full py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-semibold shadow hover:from-pink-600 hover:to-rose-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-pink-400 flex items-center justify-center gap-2" tabIndex={0} disabled>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.35 2.7A2 2 0 007.48 19h9.04a2 2 0 001.83-1.3L17 13M7 13V6a1 1 0 011-1h5a1 1 0 011 1v7" /></svg>
                        Solo visual
                      </button>
                    </div>
                </div>
              );
            })}
          </Carousel>
        )}
      </div>
    </section>
  );
};

export default ProductosDestacadosSection;