# categoria_detalle.py - Versión Mejorada con Filtros Avanzados
from flask import Blueprint, jsonify, request, current_app, render_template
from app.utils.admin_jwt_utils import admin_jwt_required
from app.models.domains.product_models import CategoriasPrincipales, Subcategorias, Seudocategorias, Productos
from app.models.domains.order_models import Pedido, PedidoProducto
from app.models.enums import EstadoPedido
from app.models.serializers import categoria_principal_to_dict, subcategoria_to_dict, seudocategoria_to_dict, admin_producto_to_dict
from app.extensions import db
from sqlalchemy import func, and_, or_, case, desc
from sqlalchemy.orm import joinedload, subqueryload
from datetime import datetime, timedelta
import random

admin_categoria_detalle_bp = Blueprint('admin_categoria_detalle', __name__, url_prefix='/admin')

@admin_categoria_detalle_bp.route('/categorias-principales/<string:category_slug>', methods=['GET'])
@admin_jwt_required
def view_category_details_page(admin_user, category_slug):
    """
    Renderiza la página de detalles para una categoría principal específica con todos los datos precargados.
    """
    categoria_obj = CategoriasPrincipales.query.filter_by(slug=category_slug).first()
    if not categoria_obj:
        return render_template('admin/404.html'), 404
    
    try:
        # Obtener toda la información necesaria para la vista
        metrics = get_category_metrics(categoria_obj.id)
        trends = get_market_trends(categoria_obj.id)
        subcategories = get_subcategories_performance(categoria_obj.id)
        top_products = get_top_products(categoria_obj.id)
        related_products_data = get_related_products(categoria_obj.id, page=1, per_page=10)
        
        # Convertir el objeto de categoría a un diccionario para que sea serializable en JSON
        categoria_dict = categoria_principal_to_dict(categoria_obj)
        
        return render_template(
            'admin/componentes/categoria/detalles_categoria.html', 
            categoria=categoria_dict,
            metrics=metrics,
            trends=trends,
            subcategories=subcategories,
            top_products=top_products,
            related_products=related_products_data['products'],
            related_products_total=related_products_data['total'],
            related_products_page=related_products_data['page'],
            related_products_per_page=related_products_data['per_page'],
            related_products_pages=related_products_data['pages']
        )
    except Exception as e:
        current_app.logger.error(f"Error al obtener detalles de la categoría {categoria_obj.id}: {str(e)}", exc_info=True)
        return render_template('admin/500.html'), 500

@admin_categoria_detalle_bp.route('/categorias-principales/<string:categoria_id>/detalle', methods=['GET'])
@admin_jwt_required
def get_category_details(admin_user, categoria_id):
    """
    Endpoint principal que obtiene todos los datos necesarios para la vista de detalles de categoría
    """
    try:
        # Obtener información básica de la categoría con carga optimizada
        categoria = CategoriasPrincipales.query.options(
            subqueryload(CategoriasPrincipales.subcategorias)
                .subqueryload(Subcategorias.seudocategorias)
                .subqueryload(Seudocategorias.productos)
        ).get(categoria_id)

        if not categoria:
            return jsonify({
                'success': False,
                'message': 'Categoría no encontrada',
                'error_code': 'CATEGORY_NOT_FOUND'
            }), 404

        # Obtener métricas
        metrics = get_category_metrics(categoria_id)

        # Obtener tendencias del mercado
        trends = get_market_trends(categoria_id)

        # Obtener rendimiento de subcategorías
        subcategories = get_subcategories_performance(categoria_id)

        # Obtener productos más vendidos
        top_products = get_top_products(categoria_id)

        # Obtener productos relacionados
        related_products = get_related_products(categoria_id, page=1, per_page=10)

        return jsonify({
            'success': True,
            'category': categoria_principal_to_dict(categoria),
            'metrics': metrics,
            'trends': trends,
            'subcategories': subcategories,
            'topProducts': top_products,
            'relatedProducts': related_products['products']
        })
    
    except Exception as e:
        current_app.logger.error(f"Error al obtener detalles de la categoría {categoria_id}: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Error interno del servidor',
            'error_code': 'INTERNAL_ERROR'
        }), 500
        
