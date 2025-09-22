# app/blueprints/products.py
from flask import Blueprint, render_template, request, jsonify, session
from app.models.domains.product_models import Productos, CategoriasPrincipales, Subcategorias, Seudocategorias
from app.models.domains.review_models import Reseñas, Likes
from app.models.domains.search_models import BusquedaTermino
from app.models.serializers import producto_to_dict, categoria_principal_to_dict, subcategoria_to_dict, seudocategoria_to_dict, busqueda_termino_to_dict
from app.extensions import db
from sqlalchemy import func, and_
from sqlalchemy.orm import joinedload
from app.models.enums import EstadoEnum
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

    # Buscar la categoría principal "Maquillaje"
    categoria_maquillaje = CategoriasPrincipales.query.filter(
        func.lower(CategoriasPrincipales.nombre) == 'maquillaje',
        CategoriasPrincipales.estado == EstadoEnum.ACTIVO
    ).first()

    # Inicializar productos como una lista vacía por defecto
    productos = []
    categoria_actual_nombre = ''

    # Obtener productos de la categoría "Maquillaje"
    if categoria_maquillaje:
        categoria_actual_nombre = categoria_maquillaje.nombre
        # Obtener IDs de todas las seudocategorías bajo "Maquillaje"
        seudocategoria_ids = db.session.query(Seudocategorias.id)\
            .join(Subcategorias)\
            .filter(
                Subcategorias.categoria_principal_id == categoria_maquillaje.id,
                Subcategorias.estado == EstadoEnum.ACTIVO, # Asegurarse de que la subcategoría también esté activa
                Seudocategorias.estado == EstadoEnum.ACTIVO
        ).all()

        seudocategoria_ids = [id[0] for id in seudocategoria_ids]

        if seudocategoria_ids: # Solo buscar productos si hay seudocategorías activas
            # Filtrar productos de esta categoría
            productos = Productos.query\
                .filter(
                    Productos.seudocategoria_id.in_(seudocategoria_ids),
                    Productos.estado == EstadoEnum.ACTIVO,
                    Productos._existencia  > 0
                )\
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
        total_productos=total_productos,
        cart_items=cart_items,
        total_price=total_price,
        categoria_actual=categoria_actual_nombre,
        categoria_maquillaje=categoria_maquillaje,
        title="YE & Ci Cosméticos"
    )


@products_bp.route('/productos')
def productos_page():
    """
    Renderiza la página de productos, pasando las categorías, subcategorías y pseudocategorías para los filtros.
    """
    # La información para el navbar y otros elementos globales ya es inyectada
    # por el context_processor en app/__init__.py. No es necesario volver a consultarla aquí.

    # Estas consultas son específicas para los filtros de esta página,
    # obteniendo todas las categorías activas para el sidebar de filtros.
    categorias_obj = CategoriasPrincipales.query.filter_by(estado=EstadoEnum.ACTIVO).all()
    subcategorias_obj = Subcategorias.query.filter_by(estado=EstadoEnum.ACTIVO).all()
    seudocategorias_obj = Seudocategorias.query.filter_by(estado=EstadoEnum.ACTIVO).all()

    # NEW: Get all unique brands from active products
    marcas_obj = db.session.query(Productos.marca).filter(
        Productos.estado == EstadoEnum.ACTIVO, 
        Productos.marca.isnot(None), 
        Productos.marca != ''
    ).distinct().order_by(Productos.marca).all()
    marcas = [marca[0] for marca in marcas_obj]

    # Serializar los objetos a diccionarios para que sean compatibles con JSON y el template.
    categorias_para_filtros = [categoria_principal_to_dict(c) for c in categorias_obj]
    subcategorias_para_filtros = [subcategoria_to_dict(s) for s in subcategorias_obj]
    seudocategorias_para_filtros = []
    for s in seudocategorias_obj:
        s_dict = seudocategoria_to_dict(s)
        if s_dict is not None:
            s_dict['subcategoria_id'] = s.subcategoria_id
            seudocategorias_para_filtros.append(s_dict)

    return render_template(
        'cliente/componentes/todos_productos.html',
        # Pasamos las listas serializadas al template. El template usará 'categorias'
        # para los filtros y para el script `window.appData`.
        categorias=categorias_para_filtros,
        subcategorias=subcategorias_para_filtros,
        seudocategorias=seudocategorias_para_filtros,
        marcas=marcas
    )


