import React from 'react';

type PublicButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
};

const PublicButton: React.FC<PublicButtonProps> = ({ children, ...props }) => (
  <button
    className="bg-pink-500 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded"
    {...props}
  >
    {children}
  </button>
);

export default PublicButton; 