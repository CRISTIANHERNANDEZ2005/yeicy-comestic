from flask import Blueprint, jsonify, request, render_template, current_app
from app.utils.admin_jwt_utils import admin_jwt_required
from app.models.domains.order_models import Pedido, PedidoProducto
from app.models.domains.user_models import Usuarios
from app.models.domains.product_models import Productos
from app.models.enums import EstadoPedido, EstadoSeguimiento, EstadoEnum
from app.models.serializers import pedido_to_dict, pedido_detalle_to_dict
from app.extensions import db
from sqlalchemy import or_, and_, func, desc
from sqlalchemy.orm import joinedload
from sqlalchemy.orm.attributes import flag_modified
from datetime import datetime, timedelta
from flask_wtf.csrf import generate_csrf

admin_lista_pedidos_bp = Blueprint('admin_lista_pedidos', __name__)

# Mapa para convertir strings de la URL a miembros del Enum de forma segura
ESTADO_PEDIDO_MAP = {
    'en proceso': EstadoPedido.EN_PROCESO,
    'completado': EstadoPedido.COMPLETADO,
    'cancelado': EstadoPedido.CANCELADO,
}

def _build_pedidos_query(estado_pedido_filter, pedido_id, cliente, fecha_inicio, fecha_fin, status_filter, sort_by, sort_order):
    """
    Función auxiliar para construir y filtrar la consulta de pedidos, evitando la duplicación de código.
    """
    # Construir consulta base
    query = Pedido.query.options(joinedload(Pedido.usuario)).filter(
        Pedido.estado_pedido == estado_pedido_filter
    )

    # Aplicar el filtro de estado (activo/inactivo)
    if status_filter != 'all':
        query = query.filter(Pedido.estado == status_filter)

    # Aplicar filtros de búsqueda
    if pedido_id:
        # Usamos ilike para permitir búsquedas parciales del ID
        query = query.filter(Pedido.id.ilike(f'%{pedido_id}%'))

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
            current_app.logger.warning(f"Formato de fecha_inicio inválido: {fecha_inicio}")
            pass
            
    if fecha_fin:
        try:
            fecha_fin_dt = datetime.strptime(fecha_fin, '%Y-%m-%d') + timedelta(days=1)
            query = query.filter(Pedido.created_at < fecha_fin_dt)
        except ValueError:
            current_app.logger.warning(f"Formato de fecha_fin inválido: {fecha_fin}")
            pass
    
    # Aplicar ordenamiento
    if sort_by == 'cliente':
        query = query.join(Pedido.usuario)
        if sort_order == 'asc':
            query = query.order_by(Usuarios.nombre.asc(), Usuarios.apellido.asc())
        else:
            query = query.order_by(Usuarios.nombre.desc(), Usuarios.apellido.desc())
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
            
    return query