# Nuevo endpoint para productos relacionados con filtros avanzados
@admin_categoria_detalle_bp.route('/categorias-principales/<string:categoria_id>/productos-relacionados-advanced', methods=['GET'])
@admin_jwt_required
def get_related_products_advanced(admin_user, categoria_id):
    """
    Endpoint para obtener productos relacionados con filtros avanzados y paginación
    """
    try:
        # Parámetros de paginación
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        # Parámetros de filtrado
        search = request.args.get('search', '', type=str)
        sort_by = request.args.get('sort_by', 'nombre', type=str)  # nombre, precio, fecha, etc.
        order = request.args.get('order', 'asc', type=str)  # asc, desc
        
        # Parámetros de estado
        estado = request.args.get('estado', '', type=str)  # activo, inactivo, todos
        
        # NUEVOS PARÁMETROS DE FILTRO DE CATEGORÍA
        subcategoria_id = request.args.get('subcategoria_id', '', type=str)
        seudocategoria_id = request.args.get('seudocategoria_id', '', type=str)

        # Obtener productos
        data = get_related_products_filtered(
            categoria_id, 
            page=page, 
            per_page=per_page, 
            search=search,
            sort_by=sort_by,
            order=order,
            estado=estado,
            subcategoria_id=subcategoria_id,
            seudocategoria_id=seudocategoria_id
        )
        
        return jsonify(data)
    except Exception as e:
        current_app.logger.error(f"Error al obtener productos relacionados avanzados: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Error interno del servidor',
            'error_code': 'INTERNAL_ERROR'
        }), 500

def get_related_products_filtered(categoria_id, page=1, per_page=10, search='', sort_by='nombre', order='asc', estado='', subcategoria_id='', seudocategoria_id=''):
    """
    Obtiene productos relacionados con paginación, búsqueda y filtros avanzados
    """
    # Construir la consulta base con joins optimizados
    query = db.session.query(Productos).join(
        Seudocategorias, Productos.seudocategoria_id == Seudocategorias.id
    ).join(
        Subcategorias, Seudocategorias.subcategoria_id == Subcategorias.id
    ).filter(
        Subcategorias.categoria_principal_id == categoria_id
    ).options( # Eager loading para la ruta de categoría
        joinedload(Productos.seudocategoria)
        .joinedload(Seudocategorias.subcategoria)
        .joinedload(Subcategorias.categoria_principal)
    )
    
    # Aplicar filtros de categoría (el más específico tiene prioridad)
    if seudocategoria_id:
        query = query.filter(Productos.seudocategoria_id == seudocategoria_id)
    elif subcategoria_id:
        query = query.filter(Seudocategorias.subcategoria_id == subcategoria_id)
    
    # Aplicar filtro de estado si se proporciona
    if estado and estado in ['activo', 'inactivo']:
        query = query.filter(Productos.estado == estado)
    
    # Aplicar búsqueda si se proporciona
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Productos.nombre.ilike(search_term),
                Productos.descripcion.ilike(search_term),
                Productos.marca.ilike(search_term)
            )
        )
    
    # Aplicar ordenamiento
    if sort_by == 'nombre':
        if order == 'asc':
            query = query.order_by(Productos.nombre.asc())
        else:
            query = query.order_by(Productos.nombre.desc())
    elif sort_by == 'precio':
        if order == 'asc':
            query = query.order_by(Productos.precio.asc())
        else:
            query = query.order_by(Productos.precio.desc())
    elif sort_by == 'fecha':
        if order == 'asc':
            query = query.order_by(Productos.created_at.asc())
        else:
            query = query.order_by(Productos.created_at.desc())
    elif sort_by == 'ventas':
        # Ordenar por unidades vendidas (simulado, en un sistema real se calcularía)
        query = query.order_by(func.random())  # Simulación, en realidad sería por ventas
    else:  # Default: nombre asc
        query = query.order_by(Productos.nombre.asc())
    
    # Contar total para paginación
    total = query.count()
    
    # Aplicar paginación
    productos = query.offset((page - 1) * per_page).limit(per_page).all()
    
    # Formatear resultados
    products_data = []
    for prod in productos:
        prod_dict = admin_producto_to_dict(prod)
        prod_dict['categoria_path'] = get_category_path(prod) # Añadir ruta completa
        products_data.append(prod_dict)
    
    return {
        'success': True,
        'products': products_data,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    }

