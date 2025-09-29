"""
Módulo de API Auxiliar para el Panel de Administración.

Este blueprint agrupa una serie de endpoints de API que sirven como utilidades
para otras partes del panel de administración. Su principal objetivo es proporcionar
datos para componentes dinámicos como campos de búsqueda autocompletables.

Funcionalidades:
- Búsqueda de usuarios registrados para asociarlos a pedidos.
- Búsqueda de productos para añadirlos a un pedido.
- Filtrado de pedidos (NOTA: funcionalidad similar existe en `lista_pedidos.py`).
"""
from flask import Blueprint, jsonify, request, current_app
from app.utils.admin_jwt_utils import admin_jwt_required
from app.models.domains.user_models import Usuarios
from app.models.domains.product_models import Productos
from app.models.domains.order_models import Pedido, PedidoProducto
from app.models.enums import EstadoPedido, EstadoEnum
from app.models.serializers import usuario_to_dict, producto_to_dict, pedido_to_dict, pedido_detalle_to_dict
from app.extensions import db
from sqlalchemy import or_

admin_api_bp = Blueprint('admin_api', __name__, url_prefix='/admin/api')

@admin_api_bp.route('/usuarios-registrados', methods=['GET'])
@admin_jwt_required
def get_registered_users(admin_user):
    """
    API para buscar usuarios (clientes) registrados y activos.

    Este endpoint es utilizado por los formularios del panel de administración
    (ej. al crear un nuevo pedido) para buscar y seleccionar un cliente a través
    de un campo de búsqueda autocompletado.

    Args:
        admin_user: El objeto del administrador autenticado.

    Query Params:
        q (str): El término de búsqueda para nombre, apellido o número de teléfono.

    Returns:
        JSON: Una lista de objetos de usuario que coinciden con la búsqueda.
    """
    try:
        search_term = request.args.get('q', '', type=str)
        
        query = Usuarios.query.filter(Usuarios.estado == 'activo')
        
        if search_term:
            query = query.filter(
                or_(
                    Usuarios.nombre.ilike(f'%{search_term}%'),
                    Usuarios.apellido.ilike(f'%{search_term}%'),
                    Usuarios.numero.ilike(f'%{search_term}%')
                )
            )
            
        users = query.order_by(Usuarios.nombre).limit(50).all()
        
        users_data = [usuario_to_dict(user) for user in users]
        
        return jsonify({
            'success': True,
            'usuarios': users_data
        })

    except Exception as e:
        current_app.logger.error(f"Error al obtener usuarios registrados: {e}")
        return jsonify({
            'success': False,
            'message': 'Error al obtener usuarios'
        }), 500

@admin_api_bp.route('/productos/search', methods=['GET'])
@admin_jwt_required
def search_products(admin_user):
    """
    API para buscar productos activos.

    Diseñado para el modal de creación/edición de pedidos, este endpoint permite
    buscar productos por nombre o descripción. Opcionalmente, puede excluir
    productos que ya están en un pedido específico para evitar duplicados.

    Args:
        admin_user: El objeto del administrador autenticado.

    Query Params:
        q (str): El término de búsqueda.
        pedido_id (str, optional): El ID de un pedido existente. Si se proporciona,
                                   los productos de ese pedido no se incluirán en los resultados.

    Returns:
        JSON: Una lista de objetos de producto que coinciden con la búsqueda.
    """
    try:
        search_term = request.args.get('q', '', type=str)
        pedido_id = request.args.get('pedido_id', None, type=str)

        if not search_term or len(search_term) < 2:
            return jsonify({
                'success': True,
                'productos': []
            })

        # Si se edita un pedido, obtener los IDs de productos que ya están en él
        product_ids_in_order = []
        if pedido_id:
            product_ids_in_order = [
                pp.producto_id for pp in 
                PedidoProducto.query.filter_by(pedido_id=pedido_id).with_entities(PedidoProducto.producto_id).all()
            ]

        # Construir la consulta base
        query = Productos.query.filter(
            or_(
                Productos.nombre.ilike(f'%{search_term}%'),
                Productos.descripcion.ilike(f'%{search_term}%')
            ),
            Productos.estado == EstadoEnum.ACTIVO.value
        )

        # Excluir los productos que ya están en el pedido
        if product_ids_in_order:
            query = query.filter(Productos.id.notin_(product_ids_in_order))

        productos = query.limit(20).all()
        
        # Serializar productos a diccionario
        productos_data = [producto_to_dict(p) for p in productos]
        
        return jsonify({
            'success': True,
            'productos': productos_data
        })

    except Exception as e:
        current_app.logger.error(f"Error al buscar productos: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Error al buscar productos'
        }), 500


