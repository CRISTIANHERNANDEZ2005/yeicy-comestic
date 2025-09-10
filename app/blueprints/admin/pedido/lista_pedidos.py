from flask import Blueprint, jsonify, request, render_template, current_app
from app.utils.admin_jwt_utils import admin_jwt_required
from app.models.domains.order_models import Pedido, PedidoProducto
from app.models.domains.user_models import Usuarios
from app.models.domains.product_models import Productos
from app.models.serializers import pedido_to_dict, pedido_detalle_to_dict
from app.extensions import db
from sqlalchemy import or_, and_, func, desc
from sqlalchemy.orm import joinedload
from datetime import datetime, timedelta
from flask_wtf.csrf import generate_csrf

admin_lista_pedidos_bp = Blueprint('admin_lista_pedidos', __name__)

@admin_lista_pedidos_bp.route('/lista-pedidos', methods=['GET'])
@admin_lista_pedidos_bp.route('/lista-pedidos/<string:estado>', methods=['GET'])
@admin_jwt_required
def get_all_pedidos(admin_user, estado=None):
    error_message = None
    pedidos_data = []  # Initialize
    pagination_info = {} # Initialize
    
    # Determinar el estado a mostrar
    if estado == 'completados':
        current_estado = 'completados'
        estado_pedido_filter = 'completado'
    elif estado == 'cancelados':
        current_estado = 'cancelados'
        estado_pedido_filter = 'cancelado'
    else:
        current_estado = 'en-proceso'
        estado_pedido_filter = 'en proceso'

    try:
        # Obtener parámetros de filtro
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        cliente = request.args.get('cliente', '')
        fecha_inicio = request.args.get('fecha_inicio', '')
        fecha_fin = request.args.get('fecha_fin', '')
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')
        
        # Construir consulta base
        query = Pedido.query.options(joinedload(Pedido.usuario)).filter(
            Pedido.estado_pedido == estado_pedido_filter
        )
        
        # Aplicar filtros
        if cliente:
            query = query.join(Usuarios).filter(
                or_(
                    Usuarios.nombre.ilike(f'%{cliente}%'),
                    Usuarios.apellido.ilike(f'%{cliente}%'),
                    Usuarios.numero.ilike(f'%{cliente}%')
                )
            )
            
        if fecha_inicio:
            try:
                fecha_inicio_dt = datetime.strptime(fecha_inicio, '%Y-%m-%d')
                query = query.filter(Pedido.created_at >= fecha_inicio_dt)
            except ValueError:
                pass
                
        if fecha_fin:
            try:
                fecha_fin_dt = datetime.strptime(fecha_fin, '%Y-%m-%d') + timedelta(days=1)
                query = query.filter(Pedido.created_at < fecha_fin_dt)
            except ValueError:
                pass
        
        # Aplicar ordenamiento
        if sort_by == 'cliente':
            if sort_order == 'asc':
                query = query.join(Usuarios).order_by(Usuarios.nombre.asc(), Usuarios.apellido.asc())
            else:
                query = query.join(Usuarios).order_by(Usuarios.nombre.desc(), Usuarios.apellido.desc())
        elif sort_by == 'total':
            if sort_order == 'asc':
                query = query.order_by(Pedido.total.asc())
            else:
                query = query.order_by(Pedido.total.desc())
        else:  # Por defecto ordenar por fecha
            if sort_order == 'asc':
                query = query.order_by(Pedido.created_at.asc())
            else:
                query = query.order_by(Pedido.created_at.desc())
        
        # Paginación
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Serializar datos
        pedidos_data = [pedido_to_dict(pedido) for pedido in pagination.items]
        
        # Preparar información de paginación
        pagination_info = {
            'page': pagination.page,
            'pages': pagination.pages,
            'per_page': pagination.per_page,
            'total': pagination.total,
            'has_next': pagination.has_next,
            'has_prev': pagination.has_prev,
            'next_num': pagination.next_num,
            'prev_num': pagination.prev_num
        }
    
    except Exception as e:
        current_app.logger.error(f"Error al cargar pedidos en el panel de administración: {e}")
        error_message = "Ocurrió un error al cargar los pedidos. Por favor, inténtalo de nuevo."

    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

    return render_template('admin/componentes/pedidos/lista_pedidos.html',
                           pedidos=pedidos_data,
                           pagination=pagination_info,
                           current_estado=current_estado,
                           filter_params=request.args,
                           error_message=error_message,
                           csrf_token=generate_csrf(),
                           is_ajax=is_ajax)

