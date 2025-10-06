"""
Módulo de Productos y Catálogo (Cliente).

Este blueprint gestiona toda la visualización de productos y categorías para el cliente.
Sus responsabilidades incluyen:
- **Página Principal**: Muestra una selección curada de productos.
- **Navegación por Categorías**: Endpoints para visualizar productos por categoría,
  subcategoría y seudocategoría.
- **Detalle de Producto**: Muestra la página detallada de un producto específico.
- **API de Filtrado y Búsqueda**: Proporciona endpoints para que el frontend filtre
  y busque productos dinámicamente.
- **Registro de Búsquedas**: Endpoints para registrar las interacciones de búsqueda
  con fines de análisis y mejora.
"""
# --- Importaciones de Flask y Librerías Estándar ---
from flask import Blueprint, render_template, request, jsonify, session, current_app
from app.models.domains.product_models import Productos, CategoriasPrincipales, Subcategorias, Seudocategorias
from app.models.domains.review_models import Reseñas, Likes
from app.models.domains.search_models import BusquedaTermino
from app.models.serializers import producto_to_dict, categoria_principal_to_dict, subcategoria_to_dict, seudocategoria_to_dict, busqueda_termino_to_dict
from app.extensions import db
from sqlalchemy import func, and_, case
from sqlalchemy.orm import joinedload
from app.models.enums import EstadoEnum
from app.blueprints.cliente.cart import get_cart_items, get_or_create_cart
from app.utils.jwt_utils import jwt_required
from flask_login import current_user

products_bp = Blueprint('products', __name__)

@products_bp.route('/')
def index():
    """
    Renderiza la página de inicio (Home).

    Esta vista está diseñada para ser la página principal de la tienda.
    Busca específicamente la categoría "Maquillaje" y muestra una selección
    aleatoria de sus productos más relevantes. Si la categoría no existe,
    la página se renderizará sin productos destacados.

    Returns:
        Response: La plantilla `index.html` renderizada con los datos de los productos y el carrito.
    """
    # MEJORA PROFESIONAL: Consulta Unificada y Optimizada
    # Se combinan las consultas para productos destacados y recomendados en una sola,
    # reduciendo las llamadas a la base de datos y simplificando la lógica.
    
    # 1. Definir los nombres de las categorías de interés.
    nombre_cat_destacada = 'insumos para uñas acrilicas'
    nombre_cat_recomendada = 'insumos para uñas acrilicas'

    # 2. Construir una consulta única para obtener todos los productos relevantes.
    #    - Se usa `joinedload` para cargar eficientemente la jerarquía de categorías y evitar el problema N+1.
    #    - Se usa `case` para asignar una prioridad de ordenamiento: 1 para destacados, 2 para recomendados.
    query = db.session.query(Productos).options(
        joinedload(Productos.seudocategoria)
        .joinedload(Seudocategorias.subcategoria)
        .joinedload(Subcategorias.categoria_principal)
    ).join(
        Seudocategorias, Productos.seudocategoria_id == Seudocategorias.id
    ).join(
        Subcategorias, Seudocategorias.subcategoria_id == Subcategorias.id
    ).join(
        CategoriasPrincipales, Subcategorias.categoria_principal_id == CategoriasPrincipales.id
    ).filter(
        func.lower(CategoriasPrincipales.nombre).in_([nombre_cat_destacada, nombre_cat_recomendada]),
        Productos.estado == EstadoEnum.ACTIVO,
        Productos._existencia > 0,
        Seudocategorias.estado == EstadoEnum.ACTIVO,
        Subcategorias.estado == EstadoEnum.ACTIVO,
        CategoriasPrincipales.estado == EstadoEnum.ACTIVO
    ).order_by(
        case(
            (func.lower(CategoriasPrincipales.nombre) == nombre_cat_destacada, 1),
            (func.lower(CategoriasPrincipales.nombre) == nombre_cat_recomendada, 2),
            else_=3
        ),
        func.random() # Orden aleatorio dentro de cada grupo
    )

    # 3. Ejecutar la consulta y separar los productos en sus respectivas listas.
    all_products = query.all()
    
    productos_destacados = []
    productos_recomendados = []
    
    # Usamos sets para evitar duplicados y limitar a 12 por categoría.
    ids_destacados = set()
    ids_recomendados = set()

    for p in all_products:
        cat_nombre_lower = p.seudocategoria.subcategoria.categoria_principal.nombre.lower()
        if cat_nombre_lower == nombre_cat_destacada and len(ids_destacados) < 12 and p.id not in ids_destacados:
            productos_destacados.append(p)
            ids_destacados.add(p.id)
        elif cat_nombre_lower == nombre_cat_recomendada and len(ids_recomendados) < 12 and p.id not in ids_recomendados:
            productos_recomendados.append(p)
            ids_recomendados.add(p.id)

    # 4. Serializar los datos para la plantilla.
    #    El `producto_to_dict` ahora será mucho más rápido gracias al `joinedload`.
    productos_data = [producto_to_dict(p) for p in productos_destacados]
    productos_recomendados_data = [producto_to_dict(p) for p in productos_recomendados]

    # 5. Obtener la categoría destacada para el título de la página.
    categoria_destacada = CategoriasPrincipales.query.filter(func.lower(CategoriasPrincipales.nombre) == nombre_cat_destacada).first()
    categoria_actual_nombre = categoria_destacada.nombre if categoria_destacada else "Destacados"

    # Obtiene los datos del carrito para mostrarlos en el encabezado.
    cart_info = get_or_create_cart()
    cart_items = get_cart_items(cart_info)
    total_price = sum(item['subtotal'] for item in cart_items)

    return render_template(
        'cliente/componentes/index.html',
        producto=productos_destacados[0] if productos_destacados else None,
        productos_data=productos_data,
        productos_recomendados_data=productos_recomendados_data, # Inyectar recomendaciones
        total_productos=len(productos_data),
        cart_items=cart_items,
        total_price=total_price,
        categoria_actual=categoria_actual_nombre,
        categoria_destacada=categoria_destacada,
        title="YE & Ci Cosméticos"
    )


