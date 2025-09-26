# user_routes.py
from flask import Blueprint, jsonify, request, render_template, current_app
from app.models.domains.user_models import Usuarios, Admins
from app.models.serializers import usuario_to_dict, admin_to_dict
from app.models.enums import EstadoEnum
from app.extensions import db
from sqlalchemy import or_
from app.extensions import bcrypt
from flask_wtf.csrf import generate_csrf
from app.utils.admin_jwt_utils import admin_jwt_required
import uuid

# Crear el blueprint
user_bp = Blueprint('users', __name__)

# Vista principal para renderizar el template
@user_bp.route('/admin//lista-usuarios', methods=['GET'])
@admin_jwt_required
def usuarios_view(admin_user):
    """
    Renderiza la vista principal de gestión de usuarios.
    Esta vista carga el template con la interfaz para administrar clientes y administradores.
    """
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

    return render_template('admin/componentes/usuario/lista_usuarios.html', 
                            admin_user=admin_user,
                            csrf_token=generate_csrf(),
                            is_ajax=is_ajax)

# Endpoints para la API de Usuarios (Clientes)

@user_bp.route('/api/usuarios', methods=['GET'])
@admin_jwt_required
def get_usuarios(admin_user):
    """
    Obtiene la lista de usuarios (clientes) con paginación y filtros.
    
    Parámetros de consulta:
    - page: Número de página (default: 1)
    - per_page: Elementos por página (default: 10)
    - search: Término de búsqueda para nombre, apellido o teléfono
    - status: Filtro por estado (activo/inactivo)
    
    Retorna:
    - JSON con lista de usuarios y datos de paginación
    """
    try:
        # Obtener parámetros de consulta
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '')
        status = request.args.get('status', '')
        
        # Construir consulta base
        query = Usuarios.query
        
        # Aplicar filtro de búsqueda si existe
        if search:
            query = query.filter(
                or_(
                    Usuarios.nombre.ilike(f'%{search}%'),
                    Usuarios.apellido.ilike(f'%{search}%'),
                    Usuarios.numero.ilike(f'%{search}%')
                )
            )
        
        # Aplicar filtro de estado si existe
        if status:
            query = query.filter(Usuarios.estado == status)
        
        # Ejecutar consulta con paginación
        usuarios = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Preparar respuesta
        return jsonify({
            'success': True,
            'usuarios': [usuario_to_dict(usuario) for usuario in usuarios.items],
            'pagination': {
                'page': usuarios.page,
                'pages': usuarios.pages,
                'per_page': usuarios.per_page,
                'total': usuarios.total,
                'has_next': usuarios.has_next,
                'has_prev': usuarios.has_prev
            }
        })
    
    except Exception as e:
        current_app.logger.error(f"Error al obtener usuarios: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al obtener usuarios'}), 500

@user_bp.route('/api/usuarios', methods=['POST'])
@admin_jwt_required
def create_usuario(admin_user):
    """
    Crea un nuevo usuario (cliente).
    
    Body:
    - numero: Teléfono del usuario (requerido)
    - ... y otros campos del formulario
    
    Retorna:
    - JSON con los datos del usuario creado
    """
    try:
        # Obtener datos del request
        data = request.get_json()
        
        # Validar datos requeridos
        required_fields = ['numero', 'nombre', 'apellido']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'success': False, 'message': f'El campo {field} es requerido'}), 400
        
        # MEJORA PROFESIONAL: Verificar si el número de teléfono ya existe
        if Usuarios.query.filter_by(numero=data['numero']).first():
            return jsonify({'success': False, 'message': 'El número de teléfono ya está registrado'}), 409 # 409 Conflict

        # MEJORA PROFESIONAL: Generar contraseña automática si no se proporciona.
        if 'contraseña' in data and data['contraseña']:
            password_to_use = data['contraseña']
        else:
            # MEJORA PROFESIONAL: Lógica de contraseña automática de 8 caracteres.
            nombre_base = data.get('nombre', '').strip().capitalize().split(' ')[0]
            numero = data.get('numero', '')
            if not nombre_base or len(numero) < 2:
                return jsonify({'success': False, 'message': 'Nombre y número son requeridos para generar contraseña automática'}), 400

            longitud_nombre = len(nombre_base)
            digitos_necesarios = max(2, 8 - longitud_nombre) # Tomar al menos 2 dígitos.
            password_to_use = f"{nombre_base}{numero[:digitos_necesarios]}"

        # Crear nuevo usuario
        usuario = Usuarios(
            numero=data['numero'],
            nombre=data['nombre'],
            apellido=data['apellido'],
            contraseña=password_to_use, # Pasar la contraseña en texto plano al constructor
            estado=EstadoEnum.ACTIVO.value
        )
        
        db.session.add(usuario)
        db.session.commit()
        
        # Preparar respuesta
        return jsonify({
            'success': True,
            'message': 'Usuario creado correctamente',
            'usuario': usuario_to_dict(usuario)
        }), 201
    
    except ValueError as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al crear usuario: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al crear usuario'}), 500

