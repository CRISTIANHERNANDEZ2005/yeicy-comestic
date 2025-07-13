import React from 'react';

const AdminSidebar: React.FC = () => (
  <aside className="w-64 h-full bg-gray-800 text-white p-4">
    <h2 className="text-xl font-bold mb-4">Panel Admin</h2>
    <nav>
      <ul>
        <li className="mb-2">Dashboard</li>
        <li className="mb-2">Usuarios</li>
        <li className="mb-2">Inventario</li>
      </ul>
    </nav>
  </aside>
);

export default AdminSidebar; 