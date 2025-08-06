# app/blueprints/products.py
from flask import Blueprint, render_template, request, jsonify, session
from app.models.models import Producto, CategoriaPrincipal, Subcategoria, Seudocategoria, BusquedaTermino, Like, Reseña
from app.extensions import db
from sqlalchemy import func
from sqlalchemy.orm import joinedload
from app.blueprints.cart import get_cart_items, get_or_create_cart
from datetime import datetime, timedelta
from app.utils.jwt_utils import jwt_required

products_bp = Blueprint('products', __name__)

# ---------------------- FAVORITOS (LIKES) ----------------------

@products_bp.route('/api/favoritos', methods=['GET'])
@jwt_required
def listar_favoritos(usuario):
    from flask import current_app as app, session
    
    # Obtener el ID del usuario autenticado
    user_id = usuario.id if hasattr(usuario, 'id') else None
    
    if not user_id and 'user' in session:
        user_id = session['user'].get('id')
    
    if not user_id:
        return jsonify({'error': 'No autorizado'}), 401
        
    app.logger.info(f"Listando favoritos para usuario {user_id}")
    favoritos = Like.query.filter_by(usuario_id=user_id, estado='activo').all()
    
    productos = [
        {
            'id': fav.producto.id,
            'nombre': fav.producto.nombre,
            'precio': float(fav.producto.precio),
            'imagen_url': fav.producto.imagen_url,
            'marca': fav.producto.marca,
            'stock': fav.producto.stock,
            'es_favorito': True  # Indica que ya está en favoritos
        }
        for fav in favoritos if fav.producto and fav.producto.estado == 'activo'
    ]
    
    app.logger.info(f"Usuario {user_id} tiene {len(productos)} favoritos")
    return jsonify({'favoritos': productos, 'total': len(productos)})

@products_bp.route('/api/favoritos/<int:producto_id>', methods=['POST'])
@jwt_required
def agregar_favorito(usuario, producto_id):
    from flask import current_app as app, session
    
    # Obtener el ID del usuario autenticado
    user_id = usuario.id if hasattr(usuario, 'id') else None
    
    if not user_id and 'user' in session:
        user_id = session['user'].get('id')
    
    if not user_id:
        return jsonify({'error': 'No autorizado'}), 401
        
    app.logger.info(f"Usuario {user_id} intenta agregar favorito {producto_id}")
    producto = Producto.query.get(producto_id)
    
    if not producto or producto.estado != 'activo':
        app.logger.warning(f"Producto {producto_id} no encontrado o inactivo para usuario {user_id}")
        return jsonify({'error': 'Producto no encontrado'}), 404
        
    existente = Like.query.filter_by(usuario_id=user_id, producto_id=producto_id).first()
    
    if existente:
        app.logger.info(f"Usuario {user_id} ya tenía favorito {producto_id}")
        return jsonify({'message': 'Ya está en favoritos', 'es_favorito': True}), 200
    else:
        nuevo_favorito = Like(usuario_id=user_id, producto_id=producto_id)
        db.session.add(nuevo_favorito)
        try:
            db.session.commit()
            app.logger.info(f"Producto {producto_id} agregado a favoritos por usuario {user_id}")
            return jsonify({'message': 'Agregado a favoritos', 'es_favorito': True}), 201
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error al agregar a favoritos: {str(e)}", exc_info=True)
            return jsonify({'error': 'Error al agregar a favoritos'}), 500

@products_bp.route('/api/favoritos/<int:producto_id>', methods=['DELETE'])
@jwt_required
def eliminar_favorito(usuario, producto_id):
    from flask import current_app as app
    app.logger.info(f"Usuario {usuario.id} elimina favorito {producto_id}")
    like = Like.query.filter_by(usuario_id=usuario.id, producto_id=producto_id, estado='activo').first()
    if not like:
        app.logger.warning(f"Usuario {usuario.id} intentó eliminar favorito inexistente {producto_id}")
        return jsonify({'error': 'El producto no está en favoritos'}), 404
    like.estado = 'inactivo'
    like.fecha = datetime.utcnow()
    db.session.commit()
    app.logger.info(f"Usuario {usuario.id} eliminó favorito {producto_id}")
    return jsonify({'message': 'Producto eliminado de favoritos'})

