import React from 'react';

type AdminButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
};

const AdminButton: React.FC<AdminButtonProps> = ({ children, ...props }) => (
  <button
    className="bg-gray-700 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded"
    {...props}
  >
    {children}
  </button>
);

export default AdminButton; 