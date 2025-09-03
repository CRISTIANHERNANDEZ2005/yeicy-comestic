from flask import Blueprint, request, jsonify, session, render_template, redirect, url_for, make_response, current_app
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

from flask_jwt_extended import create_access_token, set_access_cookies, unset_jwt_cookies
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
        access_token = create_access_token(identity=admin.id, additional_claims={"is_admin": True})

        response = make_response(jsonify({'success': True, 'redirect': url_for('admin_dashboard_bp.dashboard')}))
        set_access_cookies(response, access_token)
        return response

    return render_template('admin/page/login_admin.html')

@admin_auth_bp.route('/admin/logout')
@admin_jwt_required
def logout(admin_user): # admin_user is passed by the decorator
    # Client-side will handle token deletion.
    # We just return a success message.
    return jsonify({'success': True, 'message': 'Sesión cerrada exitosamente.'})