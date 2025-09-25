"""
Módulo de Pedidos del Cliente.

Este blueprint gestiona todas las interacciones del cliente con sus pedidos pasados y presentes.
Sus responsabilidades incluyen:
- **Visualización de Pedidos**: Renderiza la página "Mis Pedidos" con filtros y paginación.
- **Detalle de Pedido**: Muestra una vista detallada de un pedido específico.
- **Reordenar**: Permite al usuario añadir los productos de un pedido anterior a su carrito actual.
- **Facturación**: Genera una vista de factura imprimible.
- **Estadísticas**: Proporciona endpoints de API para que el cliente visualice estadísticas
  sobre sus compras.
"""
# --- Importaciones de Flask y Librerías Estándar ---
from flask import Blueprint, request, jsonify, session, render_template, current_app, make_response, url_for
from datetime import datetime, timedelta

# --- Importaciones de Extensiones y Terceros ---
from sqlalchemy import not_, and_

# --- Importaciones Locales de la Aplicación ---
from app.models.domains.product_models import Productos, Seudocategorias, Subcategorias, CategoriasPrincipales
from app.models.domains.order_models import Pedido, PedidoProducto
from app.models.domains.cart_models import CartItem
from app.extensions import db
from app.models.enums import EstadoPedido, EstadoEnum
from app.utils.jwt_utils import jwt_required

order_bp = Blueprint('order', __name__)

# --- Importaciones de Serializadores ---
from app.models.serializers import pedido_detalle_cliente_to_dict