@products_bp.route('/productos')
def productos_page():
    """
    Renderiza la página principal de "Todos los Productos".

    Esta vista no muestra productos directamente, sino que carga la estructura de la página
    y obtiene todos los datos necesarios para los filtros (categorías, subcategorías,
    seudocategorías y marcas). Los productos se cargarán dinámicamente a través de
    llamadas a la API desde JavaScript.

    Returns:
        Response: La plantilla `todos_productos.html` con los datos para los filtros.
    """
    # --- Carga de Datos para Filtros ---
    categorias_obj = CategoriasPrincipales.query.filter_by(estado=EstadoEnum.ACTIVO).all()
    subcategorias_obj = Subcategorias.query.filter_by(estado=EstadoEnum.ACTIVO).all()
    seudocategorias_obj = Seudocategorias.query.filter_by(estado=EstadoEnum.ACTIVO).all()

    # Obtiene todas las marcas únicas de productos activos para el filtro de marcas.
    marcas_obj = db.session.query(Productos.marca).filter(
        Productos.estado == EstadoEnum.ACTIVO, 
        Productos.marca.isnot(None), 
        Productos.marca != ''
    ).distinct().order_by(Productos.marca).all()
    marcas = [marca[0] for marca in marcas_obj]

    # Obtener géneros para el nuevo filtro.
    # Se extraen los valores distintos de la clave 'genero' del campo JSON 'especificaciones'.
    # MEJORA: Se usa `isnot(None)` en lugar del obsoleto `has_key`.
    # MEJORA PROFESIONAL: Se utiliza `json_extract_path_text` para hacer la búsqueda de la clave
    # insensible a mayúsculas/minúsculas, lo que funciona de manera más fiable en PostgreSQL
    # para claves JSON que pueden variar ('Genero', 'genero', etc.).
    genero_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Genero'))
    generos_obj = db.session.query(genero_expression).filter(
        Productos.estado == EstadoEnum.ACTIVO,
        func.json_extract_path_text(Productos.especificaciones, 'Genero').isnot(None)
    ).distinct().order_by(genero_expression).all()
    generos = [g[0] for g in generos_obj if g[0]]

    # LOG DE DEPURACIÓN: Añadido para verificar los géneros encontrados.
    current_app.logger.info(f"Géneros encontrados en la base de datos (crudo): {generos_obj}")
    current_app.logger.info(f"Lista de géneros procesada para la plantilla: {generos}")

    # MEJORA PROFESIONAL: Obtener funciones para el nuevo filtro.
    # Se extraen los valores distintos de la clave 'Funcion' del campo JSON 'especificaciones'.
    funcion_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Funcion'))
    funciones_obj = db.session.query(funcion_expression).filter(
        Productos.estado == EstadoEnum.ACTIVO,
        func.json_extract_path_text(Productos.especificaciones, 'Funcion').isnot(None)
    ).distinct().order_by(funcion_expression).all()
    funciones = [f[0] for f in funciones_obj if f[0]]
    current_app.logger.info(f"Lista de funciones procesada para la plantilla: {funciones}")

    # Serializa los objetos para que sean compatibles con JSON y la plantilla.
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
        categorias=categorias_para_filtros,
        subcategorias=subcategorias_para_filtros,
        seudocategorias=seudocategorias_para_filtros,
        marcas=marcas,
        generos=generos,
        funciones=funciones  # Añadir funciones al contexto de la plantilla
    )


@products_bp.route('/<slug_categoria>')
def productos_por_categoria(slug_categoria):
    """
    Renderiza la página de una categoría principal específica.

    Filtra y muestra solo los productos, subcategorías, seudocategorías y marcas
    que pertenecen a la categoría principal identificada por su `slug`.

    Args:
        slug_categoria (str): El slug de la categoría principal a mostrar.

    Returns:
        Response: La plantilla `categoria_producto.html` con los datos filtrados.
    """
    from flask import abort
    categoria_principal = CategoriasPrincipales.query.filter_by(slug=slug_categoria, estado=EstadoEnum.ACTIVO).first_or_404()

    seudocategoria_ids = db.session.query(Seudocategorias.id)\
        .join(Subcategorias)\
        .filter(
            Subcategorias.categoria_principal_id == categoria_principal.id,
            Subcategorias.estado == EstadoEnum.ACTIVO, # Asegurarse de que la subcategoría también esté activa
            Seudocategorias.estado == EstadoEnum.ACTIVO
        ).all()
    seudocategoria_ids = [id[0] for id in seudocategoria_ids]

    productos = Productos.query\
        .filter(
            Productos.seudocategoria_id.in_(seudocategoria_ids),
            Productos.estado == EstadoEnum.ACTIVO,
            Productos._existencia  > 0
        )\
        .order_by(Productos.nombre.asc())\
        .all()
    
    productos_data = [producto_to_dict(p) for p in productos]

    marcas_obj = db.session.query(Productos.marca).filter(
        Productos.seudocategoria_id.in_(seudocategoria_ids),
        Productos.estado == EstadoEnum.ACTIVO,
        Productos.marca.isnot(None),
        Productos.marca != ''
    ).distinct().order_by(Productos.marca).all()
    marcas = [marca[0] for marca in marcas_obj]
    print(f"DEBUG: productos_por_categoria - Cantidad de productos encontrados: {len(productos_data)}")

    # --- MEJORA PROFESIONAL: Obtener géneros y funciones disponibles para la categoría ---
    # Se obtienen los valores únicos de las especificaciones 'Genero' y 'Funcion'
    # para los productos dentro de la categoría actual. Esto evita una llamada AJAX
    # adicional al cargar la página.
    
    # Expresiones para extraer los valores de forma insensible a mayúsculas.
    genero_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Genero'))
    funcion_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Funcion'))

    # Consulta para géneros
    generos_obj = db.session.query(genero_expression).filter(
        Productos.seudocategoria_id.in_(seudocategoria_ids),
        Productos.estado == EstadoEnum.ACTIVO,
        func.json_extract_path_text(Productos.especificaciones, 'Genero').isnot(None)
    ).distinct().order_by(genero_expression).all()
    generos = [g[0] for g in generos_obj if g[0]]

    # Consulta para funciones (se realiza por separado para mantener la lógica simple)
    funciones_obj = db.session.query(funcion_expression).filter(Productos.seudocategoria_id.in_(seudocategoria_ids), Productos.estado == EstadoEnum.ACTIVO, func.json_extract_path_text(Productos.especificaciones, 'Funcion').isnot(None)).distinct().order_by(funcion_expression).all()
    funciones = [f[0] for f in funciones_obj if f[0]]

    # --- MEJORA PROFESIONAL: Obtener ingredientes clave disponibles para la categoría ---
    ingrediente_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Ingrediente Clave'))
    ingredientes_obj = db.session.query(ingrediente_expression).filter(
        Productos.seudocategoria_id.in_(seudocategoria_ids),
        Productos.estado == EstadoEnum.ACTIVO,
        func.json_extract_path_text(Productos.especificaciones, 'Ingrediente Clave').isnot(None)
    ).distinct().order_by(ingrediente_expression).all()
    ingredientes_clave = [i[0] for i in ingredientes_obj if i[0]]

    # --- MEJORA PROFESIONAL: Obtener opciones de "Resistente al agua" ---
    resistente_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Resistente al agua'))
    resistente_obj = db.session.query(resistente_expression).filter(
        Productos.seudocategoria_id.in_(seudocategoria_ids),
        Productos.estado == EstadoEnum.ACTIVO,
        func.json_extract_path_text(Productos.especificaciones, 'Resistente al agua').isnot(None)
    ).distinct().order_by(resistente_expression).all()
    resistente_al_agua = [r[0] for r in resistente_obj if r[0]]


    subcategorias_obj = Subcategorias.query.filter_by(
        categoria_principal_id=categoria_principal.id,
        estado=EstadoEnum.ACTIVO
    ).all()

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
        subcategorias=subcategorias,
        seudocategorias=seudocategorias,
        marcas=marcas,
        generos=generos,      # Inyectar géneros en la plantilla
        funciones=funciones,  # Inyectar funciones en la plantilla
        ingredientes_clave=ingredientes_clave, # Inyectar ingredientes clave en la plantilla
        resistente_al_agua=resistente_al_agua, # Inyectar opciones de resistencia al agua
        title=f"{categoria_principal.nombre} - YE & Ci Cosméticos"
    )

