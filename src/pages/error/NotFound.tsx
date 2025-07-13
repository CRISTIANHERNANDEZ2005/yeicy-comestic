import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
    <img src="/yc-logo.svg" alt="Logo" className="h-16 w-16 mb-4" />
    <h1 className="text-4xl font-bold mb-2 text-blue-700">404</h1>
    <p className="mb-4 text-gray-700">Página no encontrada</p>
    <Link to="/" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-800">Volver al inicio</Link>
  </div>
);

export default NotFound; 