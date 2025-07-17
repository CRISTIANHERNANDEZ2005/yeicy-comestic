import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/publico/Landing';
import Home from './pages/cliente/Home';
import Dashboard from './pages/admin/Dashboard';
import NotFound from './pages/error/NotFound';
import WhatsAppFloatingButton from './components/publico/layout/WhatsAppFloatingButton';

function App() {
  return (
    <Router>
      <WhatsAppFloatingButton />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/cliente" element={<Home />} />
        <Route path="/admin" element={<Dashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
