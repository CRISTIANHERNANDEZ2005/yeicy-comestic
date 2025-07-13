import React from 'react';

const LandingLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex flex-col bg-gradient-to-b from-pink-100 to-white">
    <header className="bg-pink-500 text-white p-4 text-center font-bold text-2xl">
      Bienvenido a Yecy Cosmetic
    </header>
    <main className="flex-1 flex flex-col items-center justify-center">
      {children}
    </main>
    <footer className="bg-pink-200 text-center p-2">© 2024 Yecy Cosmetic</footer>
  </div>
);

export default LandingLayout; 