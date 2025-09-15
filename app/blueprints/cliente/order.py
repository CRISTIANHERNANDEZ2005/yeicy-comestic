from flask import Blueprint, request, jsonify, session, render_template, current_app, make_response, url_for
from app.models.domains.product_models import Productos, Seudocategorias, Subcategorias, CategoriasPrincipales
from app.models.domains.order_models import Pedido, PedidoProducto
from app.models.domains.cart_models import CartItem
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
        
        # Usamos el serializador mejorado
        pedido_dict = pedido_detalle_cliente_to_dict(pedido)
        
        print(f"Debug: Pedido total antes de renderizar: {pedido_dict.get('total')}")
        print(f"Debug: Pedido subtotal_productos antes de renderizar: {pedido_dict.get('subtotal_productos')}")

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
    """Añade los productos de un pedido anterior al carrito del usuario."""
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

        warnings = []
        products_added_to_cart = False # Flag to track if any product was successfully added

        # Recorrer los productos del pedido original
        for pp in pedido_original.productos:
            producto = pp.producto
            cantidad_solicitada = pp.cantidad

            # Si el producto no está activo o no existe, no se puede añadir
            if not producto: # El producto original ya no existe en la tabla Productos
                # Si el producto original no existe, usamos el ID del producto del PedidoProducto
                warnings.append(f'Un producto (ID: {pp.producto_id}) ya no está disponible o ha sido eliminado.')
                continue
            
            if producto.estado != 'activo': # El producto existe pero está inactivo
                warnings.append(f'El producto "{producto.nombre}" está inactivo y no puede ser reordenado.')
                continue

            # Verificar stock
            if producto.existencia <= 0:
                warnings.append(f'El producto "{producto.nombre}" no tiene stock disponible.')
                continue # Skip to next product if no stock at all

            cantidad_a_anadir = cantidad_solicitada
            if producto.existencia < cantidad_solicitada:
                cantidad_a_anadir = producto.existencia
                warnings.append(f'Stock insuficiente para "{producto.nombre}". Se añadieron {cantidad_a_anadir} unidades.')

            # Buscar si el item ya está en el carrito
            cart_item = CartItem.query.filter_by(
                user_id=usuario.id,
                product_id=producto.id
            ).first()

            if cart_item:
                # Si ya existe, sumar la cantidad (sin exceder el stock total)
                nueva_cantidad = cart_item.quantity + cantidad_a_anadir
                if nueva_cantidad > producto.existencia:
                    nueva_cantidad = producto.existencia
                    warnings.append(f'La cantidad total de "{producto.nombre}" en el carrito se ajustó al stock disponible ({producto.existencia}).')
                cart_item.quantity = nueva_cantidad
                cart_item.updated_at = datetime.utcnow()
            else:
                # Si no existe, crear un nuevo item en el carrito
                cart_item = CartItem(
                    user_id=usuario.id,
                    product_id=producto.id,
                    quantity=cantidad_a_anadir
                )
                db.session.add(cart_item)
            
            products_added_to_cart = True # At least one product was added or updated

        db.session.commit()
        
        if not products_added_to_cart:
            # Consolidar advertencias en un solo mensaje si hay varias
            if warnings:
                consolidated_warnings = " ".join(warnings)
                return jsonify({
                    'success': False,
                    'message': 'No se pudo añadir ningún producto al carrito. ' + consolidated_warnings,
                    'open_cart': False,
                    'warnings': warnings # Mantener la lista para depuración si es necesario, pero el frontend usará el mensaje consolidado
                }), 400
            else:
                return jsonify({
                    'success': False,
                    'message': 'No se pudo añadir ningún producto al carrito.',
                    'open_cart': False,
                    'warnings': []
                }), 400
        else:
            # Consolidar advertencias en un solo mensaje si hay varias
            if warnings:
                consolidated_warnings = " ".join(warnings)
                return jsonify({
                    'success': True,
                    'message': consolidated_warnings,
                    'open_cart': False, # El usuario no quiere que se abra el carrito automáticamente
                    'warnings': warnings # Mantener la lista para depuración si es necesario
                })
            else:
                return jsonify({
                    'success': True,
                    'message': 'Productos añadidos al carrito exitosamente.',
                    'open_cart': False, # El usuario no quiere que se abra el carrito automáticamente
                    'warnings': []
                })

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al reordenar el pedido {order_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Ocurrió un error al intentar añadir los productos al carrito.'
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
        
@order_bp.route('/mis-compras')
@jwt_required
def view_compras(usuario):
    """Vista para que los clientes vean sus compras (pedidos completados)"""
    try:
        # Obtener parámetros de la URL
        page = request.args.get('page', 1, type=int)
        search = request.args.get('search', '')
        fecha_desde = request.args.get('fecha_desde', '')
        fecha_hasta = request.args.get('fecha_hasta', '')
        
        # Construir la consulta base, filtrando solo pedidos activos y completados
        query = Pedido.query.filter_by(
            usuario_id=usuario.id, 
            estado=EstadoEnum.ACTIVO.value,
            estado_pedido=EstadoPedido.COMPLETADO.value
        )
        
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
        
        # Ordenar por fecha descendente (más recientes primero)
        query = query.order_by(Pedido.created_at.desc())
        
        # Paginar los resultados (6 elementos por página)
        per_page = 6
        pedidos_paginados = query.paginate(page=page, per_page=per_page, error_out=False)
        pedidos = pedidos_paginados.items
        
        # Convertir a diccionarios para la vista
        pedidos_dict = []
        for pedido in pedidos:
            pedidos_dict.append(pedido_detalle_cliente_to_dict(pedido))
        
        return render_template('cliente/componentes/mis_compras.html', 
                               pedidos=pedidos_dict,
                               current_page=page,
                               total_pages=pedidos_paginados.pages,
                               total_items=pedidos_paginados.total)
    
    except Exception as e:
        current_app.logger.error(f"Error al cargar compras del usuario {usuario.id}: {str(e)}")
        return render_template('cliente/componentes/mis_compras.html', 
                               pedidos=[], 
                               error="Error al cargar tus compras. Por favor, intenta más tarde.")
        
@order_bp.route('/api/estadisticas-compras', methods=['GET'])
@jwt_required
def estadisticas_compras(usuario):
    """API para obtener estadísticas de compras para el gráfico de evolución"""
    try:
        # Obtener parámetros
        periodo = request.args.get('periodo', 'mes')  # mes, trimestre, año
        comparar = request.args.get('comparar', 'false') == 'true'  # si se compara con el período anterior
        fecha_desde = request.args.get('fecha_desde', '')
        fecha_hasta = request.args.get('fecha_hasta', '')

        # Construir la consulta base
        query = Pedido.query.filter_by(
            usuario_id=usuario.id,
            estado=EstadoEnum.ACTIVO.value,
            estado_pedido=EstadoPedido.COMPLETADO.value
        )

        # Aplicar filtros de fecha si se proporcionan
        if fecha_desde:
            fecha_desde_dt = datetime.strptime(fecha_desde, '%Y-%m-%d')
            query = query.filter(Pedido.created_at >= fecha_desde_dt)

        if fecha_hasta:
            fecha_hasta_dt = datetime.strptime(fecha_hasta, '%Y-%m-%d') + timedelta(days=1)
            query = query.filter(Pedido.created_at <= fecha_hasta_dt)

        # Obtener todos los pedidos que cumplen los filtros
        pedidos = query.all()

        # Función para agrupar por período
        def agrupar_por_periodo(pedidos, periodo):
            grupos = {}
            for pedido in pedidos:
                fecha = pedido.created_at
                if periodo == 'mes':
                    clave = (fecha.year, fecha.month)
                elif periodo == 'trimestre':
                    trimestre = (fecha.month - 1) // 3 + 1
                    clave = (fecha.year, trimestre)
                else:  # año
                    clave = fecha.year

                if clave not in grupos:
                    grupos[clave] = {'total': 0, 'count': 0}
                grupos[clave]['total'] += pedido.total
                grupos[clave]['count'] += 1

            return grupos

        # Agrupar los pedidos
        grupos_actuales = agrupar_por_periodo(pedidos, periodo)

        # Si se solicita comparar, obtenemos el período anterior
        grupos_anteriores = {}
        if comparar:
            # Calculamos el rango de fechas para el período anterior
            if fecha_desde and fecha_hasta:
                # Si se proporcionaron fechas, calculamos el mismo período del año anterior o el período anterior según la duración
                fecha_desde_dt = datetime.strptime(fecha_desde, '%Y-%m-%d')
                fecha_hasta_dt = datetime.strptime(fecha_hasta, '%Y-%m-%d') + timedelta(days=1)
                duracion = fecha_hasta_dt - fecha_desde_dt

                nueva_fecha_desde = fecha_desde_dt - duracion
                nueva_fecha_hasta = fecha_desde_dt

                query_anterior = Pedido.query.filter_by(
                    usuario_id=usuario.id,
                    estado=EstadoEnum.ACTIVO.value,
                    estado_pedido=EstadoPedido.COMPLETADO.value
                ).filter(
                    Pedido.created_at >= nueva_fecha_desde,
                    Pedido.created_at < nueva_fecha_hasta
                )
                pedidos_anteriores = query_anterior.all()
                grupos_anteriores = agrupar_por_periodo(pedidos_anteriores, periodo)
            else:
                # Si no se proporcionaron fechas, comparamos con el mismo período del año anterior
                query_anterior = Pedido.query.filter_by(
                    usuario_id=usuario.id,
                    estado=EstadoEnum.ACTIVO.value,
                    estado_pedido=EstadoPedido.COMPLETADO.value
                )

                # Ajustamos el filtro para el año anterior
                hoy = datetime.utcnow()
                if periodo == 'mes':
                    # Restar un año
                    query_anterior = query_anterior.filter(
                        db.extract('year', Pedido.created_at) == hoy.year - 1,
                        db.extract('month', Pedido.created_at) == hoy.month
                    )
                elif periodo == 'trimestre':
                    trimestre_actual = (hoy.month - 1) // 3 + 1
                    query_anterior = query_anterior.filter(
                        db.extract('year', Pedido.created_at) == hoy.year - 1,
                        db.extract('month', Pedido.created_at) >= (trimestre_actual - 1) * 3 + 1,
                        db.extract('month', Pedido.created_at) <= trimestre_actual * 3
                    )
                else:  # año
                    query_anterior = query_anterior.filter(
                        db.extract('year', Pedido.created_at) == hoy.year - 1
                    )

                pedidos_anteriores = query_anterior.all()
                grupos_anteriores = agrupar_por_periodo(pedidos_anteriores, periodo)

        # Preparar los datos para la respuesta
        datos_actuales = []
        datos_anteriores = []

        # Ordenar las claves
        claves_ordenadas = sorted(grupos_actuales.keys())

        for clave in claves_ordenadas:
            if periodo == 'mes':
                etiqueta = f"{clave[1]}/{clave[0]}"
            elif periodo == 'trimestre':
                etiqueta = f"T{clave[1]}/{clave[0]}"
            else:
                etiqueta = str(clave)

            datos_actuales.append({
                'periodo': etiqueta,
                'total': grupos_actuales[clave]['total'],
                'count': grupos_actuales[clave]['count']
            })

            if comparar and clave in grupos_anteriores:
                datos_anteriores.append({
                    'periodo': etiqueta,
                    'total': grupos_anteriores[clave]['total'],
                    'count': grupos_anteriores[clave]['count']
                })
            elif comparar:
                datos_anteriores.append({
                    'periodo': etiqueta,
                    'total': 0,
                    'count': 0
                })

        return jsonify({
            'success': True,
            'periodo': periodo,
            'datos_actuales': datos_actuales,
            'datos_anteriores': datos_anteriores if comparar else None
        })

    except Exception as e:
        current_app.logger.error(f"Error al obtener estadísticas de compras: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error al obtener estadísticas de compras'
        }), 500
        
