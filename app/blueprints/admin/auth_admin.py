from flask import Blueprint, request, jsonify, session, render_template, redirect, url_for, make_response, current_app
from datetime import timedelta, datetime
from app.models.domains.user_models import Admins
from app.extensions import db, bcrypt
from flask_login import login_user, logout_user, login_required
from flask_jwt_extended import create_access_token, set_access_cookies, unset_jwt_cookies, jwt_required, get_jwt_identity

admin_auth_bp = Blueprint('admin_auth', __name__)

@admin_auth_bp.route('/validate_credentials', methods=['POST'])
def validate_credentials():
    data = request.get_json()
    identificacion = data.get('identificacion')
    contraseña = data.get('contraseña')

    if not identificacion or not contraseña:
        return jsonify({'valid': False, 'message': 'Ambos campos son requeridos.'}), 200

    admin = Admins.query.filter_by(cedula=identificacion).first()

    if not admin:
        return jsonify({'valid': False, 'message': 'Usuario no encontrado.'}), 200
    
    if not admin.verificar_contraseña(contraseña):
        return jsonify({'valid': False, 'message': 'Contraseña incorrecta.'}), 200
    
    return jsonify({'valid': True, 'message': 'Credenciales válidas.'}), 200

@admin_auth_bp.route('/administracion', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json()
        identificacion = data.get('identificacion')
        contraseña = data.get('contraseña')

        if not identificacion or not contraseña:
            return jsonify({'error': 'Faltan campos requeridos'}), 400

        admin = Admins.query.filter_by(cedula=identificacion).first()

        # MEJORA PROFESIONAL: Validaciones secuenciales para mensajes de error claros.
        if not admin:
            return jsonify({'error': 'Credenciales inválidas'}), 401

        if not admin.is_active:
            return jsonify({'error': 'Tu cuenta de administrador ha sido desactivada. Contacta a soporte.'}), 403

        if not admin.verificar_contraseña(contraseña):
            return jsonify({'error': 'Credenciales inválidas'}), 401

        # MEJORA PROFESIONAL: Actualizar la última vez que se vio al admin al iniciar sesión.
        admin.last_seen = datetime.now(timezone.utc)
        db.session.commit()

        # Generar JWT
        admin_jwt_expiration_minutes = current_app.config.get('ADMIN_JWT_EXPIRATION_MINUTES', 1440) # Default to 24 hours if not set
        expires_delta = timedelta(minutes=admin_jwt_expiration_minutes)
        access_token = create_access_token(identity=admin.id, additional_claims={"is_admin": True}, expires_delta=expires_delta)

        response = make_response(jsonify({'success': True, 'redirect': url_for('admin_dashboard_bp.dashboard')}))
        set_access_cookies(response, access_token, max_age=expires_delta)
        return response

    return render_template('admin/page/login_admin.html')

@admin_auth_bp.route('/admin/logout', methods=['POST'])
@jwt_required(locations=["cookies"]) # MEJORA PROFESIONAL: Proteger el endpoint de logout.
def logout():
    """
    Cierra la sesión del administrador de forma segura.
    1. Marca al administrador como desconectado en la base de datos.
    2. Invalida la cookie JWT del lado del cliente.
    """
    try:
        # Obtener la identidad del admin desde el token JWT validado.
        admin_id = get_jwt_identity()
        admin = Admins.query.get(admin_id)
        if admin:
            # Guardar la hora exacta de la desconexión.
            admin.last_seen = datetime.now(timezone.utc)
            db.session.commit()
            current_app.logger.info(f"Administrador {admin.id} marcado como desconectado.")
    except Exception as e:
        current_app.logger.error(f"Error al marcar admin como desconectado durante logout: {e}")

    response = make_response(jsonify({'success': True, 'message': 'Sesión cerrada exitosamente.'}))
    unset_jwt_cookies(response)
    return response

@admin_auth_bp.route("/admin/me", methods=["GET"])
@jwt_required(locations=["cookies"]) # Asegura que esta ruta esté protegida
def admin_me():
    current_admin_id = get_jwt_identity()
    admin = Admins.query.get(current_admin_id)

    if not admin:
        return jsonify({"error": "Admin no encontrado"}), 404
    
    if not admin.is_active:
        return jsonify({"error": "Cuenta de administrador desactivada", "code": "ADMIN_ACCOUNT_INACTIVE"}), 403

    return jsonify({
        "id": admin.id,
        "nombre": admin.nombre,
        "apellido": admin.apellido,
        "cedula": admin.cedula
    })