@admin_lista_pedidos_bp.route('/lista-pedidos', methods=['GET'])
@admin_lista_pedidos_bp.route('/lista-pedidos/<string:estado>', methods=['GET'])
@admin_jwt_required
def get_all_pedidos(admin_user, estado=None):
    error_message = None
    pedidos_data = []  # Initialize
    pagination = None
    pagination_info = {}
    
    # Mapeo de estados de URL a valores de Enum
    estado_map = {
        'completados': ('completados', EstadoPedido.COMPLETADO),
        'cancelados': ('cancelados', EstadoPedido.CANCELADO),
        'en-proceso': ('en-proceso', EstadoPedido.EN_PROCESO)
    }
    current_estado, estado_pedido_filter = estado_map.get(estado, ('en-proceso', EstadoPedido.EN_PROCESO))

    try:
        # Obtener parámetros de filtro
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        pedido_id = request.args.get('pedido_id', '')
        cliente = request.args.get('cliente', '')
        fecha_inicio = request.args.get('fecha_inicio', '')
        fecha_fin = request.args.get('fecha_fin', '')
        status_filter = request.args.get('status', 'all')
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')
        
        # Construir consulta base
        query = _build_pedidos_query(
            estado_pedido_filter, pedido_id, cliente, fecha_inicio, fecha_fin, 
            status_filter, sort_by, sort_order
        )
        
        # Paginación
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Serializar datos
        pedidos_data = [pedido_to_dict(pedido) for pedido in pagination.items]

        # Preparar información de paginación para JSON
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
                           pagination=pagination,
                           pagination_info=pagination_info,
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
            estado_pedido=EstadoPedido.EN_PROCESO,
            estado=EstadoEnum.ACTIVO.value,
            # MEJORA PROFESIONAL: Inicializar el historial de seguimiento al crear el pedido.
            # Esto asegura que el estado 'recibido' siempre tenga un timestamp.
            seguimiento_estado=EstadoSeguimiento.RECIBIDO,
            notas_seguimiento="Tu Pedido fue recibido y esta siendo procesado",
            seguimiento_historial=[{
                'estado': EstadoSeguimiento.RECIBIDO.value,
                'notas': "Tu Pedido fue recibido y esta siendo procesado",
                'timestamp': datetime.utcnow().isoformat() + "Z",
                'notified_to_client': False # MEJORA: Marcar para notificación inicial.
            }]
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
        pedido = Pedido.query.options(joinedload(Pedido.productos).joinedload(PedidoProducto.producto)).get(pedido_id)
        if not pedido:
            return jsonify({
                'success': False,
                'message': 'Pedido no encontrado'
            }), 404

        if pedido.estado_pedido != EstadoPedido.EN_PROCESO:
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

        usuario = Usuarios.query.get(usuario_id)
        if not usuario:
            return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404

        if pedido.usuario_id != usuario_id:
            pedido.usuario_id = usuario_id

        # 1. Guardar las cantidades originales y devolver el stock
        productos_originales = {p.producto_id: p.cantidad for p in pedido.productos}
        for item in pedido.productos:
            item.producto.existencia += item.cantidad

        # 2. Eliminar los productos antiguos del pedido
        PedidoProducto.query.filter_by(pedido_id=pedido.id).delete()

        total_pedido = 0
        productos_a_procesar = []

        # 3. Validar y procesar nuevos productos
        for item in productos_payload:
            producto_id = item.get('id')
            cantidad = item.get('cantidad')

            if not producto_id or not isinstance(cantidad, int) or cantidad <= 0:
                # Revertir el stock si hay un error
                for prod_id, cant in productos_originales.items():
                    producto_a_revertir = Productos.query.get(prod_id)
                    if producto_a_revertir:
                        producto_a_revertir.existencia -= cant
                db.session.commit()
                return jsonify({'success': False, 'message': f'Datos de producto inválidos: {item}'}), 400

            producto = Productos.query.get(producto_id)
            if not producto:
                return jsonify({'success': False, 'message': f'Producto con ID {producto_id} no encontrado'}), 404

            # Validar stock disponible (ahora es correcto)
            if producto.existencia < cantidad:
                # Revertir el stock si no hay suficiente
                for prod_id, cant in productos_originales.items():
                    producto_a_revertir = Productos.query.get(prod_id)
                    if producto_a_revertir:
                        producto_a_revertir.existencia -= cant
                db.session.commit()
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

        # 4. Actualizar el pedido y el stock
        pedido.total = total_pedido
        pedido.updated_at = datetime.utcnow()

        for item in productos_a_procesar:
            pedido_producto = PedidoProducto(
                pedido_id=pedido.id,
                producto_id=item['producto_obj'].id,
                cantidad=item['cantidad'],
                precio_unitario=item['precio_unitario']
            )
            db.session.add(pedido_producto)
            
            # Restar el nuevo stock
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


# lista_pedidos.py - MEJORADO PARA ACTUALIZACIONES EN TIEMPO REAL