@admin_lista_pedidos_bp.route('/api/pedidos/<string:pedido_id>', methods=['GET'])
@admin_jwt_required
def get_pedido_detalle(admin_user, pedido_id):
    try:
        pedido = Pedido.query.options(
            joinedload(Pedido.usuario),
            joinedload(Pedido.productos).joinedload(PedidoProducto.producto)
        ).get(pedido_id)
        
        if not pedido:
            return jsonify({
                'success': False,
                'message': 'Pedido no encontrado'
            }), 404
            
        pedido_data = pedido_detalle_to_dict(pedido)
        
        return jsonify({
            'success': True,
            'pedido': pedido_data
        })
        
    except Exception as e:
        current_app.logger.error(f"Error al obtener detalle del pedido {pedido_id}: {e}")
        return jsonify({
            'success': False,
            'message': 'Error al obtener detalle del pedido'
        }), 500



@admin_lista_pedidos_bp.route('/api/pedidos/filter', methods=['GET'])
@admin_jwt_required
def filter_pedidos_api(admin_user):
    try:
        # Obtener parámetros de filtro
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        cliente = request.args.get('cliente', '')
        fecha_inicio = request.args.get('fecha_inicio', '')
        fecha_fin = request.args.get('fecha_fin', '')
        estado = request.args.get('estado', 'en proceso')
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')

        # Construir consulta base
        query = Pedido.query.options(joinedload(Pedido.usuario)).filter(
            Pedido.estado_pedido == estado
        )
        
        # Aplicar filtros
        if cliente:
            query = query.join(Usuarios).filter(
                or_(
                    Usuarios.nombre.ilike(f'%{cliente}%'),
                    Usuarios.apellido.ilike(f'%{cliente}%'),
                    Usuarios.numero.ilike(f'%{cliente}%')
                )
            )
            
        if fecha_inicio:
            try:
                fecha_inicio_dt = datetime.strptime(fecha_inicio, '%Y-%m-%d')
                query = query.filter(Pedido.created_at >= fecha_inicio_dt)
            except ValueError:
                pass
                
        if fecha_fin:
            try:
                fecha_fin_dt = datetime.strptime(fecha_fin, '%Y-%m-%d') + timedelta(days=1)
                query = query.filter(Pedido.created_at < fecha_fin_dt)
            except ValueError:
                pass
        
        # Aplicar ordenamiento
        if sort_by == 'cliente':
            if sort_order == 'asc':
                query = query.join(Usuarios).order_by(Usuarios.nombre.asc(), Usuarios.apellido.asc())
            else:
                query = query.join(Usuarios).order_by(Usuarios.nombre.desc(), Usuarios.apellido.desc())
        elif sort_by == 'total':
            if sort_order == 'asc':
                query = query.order_by(Pedido.total.asc())
            else:
                query = query.order_by(Pedido.total.desc())
        else:  # Por defecto ordenar por fecha
            if sort_order == 'asc':
                query = query.order_by(Pedido.created_at.asc())
            else:
                query = query.order_by(Pedido.created_at.desc())

        # Paginación
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Serializar datos
        pedidos_data = [pedido_to_dict(pedido) for pedido in pagination.items]

        # Preparar respuesta
        response_data = {
            'pedidos': pedidos_data,
            'pagination': {
                'page': pagination.page,
                'pages': pagination.pages,
                'per_page': pagination.per_page,
                'total': pagination.total,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev,
                'next_num': pagination.next_num,
                'prev_num': pagination.prev_num
            },
            'success': True
        }

        return jsonify(response_data)

    except Exception as e:
        current_app.logger.error(f"Error en filtro AJAX de pedidos: {e}")
        return jsonify({
            'success': False,
            'message': 'Error al filtrar pedidos'
        }), 500

@admin_lista_pedidos_bp.route('/api/pedidos/<string:pedido_id>/estado-activo', methods=['POST'])
@admin_jwt_required
def update_pedido_estado_activo(admin_user, pedido_id):
    try:
        pedido = Pedido.query.get(pedido_id)
        if not pedido:
            return jsonify({
                'success': False,
                'message': 'Pedido no encontrado'
            }), 404

        data = request.get_json()
        if not data or 'estado' not in data:
            return jsonify({
                'success': False,
                'message': 'Datos incompletos'
            }), 400

        nuevo_estado = data.get('estado')
        if nuevo_estado not in ['activo', 'inactivo']:
            return jsonify({
                'success': False,
                'message': 'Estado no válido'
            }), 400

        if pedido.estado == nuevo_estado:
            return jsonify({
                'success': True,
                'message': f'El pedido ya estaba {nuevo_estado}',
                'status_unchanged': True,
                'current_status': nuevo_estado
            }), 200

        old_status = pedido.estado
        pedido.estado = nuevo_estado
        db.session.commit()

        current_app.logger.info(
            f"Pedido {pedido_id} cambiado de estado (activo/inactivo) de {old_status} a {nuevo_estado} "
            f"por administrador {admin_user.id} ('{admin_user.nombre}')"
        )

        return jsonify({
            'success': True,
            'message': f'El pedido ha sido marcado como {nuevo_estado} correctamente',
            'pedido_id': pedido_id,
            'new_status': nuevo_estado
        })

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al cambiar estado (activo/inactivo) del pedido {pedido_id}: {e}")
        return jsonify({
            'success': False,
            'message': 'Error al cambiar el estado del pedido'
        }), 500


