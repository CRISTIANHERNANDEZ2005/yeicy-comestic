"""
Módulo de la Página Principal (Cliente).

Este blueprint gestiona endpoints de API específicos para la página de inicio,
permitiendo la carga de contenido dinámico y enriquecido como reseñas destacadas,
sin sobrecargar la carga inicial de la página.
"""
# --- Importaciones de Flask y Librerías Estándar ---
from flask import Blueprint, jsonify, current_app

# --- Importaciones de Extensiones y Terceros ---
from sqlalchemy.orm import joinedload

# --- Importaciones Locales de la Aplicación ---
from app.models.domains.review_models import Reseñas
from app.models.domains.product_models import Productos, Seudocategorias, Subcategorias
from app.models.enums import EstadoEnum
from app.models.serializers import resena_to_dict

main_page_bp = Blueprint('main_page', __name__, url_prefix='/api/main')

@main_page_bp.route('/featured-reviews', methods=['GET'])
def get_featured_reviews():
    """
    Endpoint de API para obtener reseñas destacadas para la página de inicio.

    Selecciona las 8 reseñas más recientes con una calificación de 4 o 5 estrellas
    de productos y usuarios activos. Esta selección asegura que se muestre
    contenido de alta calidad y relevante.

    Returns:
        JSON: Una lista de objetos de reseña, cada uno con detalles del usuario
              y del producto asociado.
    """
    try:
        # Consulta para obtener las 8 reseñas más recientes con 4 o 5 estrellas
        reviews = Reseñas.query.options(
            joinedload(Reseñas.usuario),
            joinedload(Reseñas.producto).joinedload(Productos.seudocategoria).joinedload(Seudocategorias.subcategoria).joinedload(Subcategorias.categoria_principal)
        ).join(
            Reseñas.producto
        ).filter(
            Reseñas.calificacion.in_([4, 5]),
            Productos.estado == EstadoEnum.ACTIVO
        ).order_by(
            Reseñas.created_at.desc()
        ).limit(8).all()

        reviews_data = []
        for review in reviews:
            review_dict = resena_to_dict(review)
            producto = review.producto
            seudocategoria = producto.seudocategoria
            subcategoria = seudocategoria.subcategoria if seudocategoria else None
            categoria_principal = subcategoria.categoria_principal if subcategoria else None

            review_dict['producto'] = {
                'nombre': producto.nombre,
                'slug': producto.slug,
                'imagen_url': producto.imagen_url,
                'seudocategoria_slug': seudocategoria.slug if seudocategoria else '',
                'subcategoria_slug': subcategoria.slug if subcategoria else '',
                'categoria_slug': categoria_principal.slug if categoria_principal else ''
            }
            reviews_data.append(review_dict)

        return jsonify({'success': True, 'reviews': reviews_data})

    except Exception as e:
        current_app.logger.error(f"Error al obtener reseñas destacadas: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error al cargar las reseñas'}), 500