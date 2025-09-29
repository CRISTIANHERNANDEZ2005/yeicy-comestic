![YE&CY Cosmetic Banner](https://yeicy-comestic.vercel.app/)

# YE&CY Cosmetic - Plataforma E-Commerce

**YE&CY Cosmetic** es una aplicación web de comercio electrónico completa, desarrollada con Flask. Está diseñada para la gestión integral de una tienda de cosméticos, ofreciendo una solución robusta para la administración de productos, clientes, pedidos y ventas. La plataforma cuenta con una moderna tienda para clientes y un potente panel de administración.

El sistema está construido siguiendo las mejores prácticas de desarrollo, con un enfoque en la seguridad, modularidad y escalabilidad, preparándolo para un despliegue profesional en entornos de nube.

---

## ✨ Características Principales

### 🛍️ Área del Cliente
- **Autenticación de Usuarios**: Registro, inicio de sesión, cierre de sesión y recuperación de contraseña.
- **Catálogo de Productos**: Navegación por categorías, subcategorías y filtros avanzados (precio, marca, etc.).
- **Búsqueda Inteligente**: Búsqueda de productos en tiempo real con sugerencias.
- **Carrito de Compras**: Gestión del carrito persistente para usuarios autenticados y anónimos.
- **Favoritos**: Lista de deseos personal para cada usuario.
- **Perfil de Usuario**: Visualización y edición de datos personales y contraseña.
- **Historial de Pedidos**: Seguimiento de pedidos, visualización de detalles y opción para "volver a pedir".
- **Generación de Facturas**: Vista de factura imprimible para cada compra.
- **Notificaciones en Tiempo Real**: Alertas sobre el estado de los pedidos.

### ⚙️ Panel de Administración
- **Autenticación Segura**: Acceso exclusivo para administradores con JWT en cookies HttpOnly.
- **Dashboard de Métricas**: Estadísticas clave de ventas, ingresos, utilidad y tendencias.
- **Gestión de Usuarios**: Listado, visualización, activación/desactivación de cuentas de clientes.
- **Gestión de Productos (CRUD)**: Creación, edición y eliminación de productos, con gestión de stock e imágenes.
- **Gestión de Categorías**: Administración de la jerarquía de categorías.
- **Gestión de Pedidos**: Visualización y actualización del estado de los pedidos.
- **Gestión de Ventas**: Análisis de ventas completadas, con filtros avanzados y generación de facturas.
- **Creación de Ventas Directas**: Posibilidad de registrar ventas realizadas fuera de la plataforma.

## 🛠️ Stack Tecnológico

| Área                | Tecnología                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| **Backend**         | ![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white) ![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white) |
| **Base de Datos**   | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white) con ![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white) |
| **Frontend**        | ![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white) ![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black) |
| **Autenticación**   | Flask-Login (sesiones) y PyJWT (APIs y persistencia).                                                    |
| **Servicios Externos** | ![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white) para almacenamiento de imágenes. |
| **Despliegue**      | Preparado para Vercel, Heroku, o cualquier plataforma compatible con WSGI.                               |

## 📂 Estructura del Proyecto

El proyecto sigue una arquitectura modular basada en Blueprints para una clara separación de responsabilidades.

```plaintext
YE&CY-COSMETIC/
├── app/
│   ├── __init__.py            # Fábrica de la aplicación (create_app)
│   ├── blueprints/            # Módulos de la aplicación (Blueprints)
│   │   ├── admin/             # Lógica del panel de administración
│   │   └── cliente/           # Lógica del área de cliente
│   ├── models/                # Modelos de la base de datos (SQLAlchemy)
│   │   ├── domains/           # Modelos de negocio (Usuarios, Productos, etc.)
│   │   ├── enums.py           # Enumeraciones para estados y tipos
│   │   └── serializers.py     # Funciones para convertir modelos a diccionarios
│   ├── static/                # Archivos estáticos (CSS, JS, imágenes)
│   ├── templates/             # Plantillas Jinja2 (HTML)
│   ├── utils/                 # Utilidades compartidas (ej. manejo de JWT)
│   └── extensions.py          # Inicialización de extensiones de Flask
├── migrations/                # Scripts de migración de Alembic (Flask-Migrate)
├── config.py                  # Clases de configuración para diferentes entornos
├── requirements.txt           # Dependencias de Python
├── create_admin.py            # Script para crear un usuario administrador
├── run.py                     # Punto de entrada para ejecutar la aplicación
└── .env.example               # Archivo de ejemplo para variables de entorno
```

## 🚀 Puesta en Marcha (Instalación Local)

Sigue estos pasos para configurar y ejecutar el proyecto en tu entorno de desarrollo.

1.  **Clonar el repositorio:**
   ```bash
   git clone <URL_DEL_REPOSITORIO> yeicy-comestic
   cd yeicy-comestic
   ```

2.  **Crear y activar un entorno virtual:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # En Windows: venv\Scripts\activate
   ```

3.  **Instalar las dependencias:**
   ```bash
   pip install -r requirements.txt
   ```

4.  **Configurar las variables de entorno:**
    Crea un archivo `.env` en la raíz del proyecto (puedes copiar `.env.example`) y configúralo con tus credenciales.

5.  **Aplicar las migraciones a la base de datos:**
    Asegúrate de que tu servidor de PostgreSQL esté en ejecución y la base de datos creada.
   ```bash
   flask db upgrade
   ```

6.  **Crear un usuario administrador:**
    Ejecuta el script interactivo para crear tu primer administrador.
   ```bash
   python create_admin.py
   ```

7.  **Ejecutar la aplicación:**
   ```bash
   python run.py
   ```
   La aplicación estará disponible en `http://127.0.0.1:5000`.

## 🔑 Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

| Variable         | Descripción                                                                                             | Ejemplo                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `FLASK_ENV`      | El entorno de la aplicación.                                                                            | `development`                                                        |
| `SECRET_KEY`     | Clave secreta para firmar sesiones y tokens. Debe ser larga y aleatoria.                                | `un-secreto-muy-largo-y-dificil-de-adivinar`                           |
| `DATABASE_URL`   | La URL de conexión a tu base de datos PostgreSQL.                                                         | `postgresql://user:password@localhost:5432/yeicy_db`                 |
| `CLOUDINARY_URL` | La URL de configuración de tu cuenta de Cloudinary para la gestión de imágenes.                             | `cloudinary://api_key:api_secret@cloud_name`                         |

## ☁️ Notas sobre Despliegue

- **Seguridad**: Nunca subas tu archivo `.env` a un repositorio de código. Utiliza los secretos del entorno de tu proveedor de hosting.
- **Modo Debug**: La variable `FLASK_ENV=production` deshabilita automáticamente el modo debug.
- **Base de Datos**: Para producción, se recomienda una base de datos PostgreSQL gestionada. La configuración actual incluye `sslmode=require` para conexiones seguras.
- **Archivos Estáticos**: En un entorno de producción, es recomendable servir los archivos estáticos a través de un CDN para un mejor rendimiento.

---

**Este proyecto ha sido desarrollado profesionalmente, con un enfoque en la calidad del código, la seguridad y la eficiencia para su despliegue en la nube.**
