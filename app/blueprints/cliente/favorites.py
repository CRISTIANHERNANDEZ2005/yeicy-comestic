"""
Módulo para manejar las operaciones relacionadas con los favoritos del usuario.
"""
from app.extensions import db
from app.utils.jwt_utils import jwt_required
from datetime import datetime
from app.models.domains.product_models import Productos, CategoriasPrincipales, Subcategorias, Seudocategorias
from app.models.domains.review_models import Likes
from app.models.serializers import producto_to_dict, categoria_principal_to_dict, subcategoria_to_dict, seudocategoria_to_dict, like_to_dict
from flask import Blueprint, render_template, request, jsonify
from sqlalchemy.orm import joinedload
from app.blueprints.cliente.cart import get_cart_items, get_or_create_cart

# Crear el blueprint para favoritos
favorites_bp = Blueprint('favorites', __name__)


@favorites_bp.route('/api/favoritos', methods=['GET', 'POST'])
@jwt_required
def manejar_favoritos(usuario):
    """
    Maneja las operaciones CRUD para los favoritos del usuario.

    GET: 
      - Retorna la lista de favoritos del usuario
      - Parámetros opcionales:
        - page: Número de página (default: 1)
        - per_page: Items por página (default: 20)
        - ids_only: Si es 'true', devuelve solo los IDs (default: false)
        - sort_by: Campo para ordenar (fecha, nombre, precio)
        - sort_order: Orden (asc, desc)

    POST: 
      - Agrega o elimina un producto de favoritos
      - Body: { "producto_id": int, "accion": "agregar"|"eliminar" (opcional) }
    """
    from flask import current_app

    if request.method == 'GET':
        try:
            # Validación y obtención de parámetros
            page = request.args.get('page', 1, type=int)
            per_page = min(request.args.get('per_page', 20, type=int), 100)
            ids_only = request.args.get('ids_only', 'false').lower() == 'true'
            sort_by = request.args.get('sort_by', 'fecha').lower()
            sort_order = request.args.get('sort_order', 'desc').lower()

            if page < 1 or per_page < 1:
                return jsonify({'success': False, 'error': 'Los parámetros de paginación deben ser mayores a 0', 'code': 'INVALID_PAGINATION'}), 400

            # Validar sort_by y sort_order
            valid_sort_fields = {'fecha': Likes.created_at,
                                 'nombre': Productos.nombre, 'precio': Productos.precio}
            if sort_by not in valid_sort_fields:
                sort_by = 'fecha'
            order_field = valid_sort_fields[sort_by].asc(
            ) if sort_order == 'asc' else valid_sort_fields[sort_by].desc()

            # Consulta de favoritos
            query = Likes.query.filter_by(usuario_id=usuario.id, estado='activo')\
                .join(Productos).filter(Productos.estado == 'activo')\
                .options(
                    joinedload(Likes.producto).joinedload(
                        Productos.seudocategoria)
                    .joinedload(Seudocategorias.subcategoria)
                    .joinedload(Subcategorias.categoria_principal)
            )\
                .order_by(order_field)

            # IDs only
            if ids_only:
                favoritos_ids = [str(fav.producto_id) for fav in query.all()]
                return jsonify({'success': True, 'favoritos': favoritos_ids, 'total': len(favoritos_ids)}), 200

            # Paginación
            pagination = query.paginate(
                page=page, per_page=per_page, error_out=False)
            favoritos = pagination.items

            # Respuesta
            # Agrupar favoritos por categoría principal
            favoritos_por_categoria = {}
            for fav in favoritos:
                categoria_principal_nombre = fav.producto.seudocategoria.subcategoria.categoria_principal.nombre \
                    if fav.producto.seudocategoria and fav.producto.seudocategoria.subcategoria and fav.producto.seudocategoria.subcategoria.categoria_principal else 'Sin Categoría'
                
                if categoria_principal_nombre not in favoritos_por_categoria:
                    favoritos_por_categoria[categoria_principal_nombre] = []
                
                favoritos_por_categoria[categoria_principal_nombre].append({
                    'id': fav.producto.id,
                    'fecha_agregado': fav.created_at.isoformat() if hasattr(fav, 'created_at') else None,
                    'producto': {
                        'id': fav.producto.id,
                        'nombre': fav.producto.nombre,
                        'precio': float(fav.producto.precio),
                        'imagen_url': fav.producto.imagen_url,
                        'marca': fav.producto.marca,
                        'existencia': fav.producto._existencia,
                        'es_favorito': True,
                        'categoria': categoria_principal_nombre,
                        'subcategoria': fav.producto.seudocategoria.subcategoria.nombre if fav.producto.seudocategoria and fav.producto.seudocategoria.subcategoria else None,
                        'seudocategoria': fav.producto.seudocategoria.nombre if fav.producto.seudocategoria else None
                    }
                })

            response_data = {
                'success': True,
                'favoritos_por_categoria': favoritos_por_categoria, # Nuevo campo
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': pagination.total,
                    'pages': pagination.pages,
                    'has_next': pagination.has_next,
                    'has_prev': pagination.has_prev
                },
                'sort': {'by': sort_by, 'order': sort_order}
            }
            response = jsonify(response_data)
            response.headers['Cache-Control'] = 'private, max-age=60'
            return response, 200
        except Exception as e:
            current_app.logger.error(
                f'Error al obtener favoritos: {str(e)}', exc_info=True)
            db.session.rollback()
            return jsonify({'success': False, 'error': 'Error interno', 'details': str(e), 'code': 'SERVER_ERROR'}), 500

    elif request.method == 'POST':
        try:
            data = request.get_json()
            if not data:
                return jsonify({
                    'success': False,
                    'error': 'No se proporcionaron datos en la solicitud',
                    'code': 'MISSING_DATA'
                }), 400

            # Asegurarse que el producto_id sea string (UUID)
            producto_id = data.get('producto_id')
            if producto_id is not None:
                producto_id = str(producto_id)
            # Por defecto: toggle
            accion = data.get('accion', 'toggle').lower()

            # Validar acción
            if accion not in ['agregar', 'eliminar', 'toggle']:
                return jsonify({
                    'success': False,
                    'error': 'Acción no válida. Use: agregar, eliminar o toggle',
                    'code': 'INVALID_ACTION'
                }), 400

            if not producto_id:
                return jsonify({
                    'success': False,
                    'error': 'ID de producto no proporcionado',
                    'code': 'MISSING_PRODUCT_ID'
                }), 400

            # Verificar si el producto existe y está activo
            producto = Productos.query.filter_by(
                id=producto_id,
                estado='activo'
            ).first()

            if not producto:
                return jsonify({
                    'success': False,
                    'error': 'Producto no encontrado o no disponible',
                    'code': 'PRODUCT_NOT_FOUND'
                }), 404

            # Buscar favorito existente (activo o inactivo)
            favorito = Likes.query.filter_by(
                usuario_id=usuario.id,
                producto_id=producto_id
            ).first()

            # Determinar la acción a realizar
            if accion == 'toggle':
                accion = 'eliminar' if (
                    favorito and favorito.estado == 'activo') else 'agregar'

            # Procesar la acción
            if accion == 'eliminar':
                if not favorito or favorito.estado == 'inactivo':
                    return jsonify({
                        'success': True,
                        'message': 'El producto no está en favoritos',
                        'es_favorito': False,
                        'producto_id': producto_id,
                        'accion': 'noop'
                    }), 200

                # Marcar como inactivo (eliminación lógica)
                favorito.estado = 'inactivo'
                favorito.fecha_actualizacion = datetime.utcnow()
                db.session.commit()

                current_app.logger.info(
                    f'Usuario {usuario.id} eliminó el producto {producto_id} de favoritos')

                return jsonify({
                    'success': True,
                    'message': 'Producto eliminado de favoritos',
                    'es_favorito': False,
                    'producto_id': producto_id,
                    'accion': 'eliminado'
                }), 200

            else:  # accion == 'agregar'
                if favorito:
                    if favorito.estado == 'activo':
                        return jsonify({
                            'success': True,
                            'message': 'El producto ya está en favoritos',
                            'es_favorito': True,
                            'producto_id': producto_id,
                            'accion': 'noop'
                        }), 200
                    else:
                        # Reactivar favorito existente
                        favorito.estado = 'activo'
                        favorito.fecha = datetime.utcnow()
                        accion_realizada = 'reactivado'
                else:
                    # Crear nuevo favorito
                    favorito = Likes(
                        usuario_id=usuario.id,
                        producto_id=producto_id,
                        estado='activo'
                    )
                    db.session.add(favorito)
                    accion_realizada = 'agregado'

                db.session.commit()
                current_app.logger.info(
                    f'Usuario {usuario.id} {accion_realizada} el producto {producto_id} en favoritos')

                return jsonify({
                    'success': True,
                    'message': f'Producto {accion_realizada} a favoritos',
                    'es_favorito': True,
                    'producto_id': producto_id,
                    'accion': accion_realizada
                }), 201 if accion_realizada == 'agregado' else 200

        except Exception as e:
            db.session.rollback()
            current_app.logger.error(
                f'Error al agregar a favoritos: {str(e)}', exc_info=True)
            return jsonify({
                'success': False,
                'error': 'Error al procesar la solicitud',
                'details': str(e) if current_app.debug else None,
                'code': 'SERVER_ERROR'
            }), 500