@user_bp.route('/api/usuarios/<string:user_id>', methods=['GET', 'PUT'])
@admin_jwt_required
def handle_usuario(admin_user, user_id):
    """
    Obtiene (GET) o actualiza (PUT) un usuario (cliente) existente.
    
    Parámetros:
    - user_id: ID del usuario
    """
    usuario = Usuarios.query.get_or_404(user_id)

    if request.method == 'GET':
        return jsonify({
            'success': True,
            'usuario': usuario_to_dict(usuario)
        })

    if request.method == 'PUT':
        try:
            data = request.get_json()
            
            # MEJORA PROFESIONAL: Validar duplicados si se cambia el número
            if 'numero' in data and data['numero'] != usuario.numero:
                if Usuarios.query.filter(Usuarios.id != user_id, Usuarios.numero == data['numero']).first():
                    return jsonify({'success': False, 'message': 'El número de teléfono ya está en uso'}), 409

            # Actualizar campos
            usuario.nombre = data.get('nombre', usuario.nombre)
            usuario.apellido = data.get('apellido', usuario.apellido)
            usuario.numero = data.get('numero', usuario.numero)
            usuario.estado = data.get('estado', usuario.estado)

            # MEJORA DE SEGURIDAD: Actualizar contraseña solo si se proporciona una nueva
            if 'contraseña' in data and data['contraseña']:
                usuario.contraseña = data['contraseña'] # El setter del modelo se encargará del hasheo
            
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Usuario actualizado correctamente',
                'usuario': usuario_to_dict(usuario)
            })
        
        except ValueError as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': str(e)}), 400
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error al actualizar usuario {user_id}: {str(e)}")
            return jsonify({'success': False, 'message': 'Error al actualizar usuario'}), 500

@user_bp.route('/api/usuarios/<string:user_id>/status', methods=['PUT'])
@admin_jwt_required
def toggle_usuario_status(admin_user, user_id):
    """
    Cambia el estado de un usuario (cliente) entre activo e inactivo.
    
    Parámetros:
    - user_id: ID del usuario a cambiar estado
    
    Retorna:
    - JSON con el resultado de la operación
    """
    try:
        usuario = Usuarios.query.get_or_404(user_id)
        # Cambiar estado
        nuevo_estado = EstadoEnum.INACTIVO.value if usuario.estado == EstadoEnum.ACTIVO.value else EstadoEnum.ACTIVO.value
        usuario.estado = nuevo_estado
        
        # Guardar cambios en la base de datos
        db.session.commit()
        
        # Preparar respuesta
        return jsonify({
            'success': True,
            'message': 'Estado de usuario actualizado correctamente',
            'usuario': usuario_to_dict(usuario)
        })
    
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al cambiar estado del usuario {user_id}: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al cambiar estado del usuario'}), 500

# Endpoints para la API de Administradores

@user_bp.route('/api/admins', methods=['GET'])
@admin_jwt_required
def get_admins(admin_user):
    """
    Obtiene la lista de administradores con paginación y filtros.
    
    Parámetros de consulta:
    - page: Número de página (default: 1)
    - per_page: Elementos por página (default: 10)
    - search: Término de búsqueda para nombre, apellido, cédula o teléfono
    
    Retorna:
    - JSON con lista de administradores y datos de paginación
    """
    try:
        # Obtener parámetros de consulta
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '')
        
        # Construir consulta base
        query = Admins.query
        
        # Aplicar filtro de búsqueda si existe
        if search:
            query = query.filter(
                or_(
                    Admins.nombre.ilike(f'%{search}%'),
                    Admins.apellido.ilike(f'%{search}%'),
                    Admins.cedula.ilike(f'%{search}%'),
                    Admins.numero_telefono.ilike(f'%{search}%')
                )
            )
        
        # Ejecutar consulta con paginación
        admins = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Preparar respuesta
        return jsonify({
            'success': True,
            'admins': [admin_to_dict(admin) for admin in admins.items],
            'pagination': {
                'page': admins.page,
                'pages': admins.pages,
                'per_page': admins.per_page,
                'total': admins.total,
                'has_next': admins.has_next,
                'has_prev': admins.has_prev
            }
        })
    
    except Exception as e:
        current_app.logger.error(f"Error al obtener administradores: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al obtener administradores'}), 500

@user_bp.route('/api/admins', methods=['POST'])
@admin_jwt_required
def create_admin(admin_user):
    """
    Crea un nuevo administrador.
    
    Body:
    - cedula: Cédula del administrador (requerido)
    - ... y otros campos del formulario
    Retorna:
    - JSON con los datos del administrador creado
    """
    try:
        # Obtener datos del request
        data = request.get_json()
        
        # Validar datos requeridos
        required_fields = ['cedula', 'nombre', 'apellido', 'numero_telefono']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'success': False, 'message': f'El campo {field} es requerido'}), 400
        
        # MEJORA PROFESIONAL: Verificar si la cédula o el teléfono ya existen
        if Admins.query.filter_by(cedula=data['cedula']).first():
            return jsonify({'success': False, 'message': 'La cédula ya está registrada'}), 409
        if Admins.query.filter_by(numero_telefono=data['numero_telefono']).first():
            return jsonify({'success': False, 'message': 'El número de teléfono ya está registrado'}), 409

        # MEJORA PROFESIONAL: Generar contraseña automática si no se proporciona.
        if 'contraseña' in data and data['contraseña']:
            password_to_use = data['contraseña']
        else:
            # MEJORA PROFESIONAL: Lógica de contraseña automática de 8 caracteres.
            nombre_base = data.get('nombre', '').strip().capitalize().split(' ')[0]
            numero = data.get('numero_telefono', '')
            if not nombre_base or len(numero) < 2:
                return jsonify({'success': False, 'message': 'Nombre y teléfono son requeridos para generar contraseña automática'}), 400

            longitud_nombre = len(nombre_base)
            digitos_necesarios = max(2, 8 - longitud_nombre) # Tomar al menos 2 dígitos.
            password_to_use = f"{nombre_base}{numero[:digitos_necesarios]}"


        # Crear nuevo administrador
        admin = Admins(
            cedula=data['cedula'],
            nombre=data['nombre'],
            apellido=data['apellido'],
            numero_telefono=data['numero_telefono'],
            contraseña=password_to_use, # Pasar la contraseña en texto plano al constructor
            estado=EstadoEnum.ACTIVO.value
        )
        
        db.session.add(admin)
        db.session.commit()
        
        # Preparar respuesta
        return jsonify({
            'success': True,
            'message': 'Administrador creado correctamente',
            'admin': admin_to_dict(admin)
        }), 201
    
    except ValueError as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al crear administrador: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al crear administrador'}), 500