@products_bp.route('/<slug_categoria>')
def productos_por_categoria(slug_categoria):
    """
    Muestra la página de productos para una categoría principal específica, usando su slug.
    Filtra y muestra solo subcategorías, seudocategorías y productos relacionados con esta categoría.
    """
    from flask import abort # Importar abort aquí para evitar circular imports si se usa en otro lugar
    categoria_principal = CategoriasPrincipales.query.filter_by(slug=slug_categoria, estado=EstadoEnum.ACTIVO).first_or_404()

    # Obtener IDs de todas las seudocategorías bajo esta categoría principal
    seudocategoria_ids = db.session.query(Seudocategorias.id)\
        .join(Subcategorias)\
        .filter(
            Subcategorias.categoria_principal_id == categoria_principal.id,
            Subcategorias.estado == EstadoEnum.ACTIVO, # Asegurarse de que la subcategoría también esté activa
            Seudocategorias.estado == EstadoEnum.ACTIVO
        ).all()
    seudocategoria_ids = [id[0] for id in seudocategoria_ids]

    # Obtener productos de esta categoría principal
    productos = Productos.query\
        .filter(
            Productos.seudocategoria_id.in_(seudocategoria_ids),
            Productos.estado == EstadoEnum.ACTIVO,
            Productos._existencia  > 0
        )\
        .order_by(Productos.nombre.asc())\
        .all()
    
    # Preparar datos para JavaScript
    productos_data = [producto_to_dict(p) for p in productos]

    # NEW: Get unique brands for this category
    marcas_obj = db.session.query(Productos.marca).filter(
        Productos.seudocategoria_id.in_(seudocategoria_ids),
        Productos.estado == EstadoEnum.ACTIVO,
        Productos.marca.isnot(None),
        Productos.marca != ''
    ).distinct().order_by(Productos.marca).all()
    marcas = [marca[0] for marca in marcas_obj]
    print(f"DEBUG: productos_por_categoria - Cantidad de productos encontrados: {len(productos_data)}")

    # --- MEJORA: Filtrar subcategorías y pseudocategorías relacionadas ---
    # Obtener subcategorías activas que pertenecen a la categoría principal actual
    subcategorias_obj = Subcategorias.query.filter_by(
        categoria_principal_id=categoria_principal.id,
        estado=EstadoEnum.ACTIVO
    ).all()

    # Obtener pseudocategorías activas que pertenecen a las subcategorías de esta categoría principal
    seudocategorias_obj = Seudocategorias.query.join(Subcategorias).filter(
        Subcategorias.categoria_principal_id == categoria_principal.id,
        Seudocategorias.estado == EstadoEnum.ACTIVO
    ).all()

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
        subcategorias=subcategorias, # Ahora solo incluye las de esta categoría principal
        seudocategorias=seudocategorias, # Ahora solo incluye las de esta categoría principal
        marcas=marcas,
        title=f"{categoria_principal.nombre} - YE & Ci Cosméticos"
    )

@products_bp.route('/<slug_categoria_principal>/<slug_subcategoria>')
def productos_por_subcategoria(slug_categoria_principal, slug_subcategoria):
    """
    Muestra la página de productos para una subcategoría específica, usando su slug y el de la categoría principal.
    Filtra y muestra solo seudocategorías y productos relacionados con esta subcategoría.
    """
    # Buscar la subcategoría asegurando que pertenece a la categoría principal correcta y ambas están activas
    subcategoria = Subcategorias.query.join(CategoriasPrincipales).filter(
        Subcategorias.slug == slug_subcategoria,
        CategoriasPrincipales.slug == slug_categoria_principal,
        Subcategorias.estado == EstadoEnum.ACTIVO,
        CategoriasPrincipales.estado == EstadoEnum.ACTIVO
    ).options(joinedload(Subcategorias.categoria_principal)).first_or_404()

    categoria_principal = subcategoria.categoria_principal

    # Obtener IDs de todas las seudocategorías activas bajo esta subcategoría
    seudocategoria_ids = [s.id for s in subcategoria.seudocategorias if s.estado == EstadoEnum.ACTIVO]

    # Obtener productos de esta subcategoría
    productos = []
    if seudocategoria_ids:
        productos = Productos.query.filter(
            Productos.seudocategoria_id.in_(seudocategoria_ids),
            Productos.estado == EstadoEnum.ACTIVO,
            Productos._existencia > 0
        ).order_by(Productos.nombre.asc()).all()

    productos_data = [producto_to_dict(p) for p in productos]

    # Obtener marcas únicas para esta subcategoría
    marcas_obj = []
    if seudocategoria_ids:
        marcas_obj = db.session.query(Productos.marca).filter(
            Productos.seudocategoria_id.in_(seudocategoria_ids),
            Productos.estado == EstadoEnum.ACTIVO,
            Productos.marca.isnot(None),
            Productos.marca != ''
        ).distinct().order_by(Productos.marca).all()
    marcas = [marca[0] for marca in marcas_obj]

    # Obtener seudocategorías para los filtros (solo las relacionadas con esta subcategoría)
    seudocategorias_obj = Seudocategorias.query.filter(
        Seudocategorias.subcategoria_id == subcategoria.id,
        Seudocategorias.estado == EstadoEnum.ACTIVO
    ).all()
    seudocategorias = [s_dict for s in seudocategorias_obj if (s_dict := seudocategoria_to_dict(s)) is not None]

    return render_template(
        'cliente/componentes/subcategoria_producto.html',
        categoria_principal=categoria_principal_to_dict(categoria_principal),
        subcategoria_actual=subcategoria_to_dict(subcategoria),
        seudocategorias=seudocategorias,
        marcas=marcas,
        title=f"{subcategoria.nombre} - YE & Ci Cosméticos"
    )

