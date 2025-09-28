# user_routes.py
from flask import Blueprint, jsonify, request, render_template, current_app
from app.models.domains.user_models import Usuarios, Admins
from app.models.serializers import usuario_to_dict, admin_to_dict
from app.models.enums import EstadoEnum
from app.extensions import db
from sqlalchemy import or_, case, desc
from app.extensions import bcrypt
from flask_wtf.csrf import generate_csrf
from app.utils.admin_jwt_utils import admin_jwt_required
import uuid, datetime

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
                            authenticated_admin_id=admin_user.id,
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
    - sort: Criterio de ordenamiento (recientes, antiguos, nombre_asc, nombre_desc)
    
    Retorna:
    - JSON con lista de usuarios y datos de paginación
    """
    try:
        # Obtener parámetros de consulta
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '')
        status = request.args.get('status', '')
        sort = request.args.get('sort', 'online') #  El orden por defecto ahora es 'online'.
        
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

        # Lógica de ordenamiento refactorizada y ampliada.
        online_threshold = datetime.datetime.utcnow() - datetime.timedelta(minutes=5)

        if sort == 'nombre_asc':
            query = query.order_by(Usuarios.nombre.asc())
        elif sort == 'nombre_desc':
            query = query.order_by(Usuarios.nombre.desc())
        elif sort == 'antiguos':
            query = query.order_by(Usuarios.created_at.asc())
        elif sort == 'recientes':
            query = query.order_by(desc(Usuarios.created_at))
        elif sort == 'inactive':
            #  Ordena mostrando primero los usuarios no-online, y al final los que tienen estado 'inactivo'.
            # Prioridad 0: Usuarios activos pero no en línea (last_seen nulo o antiguo).
            # Prioridad 1: Usuarios activos y en línea.
            # Prioridad 2: Usuarios con estado 'inactivo'.
            inactive_priority = case(
                (Usuarios.estado == EstadoEnum.INACTIVO, 2),
                (Usuarios.last_seen.is_(None), 0),
                (Usuarios.last_seen < online_threshold, 0),
                else_=1
            ).label('inactive_priority')
            query = query.order_by(inactive_priority, desc(Usuarios.last_seen), desc(Usuarios.updated_at))
        else:  # 'online' por defecto
            # Consulta de ordenamiento optimizada para 'online'.
            # Se elimina la subconsulta 'exists()' y se unifica en un solo 'CASE'.
            # Prioridad 0: En línea. Prioridad 1: Inactivos. Prioridad 2: Desconectados.
            online_priority = case(
                (Usuarios.last_seen > online_threshold, 0),
                (Usuarios.estado == EstadoEnum.INACTIVO, 2),
                else_=1
            ).label('online_priority')
            query = query.order_by(online_priority, desc(Usuarios.last_seen), desc(Usuarios.created_at))
        
        # Ejecutar consulta con paginación
        usuarios = query.paginate(page=page, per_page=per_page, error_out=False)
        
        #  Añadir 'is_online' al diccionario del usuario.
        # El serializador base no incluye propiedades, así que lo agregamos aquí.
        usuarios_list = []
        for usuario in usuarios.items:
            user_dict = usuario_to_dict(usuario)
            user_dict['is_online'] = usuario.is_online
            user_dict['last_seen_display'] = usuario.last_seen_display
            usuarios_list.append(user_dict)

        # Preparar respuesta
        return jsonify({
            'success': True,
            'usuarios': usuarios_list,
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
        
        #  Verificar si el número de teléfono ya existe
        if Usuarios.query.filter_by(numero=data['numero']).first():
            return jsonify({'success': False, 'message': 'El número de teléfono ya está registrado'}), 409 # 409 Conflict

        # Generar contraseña automática si no se proporciona.
        if 'contraseña' in data and data['contraseña']:
            password_to_use = data['contraseña']
        else:
            #  Lógica de contraseña automática de 8 caracteres.
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
            
            # Validar duplicados si se cambia el número
            if 'numero' in data and data['numero'] != usuario.numero:
                if Usuarios.query.filter(Usuarios.id != user_id, Usuarios.numero == data['numero']).first():
                    return jsonify({'success': False, 'message': 'El número de teléfono ya está en uso'}), 409

            # Actualizar campos
            usuario.nombre = data.get('nombre', usuario.nombre)
            usuario.apellido = data.get('apellido', usuario.apellido)
            usuario.numero = data.get('numero', usuario.numero)
            usuario.estado = data.get('estado', usuario.estado)

            # Actualizar contraseña solo si se proporciona una nueva y no está vacía.
            # Esto evita que una cadena vacía sobrescriba el hash existente.
            if data.get('contraseña'):
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

@user_bp.route('/api/admins/<string:admin_id>/status', methods=['PUT'])
@admin_jwt_required
def toggle_admin_status(admin_user, admin_id):
    """
    Cambia el estado de un administrador entre activo e inactivo.
    
    Parámetros:
    - admin_id: ID del administrador a cambiar estado
    
    Retorna:
    - JSON con el resultado de la operación
    """
    try:
        admin = Admins.query.get_or_404(admin_id)
        # Cambiar estado
        nuevo_estado = EstadoEnum.INACTIVO.value if admin.estado == EstadoEnum.ACTIVO.value else EstadoEnum.ACTIVO.value
        admin.estado = nuevo_estado
        
        # Guardar cambios en la base de datos
        db.session.commit()
        
        # Preparar respuesta
        return jsonify({
            'success': True,
            'message': 'Estado de administrador actualizado correctamente',
            'admin': admin_to_dict(admin)
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al cambiar estado del administrador {admin_id}: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al cambiar estado del administrador'}), 500
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
    - status: Filtro por estado (activo/inactivo)
    - sort: Criterio de ordenamiento (recientes, antiguos, nombre_asc, nombre_desc)
    
    Retorna:
    - JSON con lista de administradores y datos de paginación
    """
    try:
        # Obtener parámetros de consulta
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '')
        status = request.args.get('status', '')
        sort = request.args.get('sort', 'online') #  El orden por defecto ahora es 'online'.
        
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

        # Aplicar filtro de estado si existe
        if status:
            query = query.filter(Admins.estado == status)
            
        #  Lógica de ordenamiento refactorizada y ampliada.
        online_threshold = datetime.datetime.utcnow() - datetime.timedelta(minutes=5)
        current_admin_id = admin_user.id

        if sort == 'nombre_asc':
            query = query.order_by(Admins.nombre.asc())
        elif sort == 'nombre_desc':
            query = query.order_by(Admins.nombre.desc())
        elif sort == 'antiguos':
            query = query.order_by(Admins.created_at.asc())
        elif sort == 'recientes':
            query = query.order_by(desc(Admins.created_at))
        elif sort == 'inactive':
            #  Ordena mostrando primero los admins no-online, y al final los que tienen estado 'inactivo'.
            # Prioridad 0: Admins activos pero no en línea.
            # Prioridad 1: Admins activos y en línea.
            # Prioridad 2: Admins con estado 'inactivo'.
            inactive_priority = case(
                (Admins.estado == EstadoEnum.INACTIVO, 2),
                (Admins.last_seen.is_(None), 0),
                (Admins.last_seen < online_threshold, 0),
                else_=1
            ).label('inactive_priority')
            query = query.order_by(inactive_priority, desc(Admins.last_seen), desc(Admins.updated_at))
        else:  # 'online' por defecto
            #  Consulta de ordenamiento optimizada para 'online' en administradores.
            # Se elimina la subconsulta 'exists()' y se unifica en un solo 'CASE' jerárquico.
            # Prioridad 0: El admin actual.
            # Prioridad 1: Otros admins en línea.
            # Prioridad 2: Admins inactivos (con estado 'inactivo').
            # Prioridad 3: El resto (desconectados).
            priority_order = case(
                (Admins.id == current_admin_id, 0),
                (Admins.last_seen > online_threshold, 1),
                (Admins.estado == EstadoEnum.INACTIVO, 3),
                else_=2
            ).label('admin_priority')
            query = query.order_by(priority_order, desc(Admins.last_seen), desc(Admins.created_at))
        
        # Ejecutar consulta con paginación
        admins = query.paginate(page=page, per_page=per_page, error_out=False)
        
        #  Añadir 'is_online' al diccionario del admin.
        admins_list = []
        for admin in admins.items:
            admin_dict = admin_to_dict(admin)
            admin_dict['is_online'] = admin.is_online
            admin_dict['last_seen_display'] = admin.last_seen_display
            admins_list.append(admin_dict)

        # Preparar respuesta
        return jsonify({
            'success': True,
            'admins': admins_list,
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
        
        #  Verificar si la cédula o el teléfono ya existen
        if Admins.query.filter_by(cedula=data['cedula']).first():
            return jsonify({'success': False, 'message': 'La cédula ya está registrada'}), 409
        if Admins.query.filter_by(numero_telefono=data['numero_telefono']).first():
            return jsonify({'success': False, 'message': 'El número de teléfono ya está registrado'}), 409

        #  Generar contraseña automática si no se proporciona.
        if 'contraseña' in data and data['contraseña']:
            password_to_use = data['contraseña']
        else:
            # Lógica de contraseña automática de 8 caracteres.
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

            # Validar duplicados si se cambian datos únicos
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
        #  Calcular usuarios en línea.
        online_threshold = datetime.datetime.utcnow() - datetime.timedelta(minutes=5)

        # Obtener estadísticas
        total_clientes = Usuarios.query.count()
        clientes_activos = Usuarios.query.filter(Usuarios.estado == EstadoEnum.ACTIVO).count()
        clientes_online = Usuarios.query.filter(
            Usuarios.estado == EstadoEnum.ACTIVO,
            Usuarios.last_seen > online_threshold
        ).count()

        total_admins = Admins.query.count()
        admins_activos = Admins.query.filter(Admins.estado == EstadoEnum.ACTIVO).count()
        admins_online = Admins.query.filter(
            Admins.estado == EstadoEnum.ACTIVO,
            Admins.last_seen > online_threshold
        ).count()
        
        # Preparar respuesta
        return jsonify({
            'success': True,
            'total_clientes': total_clientes,
            'clientes_activos': clientes_activos,
            'clientes_online': clientes_online,
            'total_admins': total_admins,
            'admins_activos': admins_activos,
            'admins_online': admins_online
        })
    
    except Exception as e:
        current_app.logger.error(f"Error al obtener estadísticas: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al obtener estadísticas'}), 500

@user_bp.route('/api/heartbeat', methods=['POST'])
@admin_jwt_required
def admin_heartbeat(admin_user):
    """
    Endpoint para que el frontend del admin reporte actividad.
    Actualiza el 'last_seen' del administrador para mantenerlo 'En línea'.
    """
    try:
        # El decorador @admin_jwt_required ya nos da el admin_user
        admin_user.last_seen = datetime.datetime.now(datetime.timezone.utc)
        db.session.commit()
        return jsonify({'success': True}), 200
    except Exception as e:
        current_app.logger.error(f"Error en el heartbeat del admin {admin_user.id}: {str(e)}")
        # No devolvemos un 500 para no generar alertas innecesarias en el frontend por un fallo menor.
        return jsonify({'success': False}), 200