@admin_lista_pedidos_bp.route('/api/pedidos/<string:pedido_id>/seguimiento', methods=['POST'])
@admin_jwt_required
def update_pedido_seguimiento(admin_user, pedido_id):
    """
    MEJORADO: Actualización en tiempo real del estado de seguimiento con sincronización bidireccional
    """
    try:
        # Obtener el pedido con sus productos y usuario para sincronización completa
        pedido = Pedido.query.options(
            joinedload(Pedido.productos).joinedload(PedidoProducto.producto),
            joinedload(Pedido.usuario)
        ).get(pedido_id)
        
        if not pedido:
            return jsonify({
                'success': False,
                'message': 'Pedido no encontrado'
            }), 404

        if pedido.estado == EstadoEnum.INACTIVO:
            return jsonify({
                'success': False,
                'message': 'No se puede cambiar el estado de un pedido inactivo',
                'inactive_order': True
            }), 400

        data = request.get_json()
        nuevo_seguimiento_str = data.get('seguimiento_estado')
        notas = data.get('notas', '').strip()

        # MEJORA: Validar que el estado y las notas no estén vacíos
        if not nuevo_seguimiento_str:
            return jsonify({'success': False, 'message': 'El estado de seguimiento es obligatorio.'}), 400
        if not notas:
            return jsonify({'success': False, 'message': 'Las notas de seguimiento son obligatorias.'}), 400

        try:
            nuevo_seguimiento_enum = EstadoSeguimiento(nuevo_seguimiento_str)
        except ValueError:
            return jsonify({'success': False, 'message': 'Estado de seguimiento no válido'}), 400

        old_seguimiento = pedido.seguimiento_estado
        old_estado_pedido = pedido.estado_pedido

        # Iniciar transacción para atomicidad
        try:
            estado_pedido_cambiado = False
            nuevo_estado_pedido = None

            # 1. Si el nuevo estado de seguimiento es CANCELADO
            if nuevo_seguimiento_enum == EstadoSeguimiento.CANCELADO:
                if old_estado_pedido != EstadoPedido.CANCELADO:
                    pedido.estado_pedido = EstadoPedido.CANCELADO
                    estado_pedido_cambiado = True
                    nuevo_estado_pedido = EstadoPedido.CANCELADO.value
                    
                    # Devolver stock
                    for item in pedido.productos:
                        producto = Productos.query.get(item.producto_id)
                        if producto:
                            producto.existencia += item.cantidad
                    current_app.logger.info(f"Stock devuelto para pedido {pedido.id} ({old_estado_pedido} -> cancelado).")

            # 2. Si el nuevo estado de seguimiento es ENTREGADO
            elif nuevo_seguimiento_enum == EstadoSeguimiento.ENTREGADO:
                if old_estado_pedido != EstadoPedido.COMPLETADO:
                    pedido.estado_pedido = EstadoPedido.COMPLETADO
                    estado_pedido_cambiado = True
                    nuevo_estado_pedido = EstadoPedido.COMPLETADO.value
                    current_app.logger.info(f"Pedido {pedido.id} movido a 'completado' a través del seguimiento.")

            # 3. Si el nuevo estado de seguimiento implica que está EN PROCESO
            elif nuevo_seguimiento_enum in [EstadoSeguimiento.RECIBIDO, EstadoSeguimiento.EN_PREPARACION, EstadoSeguimiento.EN_CAMINO]:
                if old_estado_pedido != EstadoPedido.EN_PROCESO:
                    # Si venimos de 'cancelado', hay que re-validar y restar stock
                    if old_estado_pedido == EstadoPedido.CANCELADO:
                        for item in pedido.productos:
                            producto = Productos.query.get(item.producto_id)
                            if not producto or producto.existencia < item.cantidad:
                                db.session.rollback()
                                return jsonify({
                                    'success': False,
                                    'message': f'Stock insuficiente para reactivar el pedido. Producto: {producto.nombre if producto else "ID " + str(item.producto_id)}.'
                                }), 400
                        for item in pedido.productos:
                            producto = Productos.query.get(item.producto_id)
                            if producto:
                                producto.existencia -= item.cantidad
                        current_app.logger.info(f"Stock restado para pedido {pedido.id} reactivado (cancelado -> en proceso) a través del seguimiento.")
                    
                    pedido.estado_pedido = EstadoPedido.EN_PROCESO
                    estado_pedido_cambiado = True
                    nuevo_estado_pedido = EstadoPedido.EN_PROCESO.value
                    current_app.logger.info(f"Pedido {pedido.id} movido a 'en proceso' a través del seguimiento.")

            # MEJORA PROFESIONAL: Simplificar y corregir la lógica de actualización del historial.
            # Siempre se debe añadir una nueva entrada al historial para mantener un registro claro.
            if pedido.seguimiento_historial is None:
                pedido.seguimiento_historial = []

            new_history_entry = {
                'estado': nuevo_seguimiento_enum.value,
                'notas': notas,
                'timestamp': datetime.utcnow().isoformat() + "Z",
                'notified_to_client': False # MEJORA: Flag para notificaciones en carga de página
            }
            
            pedido.seguimiento_historial.append(new_history_entry)
            flag_modified(pedido, "seguimiento_historial")

            pedido.seguimiento_estado = nuevo_seguimiento_enum
            pedido.notas_seguimiento = notas
            pedido.updated_at = datetime.utcnow()
            
            db.session.commit()

            current_app.logger.info(
                f"Pedido {pedido_id} cambiado de estado de seguimiento de {old_seguimiento.value} a {nuevo_seguimiento_enum.value} "
                f"por administrador {admin_user.id} ('{admin_user.nombre}')"
            )

            # Respuesta mejorada con información de sincronización
            response_data = {
                'success': True,
                'message': f'El estado de seguimiento del pedido ha sido actualizado a {nuevo_seguimiento_enum.value} correctamente',
                'pedido_id': pedido_id,
                'old_seguimiento': old_seguimiento.value,
                'new_seguimiento': nuevo_seguimiento_enum.value,
                'timestamp': datetime.utcnow().isoformat(),
                'estado_pedido_cambiado': estado_pedido_cambiado
            }
            
            # Incluir información del estado del pedido si cambió
            if estado_pedido_cambiado:
                response_data['nuevo_estado_pedido'] = nuevo_estado_pedido
                response_data['old_estado_pedido'] = old_estado_pedido.value

            # MEJORA PROFESIONAL: El evento ahora se gestiona en el frontend al cargar la página.
            # Se elimina la publicación de eventos en tiempo real (SSE), ya que el flag
            # 'notified_to_client' se encargará de la notificación.

            return jsonify(response_data)

        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error al cambiar estado de seguimiento del pedido {pedido_id}: {e}", exc_info=True)
            return jsonify({'success': False, 'message': 'Error al cambiar el estado de seguimiento del pedido'}), 500

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al cambiar estado de seguimiento del pedido {pedido_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error al cambiar el estado de seguimiento del pedido'}), 500


@admin_lista_pedidos_bp.route('/api/pedidos/<string:pedido_id>/estado', methods=['POST'])
@admin_jwt_required
def update_pedido_estado(admin_user, pedido_id):
    """
    MEJORADO: Actualización en tiempo real del estado del pedido con sincronización completa
    """
    try:
        # Obtener el pedido con sus productos y usuario para sincronización completa
        pedido = Pedido.query.options(
            joinedload(Pedido.productos).joinedload(PedidoProducto.producto),
            joinedload(Pedido.usuario)
        ).get(pedido_id)
        
        if not pedido:
            return jsonify({'success': False, 'message': 'Pedido no encontrado'}), 404

        if pedido.estado == EstadoEnum.INACTIVO:
            return jsonify({
                'success': False,
                'message': 'No se puede cambiar el estado de un pedido inactivo',
                'inactive_order': True
            }), 400

        data = request.get_json()
        if not data or 'estado' not in data:
            return jsonify({'success': False, 'message': 'Datos incompletos'}), 400

        nuevo_estado_str = data.get('estado')
        if nuevo_estado_str not in ['completado', 'cancelado', 'en proceso']:
            return jsonify({'success': False, 'message': 'Estado no válido'}), 400

        try:
            nuevo_estado = EstadoPedido(nuevo_estado_str)
        except ValueError:
            return jsonify({'success': False, 'message': 'Estado no válido'}), 400

        old_status = pedido.estado_pedido
        if old_status == nuevo_estado:
            return jsonify({
                'success': True,
                'message': f'El pedido ya estaba {nuevo_estado.value}',
                'status_unchanged': True,
                'current_status': nuevo_estado.value
            }), 200

        try:
            seguimiento_cambiado = False
            nuevo_seguimiento = None
            # MEJORA PROFESIONAL: Añadir una nota por defecto al historial de seguimiento.

            # 2. Mover desde 'cancelado' (a 'en proceso' o 'completado')
            if old_status == EstadoPedido.CANCELADO and nuevo_estado in [EstadoPedido.EN_PROCESO, EstadoPedido.COMPLETADO]:
                # Verificar stock antes de hacer cambios
                for item in pedido.productos:
                    producto = Productos.query.get(item.producto_id)
                    if not producto or producto.existencia < item.cantidad:
                        db.session.rollback()
                        return jsonify({
                            'success': False,
                            'message': f'Stock insuficiente para reactivar el pedido. Producto: {producto.nombre if producto else "ID " + str(item.producto_id)}.'
                        }), 400

                # Si hay stock, restarlo
                for item in pedido.productos:
                    producto = Productos.query.get(item.producto_id)
                    if producto:
                        producto.existencia -= item.cantidad
                current_app.logger.info(f"Stock restado para pedido {pedido.id} reactivado (cancelado -> {nuevo_estado}).")
            
            # 1. Mover a 'cancelado' (desde 'en proceso' o 'completado')
            elif nuevo_estado == EstadoPedido.CANCELADO and old_status in [EstadoPedido.EN_PROCESO, EstadoPedido.COMPLETADO]:
                for item in pedido.productos:
                    producto = Productos.query.get(item.producto_id)
                    if producto:
                        producto.existencia += item.cantidad
                current_app.logger.info(f"Stock devuelto para pedido {pedido.id} ({old_status} -> cancelado).")

            # Sincronizar estado de seguimiento automáticamente
            # MEJORA PROFESIONAL: Asignar la nota correcta según el estado final.
            nota_por_defecto = ""
            if nuevo_estado == EstadoPedido.COMPLETADO:
                pedido.seguimiento_estado = EstadoSeguimiento.ENTREGADO
                seguimiento_cambiado = True
                nuevo_seguimiento = EstadoSeguimiento.ENTREGADO.value
                nota_por_defecto = "Tu pedido ha sido completado y entregado."
            elif nuevo_estado == EstadoPedido.CANCELADO:
                pedido.seguimiento_estado = EstadoSeguimiento.CANCELADO
                seguimiento_cambiado = True
                nuevo_seguimiento = EstadoSeguimiento.CANCELADO.value
                nota_por_defecto = "Tu pedido ha sido cancelado."
            elif nuevo_estado == EstadoPedido.EN_PROCESO:
                pedido.seguimiento_estado = EstadoSeguimiento.RECIBIDO
                seguimiento_cambiado = True
                nuevo_seguimiento = EstadoSeguimiento.RECIBIDO.value
                nota_por_defecto = "Tu pedido fue recibido y está siendo procesado."

            # MEJORA PROFESIONAL: Si el estado de seguimiento cambió, añadir una entrada al historial.
            if seguimiento_cambiado and nota_por_defecto:
                if pedido.seguimiento_historial is None:
                    pedido.seguimiento_historial = []
                
                new_history_entry = {
                    'estado': nuevo_seguimiento,
                    'notas': nota_por_defecto,
                    'timestamp': datetime.utcnow().isoformat() + "Z",
                    'notified_to_client': False # MEJORA: Flag para notificaciones en carga de página
                }
                # MEJORA PROFESIONAL: Modificar la lista in-place y marcarla como modificada.
                pedido.seguimiento_historial.append(new_history_entry)
                flag_modified(pedido, "seguimiento_historial")
                pedido.notas_seguimiento = nota_por_defecto

            pedido.estado_pedido = nuevo_estado
            pedido.updated_at = datetime.utcnow()
            
            db.session.commit()

            current_app.logger.info(
                f"Pedido {pedido_id} cambiado de estado de {old_status.value} a {nuevo_estado.value} "
                f"por administrador {admin_user.id} ('{admin_user.nombre}')"
            )

            # Respuesta mejorada con información de sincronización
            response_data = {
                'success': True,
                'message': f'El pedido ha sido marcado como {nuevo_estado.value} correctamente',
                'pedido_id': pedido_id,
                'old_status': old_status.value,
                'new_status': nuevo_estado.value,
                'timestamp': datetime.utcnow().isoformat(),
                'seguimiento_cambiado': seguimiento_cambiado
            }
            
            # Incluir información del seguimiento si cambió
            if seguimiento_cambiado:
                response_data['nuevo_seguimiento'] = nuevo_seguimiento
                response_data['old_seguimiento'] = pedido.seguimiento_estado.value if not seguimiento_cambiado else old_status.value

            # MEJORA PROFESIONAL: El evento ahora se gestiona en el frontend al cargar la página.
            # Se elimina la publicación de eventos en tiempo real (SSE).

            return jsonify(response_data)

        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error al cambiar estado del pedido {pedido_id}: {e}", exc_info=True)
            return jsonify({'success': False, 'message': 'Error al cambiar el estado del pedido'}), 500

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al cambiar estado del pedido {pedido_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error al cambiar el estado del pedido'}), 500


@admin_lista_pedidos_bp.route('/api/pedidos/filter', methods=['GET'])
@admin_jwt_required
def filter_pedidos_api(admin_user):
    """
    MEJORADO: Filtrado de pedidos con mejor rendimiento y sincronización en tiempo real
    """
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        pedido_id = request.args.get('pedido_id', '')
        cliente = request.args.get('cliente', '')
        fecha_inicio = request.args.get('fecha_inicio', '')
        fecha_fin = request.args.get('fecha_fin', '')
        estado_str = request.args.get('estado', 'en proceso')
        status_filter = request.args.get('status', 'all')
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')

        # Validar estado
        estado_pedido_filter = ESTADO_PEDIDO_MAP.get(estado_str, EstadoPedido.EN_PROCESO)
        
        # Construir consulta base con joins optimizados para rendimiento
        query = Pedido.query.options(
            joinedload(Pedido.usuario),
            joinedload(Pedido.productos).joinedload(PedidoProducto.producto)
        ).filter(
            Pedido.estado_pedido == estado_pedido_filter
        )

        # Aplicar el filtro de estado (activo/inactivo)
        if status_filter != 'all':
            query = query.filter(Pedido.estado == status_filter)

        # Aplicar filtros de búsqueda
        if pedido_id:
            # Usamos ilike para permitir búsquedas parciales del ID
            query = query.filter(Pedido.id.ilike(f'%{pedido_id}%'))

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
                current_app.logger.warning(f"Formato de fecha_inicio inválido: {fecha_inicio}")
                
        if fecha_fin:
            try:
                fecha_fin_dt = datetime.strptime(fecha_fin, '%Y-%m-%d') + timedelta(days=1)
                query = query.filter(Pedido.created_at < fecha_fin_dt)
            except ValueError:
                current_app.logger.warning(f"Formato de fecha_fin inválido: {fecha_fin}")
        
        # Aplicar ordenamiento
        if sort_by == 'cliente':
            if sort_order == 'asc':
                query = query.order_by(Usuarios.nombre.asc(), Usuarios.apellido.asc())
            else:
                query = query.order_by(Usuarios.nombre.desc(), Usuarios.apellido.desc())
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
        
        # Serializar datos con información completa para sincronización
        pedidos_data = []
        for pedido in pagination.items:
            pedido_dict = pedido_to_dict(pedido)
            # Incluir información completa del seguimiento para actualizaciones en tiempo real
            pedido_dict['seguimiento_estado'] = pedido.seguimiento_estado.value if pedido.seguimiento_estado else 'recibido'
            pedido_dict['notas_seguimiento'] = pedido.notas_seguimiento or ''
            pedidos_data.append(pedido_dict)

        # Preparar respuesta con metadatos para sincronización
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
            'success': True,
            'timestamp': datetime.utcnow().isoformat(),
            'estado_actual': estado_pedido_filter.value
        }

        return jsonify(response_data)

    except Exception as e:
        current_app.logger.error(f"Error en filtro AJAX de pedidos: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Error al filtrar pedidos'
        }), 500


