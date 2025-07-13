import React, { useEffect, useState } from 'react';
import api from '../../services/api';

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
}

const ProductosDestacados: React.FC = () => {
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
    <section id="destacados" className="w-full py-16 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-pink-600 mb-8 text-center">Productos Destacados</h2>
        {loading && <div className="text-center text-gray-500">Cargando productos...</div>}
        {error && <div className="text-center text-red-500">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {!loading && !error && productos.map((producto) => {
            const imagen = producto.imagenes.find(img => img.es_principal) || producto.imagenes[0];
            return (
              <div key={producto.id} className="bg-pink-50 rounded-lg shadow hover:shadow-lg transition p-6 flex flex-col items-center">
                {imagen && (
                  <img src={imagen.imagen_url} alt={producto.nombre} className="w-32 h-32 object-cover rounded-full mb-4" />
                )}
                <h3 className="text-xl font-semibold text-pink-700 mb-2">{producto.nombre}</h3>
                <p className="text-gray-600 mb-2 text-center">{producto.descripcion}</p>
                <span className="text-lg font-bold text-pink-600 mb-4">${parseFloat(producto.precio).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</span>
                <button className="px-4 py-2 bg-pink-500 text-white rounded hover:bg-pink-600 font-semibold">Ver más</button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ProductosDestacados; 