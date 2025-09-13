from flask import Blueprint, request, jsonify, session, render_template, current_app, make_response, url_for
from app.models.domains.product_models import Productos, Seudocategorias, Subcategorias, CategoriasPrincipales
from app.models.domains.order_models import Pedido, PedidoProducto
from app.extensions import db
from app.models.enums import EstadoPedido, EstadoEnum
from app.utils.jwt_utils import jwt_required
from datetime import datetime, timedelta

order_bp = Blueprint('order', __name__)

# Añadir al archivo cart.py después de las importaciones
from app.models.serializers import pedido_detalle_cliente_to_dict

@order_bp.route('/mis-pedidos')
@jwt_required
def view_orders(usuario):
    """Vista para que los clientes vean sus pedidos"""
    try:
        # Obtener parámetros de la URL
        orden = request.args.get('orden', 'desc')  # desc para más recientes primero, asc para más antiguos primero
        search = request.args.get('search', '')
        page = request.args.get('page', 1, type=int)
        
        # Nuevos parámetros de filtrado
        fecha_desde = request.args.get('fecha_desde', '')
        fecha_hasta = request.args.get('fecha_hasta', '')
        monto_min = request.args.get('monto_min', 0, type=float)
        monto_max = request.args.get('monto_max', float('inf'), type=float)
        
        # Construir la consulta base, filtrando solo pedidos activos
        query = Pedido.query.filter_by(usuario_id=usuario.id, estado=EstadoEnum.ACTIVO.value)
        
        # Aplicar filtro por estado de pedido (ej. 'en proceso', 'completado') si se especifica
        estado_pedido_filtro = request.args.get('estado_pedido', 'todos')
        if estado_pedido_filtro != 'todos':
            query = query.filter(Pedido.estado_pedido == estado_pedido_filtro)
        
        # Aplicar búsqueda si hay término de búsqueda
        if search:
            # Buscar por ID de pedido
            query = query.filter(Pedido.id.ilike(f'%{search}%'))
        
        # Aplicar filtros de fecha
        if fecha_desde:
            fecha_desde_dt = datetime.strptime(fecha_desde, '%Y-%m-%d')
            query = query.filter(Pedido.created_at >= fecha_desde_dt)
        
        if fecha_hasta:
            # Agregar un día a la fecha_hasta para incluir todo ese día
            fecha_hasta_dt = datetime.strptime(fecha_hasta, '%Y-%m-%d') + timedelta(days=1)
            query = query.filter(Pedido.created_at <= fecha_hasta_dt)
        
        # Aplicar filtros de monto
        query = query.filter(Pedido.total >= monto_min)
        if monto_max != float('inf'):
            query = query.filter(Pedido.total <= monto_max)
        
        # Aplicar ordenamiento
        if orden == 'asc':
            query = query.order_by(Pedido.created_at.asc())
        elif orden == 'monto-desc':
            query = query.order_by(Pedido.total.desc())
        elif orden == 'monto-asc':
            query = query.order_by(Pedido.total.asc())
        else:  # desc por defecto
            query = query.order_by(Pedido.created_at.desc())
        
        # Obtener conteos para cada estado de pedido (sin aplicar filtros de búsqueda o paginación)
        total_pedidos_todos = Pedido.query.filter_by(usuario_id=usuario.id, estado=EstadoEnum.ACTIVO.value).count()
        total_pedidos_en_proceso = Pedido.query.filter_by(usuario_id=usuario.id, estado=EstadoEnum.ACTIVO.value, estado_pedido=EstadoPedido.EN_PROCESO.value).count()
        total_pedidos_completado = Pedido.query.filter_by(usuario_id=usuario.id, estado=EstadoEnum.ACTIVO.value, estado_pedido=EstadoPedido.COMPLETADO.value).count()
        total_pedidos_cancelado = Pedido.query.filter_by(usuario_id=usuario.id, estado=EstadoEnum.ACTIVO.value, estado_pedido=EstadoPedido.CANCELADO.value).count()

        # Obtener el total de resultados para determinar si se necesita paginación
        total_count = query.count()
        
        # Determinar si se debe mostrar paginación (solo si hay más de 6 elementos)
        show_pagination = total_count > 6
        
        # Si no se necesita paginación, obtener todos los resultados
        if not show_pagination:
            pedidos = query.all()
        else:
            # Paginar los resultados (6 elementos por página)
            per_page = 6
            pedidos_paginados = query.paginate(page=page, per_page=per_page, error_out=False)
            pedidos = pedidos_paginados.items
        
        # Convertir a diccionarios para la vista
        pedidos_dict = []
        for pedido in pedidos:
            print(f"Debug: Pedido ID before serialization: {pedido.id}") # Add this line
            pedidos_dict.append(pedido_detalle_cliente_to_dict(pedido))
        
        return render_template('cliente/componentes/mis_pedidos.html', 
                               pedidos=pedidos_dict, 
                               estado_actual=estado_pedido_filtro,
                               orden_actual=orden,
                               search_actual=search,
                               fecha_desde_actual=fecha_desde,
                               fecha_hasta_actual=fecha_hasta,
                               monto_min_actual=monto_min if monto_min > 0 else '',
                               monto_max_actual=monto_max if monto_max != float('inf') else '',
                               show_pagination=show_pagination,
                               current_page=page,
                               total_pages=pedidos_paginados.pages if show_pagination else 0,
                               total_items=total_count,
                               total_pedidos_todos=total_pedidos_todos,
                               total_pedidos_en_proceso=total_pedidos_en_proceso,
                               total_pedidos_completado=total_pedidos_completado,
                               total_pedidos_cancelado=total_pedidos_cancelado)
    
    except Exception as e:
        current_app.logger.error(f"Error al cargar pedidos del usuario {usuario.id}: {str(e)}")
        return render_template('cliente/componentes/mis_pedidos.html', pedidos=[], error="Error al cargar tus pedidos. Por favor, intenta más tarde.")

