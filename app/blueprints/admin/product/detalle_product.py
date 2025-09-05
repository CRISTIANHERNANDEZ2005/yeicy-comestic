from flask import Blueprint, render_template, request, abort, current_app
from flask_wtf.csrf import generate_csrf
from sqlalchemy.orm import joinedload
from app.utils.admin_jwt_utils import admin_jwt_required
from app.models.domains.product_models import Productos, Seudocategorias, Subcategorias
from app.models.domains.review_models import Reseñas
from app.models.serializers import producto_to_dict, resena_to_dict, format_currency_cop

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
        # y get_or_404 para manejar automáticamente el caso de no encontrar el producto.
        product = Productos.query.options(
            joinedload(Productos.seudocategoria).joinedload(
                Seudocategorias.subcategoria).joinedload(Subcategorias.categoria_principal),
            joinedload(Productos.reseñas).joinedload(Reseñas.usuario)
        ).filter_by(slug=product_slug).first_or_404()

        # Serializar el producto a un diccionario. El serializador se encarga de la lógica compleja.
        product_data = producto_to_dict(product)

        # Formatear valores monetarios para la vista
        product_data['precio_formateado'] = format_currency_cop(
            product_data['precio'])
        product_data['costo_formateado'] = format_currency_cop(
            product_data['costo'])

        # Las reseñas ya están en el producto gracias a la carga eficiente (joinedload)
        # y el serializador 'producto_to_dict' debería incluirlas.
        # Sin embargo, si necesitamos pasarlas por separado, las serializamos aquí.
        reviews_data = [resena_to_dict(
            review) for review in product.reseñas]

        # Determinar si la solicitud es AJAX para carga parcial de la página
        is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

        # Renderizar la plantilla con los datos del producto
        return render_template(
            'admin/componentes/detalle_product.html',
            product=product_data,
            reviews=reviews_data,
            csrf_token=generate_csrf(),
            is_ajax=is_ajax
        )

    except Exception as e:
        # Loguear el error para depuración
        current_app.logger.error(
            f"Error al cargar el detalle del producto {product_slug}: {e}", exc_info=True)
        # Mostrar una página de error genérica al usuario
        abort(500, description="Ocurrió un error interno al cargar los detalles del producto.")