# ---------------------- RESEÑAS ----------------------

@products_bp.route('/api/productos/<int:producto_id>/reseñas', methods=['GET'])
def listar_resenas(producto_id):
    from flask import current_app as app
    app.logger.info(f"Listando reseñas para producto {producto_id}")
    producto = Producto.query.get(producto_id)
    if not producto or producto.estado != 'activo':
        app.logger.warning(f"Producto {producto_id} no encontrado o inactivo al listar reseñas")
        return jsonify({'error': 'Producto no encontrado'}), 404
    resenas = Reseña.query.filter_by(producto_id=producto_id, estado='activo').order_by(Reseña.fecha.desc()).all()
    datos = [
        {
            'id': r.id,
            'usuario': {
                'id': r.usuario.id,
                'nombre': r.usuario.nombre,
                'apellido': r.usuario.apellido
            },
            'texto': r.texto,
            'calificacion': r.calificacion,
            'fecha': r.fecha.isoformat()
        }
        for r in resenas
    ]
    app.logger.info(f"Producto {producto_id} tiene {len(datos)} reseñas activas")
    return jsonify({'reseñas': datos, 'total': len(datos)})

@products_bp.route('/api/productos/<int:producto_id>/reseñas', methods=['POST'])
@jwt_required
def crear_resena(usuario, producto_id):
    from flask import current_app as app
    app.logger.info(f"Usuario {usuario.id} intenta crear reseña para producto {producto_id}")
    producto = Producto.query.get(producto_id)
    if not producto or producto.estado != 'activo':
        app.logger.warning(f"Producto {producto_id} no encontrado o inactivo al crear reseña por usuario {usuario.id}")
        return jsonify({'error': 'Producto no encontrado'}), 404
    data = request.get_json()
    texto = data.get('texto', '').strip()
    calificacion = data.get('calificacion')
    if not texto or not calificacion:
        app.logger.warning(f"Usuario {usuario.id} intentó crear reseña sin texto o calificación")
        return jsonify({'error': 'Texto y calificación requeridos'}), 400
    if not (1 <= int(calificacion) <= 5):
        app.logger.warning(f"Usuario {usuario.id} intentó calificación inválida: {calificacion}")
        return jsonify({'error': 'La calificación debe estar entre 1 y 5'}), 400
    nueva_resena = Reseña(
        usuario_id=usuario.id,
        producto_id=producto_id,
        texto=texto,
        calificacion=int(calificacion)
    )
    db.session.add(nueva_resena)
    db.session.commit()
    app.logger.info(f"Usuario {usuario.id} creó reseña {nueva_resena.id} para producto {producto_id}")
    return jsonify({'message': 'Reseña creada exitosamente', 'reseña_id': nueva_resena.id}), 201


@products_bp.route('/producto/<int:producto_id>')
def producto_detalle(producto_id):
    """
    Muestra los detalles de un producto específico
    """
    producto = Producto.query.get_or_404(producto_id)
    
    # Verificar si el producto está activo
    if producto.estado != 'activo':
        from flask import abort
        abort(404)
    
    # Obtener productos relacionados (misma categoría principal)
    productos_relacionados = Producto.query.join(
        Seudocategoria, Producto.seudocategoria_id == Seudocategoria.id
    ).join(
        Subcategoria, Seudocategoria.subcategoria_id == Subcategoria.id
    ).filter(
        Producto.id != producto.id,
        Producto.estado == 'activo',
        Subcategoria.categoria_principal_id == producto.seudocategoria.subcategoria.categoria_principal_id
    ).limit(4).all()
    
    # Obtener reseñas del producto
    reseñas = Reseña.query.filter_by(
        producto_id=producto.id,
        estado='activo'
    ).order_by(Reseña.fecha.desc()).all()
    
    # Calcular calificación promedio
    calificacion_promedio = db.session.query(
        db.func.avg(Reseña.calificacion)
    ).filter(
        Reseña.producto_id == producto.id,
        Reseña.estado == 'activo'
    ).scalar() or 0
    
    # Verificar si el usuario actual ha dado like al producto
    es_favorito = False
    if 'user' in session:
        like = Like.query.filter_by(
            usuario_id=session['user'].get('id'),
            producto_id=producto.id,
            estado='activo'
        ).first()
        es_favorito = like is not None
    
    return render_template(
        'cliente/page/producto_detalle.html',
        producto=producto,
        productos_relacionados=productos_relacionados,
        reseñas=reseñas,
        calificacion_promedio=round(float(calificacion_promedio), 1),
        es_favorito=es_favorito,
        title=f"{producto.nombre} - YE & CY Cosméticos"
    )

