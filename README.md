# YE&CY-COSMETIC

YE&CY-COSMETIC es una aplicación web desarrollada en Flask para la gestión de clientes, productos y ventas de una tienda de cosméticos. El sistema está preparado para despliegue profesional en Render.com y utiliza buenas prácticas de seguridad, modularidad y despliegue.

## Características principales
- Gestión de clientes, productos y carrito de compras
- Autenticación de usuarios
- Panel de administración y área de cliente
- Migraciones de base de datos con Alembic/Flask-Migrate
- Contraseñas seguras con Flask-Bcrypt
- Arquitectura modular usando Blueprints
- Archivos estáticos y plantillas organizados
- Listo para producción en Render.com

## Estructura del proyecto
```
YE&CY-COMESTIC/
├── app/
│   ├── __init__.py         # Inicialización y configuración de la app Flask
│   ├── extensions.py       # Inicialización de extensiones (DB, Bcrypt, Migrate)
│   ├── blueprints/         # Blueprints: auth, cart, products
│   ├── models/             # Modelos de base de datos
│   ├── static/             # Archivos estáticos (css, js, imagenes)
│   └── templates/          # Plantillas HTML (admin, cliente)
├── migrations/             # Migraciones de base de datos
├── config.py               # Configuración de entornos (dev/prod)
├── requirements.txt        # Dependencias del proyecto
├── run.py                  # Entry point de la aplicación
├── Procfile                # Configuración para Render.com
├── render.yaml             # Configuración avanzada para Render.com
└── .gitignore              # Exclusión de archivos sensibles
```

## Instalación local

1. Clona el repositorio y entra al directorio del proyecto:
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd YE&CY-COMESTIC
   ```
2. Crea y activa un entorno virtual:
   ```bash
   python -m venv venv
   source venv/bin/activate  # En Windows: venv\Scripts\activate
   ```
3. Instala las dependencias:
   ```bash
   pip install -r requirements.txt
   ```
4. Crea un archivo `.env` con tus variables de entorno:
   ```env
   SECRET_KEY=TU_SECRETO
   DATABASE_URL=postgresql://usuario:password@host:puerto/db
   FLASK_ENV=development
   ```
5. Realiza las migraciones de base de datos:
   ```bash
   flask db upgrade
   ```
6. Ejecuta la aplicación:
   ```bash
   python run.py
   ```

## Despliegue en Render.com

1. Sube tu código a un repositorio (GitHub, GitLab, etc.)
2. Crea un nuevo servicio Web en Render y conecta el repositorio.
3. Render detectará automáticamente el `Procfile` y `render.yaml`.
4. Configura las variables de entorno en Render (usa los valores de tu `.env` local).
5. El sistema se desplegará usando Gunicorn en modo producción.

## Variables de entorno necesarias
- `SECRET_KEY` — Secreto para Flask
- `DATABASE_URL` — Cadena de conexión a la base de datos PostgreSQL
- `FLASK_ENV` — development o production (Render usa production)

## Notas de seguridad y producción
- Nunca subas tu archivo `.env` al repositorio
- El modo debug solo se activa en desarrollo
- Usa contraseñas fuertes y una base de datos segura

## Licencia
Este proyecto es privado y para uso exclusivo de YE&CY-COSMETIC.

---

**Desarrollado profesionalmente para despliegue seguro y eficiente en la nube.**