@products_bp.route('/<slug_categoria_principal>/<slug_subcategoria>/<slug_seudocategoria>')
def productos_por_seudocategoria(slug_categoria_principal, slug_subcategoria, slug_seudocategoria):
    """
    Muestra la página de productos para una seudocategoría específica, usando su slug y el de sus padres.
    Filtra y muestra solo productos y marcas relacionados con esta seudocategoría.
    """
    # Buscar la seudocategoría asegurando que pertenece a la jerarquía correcta y todo está activo
    seudocategoria = Seudocategorias.query.join(Subcategorias).join(CategoriasPrincipales).filter(
        Seudocategorias.slug == slug_seudocategoria,
        Subcategorias.slug == slug_subcategoria,
        CategoriasPrincipales.slug == slug_categoria_principal,
        Seudocategorias.estado == EstadoEnum.ACTIVO,
        Subcategorias.estado == EstadoEnum.ACTIVO,
        CategoriasPrincipales.estado == EstadoEnum.ACTIVO
    ).options(
        joinedload(Seudocategorias.subcategoria).joinedload(Subcategorias.categoria_principal)
    ).first_or_404()

    subcategoria = seudocategoria.subcategoria
    categoria_principal = subcategoria.categoria_principal

    # Obtener productos de esta seudocategoría
    productos = Productos.query.filter(
        Productos.seudocategoria_id == seudocategoria.id,
        Productos.estado == EstadoEnum.ACTIVO,
        Productos._existencia > 0
    ).order_by(Productos.nombre.asc()).all()

    # Obtener marcas únicas para esta seudocategoría
    marcas_obj = db.session.query(Productos.marca).filter(
        Productos.seudocategoria_id == seudocategoria.id,
        Productos.estado == EstadoEnum.ACTIVO,
        Productos.marca.isnot(None),
        Productos.marca != ''
    ).distinct().order_by(Productos.marca).all()
    marcas = [marca[0] for marca in marcas_obj]

    return render_template(
        'cliente/componentes/seudocategoria_producto.html',
        categoria_principal=categoria_principal_to_dict(categoria_principal),
        subcategoria_actual=subcategoria_to_dict(subcategoria),
        seudocategoria_actual=seudocategoria_to_dict(seudocategoria),
        marcas=marcas,
        title=f"{seudocategoria.nombre} - YE & Ci Cosméticos"
    )
    