@order_bp.route('/api/categorias-compras', methods=['GET'])
@jwt_required
def categorias_compras(usuario):
    """API para obtener estadísticas de categorías más compradas"""
    try:
        # Obtener parámetros
        estado_pedido = request.args.get('estado_pedido', 'completado')
        search = request.args.get('search', '')
        fecha_desde = request.args.get('fecha_desde', '')
        fecha_hasta = request.args.get('fecha_hasta', '')
        per_page = request.args.get('per_page', 1000, type=int)
        
        # Construir la consulta base
        query = Pedido.query.filter_by(
            usuario_id=usuario.id,
            estado=EstadoEnum.ACTIVO.value
        )
        
        # Aplicar filtro por estado de pedido
        if estado_pedido != 'todos':
            query = query.filter(Pedido.estado_pedido == estado_pedido)
        
        # Aplicar búsqueda si hay término de búsqueda
        if search:
            query = query.filter(Pedido.id.ilike(f'%{search}%'))
        
        # Aplicar filtros de fecha
        if fecha_desde:
            fecha_desde_dt = datetime.strptime(fecha_desde, '%Y-%m-%d')
            query = query.filter(Pedido.created_at >= fecha_desde_dt)
        
        if fecha_hasta:
            fecha_hasta_dt = datetime.strptime(fecha_hasta, '%Y-%m-%d') + timedelta(days=1)
            query = query.filter(Pedido.created_at <= fecha_hasta_dt)
        
        # Obtener todos los pedidos que cumplen los filtros
        pedidos = query.all()
        
        # Obtener detalles de todos los productos de los pedidos
        categorias_data = {}
        
        for pedido in pedidos:
            # Obtener detalles del pedido
            pedido_detalle = PedidoProducto.query.filter_by(pedido_id=pedido.id).all()
            
            for detalle in pedido_detalle:
                # Obtener información del producto
                producto = Productos.query.filter_by(id=detalle.producto_id).first()
                
                if producto and producto.seudocategoria:
                    # Obtener la categoría principal
                    seudocategoria = producto.seudocategoria
                    subcategoria = seudocategoria.subcategoria
                    categoria_principal = subcategoria.categoria_principal
                    
                    categoria_nombre = categoria_principal.nombre
                    
                    if categoria_nombre not in categorias_data:
                        categorias_data[categoria_nombre] = {
                            'total': 0,
                            'cantidad': 0,
                            'productos': set()
                        }
                    
                    categorias_data[categoria_nombre]['total'] += detalle.precio_unitario * detalle.cantidad
                    categorias_data[categoria_nombre]['cantidad'] += detalle.cantidad
                    categorias_data[categoria_nombre]['productos'].add(producto.id)
        
        # Convertir a lista para la respuesta
        categorias_lista = []
        for nombre, data in categorias_data.items():
            categorias_lista.append({
                'nombre': nombre,
                'total': data['total'],
                'cantidad': data['cantidad'],
                'productos_count': len(data['productos'])
            })
        
        return jsonify({
            'success': True,
            'categorias': categorias_lista
        })
    
    except Exception as e:
        current_app.logger.error(f"Error al obtener categorías de compras: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error al obtener categorías de compras'
        }), 500