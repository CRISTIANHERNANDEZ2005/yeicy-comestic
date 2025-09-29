"""
Módulo de Configuración de la Aplicación Flask.

Este archivo centraliza la configuración para los diferentes entornos de la aplicación
(desarrollo, producción, pruebas, etc.). Utiliza variables de entorno para mantener
la información sensible (como claves secretas y URLs de bases de datos) fuera del
código fuente, siguiendo las mejores prácticas de seguridad de "The Twelve-Factor App".

La configuración se organiza en clases:
- `Config`: Clase base con la configuración común a todos los entornos.
- `DevelopmentConfig`: Configuración específica para el entorno de desarrollo.
- `ProductionConfig`: Configuración optimizada y segura para el entorno de producción.

El diccionario `config_by_name` permite seleccionar la configuración adecuada
basándose en la variable de entorno `FLASK_ENV`.
"""
import os
from dotenv import load_dotenv

# Carga las variables de entorno desde un archivo .env para el desarrollo local.
load_dotenv()

class Config:
    """
    Clase de configuración base.

    Contiene los valores por defecto y la configuración común que se aplica a todos
    los entornos. Las configuraciones específicas de cada entorno heredarán de esta clase.
    """
    # Clave secreta para firmar sesiones, cookies y tokens. Es crucial para la seguridad.
    SECRET_KEY = os.getenv('SECRET_KEY', 'una-clave-secreta-muy-dificil-de-adivinar')

    # URL de conexión a la base de datos, leída desde las variables de entorno.
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///dev.db')

    # Desactiva el sistema de seguimiento de modificaciones de SQLAlchemy para mejorar el rendimiento.
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # --- Configuración del Pool de Conexiones de SQLAlchemy ---
    # Recicla las conexiones después de 299 segundos para evitar timeouts en la base de datos.
    SQLALCHEMY_POOL_RECYCLE = 299
    # Tiempo máximo de espera (en segundos) para obtener una conexión del pool.
    SQLALCHEMY_POOL_TIMEOUT = 20
    # Habilita el "pre-ping" que verifica si una conexión del pool está viva antes de usarla.
    SQLALCHEMY_POOL_PRE_PING = True

    # Modo de depuración de Flask. Se desactiva por defecto por seguridad.
    DEBUG = False

    # --- Configuración de Flask-JWT-Extended ---
    # Especifica que los tokens JWT se buscarán en las cookies.
    JWT_TOKEN_LOCATION = ["cookies"]
    # Nombre de la cookie que almacenará el token JWT para los administradores.
    JWT_ACCESS_COOKIE_NAME = "admin_jwt"
    # Desactiva la protección CSRF integrada en las cookies de JWT, ya que se puede manejar
    # de forma global con Flask-WTF si es necesario.
    JWT_COOKIE_CSRF_PROTECT = False
    # Nombres de cabecera y campo para CSRF (vacíos porque la protección está desactivada).
    JWT_ACCESS_CSRF_HEADER_NAME = ""
    JWT_ACCESS_CSRF_FIELD_NAME = ""
    # Define qué claim del payload del token se usará como identidad del usuario.
    JWT_IDENTITY_CLAIM = 'user_id'
    # Tiempo de expiración para el token JWT del administrador (en minutos). 10080 min = 7 días.
    ADMIN_JWT_EXPIRATION_MINUTES = 10080

class DevelopmentConfig(Config):
    """Configuración para el entorno de desarrollo."""
    DEBUG = True
    # Imprime en consola todas las sentencias SQL que SQLAlchemy ejecuta. Útil para depuración.
    SQLALCHEMY_ECHO = True

class ProductionConfig(Config):
    """Configuración para el entorno de producción."""
    DEBUG = False
    SQLALCHEMY_ECHO = False

# Diccionario que mapea los nombres de los entornos a sus respectivas clases de configuración.
# Permite cargar la configuración dinámicamente según la variable de entorno FLASK_ENV.
config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig
}