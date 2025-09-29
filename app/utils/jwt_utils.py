"""
Módulo de Utilidades JWT para Clientes.

Este módulo proporciona las herramientas necesarias para manejar la autenticación
basada en JSON Web Tokens (JWT) para los usuarios clientes de la aplicación.

Funcionalidades principales:
- `decode_jwt_token`: Valida y decodifica un token JWT de cliente.
- `jwt_required`: Un decorador de ruta que protege los endpoints del lado del
  cliente. Asegura que solo un usuario con una sesión (token) válida pueda
  acceder a funcionalidades como ver su perfil, gestionar favoritos, etc.
"""
import functools
from flask import request, jsonify, current_app, session, redirect, url_for, flash
from app.models.domains.user_models import Usuarios
from typing import Callable, TypeVar, cast, Any
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError

F = TypeVar("F", bound=Callable[..., Any])

def decode_jwt_token(token: str) -> dict | None:
    """
    Decodifica un token JWT de cliente y retorna su payload.

    Esta función es un wrapper seguro alrededor de la librería `pyjwt`. Valida la
    firma del token usando la `SECRET_KEY` de la aplicación y verifica que no
    haya expirado.

    Args:
        token (str): El token JWT a decodificar.

    Returns:
        dict | None: El payload del token si es válido, o None si es inválido o ha expirado.
    """
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
    """
    Decorador para proteger rutas de cliente que requieren autenticación JWT.

    Este decorador es fundamental para la seguridad de las áreas privadas del cliente.
    Su lógica de autenticación es la siguiente:

    1. **Compatibilidad con Sesión Flask**: Primero, verifica si ya existe una sesión
       de usuario válida en `flask.session`. Si es así, permite el acceso para
       mantener la compatibilidad con la autenticación tradicional basada en cookies.
    2. **Verificación de Token JWT**: Si no hay sesión, busca un token en el
       encabezado `Authorization` (formato 'Bearer <token>').
    3. **Validación y Decodificación**: Si encuentra un token, lo decodifica y valida.
    4. **Recuperación de Usuario**: Extrae el `user_id` del payload del token y
       recupera el objeto `Usuarios` de la base de datos.
    5. **Inyección de Usuario**: Si el usuario es válido, lo inyecta como primer
       argumento en la función de la ruta decorada.
    6. **Manejo de Fallos**: Si en cualquier punto la autenticación falla (token
       faltante, inválido, expirado o usuario no encontrado), redirige al
       usuario a la página de inicio con un mensaje explicativo.
    """
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        # 1. Verificar si hay un usuario en la sesión (para compatibilidad con autenticación tradicional).
        if 'user' in session:
            user_id = session['user'].get('id')
            if user_id:
                usuario = Usuarios.query.get(user_id)
                if usuario:
                    return f(usuario, *args, **kwargs)

        # 2. Verificar token JWT en el encabezado de autorización.
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            current_app.logger.warning('Intento de acceso no autorizado: No se proporcionó token.')
            flash('Debes iniciar sesión para acceder a esta página.', 'warning')
            return redirect(url_for('products.index'))
        try:
            token = auth_header.split(' ')[1]
            if not token:
                raise ValueError('Token vacío')

            payload = decode_jwt_token(token)
            if not payload:
                flash('Tu sesión ha expirado o es inválida. Por favor, inicia sesión de nuevo.', 'warning')
                return redirect(url_for('products.index'))

            user_id = payload.get('user_id')
            if not user_id:
                current_app.logger.warning('Payload de token no contiene user_id')
                flash('Tu sesión es inválida. Por favor, inicia sesión de nuevo.', 'warning')
                return redirect(url_for('products.index'))

            usuario = Usuarios.query.get(user_id)
            if not usuario:
                current_app.logger.error(f'Usuario no encontrado para el ID: {user_id}')
                flash('Usuario no encontrado. Por favor, inicia sesión de nuevo.', 'warning')
                return redirect(url_for('products.index'))

            current_app.logger.info(f'Acceso autorizado para el usuario: {usuario.id}')
            return f(usuario, *args, **kwargs)
        except Exception as e:
            current_app.logger.error(f'Error en la autenticación: {str(e)}')
            flash('Ocurrió un error durante la autenticación. Por favor, intenta de nuevo.', 'danger')
            return redirect(url_for('products.index'))
    return cast(F, wrapper)