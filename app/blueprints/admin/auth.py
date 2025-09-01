from flask import Blueprint, request, jsonify, session, render_template, redirect, url_for
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

        session['user_type'] = 'admin'
        login_user(admin, remember=True)

        return jsonify({'success': True, 'redirect': url_for('admin_auth.dashboard')})

    return render_template('admin/page/login_admin.html')

@admin_auth_bp.route('/admin/dashboard')
@login_required
def dashboard():
    return render_template('admin/page/dashboard.html')

@admin_auth_bp.route('/admin/logout')
@login_required
def logout():
    logout_user()
    session.pop('user_type', None)
    return redirect(url_for('admin_auth.login'))