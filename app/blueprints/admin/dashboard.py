from flask import Blueprint, render_template, request, jsonify, current_app
from app.utils.admin_jwt_utils import admin_jwt_required
from app.models.domains.user_models import Usuarios
from app.models.domains.product_models import Productos, Subcategorias, Seudocategorias, CategoriasPrincipales
from app.models.domains.order_models import Pedido, PedidoProducto
from app.models.enums import EstadoPedido
from app.extensions import db
from sqlalchemy import func, or_
from flask_wtf.csrf import generate_csrf
from datetime import datetime, timedelta

admin_dashboard_bp = Blueprint('admin_dashboard_bp', __name__)

@admin_dashboard_bp.route('/admin/dashboard')
@admin_jwt_required
def dashboard(admin_user):
    """
    Renderiza la página principal del dashboard.

    Esta función actúa como el punto de entrada para el dashboard. Renderiza la
    plantilla HTML que luego utilizará JavaScript para cargar los datos dinámicamente.

    Args:
        admin_user: El objeto del administrador autenticado (inyectado por el decorador).

    Returns:
        Response: La plantilla `dashboard.html` renderizada.
    """
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    return render_template('admin/componentes/dashboard.html',
                           admin_user=admin_user,
                           csrf_token=generate_csrf(),
                           is_ajax=is_ajax)