@admin_api_bp.route('/pedidos/filter', methods=['GET'])
@admin_jwt_required
def get_all_pedidos(admin_user):
    """
    API para filtrar y paginar la lista de pedidos.

    NOTA PROFESIONAL: Este endpoint tiene una funcionalidad muy similar al endpoint
    `/api/pedidos/filter` definido en `app/blueprints/admin/pedido/lista_pedidos.py`.
    Se recomienda consolidar ambos en un único endpoint para evitar la duplicación
    de código y mantener una única fuente de verdad para el filtrado de pedidos.

    Args:
        admin_user: El objeto del administrador autenticado.

    Query Params:
        page, per_page, estado, cliente, fecha_inicio, fecha_fin, sort_by, sort_order.

    Returns:
        JSON: Un objeto con la lista paginada de pedidos y metadatos de paginación.
    """
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        estado_filter = request.args.get('estado', 'en proceso', type=str)
        cliente_filter = request.args.get('cliente', '', type=str)
        fecha_inicio_filter = request.args.get('fecha_inicio', '', type=str)
        fecha_fin_filter = request.args.get('fecha_fin', '', type=str)
        sort_by = request.args.get('sort_by', 'created_at', type=str)
        sort_order = request.args.get('sort_order', 'desc', type=str)

        # Convertir el string del estado a un miembro del Enum para la consulta
        try:
            estado_enum = EstadoPedido(estado_filter)
        except ValueError:
            return jsonify({'success': False, 'message': f'Estado no válido: {estado_filter}'}), 400
        query = Pedido.query.join(Usuarios).filter(Pedido.estado_pedido == estado_enum)

        if cliente_filter:
            query = query.filter(or_(
                Usuarios.nombre.ilike(f'%{cliente_filter}%'),
                Usuarios.apellido.ilike(f'%{cliente_filter}%'),
                Usuarios.numero.ilike(f'%{cliente_filter}%')
            ))

        if fecha_inicio_filter:
            from datetime import datetime
            start_date = datetime.strptime(fecha_inicio_filter, '%Y-%m-%d')
            query = query.filter(Pedido.created_at >= start_date)

        if fecha_fin_filter:
            from datetime import datetime
            end_date = datetime.strptime(fecha_fin_filter, '%Y-%m-%d')
            query = query.filter(Pedido.created_at <= end_date)

        # Aplicar ordenamiento
        if sort_by == 'created_at':
            if sort_order == 'asc':
                query = query.order_by(Pedido.created_at.asc())
            else:
                query = query.order_by(Pedido.created_at.desc())
        elif sort_by == 'cliente':
            if sort_order == 'asc':
                query = query.order_by(Usuarios.nombre.asc(), Usuarios.apellido.asc())
            else:
                query = query.order_by(Usuarios.nombre.desc(), Usuarios.apellido.desc())
        elif sort_by == 'total':
            if sort_order == 'asc':
                query = query.order_by(Pedido.total.asc())
            else:
                query = query.order_by(Pedido.total.desc())

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        pedidos_data = [pedido_to_dict(p) for p in pagination.items]

        return jsonify({
            'success': True,
            'pedidos': pedidos_data,
            'pagination': {
                'total': pagination.total,
                'pages': pagination.pages,
                'page': pagination.page,
                'per_page': pagination.per_page,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev,
                'next_num': pagination.next_num,
                'prev_num': pagination.prev_num
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Error al obtener pedidos: {e}")
        return jsonify({'success': False, 'message': 'Error interno al obtener pedidos'}), 500