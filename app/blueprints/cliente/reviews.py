"""
Módulo mejorado para manejar las operaciones relacionadas con las reseñas de productos.
Implementa autenticación y CRUD completo para usuarios autenticados.
"""
from flask import Blueprint, request, jsonify, current_app
from sqlalchemy.orm import joinedload
from app.models.domains.product_models import Productos
from app.models.domains.review_models import Reseñas
from app.models.domains.user_models import Usuarios
from app.models.serializers import resena_to_dict
from app.extensions import db
from app.utils.jwt_utils import jwt_required, decode_jwt_token
from datetime import datetime, timedelta


reviews_bp = Blueprint('reviews', __name__)

# --- Utilidades internas para validación y logging profesional ---
def _validar_texto_review(texto):
    if not texto or len(texto.strip()) < 10:
        raise ValueError('El texto de la reseña debe tener al menos 10 caracteres')
    return texto.strip()

def _validar_calificacion(calificacion):
    if not isinstance(calificacion, int) or not (1 <= calificacion <= 5):
        raise ValueError('La calificación debe ser un número entre 1 y 5')
    return calificacion

def _validar_titulo(titulo):
    if titulo is None:
        return None
    titulo_stripped = titulo.strip()
    if len(titulo_stripped) > 100:
        raise ValueError('El título no puede exceder 100 caracteres')
    return titulo_stripped

def _log_request_info(endpoint, extra=None):
    msg = f"[Reviews] Endpoint: {endpoint} | Método: {request.method} | Usuario: {getattr(request, 'user', None)} | IP: {request.remote_addr}"
    if extra:
        msg += f" | {extra}"
    current_app.logger.info(msg)

# Endpoint público - Listar reseñas (sin autenticación)
@reviews_bp.route('/api/productos/<string:producto_id>/reviews', methods=['GET'])
def listar_reviews(producto_id):
    """
    GET /api/productos/<producto_id>/reviews
    Lista reseñas públicas de un producto, con filtros y ordenamiento.
    Query params:
        - page: int (paginación)
        - per_page: int (paginación)
        - rating: int (filtrar por calificación)
        - sort: str (newest, oldest, rating_desc, rating_asc)
    """
    _log_request_info('listar_reviews', f'producto_id={producto_id}')

    if not producto_id or producto_id == 'undefined':
        current_app.logger.warning(f"ID de producto inválido: {producto_id}")
        return jsonify({'success': False, 'error': 'ID de producto inválido'}), 400

    # Verificar si el producto existe y está activo
    producto = Productos.query.get(producto_id)
    if not producto or producto.estado != 'activo':
        current_app.logger.warning(f"Producto {producto_id} no encontrado o inactivo")
        return jsonify({'success': False, 'error': 'Producto no encontrado'}), 404

    # Parámetros de paginación y filtrado
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    rating_filter = request.args.get('rating', type=int)
    sort = request.args.get('sort', 'newest')

    # Query base
    query = Reseñas.query.filter_by(
        producto_id=producto_id
    ).options(
        joinedload(Reseñas.usuario)
    )

    # Filtrar por calificación si se especifica
    if rating_filter and 1 <= rating_filter <= 5:
        query = query.filter(Reseñas.calificacion == rating_filter)

    # Ordenar y filtrar por rangos de fechas o calificaciones extremas si se especifica
    if sort == 'newest':
        # Reseñas de los últimos 2 días
        two_days_ago = datetime.utcnow() - timedelta(days=2)
        query = query.filter(Reseñas.created_at >= two_days_ago).order_by(Reseñas.created_at.desc())
    elif sort == 'oldest':
        # Reseñas de hace 5 días o más
        five_days_ago = datetime.utcnow() - timedelta(days=5)
        query = query.filter(Reseñas.created_at <= five_days_ago).order_by(Reseñas.created_at.asc())
    elif sort == 'rating_desc':
        # Obtener la calificación máxima para este producto
        max_rating = db.session.query(db.func.max(Reseñas.calificacion)).filter_by(producto_id=producto_id).scalar()
        if max_rating is not None:
            query = query.filter(Reseñas.calificacion == max_rating).order_by(Reseñas.created_at.desc())
        else:
            # Si no hay reseñas, la consulta debe devolver vacía
            query = query.filter(False) # Filtro que siempre es falso para no devolver nada
    elif sort == 'rating_asc':
        # Obtener la calificación mínima para este producto
        min_rating = db.session.query(db.func.min(Reseñas.calificacion)).filter_by(producto_id=producto_id).scalar()
        if min_rating is not None:
            query = query.filter(Reseñas.calificacion == min_rating).order_by(Reseñas.created_at.desc())
        else:
            # Si no hay reseñas, la consulta debe devolver vacía
            query = query.filter(False) # Filtro que siempre es falso para no devolver nada
    else: # Fallback para cualquier otro valor de sort
        query = query.order_by(Reseñas.created_at.desc())

    # Paginar resultados
    paginated_reviews = query.paginate(
        page=page,
        per_page=per_page,
        error_out=False
    )

    # Formatear respuesta usando review_to_dict
    datos = [resena_to_dict(r) for r in paginated_reviews.items]

    # Determinar usuario autenticado (si hay token)
    user_id = None
    auth_header = request.headers.get('Authorization')
    if auth_header:
        try:
            token = auth_header.split(' ')[1]
            payload = decode_jwt_token(token)
            if payload:
                user_id = payload.get('user_id')
        except Exception:
            current_app.logger.error("Error decoding token in listar_reviews", exc_info=True)
            user_id = None

    # Siempre incluir puede_editar
    for review in datos:
        
        review['puede_editar'] = (user_id is not None and review['usuario']['id'] == user_id)

    # Obtener calificación promedio y conteo total de reseñas activas
    # El producto ya se obtuvo al inicio de la función
    average_rating = producto.calificacion_promedio_almacenada if producto else 0.0
    total_active_reviews = Reseñas.query.filter_by(
        producto_id=producto_id
    ).count()

    return jsonify({
        'success': True,
        'reviews': datos,
        'total': paginated_reviews.total,
        'page': paginated_reviews.page,
        'pages': paginated_reviews.pages,
        'per_page': per_page,
        'average_rating': average_rating,
        'total_reviews_count': total_active_reviews
    })

