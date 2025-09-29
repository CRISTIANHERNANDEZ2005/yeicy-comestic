"""
Módulo de Centralización de Extensiones de Flask.

Este archivo sigue una práctica de diseño recomendada en Flask para evitar
problemas de importación circular. Al instanciar todas las extensiones de Flask
en un único lugar (sin inicializarlas con la aplicación aquí), otros módulos
como los modelos (`models.py`) o los blueprints pueden importar estas instancias
de forma segura.

La inicialización real de estas extensiones con la instancia de la aplicación
Flask (`db.init_app(app)`, `bcrypt.init_app(app)`, etc.) se realiza dentro de la
fábrica de la aplicación (`create_app` en `app/__init__.py`).
"""
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_jwt_extended import JWTManager

# Instancia de la extensión SQLAlchemy para la gestión de la base de datos (ORM).
db = SQLAlchemy()
# Instancia de la extensión Bcrypt para el hasheo seguro de contraseñas.
bcrypt = Bcrypt()
# Instancia de la extensión Migrate para gestionar las migraciones de la base de datos con Alembic.
migrate = Migrate()
# Instancia de la extensión LoginManager para gestionar las sesiones de usuario (login/logout).
login_manager = LoginManager()
# Instancia de la extensión JWTManager para la creación y verificación de JSON Web Tokens.
jwt = JWTManager()