@order_bp.route('/api/buscar-pedidos', methods=['GET'])
@jwt_required
def buscar_pedidos(usuario):
    """API para buscar pedidos en tiempo real"""
    try:
        # Obtener parámetros de la URL
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 6, type=int)  # Cambiado a 6 elementos por página
        orden = request.args.get('orden', 'desc')
        search = request.args.get('search', '')
        
        # Nuevos parámetros de filtrado
        fecha_desde = request.args.get('fecha_desde', '')
        fecha_hasta = request.args.get('fecha_hasta', '')
        monto_min = request.args.get('monto_min', 0, type=float)
        monto_max = request.args.get('monto_max', float('inf'), type=float)
        
        # Construir la consulta base, filtrando solo pedidos activos
        query = Pedido.query.filter_by(usuario_id=usuario.id, estado=EstadoEnum.ACTIVO.value)
        
        # Aplicar filtro por estado de pedido (ej. 'en proceso', 'completado') si se especifica
        estado_pedido_filtro = request.args.get('estado_pedido', 'todos')
        if estado_pedido_filtro != 'todos':
            query = query.filter(Pedido.estado_pedido == estado_pedido_filtro)
        
        # Aplicar búsqueda si hay término de búsqueda
        if search:
            # Buscar por ID de pedido
            query = query.filter(Pedido.id.ilike(f'%{search}%'))
        
        # Aplicar filtros de fecha
        if fecha_desde:
            fecha_desde_dt = datetime.strptime(fecha_desde, '%Y-%m-%d')
            query = query.filter(Pedido.created_at >= fecha_desde_dt)
        
        if fecha_hasta:
            # Agregar un día a la fecha_hasta para incluir todo ese día
            fecha_hasta_dt = datetime.strptime(fecha_hasta, '%Y-%m-%d') + timedelta(days=1)
            query = query.filter(Pedido.created_at <= fecha_hasta_dt)
        
        # Aplicar filtros de monto
        query = query.filter(Pedido.total >= monto_min)
        if monto_max != float('inf'):
            query = query.filter(Pedido.total <= monto_max)
        
        # Aplicar ordenamiento
        if orden == 'asc':
            query = query.order_by(Pedido.created_at.asc())
        elif orden == 'monto-desc':
            query = query.order_by(Pedido.total.desc())
        elif orden == 'monto-asc':
            query = query.order_by(Pedido.total.asc())
        else:  # desc por defecto
            query = query.order_by(Pedido.created_at.desc())
        
        # Obtener conteos para cada estado de pedido (sin aplicar filtros de búsqueda o paginación)
        total_pedidos_todos = Pedido.query.filter_by(usuario_id=usuario.id, estado=EstadoEnum.ACTIVO.value).count()
        total_pedidos_en_proceso = Pedido.query.filter_by(usuario_id=usuario.id, estado=EstadoEnum.ACTIVO.value, estado_pedido=EstadoPedido.EN_PROCESO.value).count()
        total_pedidos_completado = Pedido.query.filter_by(usuario_id=usuario.id, estado=EstadoEnum.ACTIVO.value, estado_pedido=EstadoPedido.COMPLETADO.value).count()
        total_pedidos_cancelado = Pedido.query.filter_by(usuario_id=usuario.id, estado=EstadoEnum.ACTIVO.value, estado_pedido=EstadoPedido.CANCELADO.value).count()

        # Obtener el total de resultados para determinar si se necesita paginación
        total_count = query.count()
        
        # Determinar si se debe mostrar paginación (solo si hay más de 6 elementos)
        show_pagination = total_count > 6
        
        # Si no se necesita paginación, obtener todos los resultados
        if not show_pagination:
            pedidos = query.all()
            pages = 1
        else:
            # Paginar los resultados
            pedidos_paginados = query.paginate(page=page, per_page=per_page, error_out=False)
            pedidos = pedidos_paginados.items
            pages = pedidos_paginados.pages
        
        # Convertir a diccionarios para la respuesta JSON
        pedidos_dict = []
        for pedido in pedidos:
            print(f"Debug: Pedido ID before serialization (API): {pedido.id}") # Add this line
            pedidos_dict.append(pedido_detalle_cliente_to_dict(pedido))
        
        return jsonify({
            'success': True,
            'pedidos': pedidos_dict,
            'total': total_count,
            'pages': pages,
            'current_page': page,
            'show_pagination': show_pagination,
            'total_pedidos_todos': total_pedidos_todos,
            'total_pedidos_en_proceso': total_pedidos_en_proceso,
            'total_pedidos_completado': total_pedidos_completado,
            'total_pedidos_cancelado': total_pedidos_cancelado
        })
    
    except Exception as e:
        current_app.logger.error(f"Error al buscar pedidos del usuario {usuario.id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error al buscar pedidos'
        }), 500
    
