import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';

const navLinks = [
  {
    name: 'Inicio',
    href: '/',
    icon: (
      <svg className="w-6 h-6 mr-1 text-pink-400 group-hover:text-pink-600 transition-colors" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M3 12l9-9 9 9" /><path d="M9 21V9h6v12" /></svg>
    ),
    isInternal: true,
  },
  {
    name: 'Productos',
    href: '/productos',
    icon: (
      <svg className="w-6 h-6 mr-1 text-pink-400 group-hover:text-pink-600 transition-colors" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M16 3v4M8 3v4" /></svg>
    ),
    isInternal: true,
  },
  {
    name: 'Categorías',
    href: '#categorias',
    icon: (
      <svg className="w-6 h-6 mr-1 text-pink-400 group-hover:text-pink-600 transition-colors" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" /></svg>
    ),
    isInternal: false,
  },
];

const PublicNavbar: React.FC = () => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  // Estado para el buscador
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Cierra el menú móvil al navegar
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement | HTMLSpanElement>) => {
    if (location.pathname === '/') {
      e.preventDefault();
    }
  };

  // Clases dinámicas para el navbar
  const navbarClasses = `sticky top-0 z-50 w-full shadow-xl border-b-2 border-pink-200 flex items-center justify-between px-4 md:px-8 transition-all duration-300 animate-fade-in-down bg-white ${
    scrolled ? 'py-2 min-h-[56px]' : 'py-4 min-h-[72px]'
  }`;
  // Clases dinámicas para el logo
  const logoImgClasses = `transition-transform duration-300 ${scrolled ? 'h-10 w-10' : 'h-12 w-12'} group-hover:scale-110 drop-shadow-md`;

  return (
    <nav
      className={navbarClasses}
      style={{ opacity: scrolled ? 0.92 : 1 }}
      role="navigation"
      aria-label="Navegación principal"
    >
      <div className="flex w-full items-center flex-row">
        {/* Logo */}
        <Link to="/" onClick={handleLogoClick} className="flex items-center gap-2 group focus:outline-none mr-8 min-w-fit" aria-label="Inicio" tabIndex={0}>
          <img src="/yc-logo.svg" alt="Ye&Cy Cosmetic Logo" className={logoImgClasses} />
          <span className="relative select-none" style={{ letterSpacing: '0.04em' }}>
            <span
              className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-pink-400 to-fuchsia-500 drop-shadow-md transition-all duration-300 text-2xl md:text-3xl tracking-wider group-hover:from-fuchsia-500 group-hover:to-pink-500 group-hover:drop-shadow-lg"
            >
              Ye&Cy Cosmetic
            </span>
            <span className="absolute -top-2 -right-6 md:-right-8 animate-pulse">
              <svg className="w-5 h-5 md:w-6 md:h-6 text-pink-400 group-hover:text-fuchsia-500 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.38-2.454a1 1 0 00-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.049 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z" />
              </svg>
            </span>
            <span className="absolute left-0 -bottom-1 w-0 h-1 bg-gradient-to-r from-pink-400 to-fuchsia-400 rounded-full group-hover:w-full transition-all duration-500"></span>
          </span>
      </Link>
        {/* Botón menú hamburguesa (solo móvil) */}
        <button
          className="md:hidden ml-auto p-2 rounded focus:outline-none focus:ring-2 focus:ring-pink-400"
          aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          {mobileMenuOpen ? (
            <svg className="w-8 h-8 text-pink-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-8 h-8 text-pink-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" /></svg>
          )}
        </button>
        {/* Menú principal (desktop) */}
        <ul className="hidden md:flex gap-6 lg:gap-10 text-gray-700 font-semibold text-base md:text-lg items-center flex-1 ml-8">
        {navLinks.map(link => (
            <li key={link.name} className="relative group">
            {link.isInternal ? (
              <Link
                to={link.href}
                  className="relative px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all group flex items-center bg-white bg-opacity-100 hover:shadow-pink-100 hover:shadow-md hover:-translate-y-0.5 duration-200"
                tabIndex={0}
              >
                  <span className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-110">
                {link.icon}
                  </span>
                  <span className="group-hover:text-pink-600 transition-colors ml-1">{link.name}</span>
                  <span className="absolute left-0 -bottom-1 w-0 h-0.5 bg-pink-400 group-hover:w-full transition-all duration-300 rounded-full"></span>
              </Link>
            ) : (
              <a
                href={link.href}
                  className="relative px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-pink-400 transition-all group flex items-center bg-white bg-opacity-100 hover:shadow-pink-100 hover:shadow-md hover:-translate-y-0.5 duration-200"
              >
                  <span className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-110">
                {link.icon}
                  </span>
                  <span className="group-hover:text-pink-600 transition-colors ml-1">{link.name}</span>
                  <span className="absolute left-0 -bottom-1 w-0 h-0.5 bg-pink-400 group-hover:w-full transition-all duration-300 rounded-full"></span>
              </a>
            )}
          </li>
        ))}
          {/* Buscador solo en desktop */}
          <li className="flex-1 flex justify-center">
            <form className="w-full max-w-xs relative" role="search" aria-label="Buscar productos">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-full border border-pink-200 shadow focus:border-pink-400 focus:ring-2 focus:ring-pink-300 outline-none transition-all text-gray-700 placeholder-pink-300 bg-white"
                placeholder="Buscar productos…"
                aria-label="Buscar productos"
              />
              <button type="submit" className="absolute left-2 top-1/2 -translate-y-1/2 text-pink-400 hover:text-pink-600 focus:outline-none" tabIndex={-1} aria-label="Buscar">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M21 21l-3.5-3.5" /></svg>
              </button>
            </form>
        </li>
        {/* Separador vertical */}
          <li className="hidden md:block h-8 border-l border-pink-100 mx-2"></li>
          {/* Menú usuario solo en desktop */}
          <li className="relative hidden md:block">
          <div
            className="ml-2"
            onMouseEnter={() => setUserMenuOpen(true)}
            onMouseLeave={() => setUserMenuOpen(false)}
          >
            <button
                className={`p-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-pink-400 group bg-white bg-opacity-100 shadow-md border border-pink-100 relative ${userMenuOpen ? 'ring-2 ring-pink-400 scale-105' : ''}`}
              aria-label="Cuenta"
            >
              <svg className="w-9 h-9 text-pink-500 group-hover:text-pink-700 transition-colors drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
              </svg>
                {/* Indicador visual */}
                {userMenuOpen && (
                  <span className="absolute top-0 right-0 block w-3 h-3 bg-pink-400 rounded-full ring-2 ring-white animate-pulse"></span>
                )}
            </button>
            {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-pink-100 py-2 animate-fade-in-up z-50 overflow-hidden">
                  <div className="px-6 py-2 border-b border-pink-100 text-pink-500 font-semibold text-sm flex items-center gap-2">
                    <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg>
                    ¡Bienvenido!
                  </div>
                  <Link to="/login" className="flex items-center gap-3 px-6 py-3 text-gray-700 hover:bg-pink-50 hover:text-pink-700 font-medium transition-colors text-base group">
                    <svg className="w-5 h-5 text-pink-400 group-hover:text-pink-600 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 12H3" /><path d="M8 7l-5 5 5 5" /><path d="M21 12a9 9 0 1 0-9 9" /></svg>
                    Iniciar sesión
                  </Link>
                  <Link to="/registro" className="flex items-center gap-3 px-6 py-3 text-gray-700 hover:bg-pink-100 hover:text-pink-700 font-semibold transition-colors text-base group border-t border-pink-50">
                    <svg className="w-5 h-5 text-pink-400 group-hover:text-pink-600 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
                    Registrarse
                  </Link>
              </div>
            )}
          </div>
        </li>
      </ul>
      </div>
      {/* Botón menú hamburguesa y menú móvil igual que antes... */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden bg-black/30" onClick={() => setMobileMenuOpen(false)} />
      )}
      <div
        className={`fixed top-0 left-0 w-4/5 max-w-xs h-full bg-white z-50 shadow-2xl border-r border-pink-100 transform transition-transform duration-300 md:hidden ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-hidden={!mobileMenuOpen ? "true" : "false"}
        tabIndex={-1}
      >
        <div className="flex flex-col h-full pt-6 pb-8 px-6 gap-4">
          {/* Logo en menú móvil */}
          <Link to="/" onClick={handleLogoClick} className="flex items-center gap-2 mb-6" aria-label="Inicio" tabIndex={0}>
            <img src="/yc-logo.svg" alt="Ye&Cy Cosmetic Logo" className="h-10 w-10" />
            <span className="font-extrabold text-pink-600 text-xl tracking-wider">Ye&Cy Cosmetic</span>
          </Link>
          {/* Buscador en menú móvil */}
          <form className="w-full mb-4 relative" role="search" aria-label="Buscar productos">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-full border border-pink-200 shadow focus:border-pink-400 focus:ring-2 focus:ring-pink-300 outline-none transition-all text-gray-700 placeholder-pink-300 bg-white"
              placeholder="Buscar productos…"
              aria-label="Buscar productos"
            />
            <button type="submit" className="absolute left-2 top-1/2 -translate-y-1/2 text-pink-400 hover:text-pink-600 focus:outline-none" tabIndex={-1} aria-label="Buscar">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M21 21l-3.5-3.5" /></svg>
            </button>
          </form>
          <nav className="flex flex-col gap-2 flex-1">
            {navLinks.map(link => (
              <div key={link.name}>
                {link.isInternal ? (
                  <Link
                    to={link.href}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-700 font-semibold hover:bg-pink-50 hover:text-pink-600 transition-colors text-lg"
                  >
                    {link.icon}
                    {link.name}
                  </Link>
                ) : (
                  <a
                    href={link.href}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-700 font-semibold hover:bg-pink-50 hover:text-pink-600 transition-colors text-lg"
                  >
                    {link.icon}
                    {link.name}
                  </a>
                )}
              </div>
            ))}
            <Link to="/carrito" className="flex items-center gap-3 px-3 py-3 rounded-lg text-pink-600 font-bold hover:bg-pink-50 transition-colors text-lg">
              <svg className="w-7 h-7 text-pink-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h2l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              Carrito
            </Link>
          </nav>
          {/* Separador visual */}
          <div className="my-3 border-t border-pink-100" />
          {/* Menú usuario solo en móvil, siempre visible y accesible */}
          <div className="flex flex-col gap-2 md:hidden">
            <Link to="/login" className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-700 font-medium hover:bg-pink-50 hover:text-pink-700 transition-colors text-base">
              <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg>
              Iniciar sesión
            </Link>
            <Link to="/registro" className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-700 font-semibold hover:bg-pink-100 hover:text-pink-700 transition-colors text-base border-t border-pink-50">
              <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
              Registrarse
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default PublicNavbar; 