@admin_lista_pedidos_bp.route('/api/pedidos', methods=['POST'])
@admin_jwt_required
def create_pedido(admin_user):
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No se recibieron datos'}), 400

        usuario_id = data.get('usuario_id')
        productos_payload = data.get('productos')

        if not usuario_id or not productos_payload:
            return jsonify({'success': False, 'message': 'Faltan datos: se requiere usuario_id y productos'}), 400

        # Validar que el usuario exista
        usuario = Usuarios.query.get(usuario_id)
        if not usuario:
            return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404

        total_pedido = 0
        productos_a_procesar = []

        for item in productos_payload:
            producto_id = item.get('id')
            cantidad = item.get('cantidad')

            if not producto_id or not isinstance(cantidad, int) or cantidad <= 0:
                return jsonify({'success': False, 'message': f'Datos de producto inválidos: {item}'}), 400

            producto = Productos.query.get(producto_id)
            if not producto:
                return jsonify({'success': False, 'message': f'Producto con ID {producto_id} no encontrado'}), 404
            
            # Modificación: Validar stock con mensaje más detallado
            if producto.existencia < cantidad:
                return jsonify({
                    'success': False, 
                    'message': f'Stock insuficiente para {producto.nombre}. Disponible: {producto.existencia}, solicitado: {cantidad}'
                }), 400

            subtotal = producto.precio * cantidad
            total_pedido += subtotal
            
            productos_a_procesar.append({
                'producto_obj': producto,
                'cantidad': cantidad,
                'precio_unitario': producto.precio
            })

        # Crear el pedido
        nuevo_pedido = Pedido(
            usuario_id=usuario_id,
            total=total_pedido,
            estado_pedido='en proceso',
            estado='activo'
        )
        db.session.add(nuevo_pedido)
        db.session.flush() # Para obtener el ID del nuevo pedido antes del commit

        # Añadir productos al pedido y actualizar stock
        for item in productos_a_procesar:
            pedido_producto = PedidoProducto(
                pedido_id=nuevo_pedido.id,
                producto_id=item['producto_obj'].id,
                cantidad=item['cantidad'],
                precio_unitario=item['precio_unitario']
            )
            db.session.add(pedido_producto)
            
            # Disminuir stock
            item['producto_obj'].existencia -= item['cantidad']

        db.session.commit()
        
        current_app.logger.info(f"Nuevo pedido {nuevo_pedido.id} creado por administrador {admin_user.id} para el usuario {usuario.nombre}")

        return jsonify({
            'success': True,
            'message': 'Pedido creado exitosamente',
            'pedido_id': nuevo_pedido.id
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al crear pedido: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno al crear el pedido'}), 500


@admin_lista_pedidos_bp.route('/api/pedidos/<string:pedido_id>', methods=['PUT'])
@admin_jwt_required
def update_pedido(admin_user, pedido_id):
    try:
        pedido = Pedido.query.get(pedido_id)
        if not pedido:
            return jsonify({
                'success': False,
                'message': 'Pedido no encontrado'
            }), 404

        # Verificar que el pedido esté en proceso
        if pedido.estado_pedido != 'en proceso':
            return jsonify({
                'success': False,
                'message': 'Solo se pueden editar pedidos en proceso'
            }), 400

        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No se recibieron datos'}), 400

        usuario_id = data.get('usuario_id')
        productos_payload = data.get('productos')

        if not usuario_id or not productos_payload:
            return jsonify({'success': False, 'message': 'Faltan datos: se requiere usuario_id y productos'}), 400

        # Validar que el usuario exista
        usuario = Usuarios.query.get(usuario_id)
        if not usuario:
            return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404

        # Si el usuario cambió, actualizarlo
        if pedido.usuario_id != usuario_id:
            pedido.usuario_id = usuario_id

        # Procesar los productos
        # Primero, eliminamos todos los productos actuales del pedido para reemplazarlos
        PedidoProducto.query.filter_by(pedido_id=pedido.id).delete()

        total_pedido = 0
        productos_a_procesar = []

        for item in productos_payload:
            producto_id = item.get('id')
            cantidad = item.get('cantidad')

            if not producto_id or not isinstance(cantidad, int) or cantidad <= 0:
                return jsonify({'success': False, 'message': f'Datos de producto inválidos: {item}'}), 400

            producto = Productos.query.get(producto_id)
            if not producto:
                return jsonify({'success': False, 'message': f'Producto con ID {producto_id} no encontrado'}), 404

            # Validar stock disponible
            if producto.existencia < cantidad:
                return jsonify({
                    'success': False,
                    'message': f'Stock insuficiente para {producto.nombre}. Disponible: {producto.existencia}, solicitado: {cantidad}'
                }), 400

            subtotal = producto.precio * cantidad
            total_pedido += subtotal

            productos_a_procesar.append({
                'producto_obj': producto,
                'cantidad': cantidad,
                'precio_unitario': producto.precio
            })

        # Actualizar el total del pedido
        pedido.total = total_pedido
        pedido.updated_at = datetime.utcnow()

        # Añadir productos al pedido y actualizar stock
        for item in productos_a_procesar:
            pedido_producto = PedidoProducto(
                pedido_id=pedido.id,
                producto_id=item['producto_obj'].id,
                cantidad=item['cantidad'],
                precio_unitario=item['precio_unitario']
            )
            db.session.add(pedido_producto)

            # Actualizar stock (restar la diferencia entre el stock anterior y el nuevo)
            item['producto_obj'].existencia -= item['cantidad']

        db.session.commit()

        current_app.logger.info(f"Pedido {pedido.id} actualizado por administrador {admin_user.id} para el usuario {usuario.nombre}")

        return jsonify({
            'success': True,
            'message': 'Pedido actualizado exitosamente',
            'pedido_id': pedido.id
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al actualizar pedido: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno al actualizar el pedido'}), 500


@admin_lista_pedidos_bp.route('/api/pedidos/<string:pedido_id>/estado', methods=['POST'])
@admin_jwt_required
def update_pedido_estado(admin_user, pedido_id):
    try:
        pedido = Pedido.query.get(pedido_id)
        if not pedido:
            return jsonify({
                'success': False,
                'message': 'Pedido no encontrado'
            }), 404

        # Verificar si el pedido está inactivo
        if pedido.estado == 'inactivo':
            return jsonify({
                'success': False,
                'message': 'No se puede cambiar el estado de un pedido inactivo',
                'inactive_order': True
            }), 400

        data = request.get_json()
        if not data or 'estado' not in data:
            return jsonify({
                'success': False,
                'message': 'Datos incompletos'
            }), 400

        nuevo_estado = data.get('estado')
        if nuevo_estado not in ['completado', 'cancelado', 'en proceso']:
            return jsonify({
                'success': False,
                'message': 'Estado no válido'
            }), 400

        # Verificar si el estado ya es el mismo
        if pedido.estado_pedido == nuevo_estado:
            return jsonify({
                'success': True,
                'message': f'El pedido ya estaba {nuevo_estado}',
                'status_unchanged': True,
                'current_status': nuevo_estado
            }), 200

        # Guardar estado anterior para logging y manejo de stock
        old_status = pedido.estado_pedido

        # Actualizar el estado del pedido
        pedido.estado_pedido = nuevo_estado
        pedido.updated_at = datetime.utcnow()

        # Manejo de stock según el cambio de estado
        if nuevo_estado == 'cancelado' and old_status != 'cancelado':
            # Si se cancela el pedido, devolver el stock de productos
            for item in pedido.productos:
                producto = Productos.query.get(item.producto_id)
                if producto:
                    producto.existencia += item.cantidad
                    db.session.add(producto)
        elif nuevo_estado == 'en proceso' and old_status == 'cancelado':
            # Si se reactiva un pedido cancelado, volver a restar el stock
            for item in pedido.productos:
                producto = Productos.query.get(item.producto_id)
                if producto and producto.existencia >= item.cantidad:
                    producto.existencia -= item.cantidad
                    db.session.add(producto)
                elif producto:
                    # Si no hay stock suficiente, marcar como inactivo
                    pedido.estado = 'inactivo'
                    db.session.add(pedido)

        # Guardar cambios
        db.session.commit()

        # Registrar la acción
        current_app.logger.info(
            f"Pedido {pedido_id} cambiado de estado de {old_status} a {nuevo_estado} "
            f"por administrador {admin_user.id} ('{admin_user.nombre}')"
        )

        return jsonify({
            'success': True,
            'message': f'El pedido ha sido marcado como {nuevo_estado} correctamente',
            'pedido_id': pedido_id,
            'old_status': old_status,
            'new_status': nuevo_estado,
            'timestamp': datetime.utcnow().isoformat()
        })

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al cambiar estado del pedido {pedido_id}: {e}")
        return jsonify({
            'success': False,
            'message': 'Error al cambiar el estado del pedido'
        }), 500