@order_bp.route('/pedido/<uuid:order_id>')
@jwt_required
def order_detail(usuario, order_id):
    """Vista para ver los detalles de un pedido específico"""
    try:
        # Modificamos para incluir pedidos cancelados
        pedido = Pedido.query.filter_by(
            id=str(order_id),
            usuario_id=usuario.id
        ).first()  # Quitamos el filtro por estado='activo'
        
        if not pedido:
            return render_template('cliente/componentes/404.html'), 404
        
        pedido_dict = pedido_detalle_cliente_to_dict(pedido)
        
        return render_template('cliente/ui/detalle_pedido.html', pedido=pedido_dict)
    
    except Exception as e:
        current_app.logger.error(f"Error al cargar detalles del pedido {order_id}: {str(e)}")
        return render_template('cliente/ui/detalle_pedido.html', pedido=None, error="Error al cargar los detalles del pedido.")
    
@order_bp.route('/api/pedido-detalle/<uuid:order_id>')
@jwt_required
def api_pedido_detalle(usuario, order_id):
    """API para obtener los detalles de un pedido específico en formato JSON"""
    try:
        # Obtener el pedido
        pedido = Pedido.query.filter_by(
            id=str(order_id),
            usuario_id=usuario.id
        ).first()
        
        if not pedido:
            return jsonify({
                'success': False,
                'message': 'Pedido no encontrado'
            }), 404
        
        # Convertir a diccionario
        pedido_dict = pedido_detalle_cliente_to_dict(pedido)
        
        return jsonify({
            'success': True,
            'productos': pedido_dict['productos'],
            'total': pedido_dict['total']
        })
    
    except Exception as e:
        current_app.logger.error(f"Error al cargar detalles del pedido {order_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error al cargar los detalles del pedido'
        }), 500

