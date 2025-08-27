import functools
from flask import request, jsonify, current_app, session
from app.models.domains.user_models import Usuarios
from typing import Callable, TypeVar, cast, Any
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError

F = TypeVar("F", bound=Callable[..., Any])

def decode_jwt_token(token: str) -> dict | None:
    """Decodifica un token JWT y retorna su payload. Retorna None si el token es inválido o expirado."""
    secret = current_app.config.get('SECRET_KEY', 'super-secret')
    try:
        payload = jwt.decode(token, secret, algorithms=['HS256'])
        return payload
    except ExpiredSignatureError:
        current_app.logger.warning('Token expirado')
        return None
    except InvalidTokenError:
        current_app.logger.warning('Token inválido')
        return None
    except Exception as e:
        current_app.logger.error(f'Error inesperado al decodificar token: {e}')
        return None

def jwt_required(f: F) -> F:
    """Decorador para proteger rutas que requieren autenticación JWT y preservar la firma para Flask y Pylance."""
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        # Verificar si hay un usuario en la sesión (para compatibilidad con autenticación tradicional)
        if 'user' in session:
            user_id = session['user'].get('id')
            if user_id:
                usuario = Usuarios.query.get(user_id)
                if usuario:
                    return f(usuario, *args, **kwargs)

        # Verificar token JWT en el encabezado de autorización
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            current_app.logger.warning('Intento de acceso no autorizado: No se proporcionó token.')
            return jsonify({'error': 'No se proporcionó token de autenticación'}), 401
        try:
            token = auth_header.split(' ')[1]
            if not token:
                raise ValueError('Token vacío')

            payload = decode_jwt_token(token)
            if not payload:
                return jsonify({'error': 'Token inválido o expirado'}), 401

            user_id = payload.get('user_id')
            if not user_id:
                current_app.logger.warning('Payload de token no contiene user_id')
                return jsonify({'error': 'Token inválido: user_id no encontrado'}), 401

            usuario = Usuarios.query.get(user_id)
            if not usuario:
                current_app.logger.error(f'Usuario no encontrado para el ID: {usuario.id}')
                return jsonify({'error': 'Usuario no encontrado'}), 404

            current_app.logger.info(f'Acceso autorizado para el usuario: {usuario.id}')
            return f(usuario, *args, **kwargs)
        except Exception as e:
            current_app.logger.error(f'Error en la autenticación: {str(e)}')
            return jsonify({'error': 'Error de autenticación', 'details': str(e)}), 401
    return cast(F, wrapper)