@products_bp.route('/')
@products_bp.route('/products')
def index():
    """
    Endpoint principal que muestra productos de la categoría 'Maquillaje'
    o todos los productos si no existe la categoría
    """
    # Obtener categorías principales (sin cambios - ya está perfecto)
    categorias = CategoriaPrincipal.query\
        .filter_by(estado='activo')\
        .options(
            joinedload(CategoriaPrincipal.subcategorias)
            .joinedload(Subcategoria.seudocategorias)
        )\
        .all()

    # Filtrar subcategorías y seudocategorías activas
    for categoria in categorias:
        categoria.subcategorias = [
            sub for sub in categoria.subcategorias if sub.estado == 'activo']
        for subcategoria in categoria.subcategorias:
            subcategoria.seudocategorias = [
                seudo for seudo in subcategoria.seudocategorias if seudo.estado == 'activo']

    # Buscar la categoría principal "Maquillaje"
    categoria_maquillaje = CategoriaPrincipal.query.filter(
        func.lower(CategoriaPrincipal.nombre) == 'maquillaje',
        CategoriaPrincipal.estado == 'activo'
    ).first()

    # Obtener productos de la categoría "Maquillaje" o productos destacados si no existe
    if categoria_maquillaje:
        # Obtener IDs de todas las seudocategorías bajo "Maquillaje"
        seudocategoria_ids = db.session.query(Seudocategoria.id)\
            .join(Subcategoria)\
            .filter(
                Subcategoria.categoria_principal_id == categoria_maquillaje.id,
                Seudocategoria.estado == 'activo'
        ).all()

        seudocategoria_ids = [id[0] for id in seudocategoria_ids]

        # Filtrar productos de esta categoría
        productos = Producto.query\
            .filter(
                Producto.seudocategoria_id.in_(seudocategoria_ids),
                Producto.estado == 'activo'
            )\
            .order_by(func.random())\
            .limit(12)\
            .all()
    else:
        # Fallback: productos destacados si no existe "Maquillaje"
        productos = Producto.query\
            .filter_by(estado='activo')\
            .order_by(func.random())\
            .limit(12)\
            .all()

    # Preparar datos para JavaScript con lógica de "nuevo"

    productos_data = [{
        'id': p.id,
        'nombre': p.nombre,
        'descripcion': p.descripcion,
        'precio': float(p.precio),
        'imagen_url': p.imagen_url,
        'marca': p.marca or '',
        'calificacion_promedio': p.calificacion_promedio,
        'reseñas': len(p.reseñas),
        'stock': p.stock,
        'es_nuevo': bool(p.es_nuevo),  # FORZAR BOOLEANO
        'fecha_creacion': p.fecha_creacion.isoformat() if p.fecha_creacion else None
    } for p in productos]

    total_productos = len(productos)

    # Obtener datos del carrito
    cart_info, _ = get_or_create_cart()
    cart_items = get_cart_items(cart_info)
    total_price = sum(item['subtotal'] for item in cart_items)

    return render_template(
        'cliente/componentes/index.html',
        productos=productos,
        producto=productos[0] if productos else None,
        productos_data=productos_data,
        categorias=categorias,
        total_productos=total_productos,
        cart_items=cart_items,
        total_price=total_price,
        categoria_actual=categoria_maquillaje.nombre if categoria_maquillaje else 'Destacados'
    )


