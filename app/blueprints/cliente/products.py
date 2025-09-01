# app/blueprints/products.py
from flask import Blueprint, render_template, request, jsonify, session
from app.models.domains.product_models import Productos, CategoriasPrincipales, Subcategorias, Seudocategorias
from app.models.domains.review_models import Reseñas, Likes
from app.models.domains.search_models import BusquedaTermino
from app.models.serializers import producto_to_dict, categoria_principal_to_dict, subcategoria_to_dict, seudocategoria_to_dict, busqueda_termino_to_dict
from app.extensions import db
from sqlalchemy import func
from sqlalchemy.orm import joinedload
from app.blueprints.cliente.cart import get_cart_items, get_or_create_cart
from app.utils.jwt_utils import jwt_required
from flask_login import current_user

products_bp = Blueprint('products', __name__)

@products_bp.route('/')
def index():
    """
    Endpoint principal que muestra productos de la categoría 'Maquillaje'
    o todos los productos si no existe la categoría
    """
    # Obtener categorías principales (sin cambios - ya está perfecto)
    categorias = CategoriasPrincipales.query \
        .filter_by(estado='activo') \
        .options(
            joinedload(CategoriasPrincipales.subcategorias).joinedload(Subcategorias.seudocategorias)
        )\
        .all()

    # Filtrar subcategorías y seudocategorías activas
    for categoria in categorias:
        categoria.subcategorias = [
            sub for sub in getattr(categoria, 'subcategorias', []) if sub.estado == 'activo']
        for subcategoria in categoria.subcategorias:
            subcategoria.seudocategorias = [
                seudo for seudo in getattr(subcategoria, 'seudocategorias', []) if seudo.estado == 'activo']

    # Buscar la categoría principal "Maquillaje"
    categoria_maquillaje = CategoriasPrincipales.query.filter(
        func.lower(CategoriasPrincipales.nombre) == 'maquillaje',
        CategoriasPrincipales.estado == 'activo'
    ).first()

    # Obtener productos de la categoría "Maquillaje" o productos destacados si no existe
    if categoria_maquillaje:
        # Obtener IDs de todas las seudocategorías bajo "Maquillaje"
        seudocategoria_ids = db.session.query(Seudocategorias.id)\
            .join(Subcategorias)\
            .filter(
                Subcategorias.categoria_principal_id == categoria_maquillaje.id,
                Seudocategorias.estado == 'activo'
        ).all()

        seudocategoria_ids = [id[0] for id in seudocategoria_ids]

        # Filtrar productos de esta categoría
        productos = Productos.query\
            .filter(
                Productos.seudocategoria_id.in_(seudocategoria_ids),
                Productos.estado == 'activo'
            )\
            .order_by(func.random())\
            .limit(12)\
            .all()
    else:
        # Fallback: productos destacados si no existe "Maquillaje"
        productos = Productos.query\
            .filter_by(estado='activo')\
            .order_by(func.random())\
            .limit(12)\
            .all()

    # Preparar datos para JavaScript con lógica de "nuevo"
    productos_data = [producto_to_dict(p) for p in productos]

    total_productos = len(productos)

    # Obtener datos del carrito
    cart_info = get_or_create_cart()
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

@products_bp.route('/productos')
def productos_page():
    """
    Renderiza la página de productos, pasando las categorías, subcategorías y pseudocategorías para los filtros.
    """
    categorias_obj = CategoriasPrincipales.query.filter_by(estado='activo').all()
    subcategorias_obj = Subcategorias.query.filter_by(estado='activo').all()
    seudocategorias_obj = Seudocategorias.query.filter_by(estado='activo').all()

    categorias = [categoria_principal_to_dict(c) for c in categorias_obj]
    subcategorias = [subcategoria_to_dict(s) for s in subcategorias_obj]
    seudocategorias = []
    for s in seudocategorias_obj:
        s_dict = seudocategoria_to_dict(s)
        if s_dict is not None:  # Add this check
            s_dict['subcategoria_id'] = s.subcategoria_id
            seudocategorias.append(s_dict)
    return render_template(
        'cliente/componentes/todos_productos.html',
        categorias=categorias,
        subcategorias=subcategorias,
        seudocategorias=seudocategorias
    )

