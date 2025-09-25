"""
Módulo de Reseñas de Productos (Cliente).

Este blueprint gestiona todas las operaciones CRUD (Crear, Leer, Actualizar, Eliminar)
relacionadas con las reseñas de los productos.

Funcionalidades:
- **Listado Público**: Permite a cualquier visitante ver las reseñas de un producto
  con paginación, filtros y ordenamiento.
- **Creación/Gestión Protegida**: Requiere autenticación (JWT) para que un usuario
  pueda crear, actualizar o eliminar su propia reseña.
- **Validación de Datos**: Utiliza funciones auxiliares para validar la entrada del usuario.
- **Actualización de Calificación**: Mantiene actualizada la calificación promedio
  del producto después de cada operación CRUD.
"""
# --- Importaciones de Flask y Librerías Estándar ---
from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, timedelta
# --- Importaciones de Extensiones y Terceros ---
from sqlalchemy.orm import joinedload
from app.models.domains.product_models import Productos
from app.models.enums import EstadoEnum
from app.models.domains.review_models import Reseñas
from app.models.domains.user_models import Usuarios
from app.models.serializers import resena_to_dict
from app.extensions import db
from app.utils.jwt_utils import jwt_required, decode_jwt_token

reviews_bp = Blueprint('reviews', __name__)

# --- Utilidades internas para validación y logging profesional ---
def _validar_texto_review(texto):
    """Valida que el texto de la reseña cumpla con la longitud mínima."""
    if not texto or len(texto.strip()) < 10:
        raise ValueError('El texto de la reseña debe tener al menos 10 caracteres')
    return texto.strip()

def _validar_calificacion(calificacion):
    """Valida que la calificación sea un entero entre 1 y 5."""
    if not isinstance(calificacion, int) or not (1 <= calificacion <= 5):
        raise ValueError('La calificación debe ser un número entre 1 y 5')
    return calificacion

def _validar_titulo(titulo):
    """Valida que el título de la reseña no exceda la longitud máxima."""
    if titulo is None:
        return None
    titulo_stripped = titulo.strip()
    if len(titulo_stripped) > 100:
        raise ValueError('El título no puede exceder 100 caracteres')
    return titulo_stripped

def _log_request_info(endpoint, extra=None):
    """
    Registra información de la petición en los logs para auditoría y depuración.

    Args:
        endpoint (str): El nombre del endpoint que se está ejecutando.
        extra (str, optional): Información adicional para incluir en el log.
    """
    msg = f"[Reviews] Endpoint: {endpoint} | Método: {request.method} | Usuario: {getattr(request, 'user', None)} | IP: {request.remote_addr}"
    if extra:
        msg += f" | {extra}"
    current_app.logger.info(msg)

@reviews_bp.route('/api/productos/<string:producto_id>/reviews', methods=['GET'])
def listar_reviews(producto_id):
    """
    Endpoint público para listar las reseñas de un producto.

    Permite la paginación, el filtrado por calificación y el ordenamiento de las reseñas.
    También determina si el usuario que realiza la petición puede editar alguna de las
    reseñas listadas, incluso si no está completamente autenticado (solo con token).

    Args:
        producto_id (str): El ID del producto del cual se quieren listar las reseñas.

    Query Params:
        - page (int, opcional): Número de página para la paginación. Default: 1.
        - per_page (int, opcional): Reseñas por página. Default: 10.
        - rating (int, opcional): Filtra las reseñas por una calificación específica (1-5).
        - sort (str, opcional): Criterio de ordenamiento. Opciones:
            - 'newest': Más recientes (últimos 2 días).
            - 'oldest': Más antiguas (hace 5 días o más).
            - 'rating_desc': Calificaciones más altas.
            - 'rating_asc': Calificaciones más bajas.
            - Default: Más recientes en general.

    Returns:
        JSON: Un objeto con la lista de reseñas, metadatos de paginación,
              la calificación promedio y el conteo total de reseñas.
    """
    _log_request_info('listar_reviews', f'producto_id={producto_id}')

    if not producto_id or producto_id == 'undefined':
        current_app.logger.warning(f"ID de producto inválido: {producto_id}")
        return jsonify({'success': False, 'error': 'ID de producto inválido'}), 400

    # --- Validación del Producto ---
    # Se asegura de que el producto exista y esté activo para mostrar sus reseñas.
    producto = Productos.query.get(producto_id)
    if not producto or producto.estado != EstadoEnum.ACTIVO:
        current_app.logger.warning(f"Producto {producto_id} no encontrado o inactivo")
        return jsonify({'success': False, 'error': 'Producto no encontrado'}), 404

    # --- Parámetros de Paginación y Filtrado ---
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

    # --- Lógica de Filtrado y Ordenamiento ---
    if rating_filter and 1 <= rating_filter <= 5:
        query = query.filter(Reseñas.calificacion == rating_filter)

    # Lógica de ordenamiento especial para "Más recientes", "Más antiguas",
    # "Mejor calificadas" y "Peor calificadas".
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

    paginated_reviews = query.paginate(
        page=page,
        per_page=per_page,
        error_out=False
    )

    datos = [resena_to_dict(r) for r in paginated_reviews.items]

    # --- Verificación de Permisos de Edición ---
    # Determina si el usuario que hace la petición es el autor de alguna reseña,
    # decodificando el token JWT del encabezado de autorización.
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

    # Añade el flag `puede_editar` a cada reseña para que el frontend sepa si mostrar el botón de editar.
    for review in datos:
        
        review['puede_editar'] = (user_id is not None and review['usuario']['id'] == user_id)

    # --- Construcción de la Respuesta ---
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

