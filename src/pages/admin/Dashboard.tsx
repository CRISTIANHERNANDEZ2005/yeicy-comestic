import React from 'react';
import AdminSidebar from '../../components/admin/layout/AdminSidebar';
import AdminButton from '../../components/admin/ui/AdminButton';

const Dashboard: React.FC = () => (
  <div className="flex min-h-screen">
    <AdminSidebar />
    <main className="flex-1 p-8">
      <h1 className="text-2xl font-bold mb-4">Panel de Administración</h1>
      <AdminButton>Acción Admin</AdminButton>
    </main>
  </div>
);

export default Dashboard; 