import React from 'react';

type ClienteCardProps = {
  title: string;
  description: string;
};

const ClienteCard: React.FC<ClienteCardProps> = ({ title, description }) => (
  <div className="bg-white shadow-md rounded p-4 w-64">
    <h3 className="font-bold text-lg mb-2">{title}</h3>
    <p className="text-gray-700">{description}</p>
  </div>
);

export default ClienteCard; 