@favorites_bp.route('/api/favoritos/<int:producto_id>', methods=['DELETE'])
@jwt_required
def eliminar_favorito(usuario, producto_id):
    """
    Elimina un producto de los favoritos del usuario.

    Este endpoint es un alias para POST /api/favoritos con accion=eliminar
    """
    from flask import current_app, jsonify, request

    try:
        # Verificar si el producto existe y está activo
        producto = Productos.query.filter_by(
            id=producto_id,
            estado='activo'
        ).first()

        if not producto:
            return jsonify({
                'success': False,
                'error': 'Producto no encontrado o no disponible',
                'code': 'PRODUCT_NOT_FOUND'
            }), 404

        # Buscar el favorito (activo o inactivo)
        favorito = Likes.query.filter_by(
            usuario_id=usuario.id,
            producto_id=producto_id
        ).first()

        # Si no existe o ya está inactivo, devolver éxito
        if not favorito or favorito.estado == 'inactivo':
            return jsonify({
                'success': True,
                'message': 'El producto no estaba en favoritos',
                'es_favorito': False,
                'producto_id': producto_id,
                'accion': 'noop'
            }), 200

        # Marcar como inactivo (eliminación lógica)
        favorito.estado = 'inactivo'
        favorito.fecha_actualizacion = datetime.utcnow()
        db.session.commit()

        # Registrar la acción
        current_app.logger.info(
            f'Usuario {usuario.id} eliminó el producto {producto_id} de favoritos')

        # Devolver respuesta consistente con el endpoint POST
        return jsonify({
            'success': True,
            'message': 'Producto eliminado de favoritos',
            'es_favorito': False,
            'producto_id': producto_id,
            'accion': 'eliminado'
        }), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(
            f'Error al eliminar de favoritos: {str(e)}', exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Error al eliminar el producto de favoritos',
            'details': str(e) if current_app.debug else None,
            'code': 'SERVER_ERROR'
        }), 500


