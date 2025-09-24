# app/blueprints/auth.py
from flask import Blueprint, request, jsonify, session, g, render_template, redirect, url_for, flash, current_app
from urllib.parse import quote
from app.models.domains.user_models import Usuarios
from app.models.serializers import usuario_to_dict
from app.extensions import db, bcrypt, login_manager
from flask_login import login_user, logout_user, current_user
from app.utils.jwt_utils import jwt_required

auth_bp = Blueprint('auth', __name__)

# Middleware para restaurar sesión desde JWT si existe
@auth_bp.before_app_request
def restore_session_from_jwt():
    # Si ya hay usuario en la sesión, no hacer nada
    if session.get('user'):
        return
    # Si el usuario ha cerrado sesión en esta petición, no restaurar
    if request.endpoint == 'auth.logout' and request.method == 'POST':
        return
    # Buscar token en cookies o Authorization header
    cookie_token = request.cookies.get('token')
    # Si la cookie 'token' está vacía o no existe, no restaurar sesión
    if not cookie_token or cookie_token.strip() == '':
        return
    token = cookie_token
    if not token:
        auth_header = request.headers.get('Authorization', None)
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
    if not token:
        return
    usuario = Usuarios.verificar_jwt(token)
    if usuario:
        session['user'] = {
            'id': usuario.id,
            'numero': usuario.numero,
            'nombre': usuario.nombre,
            'apellido': usuario.apellido
        }
        session.modified = True

# Endpoint para restaurar sesión desde el token JWT
@auth_bp.route('/me', methods=['GET'])
def me():
    from flask import current_app as app
    # Buscar token en cookies o Authorization header
    token = request.cookies.get('token')
    if not token:
        auth_header = request.headers.get('Authorization', None)
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
    if not token:
        return jsonify({'error': 'Token no proporcionado'}), 401
    try:
        usuario = Usuarios.verificar_jwt(token)
        if not usuario:
            return jsonify({'error': 'Token inválido o expirado'}), 401
        # Opcional: refrescar token si está por expirar
        return jsonify({
            'usuario': {
                'id': usuario.id,
                'numero': usuario.numero,
                'nombre': usuario.nombre,
                'apellido': usuario.apellido
            }
        }), 200
    except Exception as e:
        app.logger.error(f"Error al verificar token: {str(e)}", exc_info=True)
        return jsonify({'error': 'Token inválido'}), 401

# Registro de usuario
@auth_bp.route('/register', methods=['POST'])
def register():
    from flask import current_app as app
    data = request.get_json()
    app.logger.info(f"Intento de registro: {data.get('numero', 'N/A')}")
    required_fields = ['numero', 'nombre', 'apellido', 'contraseña']
    if not all(field in data for field in required_fields):
        app.logger.warning('Registro fallido: faltan campos requeridos')
        return jsonify({'error': 'Faltan campos requeridos'}), 400
    if len(data['contraseña']) < 6:
        app.logger.warning('Registro fallido: contraseña muy corta')
        return jsonify({'error': 'La contraseña debe tener al menos 6 caracteres'}), 400
    if len(data['numero']) != 10 or not data['numero'].isdigit():
        app.logger.warning('Registro fallido: número inválido')
        return jsonify({'error': 'El número debe tener 10 dígitos numéricos'}), 400
    if Usuarios.query.filter_by(numero=data['numero']).first():
        app.logger.warning(f"Registro fallido: número ya registrado {data['numero']}")
        return jsonify({'error': 'El número ya está registrado'}), 409
    try:
        usuario = Usuarios(
            numero=data['numero'],
            nombre=data['nombre'],
            apellido=data['apellido'],
            contraseña=data['contraseña']
        )
        db.session.add(usuario)
        db.session.commit()
        token = usuario.generar_jwt()
        
        # Almacenar datos del usuario en la sesión
        session['user'] = {
            'id': usuario.id,
            'numero': usuario.numero,
            'nombre': usuario.nombre,
            'apellido': usuario.apellido
        }
        session.modified = True
        
        app.logger.info(f"Registro exitoso: usuario {usuario.numero} (ID: {usuario.id})")
        return jsonify({'token': token, 'usuario': {
            'id': usuario.id,
            'numero': usuario.numero,
            'nombre': usuario.nombre,
            'apellido': usuario.apellido
        }}), 201
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error en registro: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