# Endpoint protegido - Crear reseña (requiere autenticación)
@reviews_bp.route('/api/productos/<string:producto_id>/reviews', methods=['POST'])
@jwt_required
def crear_review(usuario, producto_id):
    """
    POST /api/productos/<producto_id>/reviews
    Crea una reseña para un producto. Requiere autenticación.
    Body: {"texto": str, "calificacion": int, "titulo": str (opcional)}
    """
    _log_request_info('crear_review', f'usuario={usuario.id}, producto_id={producto_id}')
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400


    try:
        texto = _validar_texto_review(data.get('texto', ''))
        calificacion = _validar_calificacion(data.get('calificacion'))
        titulo = _validar_titulo(data.get('titulo', ''))
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400

    # Verificar producto
    producto = Productos.query.filter_by(id=producto_id).first()
    if not producto or producto.estado != 'activo':
        return jsonify({'success': False, 'error': 'Producto no encontrado'}), 404

    # Verificar si ya tiene reseña
    existe_review = Reseñas.query.filter_by(
        usuario_id=usuario.id,
        producto_id=producto_id
    ).first()
    if existe_review:
        return jsonify({'success': False, 'error': 'Ya has dejado una reseña para este producto'}), 400

    try:
        nueva_review = Reseñas(
            usuario_id=usuario.id,
            producto_id=producto_id,
            texto=texto,
            calificacion=calificacion,
            titulo=titulo or None
        )
        db.session.add(nueva_review)
        db.session.commit()
        producto.actualizar_promedio_calificaciones()
        return jsonify({
            'success': True,
            'mensaje': 'Reseña creada exitosamente',
            'review': resena_to_dict(nueva_review)
        }), 201
    except ValueError as ve:
        db.session.rollback()
        current_app.logger.error(f'Error de validación al crear reseña: {str(ve)}')
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error al crear reseña: {str(e)}')
        return jsonify({'success': False, 'error': 'Error al procesar la reseña'}), 500