@admin_lista_pedidos_bp.route('/api/pedidos/<string:pedido_id>/estado-activo', methods=['POST'])
@admin_jwt_required
def update_pedido_estado_activo(admin_user, pedido_id):
    """
    MEJORADO: Actualización del estado activo/inactivo con sincronización completa
    """
    try:
        pedido = Pedido.query.options(
            joinedload(Pedido.productos).joinedload(PedidoProducto.producto),
            joinedload(Pedido.usuario)
        ).get(pedido_id)
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
        pedido.updated_at = datetime.utcnow()

        # MEJORA PROFESIONAL: Si el pedido se está activando, generar una nueva notificación.
        if old_status == 'inactivo' and nuevo_estado == 'activo':
            # En lugar de re-marcar una entrada antigua, creamos una nueva para notificar la reactivación.
            # Esto es más claro para el cliente y evita problemas de notificaciones "perdidas".
            if pedido.seguimiento_historial is None:
                pedido.seguimiento_historial = []
            
            # MEJORA PROFESIONAL: Mensaje de notificación contextual al reactivar.
            # Se genera una nota específica basada en el estado de seguimiento actual del pedido.
            current_tracking_status = pedido.seguimiento_estado
            
            reactivation_notes = {
                EstadoSeguimiento.RECIBIDO: "Tu pedido fue recibio y está siendo procesado.",
                EstadoSeguimiento.EN_PREPARACION: "Tu pedido ha sido reactivado y continúa en preparación.",
                EstadoSeguimiento.EN_CAMINO: "Tu pedido ha sido reactivado y ya se encuentra en camino.",
            }
            
            nota_reactivacion = reactivation_notes.get(current_tracking_status, "Tu pedido fue recibio y está siendo procesado.")

            new_history_entry = {
                'estado': pedido.seguimiento_estado.value, # Usar el estado de seguimiento actual
                'notas': nota_reactivacion,
                'timestamp': datetime.utcnow().isoformat() + "Z",
                'notified_to_client': False
            }
            pedido.seguimiento_historial.append(new_history_entry)
            flag_modified(pedido, "seguimiento_historial")
            current_app.logger.info(f"Pedido {pedido_id} reactivado y marcado para notificación al cliente.")

        current_app.logger.info(
            f"Pedido {pedido_id} cambiado de estado (activo/inactivo) de {old_status} a {nuevo_estado} "
            f"por administrador {admin_user.id} ('{admin_user.nombre}')"
        )
        # Respuesta mejorada con información completa para sincronización
        response_data = {
            'success': True,
            'message': f'El pedido ha sido marcado como {nuevo_estado} correctamente',
            'pedido_id': pedido_id,
            'new_status': nuevo_estado,
            'old_status': old_status,
            'timestamp': datetime.utcnow().isoformat(),
            'pedido_info': {
                'id': pedido.id,
                'usuario_nombre': f"{pedido.usuario.nombre} {pedido.usuario.apellido}" if pedido.usuario else 'N/A',
                'total': pedido.total,
                'estado_pedido': pedido.estado_pedido.value,
                'seguimiento_estado': pedido.seguimiento_estado.value if pedido.seguimiento_estado else 'recibido'
            }
        }
        
        # MEJORA: Mover el commit al final para asegurar que todos los cambios se guarden atómicamente.
        db.session.commit()
        return jsonify(response_data)

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al cambiar estado (activo/inactivo) del pedido {pedido_id}: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Error al cambiar el estado del pedido'
        }), 500