# Rutas de login
@auth_bp.route('/login', methods=['GET'])
def login_page():
    next_url = request.args.get('next', '')
    if current_user.is_authenticated:
        return redirect(next_url if next_url else url_for('products.index'))
    return render_template('cliente/ui/auth_modals.html', next=next_url)

@auth_bp.route('/login', methods=['POST'])
def login():
    from flask import current_app as app
    data = request.get_json()
    app.logger.info(f"Intento de inicio de sesión: {data.get('numero', 'N/A')}")

    if not data.get('numero') or not data.get('contraseña'):
        return jsonify({'error': 'Faltan campos requeridos'}), 400

    usuario = Usuarios.query.filter_by(numero=data['numero']).first()

    if not usuario:
        app.logger.warning(f"Inicio de sesión fallido: número no registrado {data['numero']}")
        return jsonify({'error': 'Credenciales inválidas'}), 401

    if not bcrypt.check_password_hash(usuario.contraseña, data['contraseña']):
        app.logger.warning(f"Inicio de sesión fallido: contraseña incorrecta para el número: {data['numero']}")
        return jsonify({'error': 'Credenciales inválidas'}), 401

    # Login del usuario con Flask-Login
    login_user(usuario, remember=True)

    # Almacenar datos adicionales en la sesión si es necesario
    session['user'] = {
        'id': usuario.id,
        'numero': usuario.numero,
        'nombre': usuario.nombre,
        'apellido': usuario.apellido
    }
    session.modified = True

    token = usuario.generar_jwt()
    app.logger.info(f"Inicio de sesión exitoso para el usuario: {usuario.numero} (ID: {usuario.id})")

    return jsonify({
        'success': True,
        'token': token,
        'usuario': {
            'id': usuario.id,
            'numero': usuario.numero,
            'nombre': usuario.nombre,
            'apellido': usuario.apellido
        },
        'redirect': request.args.get('next') or url_for('products.index')
    }), 200

# --- INICIO: FUNCIONALIDAD DE OLVIDÉ MI CONTRASEÑA ---

@auth_bp.route('/request-reset', methods=['POST'])
def request_reset():
    """
    Paso 1: El usuario ingresa su número.
    Genera un código de 6 dígitos y lo devuelve al frontend para que el usuario lo vea.
    """
    try:
        data = request.get_json()
        numero = data.get('numero', '').strip()
        nombre = data.get('nombre', '').strip()
        current_app.logger.info(f"Solicitud de reseteo de contraseña para el número: {numero} y nombre: {nombre[:3]}...")

        if not numero or not nombre:
            current_app.logger.warning("Solicitud de reseteo fallida: faltan campos (número o nombre).")
            return jsonify({'error': 'El número de teléfono y el nombre son requeridos.'}), 400

        # Búsqueda insensible a mayúsculas/minúsculas para el nombre
        usuario = Usuarios.query.filter(
            Usuarios.numero == numero,
            Usuarios.nombre.ilike(nombre),
            Usuarios.estado == 'activo'
        ).first()

        if not usuario:
            # Por seguridad, no revelamos si el número existe o no.
            current_app.logger.warning(f"Solicitud de reseteo fallida: combinación de número/nombre no encontrada o usuario inactivo para el número {numero}.")
            return jsonify({'error': 'Credenciales incorrectas. Verifica tu número y nombre.'}), 401

        # Generar código de 6 dígitos
        codigo = usuario.generar_codigo_recuperacion()
        current_app.logger.info(f"Código de recuperación generado para el usuario {usuario.id}")

        # Devolvemos el código directamente al frontend
        return jsonify({
            'success': True,
            'codigo': codigo
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error inesperado en request_reset: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'Ocurrió un error inesperado al procesar tu solicitud. Por favor, intenta de nuevo.'
        }), 500