@products_bp.route('/<slug_categoria>')
def productos_por_categoria(slug_categoria):
    """
    Muestra la página de productos para una categoría principal específica, usando su slug.
    Filtra y muestra solo subcategorías, seudocategorías y productos relacionados con esta categoría.
    """
    from flask import abort # Importar abort aquí para evitar circular imports si se usa en otro lugar
    categoria_principal = CategoriasPrincipales.query.filter_by(slug=slug_categoria, estado='activo').first_or_404()

    # Obtener IDs de todas las seudocategorías bajo esta categoría principal
    seudocategoria_ids = db.session.query(Seudocategorias.id)\
        .join(Subcategorias)\
        .filter(
            Subcategorias.categoria_principal_id == categoria_principal.id,
            Seudocategorias.estado == 'activo'
        ).all()
    seudocategoria_ids = [id[0] for id in seudocategoria_ids]

    # Obtener productos de esta categoría principal
    productos = Productos.query\
        .filter(
            Productos.seudocategoria_id.in_(seudocategoria_ids),
            Productos.estado == 'activo'
        )\
        .order_by(Productos.nombre.asc())\
        .all()
    
    # Preparar datos para JavaScript
    productos_data = [producto_to_dict(p) for p in productos]
    print(f"DEBUG: productos_por_categoria - Cantidad de productos encontrados: {len(productos_data)}")

    # --- MEJORA: Filtrar subcategorías y pseudocategorías relacionadas ---
    # Obtener subcategorías activas que pertenecen a la categoría principal actual
    subcategorias_obj = Subcategorias.query.filter_by(
        categoria_principal_id=categoria_principal.id,
        estado='activo'
    ).all()

    # Obtener pseudocategorías activas que pertenecen a las subcategorías de esta categoría principal
    seudocategorias_obj = Seudocategorias.query.join(Subcategorias).filter(
        Subcategorias.categoria_principal_id == categoria_principal.id,
        Seudocategorias.estado == 'activo'
    ).all()

    # Obtener todas las categorías principales para el navbar (siempre necesarias)
    categorias_obj_all = CategoriasPrincipales.query \
        .filter_by(estado='activo') \
        .options(
            joinedload(CategoriasPrincipales.subcategorias).joinedload(Subcategorias.seudocategorias)
        )\
        .all()

    # Filtrar subcategorías y seudocategorías activas para el navbar
    categorias = []
    for cat in categorias_obj_all:
        cat_dict = categoria_principal_to_dict(cat)
        if cat_dict is not None:
            cat_dict['subcategorias'] = []
            for sub in getattr(cat, 'subcategorias', []):
                if sub.estado == 'activo':
                    sub_dict = subcategoria_to_dict(sub)
                    if sub_dict is not None:
                        sub_dict['seudocategorias'] = []
                        for seudo in getattr(sub, 'seudocategorias', []):
                            if seudo.estado == 'activo':
                                sub_dict['seudocategorias'].append(seudocategoria_to_dict(seudo))
                        cat_dict['subcategorias'].append(sub_dict)
            categorias.append(cat_dict)
    subcategorias = [subcategoria_to_dict(s) for s in subcategorias_obj]
    seudocategorias = []
    for s in seudocategorias_obj:
        s_dict = seudocategoria_to_dict(s)
        if s_dict is not None:
            s_dict['subcategoria_id'] = s.subcategoria_id
            seudocategorias.append(s_dict)

    return render_template(
        'cliente/componentes/categoria_producto.html',
        categoria_principal=categoria_principal_to_dict(categoria_principal),
        productos=productos,
        productos_data=productos_data,
        categorias=categorias, # Ahora está vacío, ya que no se necesita el filtro de categoría
        subcategorias=subcategorias, # Ahora solo incluye las de esta categoría principal
        seudocategorias=seudocategorias, # Ahora solo incluye las de esta categoría principal
        title=f"{categoria_principal.nombre} - YE & Ci Cosméticos"
    )