@admin_dashboard_bp.route('/admin/api/dashboard-stats', methods=['GET'])
@admin_jwt_required
def get_dashboard_stats(admin_user):
    """
    API para obtener todas las estadísticas y datos para el dashboard.

    Este endpoint centraliza el cálculo de todas las métricas necesarias para el
    dashboard, permitiendo que el frontend lo actualice con una sola llamada.

    Query Params:
        period (str): El período de tiempo para los cálculos ('7d', '30d', '90d', '1y').
                      Default: '30d'.

    Returns:
        JSON: Un objeto con todas las estadísticas y datos para los gráficos.
    """
    try:
        period = request.args.get('period', '30d')
        current_app.logger.info(f"Dashboard stats requested for period: {period}")
        end_date = datetime.utcnow()

        if period == '7d':
            start_date = end_date - timedelta(days=7)
            date_trunc_format = 'day'
        elif period == '90d':
            start_date = end_date - timedelta(days=90)
            date_trunc_format = 'week'
        elif period == '1y':
            start_date = end_date - timedelta(days=365)
            date_trunc_format = 'month'
        else:  # '30d' por defecto
            start_date = end_date - timedelta(days=30)
            date_trunc_format = 'day'
        
        # MEJORA PROFESIONAL: Calcular el número de días para el promedio.
        num_days = (end_date - start_date).days

        # --- 1. Métricas Financieras ---
        financials = db.session.query(
            func.sum(PedidoProducto.cantidad * PedidoProducto.precio_unitario).label('total_ingresos'),
            func.sum(PedidoProducto.cantidad * Productos.costo).label('total_inversion')
        ).join(Pedido, Pedido.id == PedidoProducto.pedido_id)\
         .join(Productos, Productos.id == PedidoProducto.producto_id)\
         .filter(
            Pedido.estado_pedido == EstadoPedido.COMPLETADO,
            Pedido.created_at.between(start_date, end_date)
        ).first()

        # --- 2. Gráfico de Evolución de Ganancias ---
        profits_data = db.session.query(
            func.date_trunc(date_trunc_format, Pedido.created_at).label('fecha'),
            func.sum(PedidoProducto.cantidad * (PedidoProducto.precio_unitario - Productos.costo)).label('utilidad_diaria')
        ).join(Pedido, Pedido.id == PedidoProducto.pedido_id)\
         .join(Productos, Productos.id == PedidoProducto.producto_id)\
         .filter(
            Pedido.estado_pedido == EstadoPedido.COMPLETADO,
            Pedido.created_at.between(start_date, end_date)
        ).group_by('fecha').order_by('fecha').all()


        # --- 3. Gráfico de Distribución por Categoría ---
        category_data = db.session.query(
            Subcategorias.nombre,
            func.sum(PedidoProducto.cantidad).label('unidades_vendidas')
        ).join(Pedido, Pedido.id == PedidoProducto.pedido_id)\
         .join(Productos, Productos.id == PedidoProducto.producto_id)\
         .join(Seudocategorias, Seudocategorias.id == Productos.seudocategoria_id)\
         .join(Subcategorias, Subcategorias.id == Seudocategorias.subcategoria_id)\
         .filter(
            Pedido.estado_pedido == EstadoPedido.COMPLETADO,
            Pedido.created_at.between(start_date, end_date)
        ).group_by(Subcategorias.nombre).order_by(func.sum(PedidoProducto.cantidad).desc()).limit(6).all()


        # --- 4. Productos Más Vendidos ---
        top_products_data = db.session.query(
            Productos.id,
            Productos.nombre,
            Productos.marca,
            Productos.slug,
            Productos.imagen_url,
            func.sum(PedidoProducto.cantidad).label('unidades_vendidas')
        ).join(Pedido, Pedido.id == PedidoProducto.pedido_id)\
         .join(Productos, Productos.id == PedidoProducto.producto_id)\
         .filter(
            Pedido.estado_pedido == EstadoPedido.COMPLETADO,
            Pedido.created_at.between(start_date, end_date)
        ).group_by(Productos.id).order_by(func.sum(PedidoProducto.cantidad).desc()).limit(5).all()

        # --- 5. Productos Nuevos ---
        new_products_data = db.session.query(
            Productos.id,
            Productos.nombre,
            Productos.marca,
            Productos.slug,
            Productos.imagen_url,
            Productos.created_at
        ).filter(Productos.estado == 'activo').order_by(Productos.created_at.desc()).limit(3).all()
        
        # --- 6. Clientes Top ---
        top_customers_data = db.session.query(
            Usuarios.id.label('usuario_id'),
            Usuarios.nombre.label('usuario_nombre'),
            Usuarios.apellido.label('usuario_apellido'),
            func.sum(Pedido.total).label('total_gastado'),
            func.count(Pedido.id).label('total_pedidos'),
            func.max(Pedido.created_at).label('ultima_compra')
        ).join(Usuarios, Usuarios.id == Pedido.usuario_id)\
         .filter(
            Pedido.estado_pedido == EstadoPedido.COMPLETADO,
            Pedido.created_at.between(start_date, end_date)
        ).group_by(Usuarios.id, Usuarios.nombre, Usuarios.apellido)\
         .order_by(func.sum(Pedido.total).desc()).limit(3).all()

        # --- 7. Categorías Nuevas ---
        new_categories_data = db.session.query(
            CategoriasPrincipales.nombre,
            CategoriasPrincipales.slug,
            CategoriasPrincipales.created_at,
            func.count(Productos.id).label('product_count')
        ).outerjoin(Subcategorias, Subcategorias.categoria_principal_id == CategoriasPrincipales.id)\
         .outerjoin(Seudocategorias, Seudocategorias.subcategoria_id == Subcategorias.id)\
         .outerjoin(Productos, Productos.seudocategoria_id == Seudocategorias.id)\
         .filter(CategoriasPrincipales.estado == 'activo')\
         .group_by(CategoriasPrincipales.id)\
         .order_by(CategoriasPrincipales.created_at.desc()).limit(3).all()

        # --- 8. CORRECCIÓN PROFESIONAL: Procesamiento de datos y manejo de nulos ---
        # Si no hay ventas, 'financials' será (None, None). Debemos manejar esto.
        total_ingresos = float(financials.total_ingresos or 0)
        total_inversion = float(financials.total_inversion or 0)
        # MEJORA PROFESIONAL: Calcular la utilidad explícitamente para mayor claridad.
        total_utilidad = total_ingresos - total_inversion

        margen_ganancia = (total_utilidad / total_ingresos * 100) if total_ingresos > 0 else 0

        # Procesar datos de gráficos
        # MEJORA PROFESIONAL: Crear un diccionario de fechas para asegurar que todos los días/semanas/meses
        # en el período estén presentes, incluso si no tuvieron ventas. Esto evita que los datos se
        # agrupen al principio del gráfico.
        profits_chart = {'labels': [], 'values': []}
        profits_data_dict = {row.fecha.strftime('%Y-%m-%d'): float(row.utilidad_diaria or 0) for row in profits_data}
        
        # Generar todas las fechas en el rango para el eje X del gráfico.
        current_date = start_date
        while current_date <= end_date:
            date_key = current_date.strftime('%Y-%m-%d')
            
            if date_trunc_format == 'day':
                profits_chart['labels'].append(current_date.strftime('%d/%m'))
            elif date_trunc_format == 'week':
                profits_chart['labels'].append(current_date.strftime('Sem %W'))
            elif date_trunc_format == 'month':
                profits_chart['labels'].append(current_date.strftime('%b %Y'))
            
            profits_chart['values'].append(profits_data_dict.get(date_key, 0))
            current_date += timedelta(days=1)
            
        categories_chart = {'labels': [], 'values': []}
        for row in category_data:
            categories_chart['labels'].append(row.nombre)
            categories_chart['values'].append(int(row.unidades_vendidas or 0))

        # Procesar listas
        top_products = [dict(row._mapping) for row in top_products_data]
        new_products = [dict(row._mapping) for row in new_products_data]
        top_customers = [dict(row._mapping) for row in top_customers_data]
        new_categories = [dict(row._mapping) for row in new_categories_data]

        # --- 9. CORRECCIÓN PROFESIONAL: Calcular métricas adicionales de forma segura ---
        # Total de pedidos en el período
        total_pedidos = db.session.query(func.count(Pedido.id)).filter(
            Pedido.estado_pedido == EstadoPedido.COMPLETADO,
            Pedido.created_at.between(start_date, end_date)
        ).scalar() or 0
        
        ticket_promedio = total_ingresos / total_pedidos if total_pedidos > 0 else 0
        promedio_diario = total_ingresos / num_days if num_days > 0 else 0

        # CORRECCIÓN PROFESIONAL: El valor del mejor día debe ser la utilidad de ese día, no los ingresos.
        # El gráfico `profits_chart` ya contiene la utilidad diaria, por lo que `max(profits_chart['values'])` es correcto.
        mejor_dia_utilidad = max(profits_chart['values']) if profits_chart['values'] else 0

        # Tendencia de INGRESOS vs. Período Anterior
        previous_period_start = start_date - timedelta(days=num_days)
        previous_period_end = start_date

        ingresos_periodo_anterior = db.session.query(
            func.sum(Pedido.total)
        ).filter(
            Pedido.estado_pedido == EstadoPedido.COMPLETADO,
            Pedido.created_at.between(previous_period_start, previous_period_end)
        ).scalar() or 0

        tendencia = 0
        if ingresos_periodo_anterior > 0:
            tendencia = ((total_ingresos - ingresos_periodo_anterior) / ingresos_periodo_anterior) * 100
        elif total_ingresos > 0:
            tendencia = 100.0

        # --- 10. CORRECCIÓN PROFESIONAL: Nuevas métricas de inventario y ventas ---
        # Estas métricas son independientes del período y reflejan el estado actual del negocio.
        
        # Total de unidades vendidas en el período seleccionado.
        total_unidades_vendidas = db.session.query(func.sum(PedidoProducto.cantidad)).join(Pedido, Pedido.id == PedidoProducto.pedido_id).filter(
            Pedido.estado_pedido == EstadoPedido.COMPLETADO,
            Pedido.created_at.between(start_date, end_date)
        ).scalar() or 0

        # Métricas globales de inventario (no dependen del período)
        inventory_stats = db.session.query(
            func.sum(Productos._existencia).label('total_existencias'),
            func.sum(Productos.costo * Productos._existencia).label('inversion_inventario_total'),
            func.sum(Productos.precio * Productos._existencia).label('ingresos_potenciales_totales'),
            # MEJORA PROFESIONAL: Añadir el conteo de SKUs (productos únicos) activos.
            func.count(Productos.id).label('total_skus_activos')
        ).filter(Productos.estado == 'activo').first()

        total_existencias = int(inventory_stats.total_existencias or 0)
        inversion_inventario_total = float(inventory_stats.inversion_inventario_total or 0)
        ingresos_potenciales_totales = float(inventory_stats.ingresos_potenciales_totales or 0)
        total_skus_activos = int(inventory_stats.total_skus_activos or 0)

        # MEJORA PROFESIONAL: Calcular métricas derivadas para las nuevas tarjetas.
        utilidad_potencial_total = ingresos_potenciales_totales - inversion_inventario_total
        costo_promedio_unidad = (inversion_inventario_total / total_existencias) if total_existencias > 0 else 0


        return jsonify({
            'success': True,
            'stats': {
                'total_ingresos': total_ingresos,
                'total_inversion': total_inversion,
                'total_utilidad': total_utilidad,
                'margen_ganancia': margen_ganancia,
                'total_pedidos': total_pedidos,
                'ticket_promedio': ticket_promedio,
                'promedio_diario': promedio_diario,
                'mejor_dia': mejor_dia_utilidad,
                'tendencia': tendencia,
                'total_unidades_vendidas': total_unidades_vendidas,
                'total_existencias': total_existencias,
                'inversion_inventario_total': inversion_inventario_total,
                'ingresos_potenciales_totales': ingresos_potenciales_totales,
                'utilidad_potencial_total': utilidad_potencial_total,
                'total_skus_activos': total_skus_activos,
                'costo_promedio_unidad': costo_promedio_unidad
            },
            'profits_chart': profits_chart,
            'categories_chart': categories_chart,
            'top_products': top_products,
            'new_products': new_products,
            'top_customers': top_customers,
            'new_categories': new_categories
        })

    except Exception as e:
        current_app.logger.error(f"Error en la API del dashboard: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno al cargar los datos del dashboard.'}), 500