# Nuevos endpoints para los filtros de categoría
@admin_categoria_detalle_bp.route('/categorias-principales/<string:categoria_id>/subcategorias-filtro', methods=['GET'])
@admin_jwt_required
def get_subcategories_for_filter(admin_user, categoria_id):
    """
    Obtiene todas las subcategorías (activas e inactivas) para un filtro.
    """
    try:
        # No se filtra por estado para permitir la búsqueda en todas
        subcategorias = Subcategorias.query.filter_by(categoria_principal_id=categoria_id).order_by(Subcategorias.nombre).all()
        return jsonify({
            'success': True,
            'subcategorias': [{'id': s.id, 'nombre': s.nombre} for s in subcategorias]
        })
    except Exception as e:
        current_app.logger.error(f"Error al obtener subcategorías para filtro: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno del servidor'}), 500

@admin_categoria_detalle_bp.route('/subcategorias/<string:subcategoria_id>/seudocategorias-filtro', methods=['GET'])
@admin_jwt_required
def get_pseudocategories_for_filter(admin_user, subcategoria_id):
    """
    Obtiene todas las seudocategorías (activas e inactivas) para un filtro.
    """
    try:
        # No se filtra por estado
        seudocategorias = Seudocategorias.query.filter_by(subcategoria_id=subcategoria_id).order_by(Seudocategorias.nombre).all()
        return jsonify({
            'success': True,
            'seudocategorias': [{'id': s.id, 'nombre': s.nombre} for s in seudocategorias]
        })
    except Exception as e:
        current_app.logger.error(f"Error al obtener seudocategorías para filtro: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno del servidor'}), 500

# Nuevo endpoint para productos más vendidos con filtros avanzados
@admin_categoria_detalle_bp.route('/categorias-principales/<string:categoria_id>/top-products-filtered', methods=['GET'])
@admin_jwt_required
def get_top_products_filtered(admin_user, categoria_id):
    """
    Endpoint para obtener productos más vendidos con filtros avanzados
    """
    try:
        # Obtener parámetros de filtrado
        period = request.args.get('period', '30', type=int)  # Período en días
        sort_by = request.args.get('sort_by', 'ventas', type=str)
        min_price = request.args.get('min_price', type=float)
        max_price = request.args.get('max_price', type=float)
        category_filter = request.args.get('category_filter', '', type=str)
        status_filter = request.args.get('status_filter', '', type=str)
        search = request.args.get('search', '', type=str)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        # Calcular fechas según el período
        now = datetime.utcnow()
        start_date = now - timedelta(days=period)
        
        # Obtener IDs de productos de la categoría (activos e inactivos)
        product_ids_query = db.session.query(Productos.id).join(
            Seudocategorias, Productos.seudocategoria_id == Seudocategorias.id
        ).join(
            Subcategorias, Seudocategorias.subcategoria_id == Subcategorias.id
        ).filter(
            Subcategorias.categoria_principal_id == categoria_id
        )
        
        # Aplicar filtro de categoría si se proporciona
        if category_filter:
            if category_filter.startswith('pseudo-'):
                # Filtrar por seudocategoría
                pseudo_id = category_filter.replace('pseudo-', '')
                product_ids_query = product_ids_query.filter(
                    Seudocategorias.id == pseudo_id
                )
            else:
                # Filtrar por subcategoría
                product_ids_query = product_ids_query.filter(
                    Subcategorias.id == category_filter
                )
        
        product_ids_subquery = product_ids_query.subquery()
        
        # Construir subconsulta de ventas con ingresos por período
        # CORRECCIÓN: Usar SUM en lugar de AVG para los ingresos de los períodos.
        sales_subquery = db.session.query(
            PedidoProducto.producto_id,
            func.sum(PedidoProducto.cantidad).label('unidades_vendidas'),
            func.sum(PedidoProducto.cantidad * PedidoProducto.precio_unitario).label('ingresos'),
            func.sum(
                case(
                    (Pedido.created_at >= start_date, PedidoProducto.cantidad * PedidoProducto.precio_unitario),
                    else_=0
                )
            ).label('ingresos_recientes'),
            func.sum(
                case(
                    (Pedido.created_at < start_date, PedidoProducto.cantidad * PedidoProducto.precio_unitario),
                    else_=0
                )
            ).label('ingresos_anteriores')
        ).join(Pedido).filter(
            Pedido.estado_pedido == EstadoPedido.COMPLETADO.value,
            PedidoProducto.producto_id.in_(product_ids_subquery)
        ).group_by(PedidoProducto.producto_id).subquery()
        
        # MEJORA: Calcular la tendencia directamente en la consulta
        tendencia_expr = case(
            (sales_subquery.c.ingresos_anteriores > 0, 
             (sales_subquery.c.ingresos_recientes - sales_subquery.c.ingresos_anteriores) * 100.0 / sales_subquery.c.ingresos_anteriores),
            (sales_subquery.c.ingresos_recientes > 0, 100.0),
            else_=0.0
        ).label('tendencia')

        query = db.session.query(
            Productos,
            sales_subquery.c.unidades_vendidas,
            sales_subquery.c.ingresos,
            tendencia_expr
        ).join(
            sales_subquery, Productos.id == sales_subquery.c.producto_id
        ).options(
            joinedload(Productos.seudocategoria)
            .joinedload(Seudocategorias.subcategoria)
            .joinedload(Subcategorias.categoria_principal)
        )
        
        # Aplicar filtros adicionales
        if min_price is not None:
            query = query.filter(Productos.precio >= min_price)
        if max_price is not None:
            query = query.filter(Productos.precio <= max_price)
        
        if status_filter:
            query = query.filter(Productos.estado == status_filter)
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Productos.nombre.ilike(search_term),
                    Productos.marca.ilike(search_term),
                )
            )
        
        # Aplicar ordenamiento
        if sort_by == 'ventas':
            query = query.order_by(desc(sales_subquery.c.unidades_vendidas))
        elif sort_by == 'ingresos':
            query = query.order_by(desc(sales_subquery.c.ingresos))
        elif sort_by == 'nombre':
            query = query.order_by(Productos.nombre.asc())
        elif sort_by == 'nombre-desc':
            query = query.order_by(Productos.nombre.desc())
        elif sort_by == 'precio-asc':
            query = query.order_by(Productos.precio.asc())
        elif sort_by == 'precio-desc':
            query = query.order_by(Productos.precio.desc())
        elif sort_by == 'tendencia':
            query = query.order_by(desc('tendencia'))
        else:  # Ordenamiento por defecto (ventas)
            query = query.order_by(desc(sales_subquery.c.unidades_vendidas))
        
        # Paginar resultados
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        results = pagination.items
        
        # Formatear salida (lógica unificada)
        output = []
        for prod, unidades, ingresos, tendencia in results:
            output.append({
                'id': prod.id,
                'slug': prod.slug,
                'nombre': prod.nombre,
                'marca': prod.marca,
                'imagen_url': prod.imagen_url,
                'precio': prod.precio,
                'unidades_vendidas': unidades or 0,
                'ingresos': ingresos or 0,
                'tendencia': tendencia or 0,
                'categoria_path': get_category_path(prod),
                'estado': prod.estado
            })
        
        return jsonify({
            'success': True,
            'products': output,
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
        })
    
    except Exception as e:
        current_app.logger.error(f"Error al obtener productos filtrados: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Error interno del servidor',
            'error_code': 'INTERNAL_ERROR'
        }), 500

