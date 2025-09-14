from flask import Blueprint, request, jsonify, session, render_template, redirect, url_for, make_response, current_app
from datetime import timedelta
from app.models.domains.user_models import Admins
from app.extensions import db, bcrypt
from flask_login import login_user, logout_user, login_required

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

from flask_jwt_extended import create_access_token, set_access_cookies, unset_jwt_cookies, jwt_required, get_jwt_identity, jwt_required
from app.utils.admin_jwt_utils import admin_jwt_required

@admin_auth_bp.route('/administracion', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json()
        identificacion = data.get('identificacion')
        contraseña = data.get('contraseña')

        if not identificacion or not contraseña:
            return jsonify({'error': 'Faltan campos requeridos'}), 400

        admin = Admins.query.filter_by(cedula=identificacion).first()

        if not admin or not admin.verificar_contraseña(contraseña):
            return jsonify({'error': 'Credenciales inválidas'}), 401

        # Generar JWT
        admin_jwt_expiration_minutes = current_app.config.get('ADMIN_JWT_EXPIRATION_MINUTES', 1440) # Default to 24 hours if not set
        access_token = create_access_token(identity=admin.id, additional_claims={"is_admin": True}, expires_delta=timedelta(minutes=admin_jwt_expiration_minutes))

        response = make_response(jsonify({'success': True, 'redirect': url_for('admin_dashboard_bp.dashboard')}))
        set_access_cookies(response, access_token)
        return response

    return render_template('admin/page/login_admin.html')

@admin_auth_bp.route('/admin/logout', methods=['POST'])
def logout():
    response = make_response(jsonify({'success': True, 'message': 'Sesión cerrada exitosamente.'}))
    unset_jwt_cookies(response)
    return response

@admin_auth_bp.route("/admin/me", methods=["GET"])
@jwt_required(locations=["cookies"])
def admin_me():
    current_admin_id = get_jwt_identity()
    admin = Admins.query.get(current_admin_id)
    if not admin:
        return jsonify({"error": "Admin not found"}), 404
    
    return jsonify({
        "id": admin.id,
        "nombre": admin.nombre,
        "apellido": admin.apellido,
        "cedula": admin.cedula
    })