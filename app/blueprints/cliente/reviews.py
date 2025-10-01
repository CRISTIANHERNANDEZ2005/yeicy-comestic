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
from app.models.enums import EstadoEnum, EstadoPedido
from app.models.domains.review_models import Reseñas, ReseñaVoto
from app.models.domains.user_models import Usuarios
from app.models.serializers import resena_to_dict
from sqlalchemy.orm import selectinload
from app.extensions import db
from sqlalchemy import func, desc
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
    user_id = None
    user_review = None

    # Query base
    query = Reseñas.query.filter_by(
        producto_id=producto_id
    ).options(
        joinedload(Reseñas.usuario)
    )

    # ---  Verificación temprana de reseñas ---
    # Si no hay ninguna reseña para el producto, no procesamos filtros ni paginación.
    # Devolvemos una respuesta clara para que el frontend pueda ocultar la sección.
    total_reviews_count = query.count()
    # --- Verificación temprana y optimización ---
    # Contamos el total de reseñas ANTES de aplicar filtros.
    # Si no hay ninguna reseña para el producto, devolvemos una respuesta clara y temprana.
    # Esto evita procesar filtros y paginación innecesariamente.
    total_reviews_count = Reseñas.query.filter_by(producto_id=producto_id).count()
    if total_reviews_count == 0:
        return jsonify({
            'success': True,
            'reviews': [],
            'total': 0,
            'total_reviews_count': 0,
            'pages': 0,
            'page': 1,
            'message': 'No hay reseñas para este producto.',
            'average_rating': producto.calificacion_promedio_almacenada if producto else 0.0
        })

    # --- Lógica de Filtrado y Ordenamiento ---
    if rating_filter and 1 <= rating_filter <= 5:
        query = query.filter(Reseñas.calificacion == rating_filter)

    # ---  Lógica de ordenamiento más intuitiva ---
    # Se ajusta el ordenamiento para que no excluya reseñas, sino que las ordene todas
    # según el criterio seleccionado.
    if sort == 'newest':
        query = query.order_by(Reseñas.created_at.desc())
    elif sort == 'oldest':
        query = query.order_by(Reseñas.created_at.asc())
    elif sort == 'rating_desc':
        query = query.order_by(Reseñas.calificacion.desc(), Reseñas.created_at.desc())
    elif sort == 'rating_asc':
        query = query.order_by(Reseñas.calificacion.asc(), Reseñas.created_at.desc())
    else: # Fallback para cualquier otro valor de sort
        query = query.order_by(Reseñas.created_at.desc())

    # --- Verificación de Permisos de Edición ---
    # Determina si el usuario que hace la petición es el autor de alguna reseña,
    # decodificando el token JWT del encabezado de autorización.
    auth_header = request.headers.get('Authorization')
    if auth_header:
        try:
            token = auth_header.split(" ")[1]
            if payload := decode_jwt_token(token):
                user_id = payload.get('user_id')
                #  Cargar los votos del usuario para esta página de reseñas en una sola consulta.


                # Se aplica la opción a la consulta 'query' ANTES de paginarla para evitar el AttributeError.
                # Esto es más eficiente y corrige el error que se veía en los logs.
                query = query.options(selectinload(Reseñas.votos))
        except Exception as e:
            current_app.logger.error(f"Error decoding token in listar_reviews: {e}", exc_info=True)

    # La paginación se realiza UNA SOLA VEZ, después de aplicar todos los filtros y ordenamientos.
    paginated_reviews = query.paginate(page=page, per_page=per_page, error_out=False)

    #  No se separa la reseña del usuario. Se serializa la lista completa.
    # El serializador 'resena_to_dict' ya maneja si el usuario actual votó.
    # El frontend se encargará de destacar la reseña del usuario si 'puede_editar' es true.
    datos = [resena_to_dict(r, current_user_id=user_id) for r in paginated_reviews.items]

    # --- Construcción de la Respuesta ---
    average_rating = producto.calificacion_promedio_almacenada if producto else 0.0

    return jsonify({
        'success': True,
        'reviews': datos,
        'total': paginated_reviews.total,
        'page': paginated_reviews.page,
        'pages': paginated_reviews.pages,
        'per_page': per_page,
        'average_rating': average_rating,
        'total_reviews_count': total_reviews_count
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

@reviews_bp.route('/api/reviews/<string:review_id>/view', methods=['POST'])
def registrar_vista_review(review_id):
    """
    Endpoint público para registrar una vista en una reseña.
    Este endpoint es llamado por el frontend cuando una reseña se vuelve visible
    en la pantalla del usuario.
    """
    try:
        # Usamos with_for_update para bloquear la fila y evitar race conditions,
        # aunque la actualización atómica en el modelo ya ayuda mucho.
        reseña = Reseñas.query.with_for_update().get(review_id)
        if reseña:
            reseña.incrementar_visitas()
            # Devolvemos el nuevo conteo para que el frontend pueda actualizarse en tiempo real.
            return jsonify({'success': True, 'visitas': reseña.visitas}), 200
        return jsonify({'success': False, 'error': 'Reseña no encontrada'}), 404
    except Exception as e:
        current_app.logger.error(f"Error al registrar vista para la reseña {review_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Error interno del servidor'}), 500

@reviews_bp.route('/api/reviews/<string:review_id>/vote', methods=['POST'])
@jwt_required
def votar_review(usuario, review_id):
    """
    Endpoint protegido para que un usuario dé "me gusta" (vote) a una reseña.
    Es una acción de tipo "toggle": si ya votó, quita el voto; si no, lo añade.
    """
    _log_request_info('votar_review', f'usuario={usuario.id}, review_id={review_id}')

    reseña = Reseñas.query.get(review_id)
    if not reseña:
        return jsonify({'success': False, 'error': 'Reseña no encontrada'}), 404

    try:
        # ---  Bloqueo Pesimista ---
        # Se utiliza `with_for_update()` para bloquear la fila del voto (o el espacio donde iría)
        # y prevenir condiciones de carrera (race conditions) si el usuario hace doble clic.
        # Esto asegura que solo una transacción a la vez pueda verificar y modificar el voto.
        voto_existente = ReseñaVoto.query.with_for_update().filter_by(
            usuario_id=usuario.id, reseña_id=review_id
        ).first()

        # La lógica de toggle permanece igual, pero ahora es atómica.
        if voto_existente:
            # Si ya existe un voto, lo eliminamos (toggle off)
            db.session.delete(voto_existente)
            accion = 'voto_eliminado'
            mensaje = 'Voto eliminado.'
        else:
            # Si no existe, creamos un nuevo voto (toggle on)
            nuevo_voto = ReseñaVoto(usuario_id=usuario.id, reseña_id=review_id)
            db.session.add(nuevo_voto)
            accion = 'voto_agregado'
            mensaje = '¡Gracias por tu voto!'
        
        db.session.commit()
        
        # Actualizamos el contador en la reseña para mantenerlo sincronizado
        reseña.actualizar_votos_count()

        return jsonify({'success': True, 'message': mensaje, 'accion': accion, 'votos_utiles_count': reseña.votos_utiles_count})

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al votar en la reseña {review_id} por usuario {usuario.id}: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Error al procesar el voto'}), 500

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


@reviews_bp.route('/api/reviews/recent')
def get_recent_reviews():
    """
    API: Obtiene las reseñas más recientes para mostrar en la sección de reseñas.

    Returns:
        JSON: Una lista de las últimas reseñas, con información del producto y del usuario.
    """
    try:
        # Obtener las 10 reseñas más recientes
        recent_reviews = Reseñas.query.order_by(Reseñas.created_at.desc()).limit(12).all()
        
        # Serializar las reseñas
        reviews_data = []
        for review in recent_reviews:
            review_dict = resena_to_dict(review)
            # Incluir información del producto para el enlace
            if review.producto:
                review_dict['producto'] = {
                    'id': review.producto.id,
                    'nombre': review.producto.nombre,
                    'slug': review.producto.slug,
                    # Para construir la URL del detalle del producto, necesitamos los slugs de la jerarquía
                    'categoria_principal_slug': review.producto.seudocategoria.subcategoria.categoria_principal.slug if review.producto.seudocategoria and review.producto.seudocategoria.subcategoria and review.producto.seudocategoria.subcategoria.categoria_principal else None,
                    'subcategoria_slug': review.producto.seudocategoria.subcategoria.slug if review.producto.seudocategoria and review.producto.seudocategoria.subcategoria else None,
                    'seudocategoria_slug': review.producto.seudocategoria.slug if review.producto.seudocategoria else None,
                }
            reviews_data.append(review_dict)
        
        return jsonify(reviews_data)
    except Exception as e:
        print(f"Error en get_recent_reviews: {str(e)}")
        return jsonify({'error': str(e)}), 500
    

@reviews_bp.route('/api/reviews', methods=['GET'])
def listar_reviews_globales():
    """
    Endpoint público para listar las reseñas más recientes de todos los productos.
    
    Query Params:
        - page (int, opcional): Número de página para la paginación. Default: 1.
        - per_page (int, opcional): Reseñas por página. Default: 10.
        - sort (str, opcional): Criterio de ordenamiento. Opciones:
            - 'newest': Más recientes.
            - 'highest': Mejor calificadas.
            - 'helpful': Más útiles (por votos).
            - Default: Más recientes.
    
    Returns:
        JSON: Un objeto con la lista de reseñas y metadatos de paginación.
    """
    _log_request_info('listar_reviews_globales')
    
    # Parámetros de paginación y filtrado
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 12, type=int)
    sort = request.args.get('sort', 'newest')
    
    user_id = None
    auth_header = request.headers.get('Authorization')
    if auth_header:
        try:
            token = auth_header.split(' ')[1]
            payload = decode_jwt_token(token)
            if payload:
                user_id = payload.get('user_id')
        except Exception:
            current_app.logger.error("Error decoding token in listar_reviews_globales", exc_info=True)

    # Query base
    query = Reseñas.query.options(
        joinedload(Reseñas.usuario),
        joinedload(Reseñas.producto)
    )
    
    if user_id:
        query = query.options(selectinload(Reseñas.votos))

    # Lógica de ordenamiento
    if sort == 'highest':
        query = query.order_by(Reseñas.calificacion.desc(), Reseñas.created_at.desc())
    elif sort == 'helpful':
        # Ordenar por votos útiles.
        # Se usa `desc()` para que los más votados aparezcan primero.
        # Se añade un orden secundario por fecha para mantener consistencia.
        query = query.order_by(desc(Reseñas.votos_utiles_count), Reseñas.created_at.desc())
    else:  # 'newest' o default
        query = query.order_by(Reseñas.created_at.desc())
    
    paginated_reviews = query.paginate(
        page=page,
        per_page=per_page,
        error_out=False
    )
    
    datos = [resena_to_dict(r, current_user_id=user_id) for r in paginated_reviews.items]
    
    return jsonify({
        'success': True,
        'reviews': datos,
        'total': paginated_reviews.total,
        'page': paginated_reviews.page,
        'pages': paginated_reviews.pages,
        'per_page': per_page
    })

@reviews_bp.route('/api/reviews/<string:review_id>', methods=['GET'])
def obtener_review_por_id(review_id):
    """
    Endpoint público para obtener una reseña por su ID.
    
    Args:
        review_id (str): El ID de la reseña.
    
    Returns:
        JSON: Un objeto con los datos de la reseña.
    """
    _log_request_info('obtener_review_por_id', f'review_id={review_id}')
    
    review = Reseñas.query.options(
        joinedload(Reseñas.usuario),
        joinedload(Reseñas.producto)
    ).filter_by(id=review_id).first()
    
    if not review:
        return jsonify({'success': False, 'error': 'Reseña no encontrada'}), 404
    
    datos = resena_to_dict(review)
    
    # Verificar si el usuario autenticado es el autor de la reseña
    user_id = None
    auth_header = request.headers.get('Authorization')
    if auth_header:
        try:
            token = auth_header.split(' ')[1]
            payload = decode_jwt_token(token)
            if payload:
                user_id = payload.get('user_id')
        except Exception:
            current_app.logger.error("Error decoding token in obtener_review_por_id", exc_info=True)
            user_id = None
    
    datos['puede_editar'] = (user_id is not None and datos['usuario']['id'] == user_id)
    
    return jsonify({
        'success': True,
        'review': datos
    })

@reviews_bp.route('/api/reviews/stats', methods=['GET'])
def get_reviews_stats():
    """
    API: Obtiene estadísticas globales de todas las reseñas.

    Calcula el número total de reseñas y la calificación promedio de todas ellas.
    Es ideal para alimentar un dashboard o una sección de resumen como `_reviews_section.html`.

    Returns:
        JSON: Un objeto con `total_reviews` y `average_rating`.
    """
    try:
        stats = db.session.query(
            func.count(Reseñas.id),
            func.avg(Reseñas.calificacion)
        ).one()
        
        return jsonify({
            'success': True,
            'total_reviews': stats[0] or 0,
            'average_rating': float(stats[1]) if stats[1] else 0.0
        })
    except Exception as e:
        current_app.logger.error(f"Error al obtener estadísticas de reseñas: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Error interno del servidor'}), 500