@order_bp.route('/mis-pedidos')
@jwt_required
def view_orders(usuario):
    """
    Renderiza la página "Mis Pedidos" para el cliente autenticado.

    Esta vista construye una consulta a la base de datos que recupera los pedidos del usuario,
    aplicando diversos filtros y opciones de ordenamiento proporcionados en la URL.
    También calcula totales para las pestañas de estado y maneja la paginación.

    Args:
        usuario (Usuarios): El objeto de usuario inyectado por el decorador `@jwt_required`.

    Returns:
        Response: La plantilla `mis_pedidos.html` renderizada con los datos de los pedidos.
    """
    try:
        # --- Obtención de Parámetros de Filtrado y Ordenamiento ---
        orden = request.args.get('orden', 'desc')  # desc para más recientes primero, asc para más antiguos primero
        search = request.args.get('search', '')
        page = request.args.get('page', 1, type=int)
        
        # Nuevos parámetros de filtrado
        fecha_desde = request.args.get('fecha_desde', '')
        fecha_hasta = request.args.get('fecha_hasta', '')
        monto_min = request.args.get('monto_min', 0, type=float)
        monto_max = request.args.get('monto_max', float('inf'), type=float)
        
        # --- Construcción de la Consulta ---
        # Inicia la consulta base, filtrando por el ID del usuario.
        query = Pedido.query.filter_by(usuario_id=usuario.id)
        
        # Lógica de negocio: Excluye pedidos 'en proceso' que un administrador haya desactivado,
        # ya que se consideran en un estado inconsistente o en revisión.
        query = query.filter(
            not_(
                and_(
                    Pedido.estado_pedido == EstadoPedido.EN_PROCESO,
                    Pedido.estado == EstadoEnum.INACTIVO
                )
            )
        )
        
        # Aplica el filtro principal por estado del pedido (pestañas).
        estado_pedido_filtro = request.args.get('estado_pedido', 'todos')
        if estado_pedido_filtro != 'todos':
            try:
                estado_enum = EstadoPedido(estado_pedido_filtro)
                query = query.filter(Pedido.estado_pedido == estado_enum)
            except ValueError:
                pass # Ignorar si el estado no es válido
        
        # Aplica el filtro de búsqueda por ID de pedido.
        if search:
            query = query.filter(Pedido.id.ilike(f'%{search}%'))
        
        # Aplica los filtros de rango de fechas.
        if fecha_desde:
            fecha_desde_dt = datetime.strptime(fecha_desde, '%Y-%m-%d')
            query = query.filter(Pedido.created_at >= fecha_desde_dt)
        
        if fecha_hasta:
            # Se suma un día para que la consulta incluya todo el día de la fecha final.
            fecha_hasta_dt = datetime.strptime(fecha_hasta, '%Y-%m-%d') + timedelta(days=1)
            query = query.filter(Pedido.created_at <= fecha_hasta_dt)
        
        # Aplica los filtros de rango de monto.
        query = query.filter(Pedido.total >= monto_min)
        if monto_max != float('inf'):
            query = query.filter(Pedido.total <= monto_max)
        
        # Aplica el ordenamiento solicitado por el usuario.
        if orden == 'asc':
            query = query.order_by(Pedido.created_at.asc())
        elif orden == 'monto-desc':
            query = query.order_by(Pedido.total.desc())
        elif orden == 'monto-asc':
            query = query.order_by(Pedido.total.asc())
        else:  # Por defecto, los más recientes primero.
            query = query.order_by(Pedido.created_at.desc())
        
        # --- Cálculos de Totales para la UI ---
        # Se obtienen los conteos totales por estado para mostrarlos en las pestañas.
        # Estas consultas se hacen por separado para no ser afectadas por los filtros de búsqueda.
        total_pedidos_en_proceso = Pedido.query.filter(Pedido.usuario_id==usuario.id, Pedido.estado==EstadoEnum.ACTIVO.value, Pedido.estado_pedido==EstadoPedido.EN_PROCESO).count()
        total_pedidos_completado = Pedido.query.filter(Pedido.usuario_id==usuario.id, Pedido.estado_pedido==EstadoPedido.COMPLETADO).count()
        total_pedidos_cancelado = Pedido.query.filter(Pedido.usuario_id==usuario.id, Pedido.estado_pedido==EstadoPedido.CANCELADO).count()
        total_pedidos_todos = total_pedidos_en_proceso + total_pedidos_completado + total_pedidos_cancelado

        # --- Paginación ---
        total_count = query.count()
        show_pagination = total_count > 6
        
        if not show_pagination:
            pedidos = query.all()
        else:
            per_page = 6
            pedidos_paginados = query.paginate(page=page, per_page=per_page, error_out=False)
            pedidos = pedidos_paginados.items
        
        # --- Serialización y Renderizado ---
        # Se convierten los objetos de pedido a diccionarios para pasarlos a la plantilla.
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
    """
    Endpoint de API para buscar y filtrar pedidos en tiempo real.

    Esta función es la contraparte de `view_orders` para peticiones AJAX.
    Realiza la misma lógica de filtrado y ordenamiento, pero devuelve los resultados
    en formato JSON para ser consumidos por JavaScript.
    """
    try:
        # La lógica de obtención de parámetros, construcción de consulta, filtrado y ordenamiento
        # es idéntica a la de la función `view_orders`.
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 6, type=int)  # Cambiado a 6 elementos por página
        orden = request.args.get('orden', 'desc')
        search = request.args.get('search', '')
        
        # Nuevos parámetros de filtrado
        fecha_desde = request.args.get('fecha_desde', '')
        fecha_hasta = request.args.get('fecha_hasta', '')
        monto_min = request.args.get('monto_min', 0, type=float)
        monto_max = request.args.get('monto_max', float('inf'), type=float)
        
        # Construir la consulta base
        query = Pedido.query.filter_by(usuario_id=usuario.id)
        
        # Excluir pedidos 'en proceso' que estén 'inactivos'
        query = query.filter(
            not_(
                and_(
                    Pedido.estado_pedido == EstadoPedido.EN_PROCESO,
                    Pedido.estado == EstadoEnum.INACTIVO
                )
            )
        )
        
        # Aplicar filtro por estado de pedido (ej. 'en proceso', 'completado') si se especifica
        estado_pedido_filtro = request.args.get('estado_pedido', 'todos')
        if estado_pedido_filtro != 'todos':
            try:
                estado_enum = EstadoPedido(estado_pedido_filtro)
                query = query.filter(Pedido.estado_pedido == estado_enum)
            except ValueError:
                pass # Ignorar si el estado no es válido
        
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
        total_pedidos_en_proceso = Pedido.query.filter(Pedido.usuario_id==usuario.id, Pedido.estado==EstadoEnum.ACTIVO.value, Pedido.estado_pedido==EstadoPedido.EN_PROCESO).count()
        total_pedidos_completado = Pedido.query.filter(Pedido.usuario_id==usuario.id, Pedido.estado_pedido==EstadoPedido.COMPLETADO).count()
        total_pedidos_cancelado = Pedido.query.filter(Pedido.usuario_id==usuario.id, Pedido.estado_pedido==EstadoPedido.CANCELADO).count()
        total_pedidos_todos = total_pedidos_en_proceso + total_pedidos_completado + total_pedidos_cancelado

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
        
        # Serializa los resultados a formato JSON para la respuesta de la API.
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
    """
    Renderiza la página de detalles para un pedido específico.

    Busca un pedido por su ID, asegurándose de que pertenezca al usuario autenticado.
    Maneja casos especiales, como pedidos inactivos, para proteger la información.
    Utiliza un serializador para preparar los datos para la plantilla.
    """
    try:
        # Busca el pedido por ID y usuario, sin filtrar por estado para que el cliente
        # pueda ver también sus pedidos completados y cancelados.
        pedido = Pedido.query.filter_by(
            id=str(order_id),
            usuario_id=usuario.id
        ).first()  # Quitamos el filtro por estado='activo'

        if not pedido:
            return render_template('cliente/componentes/404.html'), 404

        # Lógica de seguridad: Si un pedido está 'en proceso' pero fue desactivado por un administrador,
        # no debe ser accesible por el cliente.
        if pedido.estado_pedido == EstadoPedido.EN_PROCESO and pedido.estado == EstadoEnum.INACTIVO.value:
            current_app.logger.warning(f"Intento de acceso a pedido inactivo en proceso: {order_id} por usuario {usuario.id}")
            return render_template('cliente/componentes/404.html'), 404

        # Serializa el objeto Pedido a un diccionario para la plantilla.
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
    """
    Endpoint de API para obtener los detalles de un pedido específico en formato JSON.

    Utilizado por componentes de JavaScript para cargar dinámicamente la información
    de un pedido sin recargar la página.
    """
    try:
        pedido = Pedido.query.filter_by(
            id=str(order_id),
            usuario_id=usuario.id
        ).first()
        
        if not pedido:
            return jsonify({
                'success': False,
                'message': 'Pedido no encontrado'
            }), 404
        
        pedido_dict = pedido_detalle_cliente_to_dict(pedido)
        
        response_data = {'success': True}
        response_data.update(pedido_dict)
        
        return jsonify(response_data)

    except Exception as e:
        current_app.logger.error(f"Error al cargar detalles del pedido {order_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error al cargar los detalles del pedido'
        }), 500

