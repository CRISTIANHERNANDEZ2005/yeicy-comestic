# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

# Yecy Cosmetic - Frontend

## Despliegue en Vercel

1. Sube este proyecto a un repositorio en GitHub, GitLab o Bitbucket.
2. Ingresa a [Vercel](https://vercel.com/) y crea un nuevo proyecto.
3. Conecta tu repositorio.
4. Vercel detectará automáticamente el framework Vite/React.
5. En Settings > Environment Variables, agrega:
   - `VITE_API_URL=https://backend-mc47.onrender.com`
6. Haz deploy.

## Entornos locales

- Para desarrollo, usa `.env` con:
  ```
  VITE_API_URL=http://localhost:8000
  ```
- Para producción, usa `.env.production` con:
  ```
  VITE_API_URL=https://backend-mc47.onrender.com
  ```

## Scripts útiles

- `npm install` — Instala dependencias
- `npm run dev` — Inicia entorno de desarrollo
- `npm run build` — Genera build de producción
- `npm run preview` — Previsualiza el build

---

- El favicon se encuentra en `/public/yc-logo.svg` y se usa tanto en la pestaña como en el navbar del cliente.
- Página 404 personalizada incluida en `src/pages/error/NotFound.tsx`.