@products_bp.route('/api/filtros/categorias')
def get_categorias_filtradas():
    """
    Devuelve las categorías principales disponibles según los filtros aplicados.
    """
    try:
        marca = request.args.get('marca')
        subcategoria_nombre = request.args.get('subcategoria')
        seudocategoria_nombre = request.args.get('seudocategoria')

        query = db.session.query(CategoriasPrincipales).filter(CategoriasPrincipales.estado == EstadoEnum.ACTIVO).distinct()

        # Unir tablas si algún filtro lo requiere
        needs_join = (marca and marca != 'all') or \
                     (subcategoria_nombre and subcategoria_nombre != 'all') or \
                     (seudocategoria_nombre and seudocategoria_nombre != 'all')

        if needs_join:
            query = query.join(Subcategorias).join(Seudocategorias).join(Productos)

        # Aplicar filtros
        if marca and marca != 'all':
            query = query.filter(Productos.marca == marca, Productos.estado == EstadoEnum.ACTIVO, Productos._existencia > 0)
        if subcategoria_nombre and subcategoria_nombre != 'all':
            query = query.filter(func.lower(Subcategorias.nombre) == func.lower(subcategoria_nombre))
        if seudocategoria_nombre and seudocategoria_nombre != 'all':
            query = query.filter(func.lower(Seudocategorias.nombre) == func.lower(seudocategoria_nombre))

        categorias = query.order_by(CategoriasPrincipales.nombre.asc()).all()
        return jsonify([categoria_principal_to_dict(c) for c in categorias])
    except Exception as e:
        print(f"Error en get_categorias_filtradas: {str(e)}")
        return jsonify({'error': str(e)}), 500

@products_bp.route('/api/filtros/subcategorias')
def get_subcategorias_filtradas():
    """
    Devuelve las subcategorías disponibles según los filtros aplicados.
    """
    try:
        categoria_principal_nombre = request.args.get('categoria_principal')
        marca = request.args.get('marca')
        seudocategoria_nombre = request.args.get('seudocategoria')

        query = db.session.query(Subcategorias).filter(Subcategorias.estado == EstadoEnum.ACTIVO).distinct()

        # Determinar qué uniones son necesarias
        needs_seudocategorias_join = (marca and marca != 'all') or (seudocategoria_nombre and seudocategoria_nombre != 'all')
        needs_productos_join = (marca and marca != 'all')

        if categoria_principal_nombre and categoria_principal_nombre != 'all':
            query = query.join(CategoriasPrincipales)
            query = query.filter(func.lower(CategoriasPrincipales.nombre) == func.lower(categoria_principal_nombre))

        if needs_seudocategorias_join:
            query = query.join(Seudocategorias, Subcategorias.id == Seudocategorias.subcategoria_id)

        if needs_productos_join:
            query = query.join(Productos, Seudocategorias.id == Productos.seudocategoria_id)

        # Aplicar filtros que dependen de las uniones
        if marca and marca != 'all':
            query = query.filter(Productos.marca == marca, Productos.estado == EstadoEnum.ACTIVO, Productos._existencia > 0)

        if seudocategoria_nombre and seudocategoria_nombre != 'all':
            query = query.filter(func.lower(Seudocategorias.nombre) == func.lower(seudocategoria_nombre))

        subcategorias = query.all()
        return jsonify([subcategoria_to_dict(s) for s in subcategorias])
    except Exception as e:
        print(f"Error en get_subcategorias_filtradas: {str(e)}")
        return jsonify({'error': str(e)}), 500


@products_bp.route('/api/filtros/seudocategorias')
def get_seudocategorias_filtradas():
    """
    Devuelve las seudocategorías disponibles según los filtros aplicados.
    """
    try:
        categoria_principal_nombre = request.args.get('categoria_principal')
        subcategoria_nombre = request.args.get('subcategoria')
        marca = request.args.get('marca')

        query = db.session.query(Seudocategorias).filter(Seudocategorias.estado == EstadoEnum.ACTIVO).distinct()

        # Unir tablas si algún filtro lo requiere
        if (categoria_principal_nombre and categoria_principal_nombre != 'all') or \
           (subcategoria_nombre and subcategoria_nombre != 'all'):
            query = query.join(Subcategorias, Seudocategorias.subcategoria_id == Subcategorias.id)
            query = query.join(CategoriasPrincipales, Subcategorias.categoria_principal_id == CategoriasPrincipales.id)

        if marca and marca != 'all':
            query = query.join(Productos, Seudocategorias.id == Productos.seudocategoria_id)

        # Aplicar filtros
        if categoria_principal_nombre and categoria_principal_nombre != 'all':
            query = query.filter(func.lower(CategoriasPrincipales.nombre) == func.lower(categoria_principal_nombre))

        if subcategoria_nombre and subcategoria_nombre != 'all':
            query = query.filter(func.lower(Subcategorias.nombre) == func.lower(subcategoria_nombre))

        if marca and marca != 'all':
            query = query.filter(Productos.marca == marca, Productos.estado == EstadoEnum.ACTIVO, Productos._existencia > 0)

        seudocategorias = query.all()
        return jsonify([seudocategoria_to_dict(s) for s in seudocategorias])
    except Exception as e:
        print(f"Error en get_seudocategorias_filtradas: {str(e)}")
        return jsonify({'error': str(e)}), 500

