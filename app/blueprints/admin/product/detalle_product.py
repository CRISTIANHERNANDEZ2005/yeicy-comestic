"""
Módulo de Detalles de Producto (Admin).

Este blueprint se encarga de proporcionar una vista detallada y analítica para un
producto específico en el panel de administración. Su objetivo es centralizar toda
la información relevante de un producto en una sola página.

Funcionalidades Clave:
- **Renderizado de Página de Detalles**: Muestra la página de detalles de un producto, cargando su información principal y métricas de negocio calculadas.
- **API de Reseñas**: Proporciona un endpoint para cargar dinámicamente las reseñas de un producto, con soporte para paginación, filtrado por calificación y ordenamiento. Esto mejora el rendimiento de la carga inicial de la página.
"""
from flask import Blueprint, render_template, request, abort, current_app, jsonify
from flask_wtf.csrf import generate_csrf
from sqlalchemy.orm import joinedload
from app.utils.admin_jwt_utils import admin_jwt_required
from app.models.domains.product_models import Productos, Seudocategorias, Subcategorias
from app.models.domains.review_models import Reseñas
from app.models.serializers import admin_producto_to_dict, resena_to_dict, format_currency_cop
from app.extensions import db

admin_detalle_product_bp = Blueprint(
    'admin_detalle', __name__, url_prefix='/admin')


@admin_detalle_product_bp.route('/producto/<string:product_slug>', methods=['GET'])
@admin_jwt_required
def get_product_detail(admin_user, product_slug):
    """
    Renderiza la página de detalles para un producto específico.

    Esta vista es el punto de entrada para la visualización detallada de un producto.
    Realiza una consulta optimizada para obtener el producto y su jerarquía de categorías,
    luego serializa y formatea los datos para presentarlos en la plantilla. Las reseñas
    se cargan por separado a través de una API para mejorar la velocidad de carga inicial.

    Args:
        admin_user: El objeto del administrador autenticado (inyectado por el decorador).
        product_slug (str): El slug del producto a visualizar.

    Returns:
        Response: La plantilla `detalle_product.html` renderizada con los datos del producto,
                  o una página de error 500 si ocurre un problema.
    """
    try:
        # MEJORA PROFESIONAL: Se utiliza `joinedload` para cargar de forma anticipada (eager loading)
        # la jerarquía de categorías en una sola consulta, evitando el problema N+1.
        # Las reseñas se excluyen deliberadamente para ser cargadas vía AJAX.
        product = Productos.query.options(
            joinedload(Productos.seudocategoria).joinedload(
                Seudocategorias.subcategoria).joinedload(Subcategorias.categoria_principal)
        ).filter_by(slug=product_slug).first_or_404()

        # El serializador `admin_producto_to_dict` convierte el objeto SQLAlchemy en un
        # diccionario, calculando métricas de negocio como margen, ventas, etc.
        product_data = admin_producto_to_dict(product)

        # Formatear valores monetarios para una presentación amigable en la plantilla.
        product_data['precio_formateado'] = format_currency_cop(
            product_data['precio'])
        product_data['costo_formateado'] = format_currency_cop(
            product_data['costo'])
        product_data['ingresos_totales_formateado'] = format_currency_cop(
            product_data.get('ingresos_totales', 0))

        # Renderizar la plantilla, pasando los datos del producto y un token CSRF
        # para la seguridad de las acciones que se puedan realizar desde la página.
        return render_template(
            'admin/componentes/producto/detalle_product.html',
            product=product_data,
            csrf_token=generate_csrf())

    except Exception as e:
        # Registrar el error completo para facilitar la depuración.
        current_app.logger.error(
            f"Error al cargar el detalle del producto {product_slug}: {e}", exc_info=True)
        # Mostrar una página de error genérica al usuario para no exponer detalles internos.
        abort(500, description="Ocurrió un error interno al cargar los detalles del producto.")

@admin_detalle_product_bp.route('/api/producto/<string:product_id>/reviews', methods=['GET'])
@admin_jwt_required
def get_product_reviews_api(admin_user, product_id):
    """
    API: Obtiene las reseñas de un producto con paginación y filtros.

    Este endpoint es consumido por el frontend para cargar dinámicamente
    las reseñas, permitiendo una experiencia de usuario fluida y escalable.

    Args:
        admin_user: El objeto del administrador autenticado.
        product_id (str): El ID del producto.

    Query Params:
        page (int): Número de página.
        per_page (int): Reseñas por página.
        rating (int): Filtro por calificación (1-5).
        sort (str): Criterio de ordenamiento ('newest', 'oldest', 'rating_desc', 'rating_asc').
    """
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 2, type=int)
        rating_filter = request.args.get('rating', type=int)
        sort = request.args.get('sort', 'newest')

        # Consulta base con carga optimizada del usuario para evitar consultas N+1.
        query = Reseñas.query.filter_by(producto_id=product_id).options(
            joinedload(Reseñas.usuario)
        )

        # Aplicar filtro de calificación si se proporciona.
        if rating_filter and 1 <= rating_filter <= 5:
            query = query.filter(Reseñas.calificacion == rating_filter)

        # Aplicar el criterio de ordenamiento solicitado.
        if sort == 'oldest':
            query = query.order_by(Reseñas.created_at.asc())
        elif sort == 'rating_desc':
            query = query.order_by(Reseñas.calificacion.desc(), Reseñas.created_at.desc())
        elif sort == 'rating_asc':
            query = query.order_by(Reseñas.calificacion.asc(), Reseñas.created_at.desc())
        else:  # 'newest' por defecto
            query = query.order_by(Reseñas.created_at.desc())

        # Aplicar paginación a la consulta.
        paginated_reviews = query.paginate(page=page, per_page=per_page, error_out=False)

        # Serializar los resultados para la respuesta JSON.
        reviews_data = [resena_to_dict(r) for r in paginated_reviews.items]

        return jsonify({
            'success': True,
            'reviews': reviews_data,
            'pagination': {
                'page': paginated_reviews.page,
                'pages': paginated_reviews.pages,
                'per_page': paginated_reviews.per_page,
                'total': paginated_reviews.total,
                'has_next': paginated_reviews.has_next,
                'has_prev': paginated_reviews.has_prev,
            }
        })

    except Exception as e:
        current_app.logger.error(
            f"Error al obtener reseñas para el producto {product_id} vía API: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Error interno al obtener las reseñas.'
        }), 500