@auth_bp.route('/verify-reset-code', methods=['POST'])
def verify_reset_code():
    """
    Paso 2: El usuario introduce el código que envió por WhatsApp.
    Verifica el código y si es válido, le permite cambiar la contraseña.
    """
    current_app.logger.info("Intento de verificación de código de reseteo.")
    data = request.get_json()
    codigo = data.get('codigo')

    if not codigo:
        current_app.logger.warning("Verificación de código fallida: no se proporcionó código.")
        return jsonify({'error': 'El código es requerido.'}), 400

    usuario = Usuarios.verificar_reset_token(codigo)

    if not usuario:
        current_app.logger.warning(f"Verificación de código fallida: código inválido o expirado '{codigo}'.")
        return jsonify({'error': 'El código es inválido o ha expirado. Por favor, solicita uno nuevo.'}), 401

    # El código es válido. Generamos un token seguro de un solo uso para la página de reseteo final.
    # Esto evita que alguien pueda reusar el código numérico para cambiar la contraseña.
    final_token = usuario.generar_token_seguro_reseteo() # Generamos un token largo y seguro.

    return jsonify({
        'success': True,
        'message': 'Código verificado. Ahora puedes crear tu nueva contraseña.',
        'message': 'Código verificado. Ahora puedes crear tu nueva contraseña.',
        'reset_token': final_token
    }), 200

