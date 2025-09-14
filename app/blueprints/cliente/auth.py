# app/blueprints/auth.py
from flask import Blueprint, request, jsonify, session, g, render_template, redirect, url_for
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

# Cerrar sesión
@auth_bp.route('/logout', methods=['POST'])
def logout():
    from flask import current_app as app, make_response
    try:
        # Cerrar sesión con Flask-Login
        logout_user()
        
        # Limpiar datos de sesión
        session.pop('user', None)
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

