import functools
from flask import request, jsonify, current_app, redirect, url_for, flash
from app.models.domains.user_models import Admins # Import Admins model
from typing import Callable, TypeVar, cast, Any
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
from datetime import datetime, timedelta, timezone

F = TypeVar("F", bound=Callable[..., Any])

def generate_admin_jwt_token(admin_user: Admins) -> str:
    """Genera un token JWT para un usuario administrador."""
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
    """Decodifica un token JWT de administrador y retorna su payload. Retorna None si el token es inválido o expirado."""
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
    """Decorador para proteger rutas de administrador que requieren autenticación JWT."""
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        current_app.logger.debug(f'Request path: {request.path}')
        current_app.logger.debug(f'Admin JWT Cookie: {request.cookies.get("admin_jwt")}')

        token = request.cookies.get('admin_jwt') # Get token from HttpOnly cookie

        if not token:
            current_app.logger.warning('Intento de acceso no autorizado a ruta de administrador: No se proporcionó token.')
            flash('Acceso denegado. Se requiere autenticación de administrador.', 'danger')
            return redirect(url_for('admin_auth.login')) # Redirect to admin login

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