"""
Módulo de Gestión de Pedidos (Admin).

Este blueprint centraliza toda la lógica para la administración de los pedidos
de los clientes. Proporciona una interfaz completa para listar, crear, editar,
y gestionar el estado de los pedidos y su seguimiento logístico.

Funcionalidades Clave:
- **Vistas de Listado**: Ofrece vistas separadas para pedidos 'en proceso',
  'completados' y 'cancelados', con paginación, búsqueda y filtros avanzados.
- **API de Gestión**: Endpoints para crear y editar pedidos, incluyendo la
  gestión de productos y la actualización de stock.
- **Gestión de Estado**: APIs para cambiar el estado principal de un pedido
  (ej. de 'en proceso' a 'completado') y el estado de seguimiento logístico
  (ej. de 'en preparación' a 'en camino'), asegurando la sincronización entre ambos.
- **Manejo de Stock**: La lógica de cambio de estado gestiona automáticamente
  la devolución o resta de stock de los productos involucrados.
"""
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

# Mapa para convertir cadenas de la URL a miembros del Enum de forma segura.
ESTADO_PEDIDO_MAP = {
    'en proceso': EstadoPedido.EN_PROCESO,
    'completado': EstadoPedido.COMPLETADO,
    'cancelado': EstadoPedido.CANCELADO,
}