@products_bp.route('/api/filtros/marcas')
def get_marcas_filtradas():
    """
    Devuelve las marcas disponibles según los filtros aplicados.
    """
    try:
        categoria_principal_nombre = request.args.get('categoria_principal')
        subcategoria_nombre = request.args.get('subcategoria')
        seudocategoria_nombre = request.args.get('seudocategoria')

        query = db.session.query(Productos.marca).filter(
            Productos.estado == EstadoEnum.ACTIVO,
            Productos._existencia > 0,
            Productos.marca.isnot(None),
            Productos.marca != ''
        ).distinct()

        # Unir tablas si algún filtro de categoría está presente
        if (categoria_principal_nombre and categoria_principal_nombre != 'all') or \
           (subcategoria_nombre and subcategoria_nombre != 'all') or \
           (seudocategoria_nombre and seudocategoria_nombre != 'all'):
            query = query.join(Seudocategorias, Productos.seudocategoria_id == Seudocategorias.id)
            query = query.join(Subcategorias, Seudocategorias.subcategoria_id == Subcategorias.id)
            query = query.join(CategoriasPrincipales, Subcategorias.categoria_principal_id == CategoriasPrincipales.id)

        # Aplicar filtros
        if categoria_principal_nombre and categoria_principal_nombre != 'all':
            query = query.filter(func.lower(CategoriasPrincipales.nombre) == func.lower(categoria_principal_nombre))

        if subcategoria_nombre and subcategoria_nombre != 'all':
            query = query.filter(func.lower(Subcategorias.nombre) == func.lower(subcategoria_nombre))

        if seudocategoria_nombre and seudocategoria_nombre != 'all':
            query = query.filter(func.lower(Seudocategorias.nombre) == func.lower(seudocategoria_nombre))

        marcas = [row[0] for row in query.order_by(Productos.marca.asc()).all() if row[0]]
        return jsonify(marcas)
    except Exception as e:
        print(f"Error en get_marcas_filtradas: {str(e)}")
        return jsonify({'error': str(e)}), 500

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
        Productos.estado == EstadoEnum.ACTIVO, # Add this filter
        Seudocategorias.slug == slug_seudocategoria,
        Seudocategorias.estado == EstadoEnum.ACTIVO, # Add this filter
        Subcategorias.slug == slug_subcategoria,
        Subcategorias.estado == EstadoEnum.ACTIVO, # Add this filter
        CategoriasPrincipales.slug == slug_categoria_principal,
        CategoriasPrincipales.estado == EstadoEnum.ACTIVO # Add this filter
    ).first_or_404()
    
    # Verificar si el producto está activo
    if producto.estado != EstadoEnum.ACTIVO:
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
            Productos.estado == EstadoEnum.ACTIVO,
            Productos._existencia  > 0,
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
            estado=EstadoEnum.ACTIVO
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
            Productos.estado == EstadoEnum.ACTIVO,
            Productos._existencia  > 0
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
    if producto.seudocategoria and producto.seudocategoria.estado == EstadoEnum.ACTIVO: # Add estado check
        if query in producto.seudocategoria.nombre.lower():
            terminos.add(producto.seudocategoria.nombre)
        if producto.seudocategoria.subcategoria and producto.seudocategoria.subcategoria.estado == EstadoEnum.ACTIVO: # Add estado check
            if query in producto.seudocategoria.subcategoria.nombre.lower():
                terminos.add(producto.seudocategoria.subcategoria.nombre)
            if producto.seudocategoria.subcategoria.categoria_principal and \
               producto.seudocategoria.subcategoria.categoria_principal.estado == EstadoEnum.ACTIVO and \
               query in producto.seudocategoria.subcategoria.categoria_principal.nombre.lower():
                terminos.add(producto.seudocategoria.subcategoria.categoria_principal.nombre)
                
    return terminos