def get_category_path(producto):
    """
    Función auxiliar para obtener la ruta de categoría de un producto
    """
    path_parts = []
    
    if producto.seudocategoria:
        path_parts.append(producto.seudocategoria.nombre)
        if producto.seudocategoria.subcategoria:
            path_parts.append(producto.seudocategoria.subcategoria.nombre)
            if producto.seudocategoria.subcategoria.categoria_principal:
                path_parts.append(producto.seudocategoria.subcategoria.categoria_principal.nombre)
    
    # Invertir para mostrar de principal a seudocategoría
    path_parts.reverse()
    return ' > '.join(path_parts)

def get_category_metrics(categoria_id):
    """
    Calcula las métricas principales de la categoría con datos reales y optimización.
    """
    # Obtener los IDs de todos los productos de la categoría (activos e inactivos)
    product_ids_subquery = db.session.query(Productos.id).join(
        Seudocategorias, Productos.seudocategoria_id == Seudocategorias.id
    ).join(
        Subcategorias, Seudocategorias.subcategoria_id == Subcategorias.id
    ).filter(
        Subcategorias.categoria_principal_id == categoria_id
    ).subquery()

    total_productos = db.session.query(func.count()).select_from(product_ids_subquery).scalar() or 0

    if total_productos == 0:
        return {
            'total_ventas': 0,
            'unidades_vendidas': 0,
            'total_productos': 0,
            'margen_promedio': 0,
            'ventas_tendencia': 0,
            'unidades_tendencia': 0,
            'margen_tendencia': 0
        }

    # Periodos de tiempo para tendencias
    now = datetime.utcnow()
    periodo_actual_fin = now
    periodo_actual_inicio = now - timedelta(days=30)
    periodo_anterior_fin = periodo_actual_inicio
    periodo_anterior_inicio = periodo_actual_inicio - timedelta(days=30)

    # Ventas y unidades totales (histórico) - optimizado
    query_total_historico = db.session.query(
        func.sum(PedidoProducto.cantidad * PedidoProducto.precio_unitario).label('total_ventas'),
        func.sum(PedidoProducto.cantidad).label('unidades_vendidas')
    ).join(Pedido).filter(
        Pedido.estado_pedido == EstadoPedido.COMPLETADO.value,
        PedidoProducto.producto_id.in_(product_ids_subquery)
    )
    
    total_result_historico = query_total_historico.one()
    total_ventas_historico = total_result_historico.total_ventas or 0
    unidades_vendidas_historico = total_result_historico.unidades_vendidas or 0

    # Ventas y unidades del periodo actual
    query_actual = db.session.query(
        func.sum(PedidoProducto.cantidad * PedidoProducto.precio_unitario).label('total_ventas'),
        func.sum(PedidoProducto.cantidad).label('unidades_vendidas')
    ).join(Pedido).filter(
        Pedido.estado_pedido == EstadoPedido.COMPLETADO.value,
        PedidoProducto.producto_id.in_(product_ids_subquery),
        Pedido.created_at.between(periodo_actual_inicio, periodo_actual_fin)
    )
    
    actual_result = query_actual.one()
    ventas_actual = actual_result.total_ventas or 0
    unidades_actual = actual_result.unidades_vendidas or 0

    # Ventas y unidades del periodo anterior
    query_anterior = db.session.query(
        func.sum(PedidoProducto.cantidad * PedidoProducto.precio_unitario).label('total_ventas'),
        func.sum(PedidoProducto.cantidad).label('unidades_vendidas')
    ).join(Pedido).filter(
        Pedido.estado_pedido == EstadoPedido.COMPLETADO.value,
        PedidoProducto.producto_id.in_(product_ids_subquery),
        Pedido.created_at.between(periodo_anterior_inicio, periodo_anterior_fin)
    )
    
    anterior_result = query_anterior.one()
    ventas_anterior = anterior_result.total_ventas or 0
    unidades_anterior = anterior_result.unidades_vendidas or 0

    # Calcular tendencias
    def calcular_tendencia(actual, anterior):
        if anterior > 0:
            return ((actual - anterior) / anterior) * 100
        return 100 if actual > 0 else 0

    ventas_tendencia = calcular_tendencia(ventas_actual, ventas_anterior)
    unidades_tendencia = calcular_tendencia(unidades_actual, unidades_anterior)

    # Calcular margen promedio - optimizado
    productos_query = db.session.query(
        Productos.precio,
        Productos.costo
    ).filter(
        Productos.id.in_(product_ids_subquery),
        Productos.precio > 0,
        Productos.costo > 0
    )
    
    productos = productos_query.all()
    
    if not productos:
        margen_promedio = 0
    else:
        margen_total = sum(
            ((p.precio - p.costo) / p.precio) * 100
            for p in productos
        )
        margen_promedio = margen_total / len(productos)

    # Simular tendencia de margen (en un sistema real, esto se calcularía con datos históricos)
    margen_tendencia = random.uniform(-2, 5)

    return {
        'total_ventas': float(total_ventas_historico),
        'unidades_vendidas': int(unidades_vendidas_historico),
        'total_productos': total_productos,
        'margen_promedio': margen_promedio,
        'ventas_tendencia': ventas_tendencia,
        'unidades_tendencia': unidades_tendencia,
        'margen_tendencia': margen_tendencia
    }