@order_bp.route('/reordenar/<uuid:order_id>', methods=['POST'])
@jwt_required
def reorder_order(usuario, order_id):
    """Crea un nuevo pedido con los mismos productos que un pedido anterior"""
    try:
        # Obtener el pedido original
        pedido_original = Pedido.query.filter_by(
            id=str(order_id),
            usuario_id=usuario.id
        ).first()
        
        if not pedido_original:
            return jsonify({
                'success': False,
                'message': 'Pedido no encontrado'
            }), 404
        
        # Crear un nuevo pedido
        nuevo_pedido = Pedido(
            usuario_id=usuario.id,
            total=0,  # Se calculará después
            estado_pedido=EstadoPedido.EN_PROCESO.value,
            estado=EstadoEnum.ACTIVO.value
        )
        db.session.add(nuevo_pedido)
        db.session.flush()  # Para obtener el ID del nuevo pedido
        
        total = 0
        productos_no_disponibles = []
        
        # Recorrer los productos del pedido original
        for pp in pedido_original.productos:
            producto = pp.producto
            cantidad_solicitada = pp.cantidad
            
            # Verificar stock
            if producto.existencia < cantidad_solicitada:
                productos_no_disponibles.append({
                    'nombre': producto.nombre,
                    'cantidad_solicitada': cantidad_solicitada,
                    'cantidad_disponible': producto.existencia
                })
                continue
            
            # Crear la relación en el nuevo pedido
            nuevo_pedido_producto = PedidoProducto(
                pedido_id=nuevo_pedido.id,
                producto_id=producto.id,
                cantidad=cantidad_solicitada,
                precio_unitario=producto.precio
            )
            db.session.add(nuevo_pedido_producto)
            
            # Actualizar stock
            producto.existencia -= cantidad_solicitada
            
            # Calcular subtotal
            subtotal = cantidad_solicitada * producto.precio
            total += subtotal
        
        # Si hay productos no disponibles, cancelar el pedido y devolver error
        if productos_no_disponibles:
            db.session.rollback()
            return jsonify({
                'success': False,
                'message': 'Algunos productos no tienen stock suficiente',
                'productos_no_disponibles': productos_no_disponibles
            }), 400
        
        # Actualizar total del pedido
        nuevo_pedido.total = total
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Pedido reordenado correctamente',
            'pedido_id': nuevo_pedido.id
        })
    
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al reordenar el pedido {order_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error al reordenar el pedido'
        }), 500
        

# Añadir esta función al archivo order.py
def format_number_colombian(value):
    """Formatea un número al formato colombiano (puntos de mil, sin decimales)"""
    try:
        # Convertir a entero para eliminar decimales
        value = int(float(value))
        # Formatear con puntos como separadores de miles
        return "{:,}".format(value).replace(",", ".")
    except (ValueError, TypeError):
        return value

@order_bp.route('/factura-pdf/<uuid:order_id>')
@jwt_required
def generar_factura_pdf(usuario, order_id):
    """Genera una factura en formato PDF para un pedido específico"""
    try:
        # Obtener el pedido
        pedido = Pedido.query.filter_by(
            id=str(order_id),
            usuario_id=usuario.id
        ).first()
        
        if not pedido:
            return render_template('cliente/componentes/404.html'), 404
        
        # Preparar los datos para la plantilla
        pedido_dict = pedido_detalle_cliente_to_dict(pedido)
        
        # Formatear los precios al formato colombiano
        for item in pedido_dict['productos']:
            item['precio_unitario_formatted'] = format_number_colombian(item['precio_unitario'])
            item['subtotal_formatted'] = format_number_colombian(item['subtotal'])
        
        total_price_formatted = format_number_colombian(pedido.total)
        
        # Renderizar la plantilla del PDF
        return render_template(
            'cliente/ui/pedido_template.html',
            pedido_id=pedido.id,
            date=datetime.now().strftime('%d/%m/%Y'),
            user=pedido.usuario,
            cart_items=pedido_dict['productos'],
            total_price=pedido.total,
            total_price_formatted=total_price_formatted
        )
    
    except Exception as e:
        current_app.logger.error(f"Error al generar factura PDF para el pedido {order_id}: {str(e)}")
        return render_template('cliente/ui/pedido_template_pedido.html', 
                               pedido_id=order_id,
                               date=datetime.now().strftime('%d/%m/%Y'),
                               user=usuario,
                               cart_items=[],
                               total_price=0,
                               total_price_formatted="0",
                               error="Error al generar la factura. Por favor, contacte con soporte.")