@user_bp.route('/api/admins/<string:admin_id>', methods=['GET', 'PUT'])
@admin_jwt_required
def handle_admin(admin_user, admin_id):
    """
    Obtiene (GET) o actualiza (PUT) un administrador existente.
    
    Parámetros:
    - admin_id: ID del administrador
    """
    admin = Admins.query.get_or_404(admin_id)

    if request.method == 'GET':
        return jsonify({
            'success': True,
            'admin': admin_to_dict(admin)
        })

    if request.method == 'PUT':
        try:
            data = request.get_json()

            # MEJORA PROFESIONAL: Validar duplicados si se cambian datos únicos
            if 'cedula' in data and data['cedula'] != admin.cedula:
                if Admins.query.filter(Admins.id != admin_id, Admins.cedula == data['cedula']).first():
                    return jsonify({'success': False, 'message': 'La cédula ya está en uso'}), 409
            if 'numero_telefono' in data and data['numero_telefono'] != admin.numero_telefono:
                if Admins.query.filter(Admins.id != admin_id, Admins.numero_telefono == data['numero_telefono']).first():
                    return jsonify({'success': False, 'message': 'El teléfono ya está en uso'}), 409

            # Actualizar campos
            admin.nombre = data.get('nombre', admin.nombre)
            admin.apellido = data.get('apellido', admin.apellido)
            admin.cedula = data.get('cedula', admin.cedula)
            admin.numero_telefono = data.get('numero_telefono', admin.numero_telefono)
            admin.estado = data.get('estado', admin.estado)

            # Actualizar contraseña solo si se proporciona una nueva y no está vacía.
            nueva_contraseña = data.get('contraseña')
            if nueva_contraseña:
                admin.contraseña = nueva_contraseña # El setter del modelo se encargará del hasheo
            
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Administrador actualizado correctamente',
                'admin': admin_to_dict(admin)
            })
        
        except ValueError as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': str(e)}), 400
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error al actualizar administrador {admin_id}: {str(e)}")
            return jsonify({'success': False, 'message': 'Error al actualizar administrador'}), 500

# Endpoint para estadísticas

@user_bp.route('/api/stats/usuarios', methods=['GET'])
@admin_jwt_required
def get_usuario_stats(admin_user):
    """
    Obtiene estadísticas de usuarios y administradores.
    
    Retorna:
    - JSON con estadísticas:
        - total_clientes: Total de clientes
        - clientes_activos: Total de clientes activos
        - total_admins: Total de administradores
    """
    try:
        # Obtener estadísticas
        total_clientes = Usuarios.query.count()
        clientes_activos = Usuarios.query.filter(Usuarios.estado == EstadoEnum.ACTIVO).count()
        total_admins = Admins.query.count()
        
        # Preparar respuesta
        return jsonify({
            'success': True,
            'total_clientes': total_clientes,
            'clientes_activos': clientes_activos,
            'total_admins': total_admins
        })
    
    except Exception as e:
        current_app.logger.error(f"Error al obtener estadísticas: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al obtener estadísticas'}), 500