@products_bp.route('/<slug_categoria_principal>/<slug_subcategoria>/<slug_seudocategoria>/<slug_producto>')
def producto_detalle(slug_categoria_principal, slug_subcategoria, slug_seudocategoria, slug_producto):
    """
    Muestra los detalles de un producto específico utilizando los slugs de categoría, subcategoría, pseudocategoría y producto.
    """
    print(f"DEBUG: Accediendo a producto_detalle con slugs: {slug_categoria_principal}/{slug_subcategoria}/{slug_seudocategoria}/{slug_producto}")

    producto = Productos.query.options(
        joinedload(Productos.seudocategoria).joinedload(Seudocategorias.subcategoria).joinedload(Subcategorias.categoria_principal),
        joinedload(Productos.reseñas)
    ).join(
        Seudocategorias, Productos.seudocategoria_id == Seudocategorias.id
    ).join(
        Subcategorias, Seudocategorias.subcategoria_id == Subcategorias.id
    ).join(
        CategoriasPrincipales, Subcategorias.categoria_principal_id == CategoriasPrincipales.id
    ).filter(
        Productos.slug == slug_producto,
        Seudocategorias.slug == slug_seudocategoria,
        Subcategorias.slug == slug_subcategoria,
        CategoriasPrincipales.slug == slug_categoria_principal
    ).first_or_404()
    
    # Verificar si el producto está activo
    if producto.estado != 'activo':
        from flask import abort
        abort(404)
    
    # Obtener productos relacionados (misma categoría principal)
    # Asegurarse de que producto.seudocategoria y producto.seudocategoria.subcategoria no sean None
    categoria_principal_id = None
    if producto.seudocategoria and producto.seudocategoria.subcategoria:
        categoria_principal_id = producto.seudocategoria.subcategoria.categoria_principal.id

    productos_relacionados = []
    if categoria_principal_id:
        print(f"DEBUG: Buscando productos relacionados para categoria_principal_id: {categoria_principal_id}")
        productos_relacionados = Productos.query.join(
            Seudocategorias, Productos.seudocategoria_id == Seudocategorias.id
        ).join(
            Subcategorias, Seudocategorias.subcategoria_id == Subcategorias.id
        ).filter(
            Productos.id != producto.id,
            Productos.estado == 'activo',
            Subcategorias.categoria_principal_id == categoria_principal_id
        ).limit(8).all()

    print(f"DEBUG: Productos relacionados para {producto.nombre}: {len(productos_relacionados)} productos encontrados.")
    for p in productos_relacionados:
        print(f"  - {p.nombre} (ID: {p.id})")
    
    # Convertir productos relacionados a diccionarios para JavaScript
    productos_relacionados_data = [producto_to_dict(p) for p in productos_relacionados]
    print(f"DEBUG: productos_relacionados_data (después de to_dict): {len(productos_relacionados_data)} elementos.")
    if productos_relacionados_data:
        print(f"DEBUG: Primer elemento de productos_relacionados_data: {productos_relacionados_data[0]}")

    # Obtener reseñas del producto
    reseñas = Reseñas.query.filter_by(
        producto_id=producto.id
    ).order_by(Reseñas.created_at.desc()).all()

    # Usar la calificación promedio almacenada directamente del producto
    calificacion_promedio = producto.calificacion_promedio_almacenada

    # Obtener el conteo de reseñas
    reseñas_count = len(reseñas)

    # Verificar si el usuario actual ha dado like al producto
    es_favorito = False
    if 'user' in session:
        like = Likes.query.filter_by(
            usuario_id=session['user'].get('id'),
            producto_id=producto.id,
            estado='activo'
        ).first()
        es_favorito = like is not None
    
    # Obtener nombres de categoría, subcategoría y seudocategoría para el breadcrumb
    main_category_name = None
    subcategory_name = None
    pseudocategory_name = None

    if producto.seudocategoria:
        pseudocategory_name = producto.seudocategoria.nombre
        if producto.seudocategoria.subcategoria:
            subcategory_name = producto.seudocategoria.subcategoria.nombre
            if producto.seudocategoria.subcategoria.categoria_principal:
                main_category_name = producto.seudocategoria.subcategoria.categoria_principal.nombre

    return render_template(
        'cliente/componentes/producto_detalle.html',
        producto=producto,
        productos_relacionados=productos_relacionados_data,
        reseñas=reseñas,
        calificacion_promedio=calificacion_promedio,
        es_favorito=es_favorito,
        title=f"{producto.nombre} - YE & Ci Cosméticos",
        main_category_name=main_category_name,
        subcategory_name=subcategory_name,
        pseudocategory_name=pseudocategory_name,
        current_user=current_user, # Pasar el usuario actual al template
        es_nuevo=producto.es_nuevo, # Pasar el indicador de producto nuevo
        reseñas_count=reseñas_count # Pasar el conteo de reseñas
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
        # Búsqueda mejorada con prioridad
        productos = Productos.query.filter(
            db.or_(
                Productos.nombre.ilike(f'{query}%'),
                Productos.marca.ilike(f'{query}%'),
                Productos.descripcion.ilike(f'{query}%')
            ),
            Productos.estado == 'activo'
        ).order_by(
            # Priorizar coincidencias exactas al inicio
            db.case(
                (Productos.nombre.ilike(f'{query}%'), 1),
                (Productos.marca.ilike(f'{query}%'), 2),
                else_=3
            ),
            Productos.nombre.asc()
        ).limit(12).all()

        # Top términos actualizados
        sugerencias = BusquedaTermino.top_terminos(10)

        return jsonify({
            'resultados': [producto_to_dict(p) for p in productos],
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

@products_bp.route('/log_search_click', methods=['POST'])
def log_search_click():
    data = request.get_json()
    product_id = data.get('product_id')
    query = data.get('query', '').strip().lower()

    if not product_id or not query:
        return jsonify({'status': 'error', 'message': 'Datos incompletos'}), 400

    terminos_a_registrar = _extraer_terminos_de_producto(product_id, query)
    
    if terminos_a_registrar:
        BusquedaTermino.registrar_batch(list(terminos_a_registrar))

    return jsonify({'status': 'success'}), 200

@products_bp.route('/log_search_terms_batch', methods=['POST'])
def log_search_terms_batch():
    data = request.get_json()
    if not data or 'terminos' not in data or not isinstance(data['terminos'], list):
        return jsonify({'status': 'error', 'message': 'Datos inválidos'}), 400

    terminos_a_registrar = set()
    
    for item in data['terminos']:
        product_id = item.get('product_id')
        query = item.get('query', '').strip().lower()
        if product_id and query:
            terminos_del_item = _extraer_terminos_de_producto(product_id, query)
            terminos_a_registrar.update(terminos_del_item)

    if terminos_a_registrar:
        BusquedaTermino.registrar_batch(list(terminos_a_registrar))

    return jsonify({'status': 'success'}), 200

def _extraer_terminos_de_producto(product_id, query):
    producto = Productos.query.get(product_id)
    if not producto:
        return set()

    terminos = set()
    # 1. Comparar con el nombre del producto
    if query in producto.nombre.lower():
        terminos.add(producto.nombre)

    # 2. Comparar con la marca del producto
    if producto.marca and query in producto.marca.lower():
        terminos.add(producto.marca)

    # 3. Comparar con las categorías
    if producto.seudocategoria:
        if query in producto.seudocategoria.nombre.lower():
            terminos.add(producto.seudocategoria.nombre)
        if producto.seudocategoria.subcategoria:
            if query in producto.seudocategoria.subcategoria.nombre.lower():
                terminos.add(producto.seudocategoria.subcategoria.nombre)
            if producto.seudocategoria.subcategoria.categoria_principal and \
               query in producto.seudocategoria.subcategoria.categoria_principal.nombre.lower():
                terminos.add(producto.seudocategoria.subcategoria.categoria_principal.nombre)
                
    return terminos



@products_bp.route('/api/productos/filtrar')
def filter_products():
    """
    Devuelve productos filtrados por categoría principal, subcategoría y/o pseudocategoría en formato JSON.
    """
    main_category_name = request.args.get('categoria_principal')
    subcategory_name = request.args.get('subcategoria')
    pseudocategory_name = request.args.get('seudocategoria')
    sort_by = request.args.get('ordenar_por', 'featured')
    min_price_str = request.args.get('min_price')
    max_price_str = request.args.get('max_price')

    # Start with the base query, joining all tables needed for any filter.
    # This is slightly less efficient if no filters are applied, but much more robust.
    query = db.session.query(Productos).select_from(Productos).join(
        Seudocategorias, Productos.seudocategoria_id == Seudocategorias.id
    ).join(
        Subcategorias, Seudocategorias.subcategoria_id == Subcategorias.id
    ).join(
        CategoriasPrincipales, Subcategorias.categoria_principal_id == CategoriasPrincipales.id
    )

    # Always filter by product status
    query = query.filter(Productos.estado == 'activo')

    # Apply filters based on provided names
    if main_category_name and main_category_name != 'all':
        query = query.filter(func.lower(CategoriasPrincipales.nombre) == func.lower(main_category_name))
    
    if subcategory_name and subcategory_name != 'all':
        query = query.filter(func.lower(Subcategorias.nombre) == func.lower(subcategory_name))

    if pseudocategory_name and pseudocategory_name != 'all':
        query = query.filter(func.lower(Seudocategorias.nombre) == func.lower(pseudocategory_name))

    # Apply price filters
    if min_price_str:
        try:
            min_price = float(min_price_str)
            query = query.filter(Productos.precio >= min_price)
        except ValueError:
            pass  # Ignore invalid price values

    if max_price_str:
        try:
            max_price = float(max_price_str)
            query = query.filter(Productos.precio <= max_price)
        except ValueError:
            pass  # Ignore invalid price values

    # Apply sorting
    if sort_by == 'price_asc':
        query = query.order_by(Productos.precio.asc())
    elif sort_by == 'price_desc':
        query = query.order_by(Productos.precio.desc())
    elif sort_by == 'top_rated':
        query = query.order_by(Productos.calificacion_promedio_almacenada.desc())
    elif sort_by == 'az':
        query = query.order_by(Productos.nombre.asc())
    elif sort_by == 'za':
        query = query.order_by(Productos.nombre.desc())
    else:  # 'az' or any other default
        query = query.order_by(Productos.nombre.asc())

    productos = query.all()
    return jsonify([producto_to_dict(p) for p in productos])


@products_bp.route('/api/productos')
def get_all_products():
    """
    Devuelve todos los productos activos en formato JSON.
    """
    productos = Productos.query.filter_by(estado='activo').all()
    return jsonify([producto_to_dict(p) for p in productos])


@products_bp.route('/api/productos/categoria/<nombre_categoria>')
def get_products_by_category(nombre_categoria):
    """
    Devuelve productos de una categoría principal específica en formato JSON.
    """
    categoria = CategoriasPrincipales.query.filter(func.lower(CategoriasPrincipales.nombre) == func.lower(nombre_categoria), CategoriasPrincipales.estado == 'activo').first()
    
    if not categoria:
        return jsonify({'error': 'Categoría no encontrada'}), 404

    seudocategoria_ids = db.session.query(Seudocategorias.id)\
        .join(Subcategorias)\
        .filter(Subcategorias.categoria_principal_id == categoria.id, Seudocategorias.estado == 'activo').all()
    
    seudocategoria_ids = [id[0] for id in seudocategoria_ids]
    
    productos = Productos.query\
        .filter(Productos.seudocategoria_id.in_(seudocategoria_ids), Productos.estado == 'activo')\
        .all()
        
    return jsonify([producto_to_dict(p) for p in productos])


@products_bp.route('/api/productos/precios_rango')
def get_price_range():
    """
    Devuelve el precio mínimo y máximo de los productos activos, opcionalmente filtrados por categoría.
    """
    main_category_name = request.args.get('categoria_principal')
    subcategory_name = request.args.get('subcategoria')
    pseudocategory_name = request.args.get('seudocategoria')

    query = db.session.query(Productos).filter(Productos.estado == 'activo')

    if main_category_name:
        query = query.join(Seudocategorias).join(Subcategorias).join(CategoriasPrincipales).filter(
            func.lower(CategoriasPrincipales.nombre) == func.lower(main_category_name)
        )
    
    if subcategory_name:
        query = query.join(Seudocategorias).join(Subcategorias).filter(
            func.lower(Subcategorias.nombre) == func.lower(subcategory_name)
        )

    if pseudocategory_name:
        query = query.join(Seudocategorias).filter(
            func.lower(Seudocategorias.nombre) == func.lower(pseudocategory_name)
        )

    min_price = query.with_entities(func.min(Productos.precio)).scalar()
    max_price = query.with_entities(func.max(Productos.precio)).scalar()

    return jsonify({
        'min_price': min_price if min_price is not None else 0,
        'max_price': max_price if max_price is not None else 0
    })