@reviews_bp.route('/api/productos/<string:producto_id>/reviews', methods=['POST'])
@jwt_required
def crear_review(usuario, producto_id):
    """
    Endpoint protegido para crear una nueva reseña.

    Requiere que el usuario esté autenticado vía JWT. Valida los datos de entrada,
    verifica que el usuario no haya reseñado ya el producto y, si todo es correcto,
    crea la reseña y actualiza la calificación promedio del producto.

    Args:
        usuario (Usuarios): Objeto del usuario autenticado, inyectado por `@jwt_required`.
        producto_id (str): El ID del producto a reseñar.

    Body (JSON):
        - texto (str): Contenido de la reseña (mín. 10 caracteres).
        - calificacion (int): Puntuación de 1 a 5.
        - titulo (str, opcional): Título de la reseña (máx. 100 caracteres).
    """
    _log_request_info('crear_review', f'usuario={usuario.id}, producto_id={producto_id}')
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400


    # --- Validación de Datos de Entrada ---
    try:
        texto = _validar_texto_review(data.get('texto', ''))
        calificacion = _validar_calificacion(data.get('calificacion'))
        titulo = _validar_titulo(data.get('titulo', ''))
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400

    # --- Verificaciones de Lógica de Negocio ---
    producto = Productos.query.filter_by(id=producto_id).first()
    if not producto or producto.estado != EstadoEnum.ACTIVO:
        return jsonify({'success': False, 'error': 'Producto no encontrado'}), 404

    # Un usuario solo puede dejar una reseña por producto.
    existe_review = Reseñas.query.filter_by(
        usuario_id=usuario.id,
        producto_id=producto_id
    ).first()
    if existe_review:
        return jsonify({'success': False, 'error': 'Ya has dejado una reseña para este producto'}), 400

    # --- Creación y Persistencia ---
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
        # Es crucial actualizar la calificación promedio del producto después de añadir una reseña.
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

@reviews_bp.route('/api/productos/<string:producto_id>/reviews/<string:review_id>', methods=['PUT'])
@jwt_required
def actualizar_review(usuario, producto_id, review_id):
    """
    Endpoint protegido para actualizar una reseña existente.

    El usuario debe estar autenticado y ser el autor original de la reseña.
    Actualiza el contenido y/o la calificación y recalcula el promedio del producto.

    Args:
        usuario (Usuarios): Objeto del usuario autenticado.
        producto_id (str): ID del producto asociado a la reseña.
        review_id (str): ID de la reseña a actualizar.

    Body (JSON):
        - texto (str, opcional): Nuevo contenido de la reseña.
        - calificacion (int, opcional): Nueva calificación.
        - titulo (str, opcional): Nuevo título.
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

    # Valida los nuevos datos proporcionados.
    try:
        texto = _validar_texto_review(data.get('texto', review.texto))
        calificacion = _validar_calificacion(data.get('calificacion', review.calificacion))
        titulo = _validar_titulo(data.get('titulo', review.titulo or ''))
    except ValueError as ve:
        return jsonify({'success': False, 'error': str(ve)}), 400

    # --- Actualización y Persistencia ---
    try:
        review.texto = texto
        review.calificacion = calificacion
        review.titulo = titulo or None
        review.updated_at = datetime.utcnow()
        db.session.commit()
        # Recalcula el promedio del producto después de la actualización.
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

@reviews_bp.route('/api/productos/<string:producto_id>/reviews/<string:review_id>', methods=['DELETE'])
@jwt_required
def eliminar_review(usuario, producto_id, review_id):
    """
    Endpoint protegido para eliminar una reseña.

    El usuario debe estar autenticado y ser el autor de la reseña.
    Realiza un borrado físico (`hard delete`) de la reseña y luego recalcula
    la calificación promedio del producto.

    Args:
        usuario (Usuarios): Objeto del usuario autenticado.
        producto_id (str): ID del producto asociado.
        review_id (str): ID de la reseña a eliminar.
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
        # Guarda una referencia al producto antes de eliminar la reseña.
        producto = review.producto
        db.session.delete(review)
        db.session.commit()

        # Refresca el objeto producto para asegurar que su relación `reviews` esté actualizada.
        db.session.refresh(producto)

        # Recalcula y actualiza el promedio de calificaciones del producto.
        if producto:
            producto.actualizar_promedio_calificaciones() # Call the method to update the stored average

        return jsonify({'success': True, 'mensaje': 'Reseña eliminada exitosamente'})
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error al eliminar reseña: {str(e)}')
        return jsonify({'success': False, 'error': 'Error al eliminar la reseña'}), 500

@reviews_bp.route('/api/productos/<string:producto_id>/my-reviews', methods=['GET'])
@jwt_required
def obtener_mi_review(usuario, producto_id):
    """
    Endpoint protegido para obtener la reseña de un usuario para un producto específico.

    Es útil para que el frontend pueda pre-rellenar un formulario de edición
    con los datos de la reseña existente del usuario.

    Args:
        usuario (Usuarios): Objeto del usuario autenticado.
        producto_id (str): ID del producto.
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
    Endpoint público para obtener la calificación de un producto.

    Devuelve la calificación promedio almacenada y el número total de reseñas.
    Es un endpoint ligero, ideal para mostrar estrellas de calificación en listados
    de productos sin necesidad de cargar todas las reseñas.
    """
    producto = Productos.query.get(producto_id)
    if not producto:
        return jsonify({'success': False, 'error': 'Producto no encontrado'}), 404

    # Utiliza la calificación promedio pre-calculada para un rendimiento óptimo.
    average_rating = producto.calificacion_promedio_almacenada
    total_reviews_count = Reseñas.query.filter_by(producto_id=producto_id).count()

    return jsonify({
        'success': True,
        'average_rating': average_rating,
        'total_reviews_count': total_reviews_count
    })
