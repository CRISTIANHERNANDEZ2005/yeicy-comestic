import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 pt-16">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/productos" element={
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">Productos</h1>
                  <p className="text-xl text-gray-600">Página en construcción</p>
                </div>
              </div>
            } />
            <Route path="/categorias" element={
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">Categorías</h1>
                  <p className="text-xl text-gray-600">Página en construcción</p>
                </div>
              </div>
            } />
            <Route path="/ofertas" element={
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">Ofertas</h1>
                  <p className="text-xl text-gray-600">Página en construcción</p>
                </div>
              </div>
            } />
            <Route path="/contacto" element={
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">Contacto</h1>
                  <p className="text-xl text-gray-600">Página en construcción</p>
                </div>
              </div>
            } />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