def _build_pedidos_query(estado_pedido_filter, pedido_id, cliente, fecha_inicio, fecha_fin, status_filter, sort_by, sort_order):
    """
    Función auxiliar para construir y filtrar la consulta de pedidos.

    Esta función centraliza la lógica de construcción de consultas para evitar la
    duplicación de código entre la vista principal y los endpoints de la API.

    Args:
        estado_pedido_filter (EstadoPedido): El estado principal del pedido a filtrar.
        pedido_id (str): ID parcial o completo del pedido.
        cliente (str): Término de búsqueda para el cliente.
        fecha_inicio (str): Fecha de inicio del rango.
        fecha_fin (str): Fecha de fin del rango.
        status_filter (str): Filtro por estado 'activo' o 'inactivo'.
        sort_by (str): Campo por el cual ordenar.
        sort_order (str): Dirección del ordenamiento ('asc' o 'desc').

    Returns:
        Query: Un objeto de consulta de SQLAlchemy con los filtros y ordenamiento aplicados.
    """
    # Construir consulta base con carga anticipada del usuario para optimización.
    query = Pedido.query.options(joinedload(Pedido.usuario)).filter(
        Pedido.estado_pedido == estado_pedido_filter
    )

    # Aplicar el filtro de estado secundario (activo/inactivo).
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
    """
    Renderiza la página de listado de pedidos para un estado específico.

    Esta función es el controlador principal para la sección de pedidos. Determina
    el estado solicitado ('en-proceso', 'completados', 'cancelados'), aplica los
    filtros y la paginación correspondientes, y renderiza la plantilla principal
    con los datos necesarios.

    Args:
        admin_user: El objeto del administrador autenticado (inyectado por el decorador).
        estado (str, optional): El estado de los pedidos a mostrar. Por defecto es
                                'en-proceso'.

    Returns:
        Response: La plantilla `lista_pedidos.html` renderizada con los datos.
    """
    error_message = None
    pedidos_data = []
    pagination = None
    pagination_info = {}
    
    # Mapeo de estados de URL a valores de Enum para la consulta.
    estado_map = {
        'completados': ('completados', EstadoPedido.COMPLETADO),
        'cancelados': ('cancelados', EstadoPedido.CANCELADO),
        'en-proceso': ('en-proceso', EstadoPedido.EN_PROCESO)
    }
    current_estado, estado_pedido_filter = estado_map.get(estado, ('en-proceso', EstadoPedido.EN_PROCESO))

    try:
        # Obtener parámetros de filtro y paginación desde la URL.
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        pedido_id = request.args.get('pedido_id', '')
        cliente = request.args.get('cliente', '')
        fecha_inicio = request.args.get('fecha_inicio', '')
        fecha_fin = request.args.get('fecha_fin', '')
        status_filter = request.args.get('status', 'all')
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')
        
        # Construir la consulta utilizando la función auxiliar.
        query = _build_pedidos_query(
            estado_pedido_filter, pedido_id, cliente, fecha_inicio, fecha_fin, 
            status_filter, sort_by, sort_order
        )
        
        # Aplicar paginación a la consulta.
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Serializar los datos paginados para la plantilla.
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
    """
    API para obtener los detalles completos de un pedido específico.

    Utilizado por el frontend para poblar modales de detalle o edición con toda
    la información de un pedido, incluyendo el cliente y la lista de productos.

    Args:
        admin_user: El objeto del administrador autenticado.
        pedido_id (str): El ID del pedido a obtener.

    Returns:
        JSON: Un objeto con los detalles completos del pedido.
    """
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
    """
    API para crear un nuevo pedido desde el panel de administración.

    Recibe el ID del usuario y una lista de productos con sus cantidades.
    Valida el stock, calcula el total, crea el `Pedido` y los `PedidoProducto`
    asociados, y descuenta el stock de los productos.

    Args:
        admin_user: El objeto del administrador autenticado.

    Returns:
        JSON: Un mensaje de éxito con el ID del nuevo pedido, o un error de
              validación o de servidor.
    """
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
            # Inicializar el historial de seguimiento al crear el pedido.
            # Esto asegura que el estado 'recibido' siempre tenga un timestamp y una nota.
            seguimiento_estado=EstadoSeguimiento.RECIBIDO,
            notas_seguimiento="Tu Pedido fue recibido y esta siendo procesado",
            seguimiento_historial=[{
                'estado': EstadoSeguimiento.RECIBIDO.value,
                'notas': "Tu Pedido fue recibido y esta siendo procesado",
                'timestamp': datetime.utcnow().isoformat() + "Z",
                'notified_to_client': False # Marcar para notificación inicial.
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
    """
    API para actualizar un pedido existente.

    Permite cambiar el cliente y la lista de productos de un pedido que está
    'en proceso'. La lógica es compleja para garantizar la consistencia del stock:
    1. Devuelve el stock de los productos originales del pedido.
    2. Elimina los productos antiguos de la relación.
    3. Valida el stock para los nuevos productos.
    4. Si hay stock, crea las nuevas relaciones y descuenta el nuevo stock.
    5. Si falla, revierte la devolución de stock para dejar todo como estaba.

    Args:
        admin_user: El objeto del administrador autenticado.
        pedido_id (str): El ID del pedido a actualizar.
    """
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



@admin_lista_pedidos_bp.route('/api/pedidos/<string:pedido_id>/seguimiento', methods=['POST'])
@admin_jwt_required
def update_pedido_seguimiento(admin_user, pedido_id):
    """
    API para actualizar el estado de seguimiento logístico de un pedido.

    Esta función es clave para la gestión logística. No solo actualiza el estado
    de seguimiento (ej. 'en preparación'), sino que también sincroniza el estado
    principal del pedido (`estado_pedido`) si es necesario. Por ejemplo, al marcar
    un pedido como 'entregado', su estado principal cambia a 'completado'.

    Además, gestiona el stock: si un pedido se cancela, devuelve el stock; si se
    reactiva desde un estado cancelado, vuelve a descontar el stock.

    Args:
        admin_user: El objeto del administrador autenticado.
        pedido_id (str): El ID del pedido a actualizar.
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

        # Validar que el estado y las notas no estén vacíos.
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

        # Iniciar transacción para atomicidad.
        try:
            estado_pedido_cambiado = False
            nuevo_estado_pedido = None

            # 1. Si el nuevo estado de seguimiento es CANCELADO
            if nuevo_seguimiento_enum == EstadoSeguimiento.CANCELADO:
                if old_estado_pedido != EstadoPedido.CANCELADO:
                    pedido.estado_pedido = EstadoPedido.CANCELADO
                    estado_pedido_cambiado = True
                    nuevo_estado_pedido = EstadoPedido.CANCELADO.value
                    
                    # Devolver stock al inventario.
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
                if old_estado_pedido != EstadoPedido.EN_PROCESO: # pragma: no cover
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

            # --- MEJORA PROFESIONAL: Lógica de relleno de historial ---
            # Al cambiar el estado de seguimiento, rellenamos los pasos intermedios para
            # que el cliente vea un historial completo y profesional.
            if pedido.seguimiento_historial is None:
                pedido.seguimiento_historial = []

            timestamp_actual = datetime.utcnow().isoformat() + "Z"

            # MEJORA PROFESIONAL: Si el estado es 'cancelado', no rellenar estados intermedios.
            # Esto preserva el historial exacto de en qué punto se canceló el pedido.
            if nuevo_seguimiento_enum == EstadoSeguimiento.CANCELADO:
                new_history_entry = {
                    'estado': nuevo_seguimiento_enum.value,
                    'notas': notas,
                    'timestamp': timestamp_actual,
                    'notified_to_client': False
                }
                pedido.seguimiento_historial.append(new_history_entry)
            else:
                # Lógica de relleno para los demás estados.
                estados_existentes = {entry['estado'] for entry in pedido.seguimiento_historial}

                # Definir la secuencia completa de seguimiento y las notas por defecto.
                secuencia_completa = [
                    (EstadoSeguimiento.RECIBIDO, "Tu pedido fue recibido y está siendo procesado."),
                    (EstadoSeguimiento.EN_PREPARACION, "Tu pedido está en preparación."),
                    (EstadoSeguimiento.EN_CAMINO, "Tu pedido ya se encuentra en camino."),
                    (EstadoSeguimiento.ENTREGADO, "Tu pedido ha sido completado y entregado.")
                ]

                # Añadir solo los estados que faltan en el historial hasta el estado actual.
                for estado_secuencia, nota_secuencia in secuencia_completa:
                    # Si el estado es el que el admin acaba de seleccionar:
                    if estado_secuencia == nuevo_seguimiento_enum:
                        # Añadirlo al historial con las notas del admin y marcarlo para notificación.
                        new_history_entry = {
                            'estado': estado_secuencia.value,
                            'notas': notas, # Usar las notas proporcionadas por el admin.
                            'timestamp': timestamp_actual,
                            'notified_to_client': False # Marcar para que el cliente sea notificado.
                        }
                        pedido.seguimiento_historial.append(new_history_entry)
                        # Una vez que llegamos al estado seleccionado, no rellenamos más.
                        break
                    
                    # Si es un estado intermedio que no estaba en el historial:
                    elif estado_secuencia.value not in estados_existentes:
                        # Añadirlo con una nota por defecto y marcarlo como ya notificado.
                        new_history_entry = {
                            'estado': estado_secuencia.value,
                            'notas': nota_secuencia, # Usar la nota por defecto.
                            'timestamp': timestamp_actual,
                            'notified_to_client': True # Marcar como ya notificado para no enviar alertas extra.
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

            # Respuesta con información de sincronización para el frontend.
            response_data = {
                'success': True,
                'message': f'El estado de seguimiento del pedido ha sido actualizado a {nuevo_seguimiento_enum.value} correctamente',
                'pedido_id': pedido_id,
                'old_seguimiento': old_seguimiento.value,
                'new_seguimiento': nuevo_seguimiento_enum.value,
                'timestamp': datetime.utcnow().isoformat(),
                'estado_pedido_cambiado': estado_pedido_cambiado
            }
            
            # Incluir información del estado del pedido si cambió.
            if estado_pedido_cambiado:
                response_data['nuevo_estado_pedido'] = nuevo_estado_pedido
                response_data['old_estado_pedido'] = old_estado_pedido.value

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
    API para actualizar el estado principal de un pedido ('en proceso', 'completado', 'cancelado').

    Esta función maneja la lógica de negocio más crítica asociada al cambio de estado:
    - **Gestión de Stock**: Devuelve el stock si se cancela un pedido, o lo descuenta
      si se reactiva desde un estado cancelado.
    - **Sincronización de Seguimiento**: Actualiza automáticamente el estado de
      seguimiento logístico para que sea coherente con el estado principal.
      (ej. al completar un pedido, el seguimiento pasa a 'entregado').

    Args:
        admin_user: El objeto del administrador autenticado.
        pedido_id (str): El ID del pedido a actualizar.
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
            # Añadir una nota por defecto al historial de seguimiento.

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
            # Asignar la nota correcta según el estado final.
            nota_por_defecto = ""
            
            # MEJORA PROFESIONAL: Al completar un pedido, rellenar el historial de seguimiento.
            # Esto asegura que el cliente vea un historial completo y profesional, incluso si los
            # pasos intermedios se omitieron en el panel de administración.
            if nuevo_estado == EstadoPedido.COMPLETADO:
                pedido.seguimiento_estado = EstadoSeguimiento.ENTREGADO
                seguimiento_cambiado = True
                nuevo_seguimiento = EstadoSeguimiento.ENTREGADO.value
                nota_por_defecto = "Tu pedido ha sido completado y entregado."

                # --- Lógica de relleno de historial ---
                if pedido.seguimiento_historial is None:
                    pedido.seguimiento_historial = []

                # Obtener los estados ya registrados en el historial.
                estados_existentes = {entry['estado'] for entry in pedido.seguimiento_historial}

                # Definir la secuencia completa de seguimiento y las notas por defecto.
                secuencia_completa = [
                    (EstadoSeguimiento.RECIBIDO, "Tu pedido fue recibido y está siendo procesado."),
                    (EstadoSeguimiento.EN_PREPARACION, "Tu pedido está en preparación."),
                    (EstadoSeguimiento.EN_CAMINO, "Tu pedido ya se encuentra en camino."),
                    (EstadoSeguimiento.ENTREGADO, nota_por_defecto) # Usar la nota final para el último estado.
                ]

                # Añadir solo los estados que faltan en el historial.
                for estado_secuencia, nota_secuencia in secuencia_completa:
                    if estado_secuencia.value not in estados_existentes:
                        new_history_entry = {
                            'estado': estado_secuencia.value,
                            'notas': nota_secuencia,
                            'timestamp': datetime.utcnow().isoformat() + "Z",
                            'notified_to_client': False
                        }
                        pedido.seguimiento_historial.append(new_history_entry)
                
                # Marcar el historial como modificado para que SQLAlchemy detecte el cambio.
                flag_modified(pedido, "seguimiento_historial")
                pedido.notas_seguimiento = nota_por_defecto

            elif nuevo_estado == EstadoPedido.CANCELADO:
                pedido.seguimiento_estado = EstadoSeguimiento.CANCELADO
                seguimiento_cambiado = True
                nuevo_seguimiento = EstadoSeguimiento.CANCELADO.value
                nota_por_defecto = "Tu pedido ha sido cancelado."
                
                # Si se cancela, añadir solo la entrada de cancelación.
                if pedido.seguimiento_historial is None:
                    pedido.seguimiento_historial = []
                new_history_entry = {
                    'estado': nuevo_seguimiento,
                    'notas': nota_por_defecto,
                    'timestamp': datetime.utcnow().isoformat() + "Z",
                    'notified_to_client': False
                }
                pedido.seguimiento_historial.append(new_history_entry)
                flag_modified(pedido, "seguimiento_historial")
                pedido.notas_seguimiento = nota_por_defecto

            elif nuevo_estado == EstadoPedido.EN_PROCESO:
                pedido.seguimiento_estado = EstadoSeguimiento.RECIBIDO
                seguimiento_cambiado = True
                nuevo_seguimiento = EstadoSeguimiento.RECIBIDO.value
                nota_por_defecto = "Tu pedido fue recibido y está siendo procesado."
                
                # Si se mueve a "en proceso", añadir solo la entrada de recibido.
                if pedido.seguimiento_historial is None:
                    pedido.seguimiento_historial = []
                new_history_entry = {
                    'estado': nuevo_seguimiento,
                    'notas': nota_por_defecto,
                    'timestamp': datetime.utcnow().isoformat() + "Z",
                    'notified_to_client': False
                }
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

            # Respuesta con información de sincronización para el frontend.
            response_data = {
                'success': True,
                'message': f'El pedido ha sido marcado como {nuevo_estado.value} correctamente',
                'pedido_id': pedido_id,
                'old_status': old_status.value,
                'new_status': nuevo_estado.value,
                'timestamp': datetime.utcnow().isoformat(),
                'seguimiento_cambiado': seguimiento_cambiado
            }
            
            # Incluir información del seguimiento si cambió.
            if seguimiento_cambiado:
                response_data['nuevo_seguimiento'] = nuevo_seguimiento

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
    API para filtrar y paginar la lista de pedidos en tiempo real.

    Este endpoint es consumido por el frontend para actualizar la vista de tabla
    de pedidos cuando el usuario aplica filtros, cambia de página o de pestaña de estado.

    Args:
        admin_user: El objeto del administrador autenticado.

    Returns:
        JSON: Un objeto que contiene la lista de pedidos y metadatos de paginación.
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
            pedido_dict = pedido_to_dict(pedido) # pragma: no cover
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
    API para cambiar el estado de un pedido entre 'activo' e 'inactivo'.

    Este estado es una capa de control administrativo. Un pedido 'inactivo' no es
    visible para el cliente si está 'en proceso', permitiendo al administrador
    revisarlo o corregirlo sin que el cliente lo vea.

    Al reactivar un pedido, se genera una nueva entrada en el historial de seguimiento
    para notificar al cliente que su pedido ha sido reactivado.

    Args:
        admin_user: El objeto del administrador autenticado.
        pedido_id (str): El ID del pedido a modificar.
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

        # Si el pedido se está activando y está "en proceso", generar una nueva notificación.
        # No se notifica para pedidos completados o cancelados que se reactivan, ya que sería confuso para el cliente.
        if old_status == 'inactivo' and nuevo_estado == 'activo' and pedido.estado_pedido == EstadoPedido.EN_PROCESO:
            # En lugar de re-marcar una entrada antigua, creamos una nueva para notificar la reactivación.
            # Esto es más claro para el cliente y evita problemas de notificaciones "perdidas".
            if pedido.seguimiento_historial is None:
                pedido.seguimiento_historial = []
            
            # Mensaje de notificación contextual al reactivar.
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
        # Respuesta con información completa para sincronización.
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
        
        # Mover el commit al final para asegurar que todos los cambios se guarden atómicamente.
        db.session.commit()
        return jsonify(response_data)

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al cambiar estado (activo/inactivo) del pedido {pedido_id}: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Error al cambiar el estado del pedido'
        }), 500