# Endpoint protegido - Actualizar reseña propia
@reviews_bp.route('/api/productos/<string:producto_id>/reviews/<string:review_id>', methods=['PUT'])
@jwt_required
def actualizar_review(usuario, producto_id, review_id):
    """
    PUT /api/productos/<producto_id>/reviews/<review_id>
    Actualiza una reseña propia. Requiere autenticación.
    Body: {"texto": str, "calificacion": int, "titulo": str (opcional)}
    """
    _log_request_info('actualizar_review', f'usuario={usuario.id}, producto_id={producto_id}, review_id={review_id}')
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400

    # Buscar reseña
    review = Reseñas.query.filter_by(
        id=review_id,
        usuario_id=usuario.id,
        producto_id=producto_id
    ).first()
    if not review:
        return jsonify({'success': False, 'error': 'Reseña no encontrada o no tienes permisos'}), 404

    # Validar datos

    try:
        texto = _validar_texto_review(data.get('texto', review.texto))
        calificacion = _validar_calificacion(data.get('calificacion', review.calificacion))
        titulo = _validar_titulo(data.get('titulo', review.titulo or ''))
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400

    try:
        review.texto = texto
        review.calificacion = calificacion
        review.titulo = titulo or None
        review.updated_at = datetime.utcnow()
        db.session.commit()
        producto = Productos.query.filter_by(id=producto_id).first()
        if producto:
            producto.actualizar_promedio_calificaciones()
        return jsonify({
            'success': True,
            'mensaje': 'Reseña actualizada exitosamente',
            'review': resena_to_dict(review)
        })
    except ValueError as ve:
        db.session.rollback()
        current_app.logger.error(f'Error de validación al actualizar reseña: {str(ve)}')
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error al actualizar reseña: {str(e)}')
        return jsonify({'success': False, 'error': 'Error al actualizar la reseña'}), 500


# Endpoint protegido - Eliminar reseña propia
@reviews_bp.route('/api/productos/<string:producto_id>/reviews/<string:review_id>', methods=['DELETE'])
@jwt_required
def eliminar_review(usuario, producto_id, review_id):
    """
    DELETE /api/productos/<producto_id>/reviews/<review_id>
    Elimina (soft delete) una reseña propia. Requiere autenticación.
    """
    _log_request_info('eliminar_review', f'usuario={usuario.id}, producto_id={producto_id}, review_id={review_id}')
    review = Reseñas.query.filter_by(
        id=review_id,
        usuario_id=usuario.id,
        producto_id=producto_id
    ).first()
    if not review:
        return jsonify({'success': False, 'error': 'Reseña no encontrada o no tienes permisos'}), 404
    try:
        # Guardar el producto antes de eliminar la reseña para poder acceder a él después
        producto = review.producto # Get the product object before deleting the review
        db.session.delete(review)
        db.session.commit()

        # Refresh the product object to ensure its 'reviews' relationship is up-to-date
        db.session.refresh(producto)

        # Recalcular y actualizar el promedio de calificaciones del producto
        if producto:
            producto.actualizar_promedio_calificaciones() # Call the method to update the stored average

        return jsonify({'success': True, 'mensaje': 'Reseña eliminada exitosamente'})
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error al eliminar reseña: {str(e)}')
        return jsonify({'success': False, 'error': 'Error al eliminar la reseña'}), 500

# Endpoint protegido - Obtener reseña propia para edición
@reviews_bp.route('/api/productos/<string:producto_id>/my-reviews', methods=['GET'])
@jwt_required
def obtener_mi_review(usuario, producto_id):
    """
    GET /api/productos/<string:producto_id>/my-reviews
    Obtiene la reseña propia para un producto. Requiere autenticación.
    """
    _log_request_info('obtener_mi_review', f'usuario={usuario.id}, producto_id={producto_id}')
    review = Reseñas.query.filter_by(
        usuario_id=usuario.id,
        producto_id=producto_id
    ).first()
    if not review:
        return jsonify({'success': False, 'error': 'No tienes una reseña para este producto'}), 404
    data = resena_to_dict(review)
    data['puede_editar'] = True
    return jsonify({'success': True, 'review': data})

@reviews_bp.route('/api/productos/<string:producto_id>/rating', methods=['GET'])
def obtener_rating_producto(producto_id):
    """
    GET /api/productos/<string:producto_id>/rating
    Obtiene la calificación promedio y el conteo de reseñas de un producto.
    """
    producto = Productos.query.get(producto_id)
    if not producto:
        return jsonify({'success': False, 'error': 'Producto no encontrado'}), 404

    # Usar la calificación promedio almacenada y contar las reseñas
    average_rating = producto.calificacion_promedio_almacenada
    total_reviews_count = Reseñas.query.filter_by(producto_id=producto_id).count()

    return jsonify({
        'success': True,
        'average_rating': average_rating,
        'total_reviews_count': total_reviews_count
    })