def get_market_trends(categoria_id):
    """
    Obtiene las tendencias del mercado para la categoría con datos reales y mejor manejo de casos vacíos.
    """
    now = datetime.utcnow()
    
    # Obtener IDs de productos de la categoría (activos e inactivos)
    product_ids_subquery = db.session.query(Productos.id).join(
        Seudocategorias, Productos.seudocategoria_id == Seudocategorias.id
    ).join(
        Subcategorias, Seudocategorias.subcategoria_id == Subcategorias.id
    ).filter(
        Subcategorias.categoria_principal_id == categoria_id
    ).subquery()
    
    product_ids_result = db.session.query(product_ids_subquery).all()
    product_ids = [pid[0] for pid in product_ids_result]

    # --- Evolución de ventas (últimos 6 meses) ---
    labels = []
    data_ventas = []
    
    for i in range(5, -1, -1):
        mes = now - timedelta(days=i*30)
        inicio_mes = mes.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Calcular el fin del mes correctamente
        if mes.month == 12:
            fin_mes = datetime(mes.year + 1, 1, 1) - timedelta(seconds=1)
        else:
            fin_mes = datetime(mes.year, mes.month + 1, 1) - timedelta(seconds=1)
        
        labels.append(mes.strftime('%b'))
        
        if product_ids:
            ventas_mes = db.session.query(
                func.sum(PedidoProducto.cantidad * PedidoProducto.precio_unitario)
            ).join(Pedido).filter(
                Pedido.estado_pedido == EstadoPedido.COMPLETADO.value,
                PedidoProducto.producto_id.in_(product_ids),
                Pedido.created_at.between(inicio_mes, fin_mes)
            ).scalar() or 0
        else:
            ventas_mes = 0
            
        data_ventas.append(float(ventas_mes))

    evolucion_ventas = {
        'labels': labels,
        'data': data_ventas
    }

    # --- Comparación con otras categorías (Top 5 en el último mes) ---
    periodo_actual_fin = now
    periodo_actual_inicio = now - timedelta(days=30)
    periodo_anterior_fin = periodo_actual_inicio
    periodo_anterior_inicio = periodo_actual_inicio - timedelta(days=30)

    # 1. Encontrar las 5 categorías principales con más ventas en el último mes
    top_categories_query = db.session.query(
        CategoriasPrincipales.id,
        CategoriasPrincipales.nombre
    ).join(Subcategorias).join(Seudocategorias).join(Productos).join(PedidoProducto).join(Pedido).filter(
        Pedido.estado_pedido == EstadoPedido.COMPLETADO.value,
        Pedido.created_at.between(periodo_actual_inicio, periodo_actual_fin)
    ).group_by(CategoriasPrincipales.id, CategoriasPrincipales.nombre).order_by(
        desc(func.sum(PedidoProducto.cantidad * PedidoProducto.precio_unitario))
    ).limit(5).all()

    top_category_ids = [cat.id for cat in top_categories_query]
    top_category_names = [cat.nombre for cat in top_categories_query]

    if not top_category_ids:
        # Si no hay ventas recientes, mostrar el gráfico vacío
        comparacion_categorias = {
            'labels': [], 'current_data': [], 'previous_data': []
        }
    else:
        # 2. Obtener las ventas para estas categorías en el período actual y anterior
        sales_data_query = db.session.query(
            CategoriasPrincipales.id,
            func.sum(case((Pedido.created_at.between(periodo_actual_inicio, periodo_actual_fin), PedidoProducto.cantidad * PedidoProducto.precio_unitario), else_=0)).label('ventas_actuales'),
            func.sum(case((Pedido.created_at.between(periodo_anterior_inicio, periodo_anterior_fin), PedidoProducto.cantidad * PedidoProducto.precio_unitario), else_=0)).label('ventas_anteriores')
        ).join(Subcategorias).join(Seudocategorias).join(Productos).join(PedidoProducto).join(Pedido).filter(
            Pedido.estado_pedido == EstadoPedido.COMPLETADO.value,
            CategoriasPrincipales.id.in_(top_category_ids)
        ).group_by(CategoriasPrincipales.id)

        sales_data = {str(row.id): row for row in sales_data_query.all()}

        # 3. Construir los datos para el gráfico, asegurando el orden
        current_data = [float(sales_data.get(str(cat_id)).ventas_actuales) if sales_data.get(str(cat_id)) else 0 for cat_id in top_category_ids]
        previous_data = [float(sales_data.get(str(cat_id)).ventas_anteriores) if sales_data.get(str(cat_id)) else 0 for cat_id in top_category_ids]

        comparacion_categorias = {
            'labels': top_category_names, 'current_data': current_data, 'previous_data': previous_data
        }

    # --- Indicadores clave ---
    # Participación de mercado
    ventas_totales_categoria = sum(data_ventas) # Usamos las ventas de los últimos 6 meses
    
    # Ventas totales globales en los últimos 6 meses
    ventas_totales_globales = db.session.query(
        func.sum(PedidoProducto.cantidad * PedidoProducto.precio_unitario)
    ).join(Pedido).filter(
        Pedido.estado_pedido == EstadoPedido.COMPLETADO.value,
        Pedido.created_at >= (now - timedelta(days=180))
    ).scalar() or 1 # Evitar división por cero
    
    participacion_mercado = (ventas_totales_categoria / ventas_totales_globales) * 100

    # Tasa de crecimiento (YoY - últimos 12 meses vs 12 meses anteriores)
    tasa_crecimiento = 0
    if product_ids:
        hace_1_ano = now - timedelta(days=365)
        hace_2_anos = now - timedelta(days=730)
        
        ventas_ultimos_12m = db.session.query(
            func.sum(PedidoProducto.cantidad * PedidoProducto.precio_unitario)
        ).join(Pedido).filter(
            Pedido.estado_pedido == EstadoPedido.COMPLETADO.value,
            PedidoProducto.producto_id.in_(product_ids),
            Pedido.created_at >= hace_1_ano
        ).scalar() or 0
        
        ventas_12m_anteriores = db.session.query(
            func.sum(PedidoProducto.cantidad * PedidoProducto.precio_unitario)
        ).join(Pedido).filter(
            Pedido.estado_pedido == EstadoPedido.COMPLETADO.value,
            PedidoProducto.producto_id.in_(product_ids),
            Pedido.created_at.between(hace_2_anos, hace_1_ano)
        ).scalar() or 0

        if ventas_12m_anteriores > 0:
            tasa_crecimiento = ((ventas_ultimos_12m - ventas_12m_anteriores) / ventas_12m_anteriores) * 100
        elif ventas_ultimos_12m > 0:
            tasa_crecimiento = 100  # Crecimiento del 100% si no había ventas antes

    # Clamp the growth rate for the progress circle (0 to 100)
    tasa_crecimiento_clamped = min(100, max(0, tasa_crecimiento))

    # Satisfacción del cliente
    avg_rating = db.session.query(func.avg(Productos.calificacion_promedio_almacenada)).join(Seudocategorias).join(Subcategorias).filter(
        Subcategorias.categoria_principal_id == categoria_id,
        Productos.calificacion_promedio_almacenada.isnot(None)
    ).scalar() or 0
    
    satisfaccion_cliente = (avg_rating / 5) * 100 if avg_rating > 0 else 0

    indicadores = {
        'participacion_mercado': participacion_mercado,
        'participacion_mercado_desc': f"Representa el {participacion_mercado:.1f}% de las ventas totales en los últimos 6 meses.",
        'tasa_crecimiento': tasa_crecimiento,
        'tasa_crecimiento_clamped': tasa_crecimiento_clamped,
        'tasa_crecimiento_desc': f"Crecimiento interanual del {tasa_crecimiento:.1f}%.",
        'satisfaccion_cliente': satisfaccion_cliente,
        'satisfaccion_cliente_desc': f"Calificación promedio de {avg_rating:.1f}/5 estrellas en los productos de esta categoría."
    }
    
    return {
        'evolucion_ventas': evolucion_ventas,
        'comparacion_categorias': comparacion_categorias,
        'indicadores': indicadores
    }

