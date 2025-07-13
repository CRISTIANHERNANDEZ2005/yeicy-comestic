import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import SkeletonLoader from './ui/SkeletonLoader';

interface Categoria {
  id: number;
  nombre: string;
  descripcion: string;
}
interface Subcategoria {
  id: number;
  nombre: string;
  descripcion: string;
}

const iconos = [
  <svg key="1" className="w-8 h-8 text-pink-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
  <svg key="2" className="w-8 h-8 text-pink-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>,
  <svg key="3" className="w-8 h-8 text-pink-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" /></svg>,
  <svg key="4" className="w-8 h-8 text-pink-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18" /></svg>,
];

const CategoriasSection: React.FC = () => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [showSub, setShowSub] = useState(false);
  const [catSeleccionada, setCatSeleccionada] = useState<Categoria | null>(null);

  useEffect(() => {
    setLoading(true);
    api.get('/cliente/categorias/')
      .then(res => {
        setCategorias(res.data);
        setError(null);
      })
      .catch(() => setError('No se pudieron cargar las categorías.'))
      .finally(() => setLoading(false));
  }, []);

  const handleCategoriaClick = (cat: Categoria) => {
    setCatSeleccionada(cat);
    setShowSub(true);
    setSubcategorias([]);
    api.get(`/cliente/categorias/${cat.id}/subcategorias/`)
      .then(res => setSubcategorias(res.data))
      .catch(() => setSubcategorias([]));
  };

  return (
    <section className="w-full py-12 bg-gradient-to-r from-pink-50 to-pink-100">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-pink-600 mb-6 text-center animate-fade-in">Categorías</h2>
        {loading ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {[...Array(4)].map((_, i) => (
              <SkeletonLoader key={i} className="w-40 h-32" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center text-red-500">{error}</div>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-2 snap-x">
            {categorias.map((cat, i) => (
              <div
                key={cat.id}
                className="min-w-[10rem] bg-white rounded-xl shadow-lg p-5 flex flex-col items-center gap-2 transition-transform duration-300 hover:scale-105 hover:shadow-2xl cursor-pointer snap-center animate-fade-in"
                onClick={() => handleCategoriaClick(cat)}
              >
                {iconos[i % iconos.length]}
                <span className="font-bold text-pink-700 text-lg text-center">{cat.nombre}</span>
                <span className="text-gray-500 text-sm text-center">{cat.descripcion}</span>
              </div>
            ))}
          </div>
        )}
        {/* Modal de subcategorías */}
        {showSub && catSeleccionada && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full relative animate-fade-in-up">
              <button className="absolute top-3 right-3 text-pink-600 text-2xl font-bold" onClick={() => setShowSub(false)}>&times;</button>
              <h3 className="text-2xl font-bold text-pink-700 mb-4 text-center">{catSeleccionada.nombre}</h3>
              {subcategorias.length === 0 ? (
                <div className="text-center text-gray-400">No hay subcategorías.</div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {subcategorias.map(sub => (
                    <li key={sub.id} className="p-3 rounded-lg bg-pink-50 hover:bg-pink-100 cursor-pointer text-center font-medium text-pink-700 transition-all" onClick={() => window.location.href = `/subcategoria/${sub.id}`}>{sub.nombre}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default CategoriasSection; 