@favorites_bp.route('/api/favoritos/sincronizar', methods=['POST'])
@jwt_required
def sincronizar_favoritos(usuario):
    """
    Sincroniza los favoritos locales con los del servidor de manera más eficiente.

    Body:
    {
        "favoritos_locales": [int],  # Lista de IDs de productos favoritos locales
        "timestamp": int,            # Timestamp de la última sincronización (opcional)
        "acciones": [               # Acciones pendientes de sincronizar
            {
                "producto_id": int,
                "accion": "agregar" | "eliminar",
                "timestamp": int
            }
        ]
    }

    Retorna:
    {
        "success": bool,
        "favoritos_actualizados": [int],  # Lista completa de IDs de favoritos
        "timestamp": int,                 # Timestamp de la sincronización
        "needs_sync": bool,               # Si se requirió sincronización
        "removed": [int],                 # IDs que fueron eliminados
        "server_timestamp": int,          # Timestamp del servidor
        "estado_actual": {                # Estado actual de los favoritos
            "favoritos": [int],
            "timestamp": int
        }
    }
    """
    from flask import current_app, request, jsonify

    try:
        # Obtener favoritos actuales del usuario
        favoritos_actuales = set(
            fav[0] for fav in db.session.query(Likes.producto_id)
            .filter(
                Likes.usuario_id == usuario.id,
                Likes.estado == 'activo',
                Productos.estado == 'activo'
            )
            .join(Productos)
            .all()
        )

        # Obtener datos de la solicitud
        data = request.get_json()
        favoritos_locales = data.get('favoritos_locales', [])
        timestamp = data.get('timestamp')
        acciones_pendientes = data.get('acciones', [])

        # Obtener timestamp del servidor
        server_timestamp = int(datetime.utcnow().timestamp())

        # Verificar si los favoritos locales coinciden con los del servidor
        if set(favoritos_locales) == favoritos_actuales and not acciones_pendientes:
            return jsonify({
                'success': True,
                'favoritos_actualizados': list(favoritos_actuales),
                'timestamp': server_timestamp,
                'server_timestamp': server_timestamp,
                'needs_sync': False,
                'removed': [],
                'estado_actual': {
                    'favoritos': list(favoritos_actuales),
                    'timestamp': server_timestamp
                }
            }), 200

        # Procesar acciones pendientes de manera más eficiente
        acciones_por_tipo = {'agregar': [], 'eliminar': []}

        # Agrupar acciones por tipo para procesamiento por lotes
        for accion in acciones_pendientes:
            if not accion.get('producto_id') or accion.get('accion') not in ['agregar', 'eliminar']:
                continue
            acciones_por_tipo[accion['accion']].append(accion['producto_id'])

        # Procesar eliminaciones
        if acciones_por_tipo['eliminar']:
            # Eliminar en lote
            Likes.query.filter(
                Likes.usuario_id == usuario.id,
                Likes.producto_id.in_(acciones_por_tipo['eliminar'])
            ).update({'estado': 'inactivo'}, synchronize_session='fetch')

            # Actualizar conjunto local
            favoritos_actuales.difference_update(acciones_por_tipo['eliminar'])

        # Procesar adiciones
        if acciones_por_tipo['agregar']:
            # Filtrar productos que ya están en favoritos
            productos_a_agregar = [
                pid for pid in acciones_por_tipo['agregar']
                if pid not in favoritos_actuales
            ]

            if productos_a_agregar:
                # Verificar que los productos existan y estén activos
                productos_validos = set(
                    pid[0] for pid in db.session.query(Productos.id)
                    .filter(
                        Productos.id.in_(productos_a_agregar),
                        Productos.estado == 'activo'
                    )
                    .all()
                )

                # Insertar en lote
                nuevos_favoritos = [
                    {
                        'usuario_id': usuario.id,
                        'producto_id': pid,
                        'estado': 'activo',
                        'fecha': datetime.utcnow()
                    }
                    for pid in productos_validos
                ]

                if nuevos_favoritos:
                    db.session.bulk_insert_mappings(
                        # type: ignore[arg-type]
                        Likes.__mapper__, nuevos_favoritos)
                    favoritos_actuales.update(productos_validos)

        # Confirmar cambios en la base de datos
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(
                f'Error en sincronización de favoritos: {str(e)}')
            return jsonify({
                'success': False,
                'error': 'Error al procesar las acciones de sincronización',
                'code': 'SYNC_ERROR'
            }), 500

        # Obtener lista de IDs eliminados
        current_app.logger.info(
            f"Favoritos sincronizados para usuario {usuario.id}")

        # Obtener la lista completa de favoritos actualizada
        favoritos_actuales = Likes.query.filter_by(
            usuario_id=usuario.id, estado='activo').all()
        todos_favoritos = [{
            'id': fav.producto.id,
            'nombre': fav.producto.nombre,
            'precio': float(fav.producto.precio),
            'imagen_url': fav.producto.imagen_url,
            'marca': fav.producto.marca,
            'existencia': fav.producto._existencia,
            'es_favorito': True
        } for fav in favoritos_actuales if fav.producto and fav.producto.estado == 'activo']

        return jsonify({
            'success': True,
            'message': 'Favoritos sincronizados correctamente',
            'favorites': todos_favoritos
        })

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(
            f"Error al sincronizar favoritos: {str(e)}", exc_info=True)
        return jsonify({'error': 'Error al sincronizar favoritos'}), 500