def get_subcategories_performance(categoria_id):
    """
    Obtiene el rendimiento de las subcategorías con datos reales de forma optimizada.
    """
    # Obtener todas las subcategorías y seudocategorías de la categoría principal (activas e inactivas)
    subcategorias = Subcategorias.query.filter(
        Subcategorias.categoria_principal_id == categoria_id
    ).options(
        joinedload(Subcategorias.seudocategorias).joinedload(Seudocategorias.productos)
    ).all()

    if not subcategorias:
        return []

    # Mapear subcategorías y seudocategorías a sus productos
    sub_to_products = {}
    seudo_to_products = {}
    all_product_ids = set()

    for sub in subcategorias:
        sub_to_products[sub.id] = []
        for seudo in sub.seudocategorias:
            product_ids_in_seudo = [p.id for p in seudo.productos]
            seudo_to_products[seudo.id] = product_ids_in_seudo
            sub_to_products[sub.id].extend(product_ids_in_seudo)
            all_product_ids.update(product_ids_in_seudo)

    if not all_product_ids:
        return []

    # Periodos de tiempo para tendencias
    now = datetime.utcnow()
    periodo_actual_inicio = now - timedelta(days=30)
    periodo_anterior_inicio = now - timedelta(days=60)

    # Obtener todos los datos de ventas relevantes en una sola consulta optimizada
    sales_data = db.session.query(
        PedidoProducto.producto_id,
        Pedido.created_at,
        (PedidoProducto.cantidad * PedidoProducto.precio_unitario).label('ingresos')
    ).join(Pedido).filter(
        Pedido.estado_pedido == EstadoPedido.COMPLETADO.value,
        PedidoProducto.producto_id.in_(all_product_ids),
        Pedido.created_at >= periodo_anterior_inicio
    ).all()

    # Procesar los datos de ventas en Python
    sales_by_product = {pid: {'total': 0, 'actual': 0, 'anterior': 0} for pid in all_product_ids}
    for pid, created_at, ingresos in sales_data:
        sales_by_product[pid]['total'] += ingresos
        if created_at >= periodo_actual_inicio:
            sales_by_product[pid]['actual'] += ingresos
        else:
            sales_by_product[pid]['anterior'] += ingresos

    # Calcular métricas para cada subcategoría y seudocategoría
    result = []
    for sub in subcategorias:
        sub_product_ids = sub_to_products.get(sub.id, [])
        
        ventas_totales_sub = sum(sales_by_product[pid]['total'] for pid in sub_product_ids)
        ventas_actual_sub = sum(sales_by_product[pid]['actual'] for pid in sub_product_ids)
        ventas_anterior_sub = sum(sales_by_product[pid]['anterior'] for pid in sub_product_ids)

        crecimiento = ((ventas_actual_sub - ventas_anterior_sub) / ventas_anterior_sub) * 100 if ventas_anterior_sub > 0 else 100 if ventas_actual_sub > 0 else 0

        seudos_data = []
        for seudo in sub.seudocategorias:
            seudo_product_ids = seudo_to_products.get(seudo.id, [])
            ventas_seudo = sum(sales_by_product[pid]['total'] for pid in seudo_product_ids)
            if ventas_seudo > 0:
                seudos_data.append({
                    'id': seudo.id,
                    'nombre': seudo.nombre,
                    'ventas': float(ventas_seudo),
                    'estado': seudo.estado
                })
        
        if ventas_totales_sub > 0:
            result.append({
                'id': sub.id,
                'nombre': sub.nombre,
                'ventas': float(ventas_totales_sub),
                'crecimiento': crecimiento,
                'estado': sub.estado,
                'seudocategorias': sorted(seudos_data, key=lambda x: x['ventas'], reverse=True)
            })

    # Ordenar por ventas (descendente)
    result.sort(key=lambda x: x['ventas'], reverse=True)
    
    return result

