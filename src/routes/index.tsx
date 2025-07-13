// Rutas principales que agrupan todas las rutas por rol

import adminRoutes from './admin';
import clienteRoutes from './cliente';
import publicoRoutes from './publico';

const routes = [
  ...publicoRoutes,
  ...clienteRoutes,
  ...adminRoutes,
];

export default routes; 