@order_bp.route('/reordenar/<uuid:order_id>', methods=['POST'])
@jwt_required
def reorder_order(usuario, order_id):
    """
    Añade los productos de un pedido anterior al carrito del usuario actual.

    Esta función recorre los productos de un pedido histórico y los añade al carrito
    del usuario. Realiza validaciones importantes:
    - Verifica que el producto original todavía exista y esté activo.
    - Comprueba el stock disponible.
    - Ajusta la cantidad si el stock es insuficiente, generando una advertencia.
    - Actualiza la cantidad si el producto ya está en el carrito, o lo añade si es nuevo.
    """
    try:
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
        products_added_to_cart = False # Flag para rastrear si se añadió al menos un producto.

        # Itera sobre cada producto en el pedido original.
        for pp in pedido_original.productos:
            producto = pp.producto
            cantidad_solicitada = pp.cantidad

            # --- Validaciones de Producto y Stock ---
            if not producto:
                warnings.append(f'Un producto (ID: {pp.producto_id}) ya no está disponible o ha sido eliminado.')
                continue
            
            if producto.estado != EstadoEnum.ACTIVO:
                warnings.append(f'El producto "{producto.nombre}" está inactivo y no puede ser reordenado.')
                continue

            if producto.existencia <= 0:
                warnings.append(f'El producto "{producto.nombre}" no tiene stock disponible.')
                continue

            cantidad_a_anadir = cantidad_solicitada
            if producto.existencia < cantidad_solicitada:
                cantidad_a_anadir = producto.existencia
                warnings.append(f'Stock insuficiente para "{producto.nombre}". Se añadieron {cantidad_a_anadir} unidades.')

            # --- Lógica de Añadir/Actualizar Carrito ---
            # Busca si el producto ya existe en el carrito del usuario.
            cart_item = CartItem.query.filter_by(
                user_id=usuario.id,
                product_id=producto.id
            ).first()

            if cart_item:
                # Si ya existe, actualiza la cantidad, asegurando no exceder el stock.
                nueva_cantidad = cart_item.quantity + cantidad_a_anadir
                if nueva_cantidad > producto.existencia:
                    nueva_cantidad = producto.existencia
                    warnings.append(f'La cantidad total de "{producto.nombre}" en el carrito se ajustó al stock disponible ({producto.existencia}).')
                cart_item.quantity = nueva_cantidad
                cart_item.updated_at = datetime.utcnow()
            else:
                # Si no existe, crea un nuevo artículo en el carrito.
                cart_item = CartItem(
                    user_id=usuario.id,
                    product_id=producto.id,
                    quantity=cantidad_a_anadir
                )
                db.session.add(cart_item)
            
            products_added_to_cart = True

        db.session.commit()
        
        # --- Construcción de la Respuesta ---
        if not products_added_to_cart:
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
    """Función de utilidad para formatear un número al estilo de moneda colombiana."""
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
    """
    Genera una vista HTML con formato de factura para un pedido específico.

    Esta vista está diseñada para ser impresa o guardada como PDF desde el navegador.
    """
    try:
        pedido = Pedido.query.filter_by(
            id=str(order_id),
            usuario_id=usuario.id
        ).first()
        
        if not pedido:
            return render_template('cliente/componentes/404.html'), 404
        
        # Preparar los datos para la plantilla
        pedido_dict = pedido_detalle_cliente_to_dict(pedido)
        
        for item in pedido_dict['productos']:
            item['precio_unitario_formatted'] = format_number_colombian(item['precio_unitario'])
            item['subtotal_formatted'] = format_number_colombian(item['subtotal'])
        
        total_price_formatted = format_number_colombian(pedido.total)
        
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
    """
    Renderiza la página "Mis Compras", que es una vista filtrada de los pedidos completados.

    Es similar a `view_orders`, pero pre-filtra los pedidos para mostrar únicamente
    aquellos con estado `COMPLETADO`.
    """
    try:
        page = request.args.get('page', 1, type=int)
        search = request.args.get('search', '')
        fecha_desde = request.args.get('fecha_desde', '')
        fecha_hasta = request.args.get('fecha_hasta', '')
        
        # Construir la consulta base, filtrando pedidos completados (activos e inactivos)
        query = Pedido.query.filter_by(
            usuario_id=usuario.id
        )
        query = query.filter(Pedido.estado_pedido == EstadoPedido.COMPLETADO)
        
        if search:
            query = query.filter(Pedido.id.ilike(f'%{search}%'))
        
        if fecha_desde:
            fecha_desde_dt = datetime.strptime(fecha_desde, '%Y-%m-%d')
            query = query.filter(Pedido.created_at >= fecha_desde_dt)
        
        if fecha_hasta:
            fecha_hasta_dt = datetime.strptime(fecha_hasta, '%Y-%m-%d') + timedelta(days=1)
            query = query.filter(Pedido.created_at <= fecha_hasta_dt)
        
        # Ordena por defecto con las compras más recientes primero.
        query = query.order_by(Pedido.created_at.desc())
        
        # Pagina los resultados.
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
    """
    Endpoint de API para obtener estadísticas de compras del usuario.

    Calcula y agrupa los datos de compras (pedidos completados) por mes, trimestre o año.
    Permite la comparación con el período anterior para análisis de tendencias.
    """
    try:
        # Obtiene los parámetros para definir el rango y período de las estadísticas.
        periodo = request.args.get('periodo', 'mes')  # mes, trimestre, año
        comparar = request.args.get('comparar', 'false') == 'true'  # si se compara con el período anterior
        fecha_desde = request.args.get('fecha_desde', '')
        fecha_hasta = request.args.get('fecha_hasta', '')

        # Construir la consulta base
        query = Pedido.query.filter(Pedido.usuario_id == usuario.id)
        query = query.filter(Pedido.estado_pedido == EstadoPedido.COMPLETADO)

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

                query_anterior = Pedido.query.filter(
                    Pedido.usuario_id == usuario.id,
                    Pedido.estado_pedido == EstadoPedido.COMPLETADO,
                    Pedido.created_at >= nueva_fecha_desde,
                    Pedido.created_at < nueva_fecha_hasta
                )
                pedidos_anteriores = query_anterior.all()
                grupos_anteriores = agrupar_por_periodo(pedidos_anteriores, periodo)
            else:
                # Si no se proporcionaron fechas, comparamos con el mismo período del año anterior
                query_anterior = Pedido.query.filter(
                    Pedido.usuario_id == usuario.id,
                    Pedido.estado_pedido == EstadoPedido.COMPLETADO
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
    """
    Endpoint de API para obtener estadísticas de las categorías más compradas por el usuario.

    Analiza todos los pedidos del usuario (filtrados opcionalmente) y agrega las compras
    por categoría principal, calculando el total gastado, la cantidad de artículos y el
    número de productos únicos por categoría.
    """
    try:
        estado_pedido = request.args.get('estado_pedido', 'completado')
        search = request.args.get('search', '')
        fecha_desde = request.args.get('fecha_desde', '')
        fecha_hasta = request.args.get('fecha_hasta', '')
        per_page = request.args.get('per_page', 1000, type=int)
        
        # Construir la consulta base
        query = Pedido.query.filter_by(
            usuario_id=usuario.id
        )
        
        if estado_pedido != 'todos':
            try:
                estado_enum = EstadoPedido(estado_pedido)
                query = query.filter(Pedido.estado_pedido == estado_enum)
            except ValueError:
                pass # Ignorar si el estado no es válido
        
        if search:
            query = query.filter(Pedido.id.ilike(f'%{search}%'))
        
        if fecha_desde:
            fecha_desde_dt = datetime.strptime(fecha_desde, '%Y-%m-%d')
            query = query.filter(Pedido.created_at >= fecha_desde_dt)
        
        if fecha_hasta:
            fecha_hasta_dt = datetime.strptime(fecha_hasta, '%Y-%m-%d') + timedelta(days=1)
            query = query.filter(Pedido.created_at <= fecha_hasta_dt)
        
        pedidos = query.all()
        
        # Agrega los datos de los productos por categoría principal.
        categorias_data = {}
        
        for pedido in pedidos:
            pedido_detalle = PedidoProducto.query.filter_by(pedido_id=pedido.id).all()
            
            for detalle in pedido_detalle:
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
        
        # Convierte el diccionario agregado a una lista para la respuesta JSON.
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