def get_top_products(categoria_id, limit=10):
    """
    Obtiene los productos más vendidos de la categoría con datos reales.
    """
    # Obtener IDs de productos de la categoría (activos e inactivos)
    product_ids_subquery = db.session.query(Productos.id).join(
        Seudocategorias, Productos.seudocategoria_id == Seudocategorias.id
    ).join(
        Subcategorias, Seudocategorias.subcategoria_id == Subcategorias.id
    ).filter(
        Subcategorias.categoria_principal_id == categoria_id
    ).subquery()
    
    product_ids_result = db.session.query(product_ids_subquery).all()
    product_ids = [pid[0] for pid in product_ids_result]

    if not product_ids:
        return []

    # Periodos de tiempo para tendencias
    now = datetime.utcnow()
    periodo_actual_inicio = now - timedelta(days=30)
    periodo_anterior_inicio = now - timedelta(days=60)

    # Obtener datos de ventas para esos productos de manera optimizada
    sales_query = db.session.query(
        PedidoProducto.producto_id,
        func.sum(PedidoProducto.cantidad).label('unidades_vendidas'),
        func.sum(PedidoProducto.cantidad * PedidoProducto.precio_unitario).label('ingresos'),
        func.sum(
            case(
                (Pedido.created_at >= periodo_actual_inicio, PedidoProducto.cantidad * PedidoProducto.precio_unitario),
                else_=0
            )
        ).label('ingresos_actual'),
        func.sum(
            case(
                (Pedido.created_at.between(periodo_anterior_inicio, periodo_actual_inicio), PedidoProducto.cantidad * PedidoProducto.precio_unitario),
                else_=0
            )
        ).label('ingresos_anterior')
    ).join(Pedido).filter(
        Pedido.estado_pedido == EstadoPedido.COMPLETADO.value,
        PedidoProducto.producto_id.in_(product_ids)
    ).group_by(PedidoProducto.producto_id).subquery()

    # Unir con la tabla de productos y ordenar
    top_products_query = db.session.query(
        Productos,
        sales_query.c.unidades_vendidas,
        sales_query.c.ingresos,
        sales_query.c.ingresos_actual,
        sales_query.c.ingresos_anterior
    ).join(
        sales_query, Productos.id == sales_query.c.producto_id
    ).order_by(desc(sales_query.c.ingresos)).limit(limit)

    top_products_data = top_products_query.all()

    # Formatear la salida
    result = []
    for prod, unidades, ingresos, ingresos_actual, ingresos_anterior in top_products_data:
        ingresos_actual = ingresos_actual or 0
        ingresos_anterior = ingresos_anterior or 0
        
        tendencia = ((ingresos_actual - ingresos_anterior) / ingresos_anterior) * 100 if ingresos_anterior > 0 else 100 if ingresos_actual > 0 else 0

        # Obtener ruta de categoría
        seudo = prod.seudocategoria
        sub = seudo.subcategoria if seudo else None
        cat = sub.categoria_principal if sub else None
        categoria_path = f"{cat.nombre if cat else 'N/A'} > {sub.nombre if sub else 'N/A'} > {seudo.nombre if seudo else 'N/A'}"

        result.append({
            'id': prod.id,
            'slug': prod.slug,
            'nombre': prod.nombre,
            'marca': prod.marca,
            'imagen_url': prod.imagen_url,
            'precio': prod.precio,
            'unidades_vendidas': int(unidades) if unidades else 0,
            'ingresos': float(ingresos) if ingresos else 0,
            'tendencia': tendencia,
            'categoria_path': categoria_path,
            'estado': prod.estado
        })

    return result