# Ruta para la página de favoritos


@favorites_bp.route('/favoritos')
@jwt_required
def favoritos(usuario):
    """
    Muestra la página de productos favoritos del usuario
    quiero que mejores el endpoint de la pagina de favoritos para que devuelva correctamente los productos que tiene el usuarios en la base de datos, ya que antes de realizarme las mejoras como te mensione habia eliminado un producto en la pagina de favorito cuando ya me realizastes las mejoras ya puedo eliminar los productos de la pagina de favoritos y volverlos a colocar desde la pagina principal pero como habia eliminado antes de la mejora que me realizaste ahora ese producto no me aparece en la pagina de favorito pero si en la base de datos.
    """
    from flask import current_app as app, session
    app.logger.info("Accediendo a la página de favoritos")

    try:
        # Validar que el usuario esté autenticado
        user_id = usuario.id if hasattr(usuario, 'id') else None
        if not user_id and 'user' in session:
            user_id = session['user'].get('id')

        if not user_id:
            app.logger.warning(
                "Intento de acceso a favoritos sin ID de usuario.")
            return jsonify({'error': 'No autorizado'}), 401

        app.logger.info(f"Buscando favoritos para el usuario ID: {user_id}")

        # Obtener los objetos 'Like' de los favoritos, asegurando que el producto esté activo
        likes = Likes.query.filter_by(usuario_id=user_id, estado='activo')\
            .join(Likes.producto)\
            .filter(Productos.estado == 'activo')\
            .options(\
                joinedload(Likes.producto).joinedload(\
                    Productos.seudocategoria)\
                .joinedload(Seudocategorias.subcategoria)\
                .joinedload(Subcategorias.categoria_principal)\
            )\
            .all()
        app.logger.info(
            f"Se encontraron {len(likes)} registros de 'likes' activos.")

        # Crear una lista plana de productos favoritos
        favoritos = [producto_to_dict(like.producto) for like in likes if like.producto]
        app.logger.info(f"Se encontraron {len(favoritos)} productos favoritos para el usuario con ID {user_id}")

        # Obtener categorías para el menú (se mantiene por si se usa en la base.html)
        categorias = CategoriasPrincipales.query.filter_by(estado='activo')\
            .options(
                joinedload(CategoriasPrincipales.subcategorias).joinedload(
                    Subcategorias.seudocategorias)
        ).all()

        if not categorias:
            app.logger.info("No se encontraron categorías activas")

        app.logger.info("Renderizando la plantilla de favoritos.html con una lista única de favoritos.")
        # Renderizar la plantilla, pasando la lista única de favoritos
        return render_template('cliente/componentes/favoritos.html', favoritos=favoritos, categorias=categorias), 200

    except Exception as e:
        app.logger.error(
            f"Error al procesar la página de favoritos: {str(e)}", exc_info=True)
        return jsonify({'error': 'Error interno del servidor'}), 500
