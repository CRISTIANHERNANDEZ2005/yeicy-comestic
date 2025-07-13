import React from 'react';

const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = 'bg-pink-500' }) => (
  <span className={`inline-block px-3 py-1 text-xs font-bold text-white rounded-full shadow ${color}`}>{children}</span>
);

export default Badge; 