@products_bp.route('/favoritos')
@jwt_required
def favoritos(usuario):
    """
    Muestra la página de productos favoritos del usuario
    """
    from flask import current_app as app, session
    
    # Obtener el ID del usuario autenticado
    user_id = usuario.id if hasattr(usuario, 'id') else None
    
    if not user_id and 'user' in session:
        user_id = session['user'].get('id')
    
    if not user_id:
        return jsonify({'error': 'No autorizado'}), 401
    
    # Obtener productos favoritos
    favoritos = Like.query.filter_by(usuario_id=user_id, estado='activo')\
        .join(Like.producto)\
        .filter(Producto.estado == 'activo')\
        .options(joinedload(Like.producto))\
        .all()
    
    # Obtener categorías para el menú
    categorias = CategoriaPrincipal.query.filter_by(estado='activo')\
        .options(
            joinedload(CategoriaPrincipal.subcategorias).joinedload(Subcategoria.seudocategorias)
        ).all()
    
    # Obtener información del carrito
    cart = get_or_create_cart()
    cart_items = get_cart_items(cart)
    total_price = sum(item['precio'] * item['cantidad'] for item in cart_items)
    
    # Preparar datos de productos para la plantilla
    productos = [fav.producto for fav in favoritos if fav.producto]
    
    return render_template(
        'cliente/page/favoritos.html',
        productos=productos,
        productos_data=[{
            'id': p.id,
            'nombre': p.nombre,
            'descripcion': p.descripcion,
            'precio': float(p.precio),
            'imagen_url': p.imagen_url,
            'marca': p.marca or '',
            'calificacion_promedio': p.calificacion_promedio,
            'reseñas': len(p.reseñas),
            'stock': p.stock,
            'es_nuevo': bool(p.es_nuevo),  # FORZAR BOOLEANO
            'fecha_creacion': p.fecha_creacion.isoformat() if p.fecha_creacion else None
        } for p in productos],
        categorias=categorias,
        cart_items=cart_items,
        total_price=total_price,
        categoria_actual='Mis Favoritos'
    )

@products_bp.route('/buscar')
def buscar():
    query = request.args.get('q', '').strip()

    # Validación mejorada
    if not query:
        # Si no hay query, devolver solo los 10 términos más buscados
        sugerencias = BusquedaTermino.top_terminos(10)
        return jsonify({
            'resultados': [],
            'sugerencias': [s.termino for s in sugerencias],
            'query': query
        })

    # Validar longitud
    if len(query) < 1 or len(query) > 100:
        sugerencias = BusquedaTermino.top_terminos(10)
        return jsonify({
            'resultados': [],
            'sugerencias': [s.termino for s in sugerencias],
            'error': 'Término de búsqueda inválido'
        }), 400

    try:
        # Registrar búsqueda
        BusquedaTermino.registrar(query)

        # Búsqueda mejorada con prioridad
        productos = Producto.query.filter(
            db.or_(
                Producto.nombre.ilike(f'%{query}%'),
                Producto.marca.ilike(f'%{query}%'),
                Producto.descripcion.ilike(f'%{query}%')
            ),
            Producto.estado == 'activo'
        ).order_by(
            # Priorizar coincidencias exactas al inicio
            db.case(
                (Producto.nombre.ilike(f'{query}%'), 1),
                (Producto.marca.ilike(f'{query}%'), 2),
                else_=3
            ),
            Producto.nombre.asc()
        ).limit(12).all()

        # Top términos actualizados
        sugerencias = BusquedaTermino.top_terminos(10)

        return jsonify({
            'resultados': [{
                'id': p.id,
                'nombre': p.nombre,
                'imagen_url': p.imagen_url,
                'precio': float(p.precio),
                'marca': p.marca or '',
                'stock': p.stock
            } for p in productos],
            'sugerencias': [s.termino for s in sugerencias],
            'total': len(productos),
            'query': query
        })

    except Exception as e:
        print(f"Error en búsqueda: {str(e)}")
        sugerencias = BusquedaTermino.top_terminos(10)
        return jsonify({
            'error': 'Error al procesar la búsqueda',
            'resultados': [],
            'sugerencias': [s.termino for s in sugerencias]
        }), 500