@products_bp.route('/<slug_categoria_principal>/<slug_subcategoria>')
def productos_por_subcategoria(slug_categoria_principal, slug_subcategoria):
    """
    Renderiza la página de una subcategoría específica.

    Utiliza los slugs de la categoría principal y la subcategoría para asegurar
    una URL jerárquica y única. Filtra y muestra solo los productos, seudocategorías
    y marcas que pertenecen a esta subcategoría.

    Args:
        slug_categoria_principal (str): El slug de la categoría principal padre.
        slug_subcategoria (str): El slug de la subcategoría a mostrar.

    Returns:
        Response: La plantilla `subcategoria_producto.html` con los datos filtrados.
    """
    subcategoria = Subcategorias.query.join(CategoriasPrincipales).filter(
        Subcategorias.slug == slug_subcategoria,
        CategoriasPrincipales.slug == slug_categoria_principal,
        Subcategorias.estado == EstadoEnum.ACTIVO,
        CategoriasPrincipales.estado == EstadoEnum.ACTIVO
    ).options(joinedload(Subcategorias.categoria_principal)).first_or_404()

    categoria_principal = subcategoria.categoria_principal

    seudocategoria_ids = [s.id for s in subcategoria.seudocategorias if s.estado == EstadoEnum.ACTIVO]

    productos = []
    if seudocategoria_ids:
        productos = Productos.query.filter(
            Productos.seudocategoria_id.in_(seudocategoria_ids),
            Productos.estado == EstadoEnum.ACTIVO,
            Productos._existencia > 0
        ).order_by(Productos.nombre.asc()).all()

    productos_data = [producto_to_dict(p) for p in productos]

    marcas_obj = []
    if seudocategoria_ids:
        marcas_obj = db.session.query(Productos.marca).filter(
            Productos.seudocategoria_id.in_(seudocategoria_ids),
            Productos.estado == EstadoEnum.ACTIVO,
            Productos.marca.isnot(None),
            Productos.marca != ''
        ).distinct().order_by(Productos.marca).all()
    marcas = [marca[0] for marca in marcas_obj]

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
    Renderiza la página de una seudocategoría específica (el nivel más bajo).

    Utiliza una URL jerárquica completa con los slugs de sus padres para asegurar
    unicidad y buen SEO. Muestra solo los productos y marcas de esta seudocategoría.

    Args:
        slug_categoria_principal (str): El slug de la categoría principal.
        slug_subcategoria (str): El slug de la subcategoría.
        slug_seudocategoria (str): El slug de la seudocategoría a mostrar.

    Returns:
        Response: La plantilla `seudocategoria_producto.html` con los datos filtrados.
    """
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

    productos = Productos.query.filter(
        Productos.seudocategoria_id == seudocategoria.id,
        Productos.estado == EstadoEnum.ACTIVO,
        Productos._existencia > 0
    ).order_by(Productos.nombre.asc()).all()

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
    API: Devuelve las categorías principales disponibles según los filtros aplicados.

    Este endpoint es utilizado por el frontend para actualizar dinámicamente las opciones
    del filtro de "Categoría Principal" cuando el usuario selecciona otros filtros
    (como marca, subcategoría, etc.), mostrando solo las opciones relevantes.
    """
    try:
        current_app.logger.info("API: Solicitud recibida en /api/filtros/categorias")
        marca = request.args.get('marca')
        subcategoria_nombre = request.args.get('subcategoria')
        seudocategoria_nombre = request.args.get('seudocategoria')

        query = db.session.query(CategoriasPrincipales).filter(CategoriasPrincipales.estado == EstadoEnum.ACTIVO).distinct()

        needs_join = (marca and marca != 'all') or \
                     (subcategoria_nombre and subcategoria_nombre != 'all') or \
                     (seudocategoria_nombre and seudocategoria_nombre != 'all')

        if needs_join:
            query = query.join(Subcategorias).join(Seudocategorias).join(Productos)

        if marca and marca != 'all':
            query = query.filter(Productos.marca == marca, Productos.estado == EstadoEnum.ACTIVO, Productos._existencia > 0)
        if subcategoria_nombre and subcategoria_nombre != 'all':
            query = query.filter(func.lower(Subcategorias.nombre) == func.lower(subcategoria_nombre))
        if seudocategoria_nombre and seudocategoria_nombre != 'all':
            query = query.filter(func.lower(Seudocategorias.nombre) == func.lower(seudocategoria_nombre))

        categorias = query.order_by(CategoriasPrincipales.nombre.asc()).all()
        return jsonify([categoria_principal_to_dict(c) for c in categorias])
    except Exception as e:
        current_app.logger.error(f"Error en get_categorias_filtradas: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@products_bp.route('/api/filtros/subcategorias')
def get_subcategorias_filtradas():
    """
    API: Devuelve las subcategorías disponibles según los filtros aplicados.

    Similar a `get_categorias_filtradas`, este endpoint actualiza dinámicamente
    las opciones del filtro de "Subcategoría" basándose en las selecciones
    actuales del usuario en otros filtros.
    """
    try:
        current_app.logger.info("API: Solicitud recibida en /api/filtros/subcategorias")
        categoria_principal_nombre = request.args.get('categoria_principal')
        marca = request.args.get('marca')
        seudocategoria_nombre = request.args.get('seudocategoria')

        query = db.session.query(Subcategorias).filter(Subcategorias.estado == EstadoEnum.ACTIVO).distinct()

        needs_seudocategorias_join = (marca and marca != 'all') or (seudocategoria_nombre and seudocategoria_nombre != 'all')
        needs_productos_join = (marca and marca != 'all')

        if categoria_principal_nombre and categoria_principal_nombre != 'all':
            query = query.join(CategoriasPrincipales)
            query = query.filter(func.lower(CategoriasPrincipales.nombre) == func.lower(categoria_principal_nombre))

        if needs_seudocategorias_join:
            query = query.join(Seudocategorias, Subcategorias.id == Seudocategorias.subcategoria_id)

        if needs_productos_join:
            query = query.join(Productos, Seudocategorias.id == Productos.seudocategoria_id)

        if marca and marca != 'all':
            query = query.filter(Productos.marca == marca, Productos.estado == EstadoEnum.ACTIVO, Productos._existencia > 0)

        if seudocategoria_nombre and seudocategoria_nombre != 'all':
            query = query.filter(func.lower(Seudocategorias.nombre) == func.lower(seudocategoria_nombre))

        subcategorias = query.all()
        return jsonify([subcategoria_to_dict(s) for s in subcategorias])
    except Exception as e:
        current_app.logger.error(f"Error en get_subcategorias_filtradas: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@products_bp.route('/api/filtros/seudocategorias')
def get_seudocategorias_filtradas():
    """
    API: Devuelve las seudocategorías disponibles según los filtros aplicados.

    Endpoint para la actualización dinámica del filtro de "Seudocategoría",
    mostrando solo las opciones que son relevantes según las selecciones
    de categoría principal, subcategoría o marca.
    """
    try:
        current_app.logger.info("API: Solicitud recibida en /api/filtros/seudocategorias")
        categoria_principal_nombre = request.args.get('categoria_principal')
        subcategoria_nombre = request.args.get('subcategoria')
        marca = request.args.get('marca')

        query = db.session.query(Seudocategorias).filter(Seudocategorias.estado == EstadoEnum.ACTIVO).distinct()

        if (categoria_principal_nombre and categoria_principal_nombre != 'all') or \
           (subcategoria_nombre and subcategoria_nombre != 'all'):
            query = query.join(Subcategorias, Seudocategorias.subcategoria_id == Subcategorias.id)
            query = query.join(CategoriasPrincipales, Subcategorias.categoria_principal_id == CategoriasPrincipales.id)

        if marca and marca != 'all':
            query = query.join(Productos, Seudocategorias.id == Productos.seudocategoria_id)

        if categoria_principal_nombre and categoria_principal_nombre != 'all':
            query = query.filter(func.lower(CategoriasPrincipales.nombre) == func.lower(categoria_principal_nombre))

        if subcategoria_nombre and subcategoria_nombre != 'all':
            query = query.filter(func.lower(Subcategorias.nombre) == func.lower(subcategoria_nombre))

        if marca and marca != 'all':
            query = query.filter(Productos.marca == marca, Productos.estado == EstadoEnum.ACTIVO, Productos._existencia > 0)

        seudocategorias = query.all()
        return jsonify([seudocategoria_to_dict(s) for s in seudocategorias])
    except Exception as e:
        current_app.logger.error(f"Error en get_seudocategorias_filtradas: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@products_bp.route('/api/filtros/marcas')
def get_marcas_filtradas():
    """
    API: Devuelve las marcas disponibles según los filtros aplicados.

    Endpoint para la actualización dinámica del filtro de "Marca", mostrando solo
    las marcas que tienen productos dentro de las categorías seleccionadas
    por el usuario.
    """
    try:
        current_app.logger.info("API: Solicitud recibida en /api/filtros/marcas")
        categoria_principal_nombre = request.args.get('categoria_principal')
        subcategoria_nombre = request.args.get('subcategoria')
        seudocategoria_nombre = request.args.get('seudocategoria')
        ingrediente_clave = request.args.get('ingrediente_clave')
        resistente_al_agua = request.args.get('resistente_al_agua')

        query = db.session.query(Productos.marca).filter(
            Productos.estado == EstadoEnum.ACTIVO,
            Productos._existencia > 0,
            Productos.marca.isnot(None),
            Productos.marca != ''
        ).distinct()

        if (categoria_principal_nombre and categoria_principal_nombre != 'all') or \
           (subcategoria_nombre and subcategoria_nombre != 'all') or \
           (seudocategoria_nombre and seudocategoria_nombre != 'all') or \
           (ingrediente_clave and ingrediente_clave != 'all') or \
           (resistente_al_agua and resistente_al_agua != 'all'):
            query = query.join(Seudocategorias, Productos.seudocategoria_id == Seudocategorias.id)
            query = query.join(Subcategorias, Seudocategorias.subcategoria_id == Subcategorias.id)
            query = query.join(CategoriasPrincipales, Subcategorias.categoria_principal_id == CategoriasPrincipales.id)

        if categoria_principal_nombre and categoria_principal_nombre != 'all':
            query = query.filter(func.lower(CategoriasPrincipales.nombre) == func.lower(categoria_principal_nombre))

        if subcategoria_nombre and subcategoria_nombre != 'all':
            query = query.filter(func.lower(Subcategorias.nombre) == func.lower(subcategoria_nombre))

        if seudocategoria_nombre and seudocategoria_nombre != 'all':
            query = query.filter(func.lower(Seudocategorias.nombre) == func.lower(seudocategoria_nombre))

        if ingrediente_clave and ingrediente_clave != 'all':
            ingrediente_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Ingrediente Clave'))
            query = query.filter(ingrediente_expression == func.lower(ingrediente_clave))
        
        if resistente_al_agua and resistente_al_agua != 'all':
            resistente_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Resistente al agua'))
            query = query.filter(resistente_expression == func.lower(resistente_al_agua))

        marcas = [row[0] for row in query.order_by(Productos.marca.asc()).all() if row[0]]
        return jsonify(marcas)
    except Exception as e:
        current_app.logger.error(f"Error en get_marcas_filtradas: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@products_bp.route('/api/filtros/generos')
def get_generos_filtrados():
    """
    API: Devuelve los géneros disponibles según los filtros aplicados.

    Este endpoint es utilizado por el frontend para actualizar dinámicamente las opciones
    del filtro de "Género", mostrando solo las opciones relevantes.
    """
    try:
        current_app.logger.info("API: Solicitud recibida en /api/filtros/generos")
        categoria_principal_nombre = request.args.get('categoria_principal')
        subcategoria_nombre = request.args.get('subcategoria')
        seudocategoria_nombre = request.args.get('seudocategoria')
        marca = request.args.get('marca')
        ingrediente_clave = request.args.get('ingrediente_clave')
        resistente_al_agua = request.args.get('resistente_al_agua')

        # LOG DE DEPURACIÓN: Mostrar los filtros recibidos por la API de géneros.
        current_app.logger.info(f"[API /api/filtros/generos] Filtros recibidos: categoria='{categoria_principal_nombre}', "
                                f"subcategoria='{subcategoria_nombre}', seudocategoria='{seudocategoria_nombre}', "
                                f"marca='{marca}'")

        # MEJORA PROFESIONAL: Usar json_extract_path_text para ser insensible a mayúsculas en la clave 'Genero'.
        genero_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Genero'))

        query = db.session.query(genero_expression).filter(
            Productos.estado == EstadoEnum.ACTIVO,
            Productos._existencia > 0,
            func.json_extract_path_text(Productos.especificaciones, 'Genero').isnot(None)
        ).distinct()

        # Unir con otras tablas si hay filtros de categoría o marca
        if any(f and f != 'all' for f in [categoria_principal_nombre, subcategoria_nombre, seudocategoria_nombre, marca, ingrediente_clave, resistente_al_agua]):
            query = query.join(Seudocategorias).join(Subcategorias).join(CategoriasPrincipales)

        if categoria_principal_nombre and categoria_principal_nombre != 'all':
            query = query.filter(func.lower(CategoriasPrincipales.nombre) == func.lower(categoria_principal_nombre))
        if subcategoria_nombre and subcategoria_nombre != 'all':
            query = query.filter(func.lower(Subcategorias.nombre) == func.lower(subcategoria_nombre))
        if seudocategoria_nombre and seudocategoria_nombre != 'all':
            query = query.filter(func.lower(Seudocategorias.nombre) == func.lower(seudocategoria_nombre))
        if marca and marca != 'all':
            query = query.filter(func.lower(Productos.marca) == func.lower(marca))
        
        if ingrediente_clave and ingrediente_clave != 'all':
            ingrediente_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Ingrediente Clave'))
            query = query.filter(ingrediente_expression == func.lower(ingrediente_clave))
        
        if resistente_al_agua and resistente_al_agua != 'all':
            resistente_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Resistente al agua'))
            query = query.filter(resistente_expression == func.lower(resistente_al_agua))

        generos_obj = query.order_by(genero_expression).all()
        generos = [row[0] for row in generos_obj if row[0]]

        # LOG DE DEPURACIÓN: Mostrar los géneros encontrados por la consulta.
        current_app.logger.info(f"[API /api/filtros/generos] Géneros encontrados (crudo): {generos_obj}")
        current_app.logger.info(f"[API /api/filtros/generos] Lista de géneros a enviar: {generos}")

        return jsonify(generos)
    except Exception as e:
        current_app.logger.error(f"Error en get_generos_filtrados: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
    
@products_bp.route('/api/filtros/funciones')
def get_funciones_filtradas():
    """
    API: Devuelve las funciones disponibles según los filtros aplicados.

    Endpoint para la actualización dinámica del filtro de "Función", mostrando solo
    las opciones relevantes según las selecciones de categoría, marca, etc.
    """
    try:
        current_app.logger.info("API: Solicitud recibida en /api/filtros/funciones")
        categoria_principal_nombre = request.args.get('categoria_principal')
        subcategoria_nombre = request.args.get('subcategoria')
        seudocategoria_nombre = request.args.get('seudocategoria')
        marca = request.args.get('marca')
        genero = request.args.get('genero')
        ingrediente_clave = request.args.get('ingrediente_clave')
        resistente_al_agua = request.args.get('resistente_al_agua')

        # Usar json_extract_path_text para ser insensible a mayúsculas en la clave 'Funcion'.
        funcion_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Funcion'))

        query = db.session.query(funcion_expression).filter(
            Productos.estado == EstadoEnum.ACTIVO,
            Productos._existencia > 0,
            func.json_extract_path_text(Productos.especificaciones, 'Funcion').isnot(None)
        ).distinct()

        # Unir con otras tablas si hay filtros
        if any(f and f != 'all' for f in [categoria_principal_nombre, subcategoria_nombre, seudocategoria_nombre, marca, genero, ingrediente_clave, resistente_al_agua]):
            query = query.join(Seudocategorias).join(Subcategorias).join(CategoriasPrincipales)

        if categoria_principal_nombre and categoria_principal_nombre != 'all':
            query = query.filter(func.lower(CategoriasPrincipales.nombre) == func.lower(categoria_principal_nombre))
        if subcategoria_nombre and subcategoria_nombre != 'all':
            query = query.filter(func.lower(Subcategorias.nombre) == func.lower(subcategoria_nombre))
        if seudocategoria_nombre and seudocategoria_nombre != 'all':
            query = query.filter(func.lower(Seudocategorias.nombre) == func.lower(seudocategoria_nombre))
        if marca and marca != 'all':
            query = query.filter(func.lower(Productos.marca) == func.lower(marca))
        
        if resistente_al_agua and resistente_al_agua != 'all':
            resistente_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Resistente al agua'))
            query = query.filter(resistente_expression == func.lower(resistente_al_agua))

        funciones_obj = query.order_by(funcion_expression).all()
        funciones = [row[0] for row in funciones_obj if row[0]]
        return jsonify(funciones)
    except Exception as e:
        current_app.logger.error(f"Error en get_funciones_filtradas: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@products_bp.route('/api/filtros/ingredientes_clave')
def get_ingredientes_clave_filtrados():
    """
    API: Devuelve los ingredientes clave disponibles según los filtros aplicados.

    Endpoint para la actualización dinámica del filtro de "Ingrediente Clave".
    """
    try:
        current_app.logger.info("API: Solicitud recibida en /api/filtros/ingredientes_clave")
        categoria_principal_nombre = request.args.get('categoria_principal')
        subcategoria_nombre = request.args.get('subcategoria')
        seudocategoria_nombre = request.args.get('seudocategoria')
        marca = request.args.get('marca')
        genero = request.args.get('genero')
        funcion = request.args.get('funcion')
        resistente_al_agua = request.args.get('resistente_al_agua')

        ingrediente_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Ingrediente Clave'))

        query = db.session.query(ingrediente_expression).filter(
            Productos.estado == EstadoEnum.ACTIVO,
            Productos._existencia > 0,
            func.json_extract_path_text(Productos.especificaciones, 'Ingrediente Clave').isnot(None)
        ).distinct()

        # Unir con otras tablas si hay filtros
        if any(f and f != 'all' for f in [categoria_principal_nombre, subcategoria_nombre, seudocategoria_nombre, marca, genero, funcion, resistente_al_agua]):
            query = query.join(Seudocategorias).join(Subcategorias).join(CategoriasPrincipales)

        if categoria_principal_nombre and categoria_principal_nombre != 'all':
            query = query.filter(func.lower(CategoriasPrincipales.nombre) == func.lower(categoria_principal_nombre))
        if subcategoria_nombre and subcategoria_nombre != 'all':
            query = query.filter(func.lower(Subcategorias.nombre) == func.lower(subcategoria_nombre))
        if seudocategoria_nombre and seudocategoria_nombre != 'all':
            query = query.filter(func.lower(Seudocategorias.nombre) == func.lower(seudocategoria_nombre))
        if marca and marca != 'all':
            query = query.filter(func.lower(Productos.marca) == func.lower(marca))
        if genero and genero != 'all':
            genero_expression_filter = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Genero'))
            query = query.filter(genero_expression_filter == func.lower(genero))
        if funcion and funcion != 'all':
            funcion_expression_filter = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Funcion'))
            query = query.filter(funcion_expression_filter == func.lower(funcion))
        
        if resistente_al_agua and resistente_al_agua != 'all':
            resistente_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Resistente al agua'))
            query = query.filter(resistente_expression == func.lower(resistente_al_agua))

        ingredientes_obj = query.order_by(ingrediente_expression).all()
        ingredientes = [row[0] for row in ingredientes_obj if row[0]]
        
        current_app.logger.info(f"[API /api/filtros/ingredientes_clave] Ingredientes encontrados: {ingredientes}")

        return jsonify(ingredientes)
    except Exception as e:
        current_app.logger.error(f"Error en get_ingredientes_clave_filtrados: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@products_bp.route('/api/filtros/resistente_al_agua')
def get_resistente_al_agua_filtrados():
    """
    API: Devuelve las opciones de "Resistente al agua" disponibles según los filtros.
    """
    try:
        current_app.logger.info("API: Solicitud recibida en /api/filtros/resistente_al_agua")
        categoria_principal_nombre = request.args.get('categoria_principal')
        subcategoria_nombre = request.args.get('subcategoria')
        seudocategoria_nombre = request.args.get('seudocategoria')
        marca = request.args.get('marca')
        genero = request.args.get('genero')
        funcion = request.args.get('funcion')
        ingrediente_clave = request.args.get('ingrediente_clave')

        resistente_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Resistente al agua'))

        query = db.session.query(resistente_expression).filter(
            Productos.estado == EstadoEnum.ACTIVO,
            Productos._existencia > 0,
            func.json_extract_path_text(Productos.especificaciones, 'Resistente al agua').isnot(None)
        ).distinct()

        # Unir con otras tablas si hay filtros
        if any(f and f != 'all' for f in [categoria_principal_nombre, subcategoria_nombre, seudocategoria_nombre, marca, genero, funcion, ingrediente_clave]):
            query = query.join(Seudocategorias).join(Subcategorias).join(CategoriasPrincipales)

        if categoria_principal_nombre and categoria_principal_nombre != 'all':
            query = query.filter(func.lower(CategoriasPrincipales.nombre) == func.lower(categoria_principal_nombre))
        if subcategoria_nombre and subcategoria_nombre != 'all':
            query = query.filter(func.lower(Subcategorias.nombre) == func.lower(subcategoria_nombre))
        if seudocategoria_nombre and seudocategoria_nombre != 'all':
            query = query.filter(func.lower(Seudocategorias.nombre) == func.lower(seudocategoria_nombre))
        if marca and marca != 'all':
            query = query.filter(func.lower(Productos.marca) == func.lower(marca))
        if genero and genero != 'all':
            genero_expression_filter = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Genero'))
            query = query.filter(genero_expression_filter == func.lower(genero))
        if funcion and funcion != 'all':
            funcion_expression_filter = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Funcion'))
            query = query.filter(funcion_expression_filter == func.lower(funcion))
        if ingrediente_clave and ingrediente_clave != 'all':
            ingrediente_expression_filter = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Ingrediente Clave'))
            query = query.filter(ingrediente_expression_filter == func.lower(ingrediente_clave))

        resistente_obj = query.order_by(resistente_expression).all()
        opciones = [row[0] for row in resistente_obj if row[0]]
        
        current_app.logger.info(f"[API /api/filtros/resistente_al_agua] Opciones encontradas: {opciones}")

        return jsonify(opciones)
    except Exception as e:
        current_app.logger.error(f"Error en get_resistente_al_agua_filtrados: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@products_bp.route('/<slug_categoria_principal>/<slug_subcategoria>/<slug_seudocategoria>/<slug_producto>')
def producto_detalle(slug_categoria_principal, slug_subcategoria, slug_seudocategoria, slug_producto):
    """
    Renderiza la página de detalle de un producto específico.

    Utiliza una URL jerárquica completa para identificar de manera única el producto,
    lo que es beneficioso para el SEO. Realiza una consulta optimizada para cargar
    el producto, sus categorías, reseñas y productos relacionados.

    Args:
        slug_categoria_principal (str): Slug de la categoría principal.
        slug_subcategoria (str): Slug de la subcategoría.
        slug_seudocategoria (str): Slug de la seudocategoría.
        slug_producto (str): Slug del producto.

    Returns:
        Response: La plantilla `producto_detalle.html` con todos los datos del producto.
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
        Productos.estado == EstadoEnum.ACTIVO,
        Seudocategorias.slug == slug_seudocategoria,
        Seudocategorias.estado == EstadoEnum.ACTIVO,
        Subcategorias.slug == slug_subcategoria,
        Subcategorias.estado == EstadoEnum.ACTIVO,
        CategoriasPrincipales.slug == slug_categoria_principal,
        CategoriasPrincipales.estado == EstadoEnum.ACTIVO
    ).first_or_404()
    
    if producto.estado != EstadoEnum.ACTIVO:
        from flask import abort
        abort(404)
    
    # --- MEJORA PROFESIONAL: Lógica de Productos Relacionados más Relevante ---
    # 1. Prioridad: Productos de la misma Seudocategoría.
    productos_relacionados = []
    if producto.seudocategoria_id:
        print(f"DEBUG: Buscando productos relacionados para seudocategoria_id: {producto.seudocategoria_id}")
        productos_relacionados = Productos.query.filter(
            Productos.seudocategoria_id == producto.seudocategoria_id,
            Productos.id != producto.id,
            Productos.estado == EstadoEnum.ACTIVO,
            Productos._existencia > 0
        ).order_by(func.random()).limit(8).all()

    # 2. Fallback: Si no hay suficientes, buscar en la misma Subcategoría.
    if len(productos_relacionados) < 4 and producto.seudocategoria and producto.seudocategoria.subcategoria:
        print(f"DEBUG: No hay suficientes productos en la seudocategoría. Buscando en la subcategoría: {producto.seudocategoria.subcategoria.id}")
        
        # Obtener IDs de todas las seudocategorías de la misma subcategoría.
        seudocategoria_ids_sub = [s.id for s in producto.seudocategoria.subcategoria.seudocategorias if s.estado == EstadoEnum.ACTIVO]
        
        # Obtener IDs de productos ya encontrados para no repetirlos.
        productos_relacionados_ids = [p.id for p in productos_relacionados]
        
        # Buscar productos adicionales.
        productos_adicionales = Productos.query.filter(
            Productos.seudocategoria_id.in_(seudocategoria_ids_sub),
            Productos.id != producto.id,
            Productos.id.notin_(productos_relacionados_ids),
            Productos.estado == EstadoEnum.ACTIVO,
            Productos._existencia > 0
        ).order_by(func.random()).limit(8 - len(productos_relacionados)).all()
        
        productos_relacionados.extend(productos_adicionales)

    print(f"DEBUG: Productos relacionados para {producto.nombre}: {len(productos_relacionados)} productos encontrados.")
    for p in productos_relacionados:
        print(f"  - {p.nombre} (ID: {p.id})")
    
    productos_relacionados_data = [producto_to_dict(p) for p in productos_relacionados]
    print(f"DEBUG: productos_relacionados_data (después de to_dict): {len(productos_relacionados_data)} elementos.")
    if productos_relacionados_data:
        print(f"DEBUG: Primer elemento de productos_relacionados_data: {productos_relacionados_data[0]}")

    reseñas = Reseñas.query.filter_by(
        producto_id=producto.id
    ).order_by(Reseñas.created_at.desc()).all()

    calificacion_promedio = producto.calificacion_promedio_almacenada

    reseñas_count = len(reseñas)

    es_favorito = False
    current_user_id = None
    if hasattr(current_user, 'id'):
        current_user_id = current_user.id
    elif 'user' in session and 'id' in session['user']:
        current_user_id = session['user']['id']

    if current_user_id:
        like = Likes.query.filter_by(
            usuario_id=current_user_id,
            producto_id=producto.id,
            estado=EstadoEnum.ACTIVO
        ).first()
        es_favorito = like is not None
    
    # Obtiene la jerarquía de categorías para construir el breadcrumb en la plantilla.
    main_category_name = None
    main_category_slug = None
    subcategory_name = None
    subcategory_slug = None
    pseudocategory_name = None
    pseudocategory_slug = None

    if producto.seudocategoria:
        pseudocategory_name = producto.seudocategoria.nombre
        pseudocategory_slug = producto.seudocategoria.slug
        if producto.seudocategoria.subcategoria:
            subcategory_name = producto.seudocategoria.subcategoria.nombre
            subcategory_slug = producto.seudocategoria.subcategoria.slug
            if producto.seudocategoria.subcategoria.categoria_principal:
                main_category_name = producto.seudocategoria.subcategoria.categoria_principal.nombre
                main_category_slug = producto.seudocategoria.subcategoria.categoria_principal.slug

    return render_template(
        'cliente/componentes/producto_detalle.html',
        producto=producto,
        productos_relacionados=productos_relacionados_data,
        reseñas=reseñas,
        calificacion_promedio=calificacion_promedio,
        es_favorito=es_favorito,
        title=f"{producto.nombre} - YE & Ci Cosméticos",
        main_category_name=main_category_name,
        main_category_slug=main_category_slug,
        subcategory_name=subcategory_name,
        subcategory_slug=subcategory_slug,
        pseudocategory_name=pseudocategory_name,
        pseudocategory_slug=pseudocategory_slug,
        current_user=current_user,
        es_nuevo=producto.es_nuevo,
        reseñas_count=reseñas_count
    )


@products_bp.route('/buscar')
def buscar():
    """
    API: Realiza una búsqueda de productos en tiempo real.

    Busca productos por nombre, marca o descripción. Prioriza los resultados que
    coinciden con el inicio del nombre o la marca. También devuelve una lista de
    los términos de búsqueda más populares como sugerencias.

    Query Params:
        q (str): El término de búsqueda.

    Returns:
        JSON: Un objeto con los resultados, sugerencias y el total.
    """
    query = request.args.get('q', '').strip()

    if not query:
        sugerencias = BusquedaTermino.top_terminos(10)
        return jsonify({
            'resultados': [],
            'sugerencias': [s.termino for s in sugerencias],
            'query': query
        })

    if len(query) < 1 or len(query) > 100:
        sugerencias = BusquedaTermino.top_terminos(10)
        return jsonify({
            'resultados': [],
            'sugerencias': [s.termino for s in sugerencias],
            'error': 'Término de búsqueda inválido'
        }), 400

    try:
        productos = Productos.query.filter(
            db.or_(
                Productos.nombre.ilike(f'{query}%'),
                Productos.marca.ilike(f'{query}%'),
                Productos.descripcion.ilike(f'{query}%')
            ),
            Productos.estado == EstadoEnum.ACTIVO,
            Productos._existencia  > 0
        ).order_by(
            # Prioriza las coincidencias que empiezan con el término de búsqueda.
            db.case(
                (Productos.nombre.ilike(f'{query}%'), 1),
                (Productos.marca.ilike(f'{query}%'), 2),
                else_=3
            ),
            Productos.nombre.asc()
        ).limit(12).all()

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
    """
    API: Registra los términos de búsqueda asociados a un clic en un producto.

    Cuando un usuario busca algo y hace clic en un producto, este endpoint
    registra los términos relevantes (nombre del producto, marca, categorías)
    asociados con esa búsqueda para mejorar la relevancia futura.

    Body (JSON): { "product_id": str, "query": str }
    """
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
    """
    API: Registra un lote de términos de búsqueda.

    Permite al frontend enviar múltiples términos de búsqueda para ser registrados
    en una sola petición, lo cual es más eficiente que hacer una petición por cada término.

    Body (JSON): { "terminos": [{"product_id": str, "query": str}] }
    """
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
    """
    Función auxiliar para extraer términos de búsqueda relevantes de un producto.

    Compara la consulta de búsqueda (`query`) con el nombre, marca y categorías
    de un producto para identificar qué atributos del producto coinciden con la
    búsqueda del usuario.

    Args:
        product_id (str): El ID del producto.
        query (str): El término de búsqueda del usuario.

    Returns:
        set: Un conjunto de términos relevantes extraídos del producto.
    """
    producto = Productos.query.get(product_id)
    if not producto:
        return set()

    terminos = set()
    if query in producto.nombre.lower():
        terminos.add(producto.nombre)

    if producto.marca and query in producto.marca.lower():
        terminos.add(producto.marca)

    if producto.seudocategoria and producto.seudocategoria.estado == EstadoEnum.ACTIVO:
        if query in producto.seudocategoria.nombre.lower():
            terminos.add(producto.seudocategoria.nombre)
        if producto.seudocategoria.subcategoria and producto.seudocategoria.subcategoria.estado == EstadoEnum.ACTIVO:
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
    API: Devuelve productos filtrados según múltiples criterios.

    Este es el endpoint principal para el filtrado dinámico de productos en la página
    de catálogo. Acepta una variedad de parámetros de consulta para filtrar por
    jerarquía de categorías, marca, rango de precios y para ordenar los resultados.

    Returns:
        JSON: Una lista de objetos de producto que coinciden con los filtros.
    """
    main_category_name = request.args.get('categoria_principal')
    subcategory_name = request.args.get('subcategoria')
    pseudocategory_name = request.args.get('pseudocategoria')
    marca = request.args.get('marca')
    genero = request.args.get('genero')
    funcion = request.args.get('funcion') # Nuevo filtro
    ingrediente_clave = request.args.get('ingrediente_clave') # Nuevo filtro
    resistente_al_agua = request.args.get('resistente_al_agua') # Nuevo filtro
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

    query = query.filter(Productos.estado == EstadoEnum.ACTIVO, Productos._existencia  > 0)

    if main_category_name and main_category_name != 'all':
        query = query.filter(func.lower(CategoriasPrincipales.nombre) == func.lower(main_category_name))
    
    if subcategory_name and subcategory_name != 'all':
        query = query.filter(func.lower(Subcategorias.nombre) == func.lower(subcategory_name))

    if pseudocategory_name and pseudocategory_name != 'all':
        query = query.filter(func.lower(Seudocategorias.nombre) == func.lower(pseudocategory_name))
    
    if marca and marca != 'all':
        query = query.filter(func.lower(Productos.marca) == func.lower(marca))

    # MEJORA PROFESIONAL: Añadir filtro por género.
    if genero and genero != 'all':
        # MEJORA PROFESIONAL: Se utiliza `json_extract_path_text` para una comparación robusta e insensible
        # a mayúsculas tanto en la clave ('Genero') como en el valor (ej. 'Mujer', 'mujer').
        genero_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Genero'))
        query = query.filter(genero_expression == func.lower(genero))

    # MEJORA PROFESIONAL: Añadir filtro por función.
    if funcion and funcion != 'all':
        # Se utiliza `json_extract_path_text` para una comparación robusta.
        funcion_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Funcion'))
        query = query.filter(funcion_expression == func.lower(funcion))

    # MEJORA PROFESIONAL: Añadir filtro por ingrediente clave.
    if ingrediente_clave and ingrediente_clave != 'all':
        # Se utiliza `json_extract_path_text` para una comparación robusta.
        ingrediente_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Ingrediente Clave'))
        query = query.filter(ingrediente_expression == func.lower(ingrediente_clave))

    # MEJORA PROFESIONAL: Añadir filtro por resistente al agua.
    if resistente_al_agua and resistente_al_agua != 'all':
        # Se utiliza `json_extract_path_text` para una comparación robusta.
        resistente_expression = func.lower(func.json_extract_path_text(Productos.especificaciones, 'Resistente al agua'))
        query = query.filter(resistente_expression == func.lower(resistente_al_agua))

    if min_price_str:
        try:
            min_price = float(min_price_str)
            query = query.filter(Productos.precio >= min_price)
        except ValueError:
            pass
    if max_price_str:
        try:
            max_price = float(max_price_str)
            query = query.filter(Productos.precio <= max_price)
        except ValueError:
            pass  

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
    else:
        query = query.order_by(Productos.nombre.asc())

    productos = query.all()
    return jsonify([producto_to_dict(p) for p in productos])

@products_bp.route('/api/productos')
def get_all_products():
    """
    API: Devuelve todos los productos activos.

    Un endpoint simple para obtener una lista completa de todos los productos
    que están activos y tienen stock, sin ningún filtro.
    """
    productos = Productos.query.filter_by(estado=EstadoEnum.ACTIVO).filter(Productos._existencia  > 0).all()
    return jsonify([producto_to_dict(p) for p in productos])

@products_bp.route('/api/productos/categoria/<nombre_categoria>')
def get_products_by_category(nombre_categoria):
    """
    API: Devuelve productos de una categoría principal específica.

    Args:
        nombre_categoria (str): El nombre de la categoría principal.
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
    API: Devuelve el rango de precios (mínimo y máximo) de los productos.

    Este endpoint es utilizado por el control deslizante de precios en la UI de filtros.
    Puede devolver el rango de precios global o un rango filtrado si se proporcionan
    parámetros de categoría.
    """
    main_category_name = request.args.get('categoria_principal')
    subcategory_name = request.args.get('subcategoria')
    pseudocategory_name = request.args.get('seudocategoria')

    query = db.session.query(Productos).filter(Productos.estado == EstadoEnum.ACTIVO, Productos._existencia  > 0)
    
    needs_join = main_category_name or subcategory_name or pseudocategory_name
    
    if needs_join:
        query = query.join(Seudocategorias, and_(Productos.seudocategoria_id == Seudocategorias.id, Seudocategorias.estado == EstadoEnum.ACTIVO))
    
    if main_category_name or subcategory_name:
        query = query.join(Subcategorias, and_(Seudocategorias.subcategoria_id == Subcategorias.id, Subcategorias.estado == EstadoEnum.ACTIVO))
    
    if main_category_name:
        query = query.join(CategoriasPrincipales, and_(Subcategorias.categoria_principal_id == CategoriasPrincipales.id, CategoriasPrincipales.estado == EstadoEnum.ACTIVO))
    
    if main_category_name:
        query = query.filter(func.lower(CategoriasPrincipales.nombre) == func.lower(main_category_name))
    
    if subcategory_name:
        query = query.filter(func.lower(Subcategorias.nombre) == func.lower(subcategory_name))

    if pseudocategory_name:
        query = query.filter(func.lower(Seudocategorias.nombre) == func.lower(pseudocategory_name))

    min_price = query.with_entities(func.min(Productos.precio)).scalar()
    max_price = query.with_entities(func.max(Productos.precio)).scalar()

    return jsonify({
        'min_price': min_price if min_price is not None else 0,
        'max_price': max_price if max_price is not None else 0
    })

@products_bp.route('/api/productos/recomendados')
@jwt_required
def get_recomendaciones(usuario):
    """
    API: Devuelve productos recomendados para el usuario autenticado.

    La lógica de recomendación se basa en los productos que le han gustado al usuario.
    1.  Obtiene las seudocategorías de los productos que le gustan al usuario.
    2.  Busca otros productos populares (basado en la cantidad de 'likes') dentro de esas mismas seudocategorías.
    3.  Si no hay suficientes, rellena con productos populares de la tienda en general.

    Args:
        usuario (Usuarios): El objeto de usuario inyectado por el decorador `@jwt_required`.

    Returns:
        JSON: Una lista de objetos de producto recomendados.
    """
    try:
        # Obtener los IDs de los productos que le gustan al usuario
        liked_product_ids = db.session.query(Likes.producto_id).filter_by(usuario_id=usuario.id, estado=EstadoEnum.ACTIVO).all()
        liked_product_ids = [pid[0] for pid in liked_product_ids]

        recomendaciones = []
        
        if liked_product_ids:
            # Obtener las seudocategorías de los productos que le gustan
            liked_seudocategorias = db.session.query(Productos.seudocategoria_id).filter(Productos.id.in_(liked_product_ids)).distinct().all()
            liked_seudocategorias_ids = [sid[0] for sid in liked_seudocategorias]

            if liked_seudocategorias_ids:
                # Buscar otros productos en esas seudocategorías, excluyendo los que ya le gustan
                recomendaciones = Productos.query.filter(
                    Productos.seudocategoria_id.in_(liked_seudocategorias_ids),
                    Productos.id.notin_(liked_product_ids),
                    Productos.estado == EstadoEnum.ACTIVO,
                    Productos._existencia > 0
                ).order_by(func.random()).limit(12).all()

        # Si no hay suficientes recomendaciones, rellenar con productos populares generales
        if len(recomendaciones) < 12:
            ids_existentes = [p.id for p in recomendaciones] + liked_product_ids
            productos_populares = Productos.query.filter(
                Productos.id.notin_(ids_existentes),
                Productos.estado == EstadoEnum.ACTIVO,
                Productos._existencia > 0
            ).order_by(func.random()).limit(12 - len(recomendaciones)).all()
            recomendaciones.extend(productos_populares)

        return jsonify([producto_to_dict(p) for p in recomendaciones])
    except Exception as e:
        current_app.logger.error(f"Error al generar recomendaciones para el usuario {usuario.id}: {e}")
        return jsonify({'error': 'No se pudieron generar las recomendaciones'}), 500
