"""
Módulo de Utilidades JWT para Administradores.

Este módulo encapsula toda la lógica relacionada con la generación, decodificación
y validación de JSON Web Tokens (JWT) específicamente para los usuarios
administradores. Separar esta lógica de la de los usuarios clientes es una
buena práctica de seguridad que previene que un token de cliente pueda ser
utilizado para acceder a rutas de administrador.

Funcionalidades principales:
- `generate_admin_jwt_token`: Crea un token JWT para una sesión de administrador.
- `decode_admin_jwt_token`: Valida y decodifica un token de administrador.
- `admin_jwt_required`: Un decorador de ruta que protege los endpoints del panel
  de administración, asegurando que solo un administrador con una sesión
  (token) válida pueda acceder.
"""
import functools
from flask import request, jsonify, current_app, redirect, url_for, flash
from app.models.domains.user_models import Admins
from typing import Callable, TypeVar, cast, Any
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
from datetime import datetime, timedelta, timezone

F = TypeVar("F", bound=Callable[..., Any])

def generate_admin_jwt_token(admin_user: Admins) -> str:
    """
    Genera un token JWT para un usuario administrador.

    El payload del token incluye el ID del usuario, un flag `is_admin` para una
    verificación explícita, y las marcas de tiempo de expiración (exp) y emisión (iat).

    Args:
        admin_user (Admins): La instancia del modelo del administrador.

    Returns:
        str: El token JWT codificado como una cadena.
    """
    secret = current_app.config.get('SECRET_KEY', 'super-secret')
    token_expiration_minutes = current_app.config.get('ADMIN_JWT_EXPIRATION_MINUTES', 1440)
    
    payload = {
        'user_id': admin_user.id,
        'is_admin': True,
        'exp': int((datetime.utcnow() + timedelta(minutes=token_expiration_minutes)).timestamp()),
        'iat': int(datetime.utcnow().timestamp())
    }
    return jwt.encode(payload, secret, algorithm='HS256')

def decode_admin_jwt_token(token: str) -> dict | None:
    """
    Decodifica un token JWT de administrador y retorna su payload.

    Valida la firma y la fecha de expiración del token.

    Args:
        token (str): El token JWT a decodificar.

    Returns:
        dict | None: El payload del token si es válido, o None si ha expirado o es inválido.
    """
    secret = current_app.config.get('SECRET_KEY', 'super-secret')
    try:
        payload = jwt.decode(token, secret, algorithms=['HS256'])
        return payload
    except ExpiredSignatureError:
        current_app.logger.warning('Token de administrador expirado')
        return None
    except InvalidTokenError:
        current_app.logger.warning('Token de administrador inválido')
        return None
    except Exception as e:
        current_app.logger.error(f'Error inesperado al decodificar token de administrador: {e}')
        return None

def admin_jwt_required(f: F) -> F:
    """
    Decorador para proteger rutas de administrador que requieren autenticación JWT.

    Este decorador verifica la presencia y validez de un token JWT de administrador
    almacenado en la cookie `admin_jwt`.

    Funcionamiento:
    1. Extrae el token de la cookie `admin_jwt`.
    2. Si no hay token, redirige al login de administrador con un mensaje de error.
    3. Decodifica el token. Si es inválido o ha expirado, redirige al login.
    4. Verifica que el payload contenga `user_id` y el flag `is_admin`.
    5. Recupera el objeto `Admins` de la base de datos.
    6. Si el administrador es válido, lo inyecta como primer argumento en la función
       de la ruta decorada.
    7. Si algún paso falla, redirige al login y muestra un mensaje flash apropiado.
    """
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        current_app.logger.debug(f'Request path: {request.path}')
        current_app.logger.debug(f'Admin JWT Cookie: {request.cookies.get("admin_jwt")}')

        token = request.cookies.get('admin_jwt')
        if not token:
            current_app.logger.warning('Intento de acceso no autorizado a ruta de administrador: No se proporcionó token.')
            flash('Acceso denegado. Se requiere autenticación de administrador.', 'danger')
            return redirect(url_for('admin_auth.login'))

        try:

            payload = decode_admin_jwt_token(token)
            if not payload:
                flash('Tu sesión de administrador ha expirado o es inválida. Por favor, inicia sesión de nuevo.', 'warning')
                return redirect(url_for('admin_auth.login'))

            user_id = payload.get('user_id')
            is_admin = payload.get('is_admin', False)
            if not user_id or not is_admin:
                current_app.logger.warning('Payload de token de administrador no contiene user_id o no es administrador.')
                flash('Acceso denegado. Credenciales de administrador inválidas.', 'danger')
                return redirect(url_for('admin_auth.login'))

            admin_user = Admins.query.get(user_id)
            if not admin_user:
                current_app.logger.error(f'Usuario administrador no encontrado para el ID: {user_id}')
                flash('Acceso denegado. Usuario no autorizado.', 'danger')
                return redirect(url_for('admin_auth.login'))

            current_app.logger.info(f'Acceso autorizado a ruta de administrador para el usuario: {admin_user.id}')
            return f(admin_user, *args, **kwargs)
        except Exception as e:
            current_app.logger.error(f'Error en la autenticación de administrador: {str(e)}')
            flash('Ocurrió un error durante la autenticación de administrador. Por favor, intenta de nuevo.', 'danger')
            return redirect(url_for('admin_auth.login'))
    return cast(F, wrapper)