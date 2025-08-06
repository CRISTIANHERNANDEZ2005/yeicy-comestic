# app/blueprints/auth.py
from flask import Blueprint, request, jsonify, session
from app.models.models import Usuario
from app.extensions import db, bcrypt

auth_bp = Blueprint('auth', __name__)

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
    if Usuario.query.filter_by(numero=data['numero']).first():
        app.logger.warning(f"Registro fallido: número ya registrado {data['numero']}")
        return jsonify({'error': 'El número ya está registrado'}), 409
    try:
        usuario = Usuario(
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

# Login de usuario
@auth_bp.route('/login', methods=['POST'])
def login():
    from flask import current_app as app
    data = request.get_json()
    app.logger.info(f"Intento de inicio de sesión: {data.get('numero', 'N/A')}")
    
    if not data.get('numero') or not data.get('contraseña'):
        return jsonify({'error': 'Número y contraseña son requeridos'}), 400
    
    usuario = Usuario.query.filter_by(numero=data['numero']).first()
    
    if not usuario or not bcrypt.check_password_hash(usuario.contraseña, data['contraseña']):
        app.logger.warning(f"Inicio de sesión fallido para el número: {data['numero']}")
        return jsonify({'error': 'Número o contraseña incorrectos'}), 401
    
    # Almacenar datos del usuario en la sesión
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
        'token': token,
        'usuario': {
            'id': usuario.id,
            'numero': usuario.numero,
            'nombre': usuario.nombre,
            'apellido': usuario.apellido
        }
    }), 200

# Cerrar sesión
@auth_bp.route('/logout', methods=['POST'])
def logout():
    from flask import current_app as app
    try:
        # Eliminar los datos del usuario de la sesión
        if 'user' in session:
            session.pop('user', None)
            session.modified = True
            app.logger.info("Sesión cerrada exitosamente")
            return jsonify({'success': True, 'message': 'Sesión cerrada exitosamente'}), 200
        else:
            app.logger.warning("Intento de cierre de sesión sin sesión activa")
            return jsonify({'error': 'No hay sesión activa'}), 400
    except Exception as e:
        app.logger.error(f"Error al cerrar sesión: {str(e)}", exc_info=True)
        return jsonify({'error': 'Error al cerrar la sesión'}), 500