@auth_bp.route('/reset-password/<token>', methods=['POST'])
def reset_password_api(token):
    """
    Paso 3 (API): Procesa el cambio de contraseña.
    Este endpoint solo es accesible con el token seguro generado en `verify_reset_code`
    y solo acepta peticiones POST con la nueva contraseña.
    """
    usuario = Usuarios.verificar_reset_token(token)
    if not usuario:
        return jsonify({'error': 'El token para restablecer la contraseña es inválido o ha expirado.'}), 404

    data = request.get_json()
    nueva_contraseña = data.get('contraseña')
    confirm_contraseña = data.get('confirm_contraseña')

    # Validar la nueva contraseña con el mismo patrón que el frontend
    # Mínimo 8 caracteres, una mayúscula, una minúscula y un número
    password_pattern = r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$"
    import re
    if not nueva_contraseña or not re.match(password_pattern, nueva_contraseña):
        return jsonify({'error': 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.'}), 400
    
    # MEJORA PROFESIONAL: Validar que las contraseñas coincidan en el backend
    if nueva_contraseña != confirm_contraseña:
        return jsonify({'error': 'Las contraseñas no coinciden. Por favor, verifica.', 'field': 'confirm_contraseña'}), 400

    # Actualizar contraseña
    usuario.contraseña = bcrypt.generate_password_hash(nueva_contraseña).decode('utf-8')
    # Invalidar el token para que no pueda ser reutilizado
    usuario.reset_token = None
    usuario.reset_token_expiration = None
    # MEJORA: Invalidar también el código numérico por si acaso.
    usuario.reset_code = None
    usuario.reset_code_expiration = None
    db.session.commit()

    current_app.logger.info(f"Contraseña restablecida exitosamente para el usuario {usuario.id}.")
    return jsonify({'success': True, 'message': '¡Contraseña actualizada con éxito! Redirigiendo para iniciar sesión.'}), 200


# --- FIN: FUNCIONALIDAD DE OLVIDÉ MI CONTRASEÑA ---
# Cerrar sesión
@auth_bp.route('/logout', methods=['POST'])
def logout():
    from flask import current_app as app, make_response
    try:
        # Cerrar sesión con Flask-Login
        logout_user()
        
        # Limpiar datos de sesión
        session.pop('user', None)
        session.pop('cart_id', None) # MEJORA: Limpiar también el carrito de sesión anónima
        session.modified = True
        
        # Crear respuesta y limpiar cookie del token
        response = make_response(jsonify({'success': True}))
        response.delete_cookie('token')
        
        app.logger.info("Sesión cerrada exitosamente")
        return response
    except Exception as e:
        app.logger.error(f"Error al cerrar sesión: {str(e)}", exc_info=True)
        return jsonify({'error': 'Error al cerrar sesión'}), 500

# Perfil de usuario
def perfil(usuario, pedidos_realizados=0, total_compras=0):
    # Detectar si es un dispositivo móvil
    user_agent = request.headers.get('User-Agent', '').lower()
    es_movil = 'mobile' in user_agent or 'android' in user_agent or 'iphone' in user_agent

    template_vars = {
        'usuario': usuario,
        'pedidos_realizados': pedidos_realizados,
        'total_compras': total_compras
    }

    if es_movil:
        return render_template('cliente/componentes/perfil_usuario.html', **template_vars)
    else:
        # TODO: Crear una plantilla de perfil para escritorio
        return render_template('cliente/componentes/perfil_usuario.html', **template_vars)

@auth_bp.route('/update_profile', methods=['PUT'])
@jwt_required
def update_profile(usuario):
    from flask import current_app as app
    data = request.get_json()
    user_id = current_user.id

    usuario = Usuarios.query.get(user_id)
    if not usuario:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    # Update fields if provided
    if 'nombre' in data:
        usuario.nombre = data['nombre']
    if 'apellido' in data:
        usuario.apellido = data['apellido']
    if 'nombre' in data:
        if not data['nombre'] or not all(c.isalpha() or c.isspace() for c in data['nombre']):
            return jsonify({'error': 'El nombre solo debe contener letras y espacios', 'field': 'modalNombre'}), 400
        usuario.nombre = data['nombre']
    if 'apellido' in data:
        if not data['apellido'] or not all(c.isalpha() or c.isspace() for c in data['apellido']):
            return jsonify({'error': 'El apellido solo debe contener letras y espacios', 'field': 'modalApellido'}), 400
        usuario.apellido = data['apellido']
    if 'numero' in data:
        if not data['numero'] or not data['numero'].isdigit() or len(data['numero']) != 10:
            return jsonify({'error': 'El número debe tener 10 dígitos numéricos', 'field': 'modalTelefono'}), 400
        if Usuarios.query.filter(Usuarios.numero == data['numero'], Usuarios.id != user_id).first():
            return jsonify({'error': 'El número de teléfono ya está en uso', 'field': 'modalTelefono'}), 409
        usuario.numero = data['numero']
    if 'contraseña' in data and data['contraseña']: # Only update if password is provided and not empty
        # Password strength validation (at least 8 chars, 1 uppercase, 1 lowercase, 1 digit)
        if len(data['contraseña']) < 8 or \
           not any(c.islower() for c in data['contraseña']) or \
           not any(c.isupper() for c in data['contraseña']) or \
           not any(c.isdigit() for c in data['contraseña']):
            return jsonify({'error': 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número', 'field': 'modalPassword'}), 400
        usuario.contraseña = bcrypt.generate_password_hash(data['contraseña']).decode('utf-8')

    try:
        db.session.commit()
        app.logger.info(f"Perfil actualizado para el usuario ID: {user_id}")
        return jsonify({
            'success': True,
            'usuario': {
                'id': usuario.id,
                'numero': usuario.numero,
                'nombre': usuario.nombre,
                'apellido': usuario.apellido
            }
        }), 200
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error al actualizar perfil para el usuario ID: {user_id}: {str(e)}", exc_info=True)
        return jsonify({'error': 'Error al actualizar el perfil'}), 500