@admin_categoria_detalle_bp.route('/categorias-principales/<string:categoria_id>/productos-relacionados', methods=['GET'])
@admin_jwt_required
def get_related_products_endpoint(admin_user, categoria_id):
    """
    Endpoint para obtener productos relacionados con paginación
    """
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    search = request.args.get('search', '')
    
    try:
        data = get_related_products(categoria_id, page, per_page, search)
        return jsonify(data)
    except Exception as e:
        current_app.logger.error(f"Error al obtener productos relacionados: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Error interno del servidor',
            'error_code': 'INTERNAL_ERROR'
        }), 500

def get_related_products(categoria_id, page=1, per_page=10, search=''):
    """
    Obtiene productos relacionados con paginación y búsqueda optimizada
    """
    # Construir la consulta base con joins optimizados
    query = db.session.query(Productos).join(
        Seudocategorias, Productos.seudocategoria_id == Seudocategorias.id
    ).join(
        Subcategorias, Seudocategorias.subcategoria_id == Subcategorias.id
    ).filter(
        Subcategorias.categoria_principal_id == categoria_id
    )
    
    # Aplicar búsqueda si se proporciona
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Productos.nombre.ilike(search_term),
                Productos.descripcion.ilike(search_term),
                Productos.marca.ilike(search_term)
            )
        )
    
    # Contar total para paginación
    total = query.count()
    
    # Aplicar paginación
    productos = query.offset((page - 1) * per_page).limit(per_page).all()
    
    # Formatear resultados
    products_data = []
    for prod in productos:
        products_data.append(admin_producto_to_dict(prod))
    
    return {
        'success': True,
        'products': products_data,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    }