@products_bp.route('/api/productos/filtrar')
def filter_products():
    """
    Devuelve productos filtrados por categoría principal, subcategoría, pseudocategoría, marca y/o rango de precios en formato JSON.
    """
    main_category_name = request.args.get('categoria_principal')
    subcategory_name = request.args.get('subcategoria')
    pseudocategory_name = request.args.get('pseudocategoria')
    marca = request.args.get('marca')
    sort_by = request.args.get('ordenar_por', 'featured')
    min_price_str = request.args.get('min_price')
    max_price_str = request.args.get('max_price')

    query = db.session.query(Productos).select_from(Productos).join(
        Seudocategorias, and_(Productos.seudocategoria_id == Seudocategorias.id, Seudocategorias.estado == EstadoEnum.ACTIVO)
    ).join(
        Subcategorias, and_(Seudocategorias.subcategoria_id == Subcategorias.id, Subcategorias.estado == EstadoEnum.ACTIVO)
    ).join(
        CategoriasPrincipales, and_(Subcategorias.categoria_principal_id == CategoriasPrincipales.id, CategoriasPrincipales.estado == EstadoEnum.ACTIVO)
    )

    # Always filter by product status and availability
    query = query.filter(Productos.estado == EstadoEnum.ACTIVO, Productos._existencia  > 0)

    # Apply filters based on provided names
    if main_category_name and main_category_name != 'all':
        query = query.filter(func.lower(CategoriasPrincipales.nombre) == func.lower(main_category_name))
    
    if subcategory_name and subcategory_name != 'all':
        query = query.filter(func.lower(Subcategorias.nombre) == func.lower(subcategory_name))

    if pseudocategory_name and pseudocategory_name != 'all':
        query = query.filter(func.lower(Seudocategorias.nombre) == func.lower(pseudocategory_name))
    
    if marca and marca != 'all':
        query = query.filter(func.lower(Productos.marca) == func.lower(marca))

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
    productos = Productos.query.filter_by(estado=EstadoEnum.ACTIVO).filter(Productos._existencia  > 0).all()
    return jsonify([producto_to_dict(p) for p in productos])


@products_bp.route('/api/productos/categoria/<nombre_categoria>')
def get_products_by_category(nombre_categoria):
    """
    Devuelve productos de una categoría principal específica en formato JSON.
    """
    categoria = CategoriasPrincipales.query.filter(func.lower(CategoriasPrincipales.nombre) == func.lower(nombre_categoria), CategoriasPrincipales.estado == EstadoEnum.ACTIVO).first()
    
    if not categoria:
        return jsonify({'error': 'Categoría no encontrada'}), 404

    seudocategoria_ids = db.session.query(Seudocategorias.id)\
        .join(Subcategorias)\
        .filter(Subcategorias.categoria_principal_id == categoria.id, Seudocategorias.estado == EstadoEnum.ACTIVO).all()
    
    seudocategoria_ids = [id[0] for id in seudocategoria_ids]
    
    productos = Productos.query\
        .filter(Productos.seudocategoria_id.in_(seudocategoria_ids), Productos.estado == EstadoEnum.ACTIVO, Productos._existencia  > 0)\
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

    query = db.session.query(Productos).filter(Productos.estado == EstadoEnum.ACTIVO, Productos._existencia  > 0)

    if main_category_name:
        query = query.join(Seudocategorias, and_(Seudocategorias.estado == EstadoEnum.ACTIVO)).join(Subcategorias, and_(Subcategorias.estado == EstadoEnum.ACTIVO)).join(CategoriasPrincipales, and_(CategoriasPrincipales.estado == EstadoEnum.ACTIVO)).filter(
            func.lower(CategoriasPrincipales.nombre) == func.lower(main_category_name)
        )
    
    if subcategory_name:
        query = query.join(Seudocategorias, and_(Seudocategorias.estado == EstadoEnum.ACTIVO)).join(Subcategorias, and_(Subcategorias.estado == EstadoEnum.ACTIVO)).filter(
            func.lower(Subcategorias.nombre) == func.lower(subcategory_name)
        )

    if pseudocategory_name:
        query = query.join(Seudocategorias, and_(Seudocategorias.estado == EstadoEnum.ACTIVO)).filter(
            func.lower(Seudocategorias.nombre) == func.lower(pseudocategory_name)
        )

    min_price = query.with_entities(func.min(Productos.precio)).scalar()
    max_price = query.with_entities(func.max(Productos.precio)).scalar()

    return jsonify({
        'min_price': min_price if min_price is not None else 0,
        'max_price': max_price if max_price is not None else 0
    })
