# app/blueprints/auth.py
from flask import Blueprint, request, jsonify
from app.models.models import Usuario
from app.extensions import db, bcrypt

auth_bp = Blueprint('auth', __name__)

# Registro de usuario
@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    required_fields = ['numero', 'nombre', 'apellido', 'contraseña']
    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Faltan campos requeridos'}), 400
    if len(data['contraseña']) < 6:
        return jsonify({'error': 'La contraseña debe tener al menos 6 caracteres'}), 400
    if len(data['numero']) != 10 or not data['numero'].isdigit():
        return jsonify({'error': 'El número debe tener 10 dígitos numéricos'}), 400
    if Usuario.query.filter_by(numero=data['numero']).first():
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
        return jsonify({'token': token, 'usuario': {
            'id': usuario.id,
            'numero': usuario.numero,
            'nombre': usuario.nombre,
            'apellido': usuario.apellido
        }}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Login de usuario
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or 'numero' not in data or 'contraseña' not in data:
        return jsonify({'error': 'Número y contraseña requeridos'}), 400
    usuario = Usuario.query.filter_by(numero=data['numero']).first()
    if not usuario or not usuario.verificar_contraseña(data['contraseña']):
        return jsonify({'error': 'Credenciales inválidas'}), 401
    token = usuario.generar_jwt()
    return jsonify({'token': token, 'usuario': {
        'id': usuario.id,
        'numero': usuario.numero,
        'nombre': usuario.nombre,
        'apellido': usuario.apellido
    }}), 200