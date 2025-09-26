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
    Maneja la solicitud para ver los detalles de un producto específico en el panel de administración.
    """
    try:
        # Usamos joinedload para cargar eficientemente las relaciones necesarias
        # pero quitamos el joinedload de reseñas, ya que se cargarán por AJAX.
        product = Productos.query.options(
            joinedload(Productos.seudocategoria).joinedload(
                Seudocategorias.subcategoria).joinedload(Subcategorias.categoria_principal)
        ).filter_by(slug=product_slug).first_or_404()

        # Serializar el producto a un diccionario. El serializador se encarga de la lógica compleja.
        product_data = admin_producto_to_dict(product)

        # Formatear valores monetarios para la vista
        product_data['precio_formateado'] = format_currency_cop(
            product_data['precio'])
        product_data['costo_formateado'] = format_currency_cop(
            product_data['costo'])
        product_data['ingresos_totales_formateado'] = format_currency_cop(
            product_data.get('ingresos_totales', 0))

        # Las reseñas se cargarán a través de una llamada a la API,
        # por lo que no las pasamos directamente aquí.

        # Renderizar la plantilla con los datos del producto
        return render_template(
            'admin/componentes/producto/detalle_product.html',
            product=product_data,
            csrf_token=generate_csrf())

    except Exception as e:
        # Loguear el error para depuración
        current_app.logger.error(
            f"Error al cargar el detalle del producto {product_slug}: {e}", exc_info=True)
        # Mostrar una página de error genérica al usuario
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

        # Query base con carga optimizada del usuario
        query = Reseñas.query.filter_by(producto_id=product_id).options(
            joinedload(Reseñas.usuario)
        )

        # Aplicar filtro de calificación
        if rating_filter and 1 <= rating_filter <= 5:
            query = query.filter(Reseñas.calificacion == rating_filter)

        # Aplicar ordenamiento
        if sort == 'oldest':
            query = query.order_by(Reseñas.created_at.asc())
        elif sort == 'rating_desc':
            query = query.order_by(Reseñas.calificacion.desc(), Reseñas.created_at.desc())
        elif sort == 'rating_asc':
            query = query.order_by(Reseñas.calificacion.asc(), Reseñas.created_at.desc())
        else:  # 'newest' por defecto
            query = query.order_by(Reseñas.created_at.desc())

        # Paginación
        paginated_reviews = query.paginate(page=page, per_page=per_page, error_out=False)

        # Serialización de datos
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
