"""
Módulo de Listado y Gestión de Productos (Admin).

Este blueprint centraliza toda la lógica para la visualización y gestión de la
lista de productos en el panel de administración. Proporciona una interfaz de
tabla robusta con funcionalidades avanzadas.

Funcionalidades Clave:
- **Vista de Listado Principal**: Renderiza la tabla de productos con paginación, soportando una carga inicial de datos.
- **API de Filtrado en Tiempo Real**: Un endpoint `/api/products/filter` que permite al frontend filtrar, ordenar y paginar la lista de productos dinámicamente sin recargar la página. Soporta múltiples criterios como nombre, estado, jerarquía de categorías, marca, precio y más.
- **Gestión de Estado**: Un endpoint para activar o desactivar productos de forma individual.
- **APIs Auxiliares**: Endpoints para poblar dinámicamente los selectores de filtros (subcategorías, seudocategorías, marcas) basándose en la selección de una categoría principal, mejorando la usabilidad de los filtros.
"""
from flask import Blueprint, jsonify, request, render_template, current_app
from app.utils.admin_jwt_utils import admin_jwt_required
from app.models.domains.product_models import Productos, Seudocategorias, Subcategorias, CategoriasPrincipales
from app.models.serializers import producto_list_to_dict, seudocategoria_to_dict, subcategoria_to_dict, categoria_principal_to_dict, format_currency_cop
from app.extensions import db
from sqlalchemy import or_, and_
from sqlalchemy.orm import subqueryload
from datetime import datetime, timedelta
from flask_wtf.csrf import generate_csrf

admin_lista_product_bp = Blueprint('admin_products', __name__, url_prefix='/admin')

@admin_lista_product_bp.route('/lista-productos', methods=['GET'])
@admin_jwt_required
def get_all_products(admin_user):
    """
    Renderiza la página principal del listado de productos.

    Esta función actúa como el controlador para la carga inicial de la página.
    Procesa los parámetros de la URL para aplicar filtros, ordenamiento y paginación
    a la consulta de productos. Además, carga los datos necesarios para poblar
    los menús desplegables de los filtros (categorías, marcas, etc.).

    Args:
        admin_user: El objeto del administrador autenticado (inyectado por el decorador).

    Returns:
        Response: La plantilla `lista_productos.html` renderizada con los datos
                  iniciales de productos y filtros.
    """
    error_message = None
    products_data = []
    productos_paginados = None
    categorias_data = []
    subcategorias_data = []
    seudocategorias_data = []
    marcas_data = []

    try:
        # --- 1. Obtención de parámetros de filtro y paginación desde la URL ---
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        nombre = request.args.get('nombre', '')
        estado = request.args.get('estado', '')
        categoria_id = request.args.get('categoria_id', '')
        subcategoria_id = request.args.get('subcategoria_id', '')
        seudocategoria_id = request.args.get('seudocategoria_id', '')
        marca = request.args.get('marca', '')
        min_price = request.args.get('min_price', type=float)
        max_price = request.args.get('max_price', type=float)
        agotados = request.args.get('agotados', 'false') == 'true'
        nuevos = request.args.get('nuevos', 'false') == 'true'
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')

        # --- 2. Construcción de la consulta base ---
        query = Productos.query

        # --- 3. Aplicación de filtros a la consulta ---
        if nombre:
            query = query.filter(Productos.nombre.ilike(f'%{nombre}%'))

        if estado:
            query = query.filter(Productos.estado == estado)

        # Filtros de categoría jerárquicos
        if seudocategoria_id:
            query = query.filter(
                Productos.seudocategoria_id == seudocategoria_id)
        elif subcategoria_id:
            query = query.join(Seudocategorias).filter(
                Seudocategorias.subcategoria_id == subcategoria_id)
        elif categoria_id:
            query = query.join(Seudocategorias).join(Subcategorias).filter(
                Subcategorias.categoria_principal_id == categoria_id)

        if marca:
            query = query.filter(Productos.marca.ilike(f'%{marca}%'))

        if min_price is not None:
            query = query.filter(Productos.precio >= min_price)

        if max_price is not None:
            query = query.filter(Productos.precio <= max_price)

        if agotados:
            # La lógica correcta para "agotados" es comparar la existencia con el stock mínimo definido para cada producto.
            query = query.filter(Productos._existencia <
                                 Productos.stock_minimo)

        if nuevos:
            cinco_dias_atras = datetime.utcnow() - timedelta(days=5) # Considera "nuevos" los productos de los últimos 5 días.
            query = query.filter(Productos.created_at >= cinco_dias_atras)

        # Aplicar ordenamiento
        if sort_by == 'nombre':
            order_field = Productos.nombre
        elif sort_by == 'precio':
            order_field = Productos.precio
        elif sort_by == 'existencia':
            order_field = Productos._existencia
        else:
            order_field = Productos.created_at

        if sort_order == 'asc':
            query = query.order_by(order_field.asc())
        else:
            query = query.order_by(order_field.desc())

        # --- 4. Paginación de los resultados ---
        productos_paginados = query.paginate(
            page=page, per_page=per_page, error_out=False)

        # --- 5. Obtención de datos para los menús de filtro ---
        # MEJORA PROFESIONAL: Optimización de consultas para evitar el problema N+1.
        # Usamos `subqueryload` para cargar las relaciones jerárquicas de forma eficiente.
        # Esto reduce drásticamente el número de consultas a la base de datos.
        categorias = CategoriasPrincipales.query.options(
            subqueryload(CategoriasPrincipales.subcategorias)
        ).order_by(CategoriasPrincipales.nombre).all()
        subcategorias = Subcategorias.query.options(
            subqueryload(Subcategorias.seudocategorias)
        ).order_by(Subcategorias.nombre).all()
        seudocategorias = Seudocategorias.query.order_by(
            Seudocategorias.nombre).all()
        marcas = db.session.query(Productos.marca).filter(
            Productos.marca.isnot(None),
            Productos.marca != ''
        ).distinct().all()

        # Serializar datos
        products_data = [producto_list_to_dict(product) for product in productos_paginados.items]

        # Formatear valores monetarios para la renderización inicial en la plantilla.
        for product_dict in products_data:
            # NOTA: Esta mutación se hace aquí para la carga inicial. La API devuelve los números directamente.
            product_dict['precio'] = format_currency_cop(
                product_dict['precio'])
            product_dict['costo'] = format_currency_cop(product_dict['costo'])
        categorias_data = [categoria_principal_to_dict(
            cat) for cat in categorias]
        subcategorias_data = [subcategoria_to_dict(
            sub) for sub in subcategorias]
        seudocategorias_data = [seudocategoria_to_dict(
            seudo) for seudo in seudocategorias]
        marcas_data = [marca[0] for marca in marcas if marca[0]]

    except Exception as e:
        # Manejo de errores para evitar que la página se rompa.
        current_app.logger.error(
            f"Error al cargar productos en el panel de administración: {e}")
        error_message = "Ocurrió un error al cargar los productos. Por favor, inténtalo de nuevo."

        if productos_paginados is None:
            from flask_sqlalchemy import Pagination
            productos_paginados = Pagination(None, 1, 20, 0, [])

    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

    # --- 6. Renderizado de la plantilla ---
    return render_template('admin/componentes/producto/lista_productos.html',
                           products=products_data,
                           pagination=productos_paginados,
                           categorias=categorias_data,
                           subcategorias=subcategorias_data,
                           seudocategorias=seudocategorias_data,
                           marcas=marcas_data,
                           filter_params=request.args,
                           error_message=error_message,
                           csrf_token=generate_csrf(),
                           is_ajax=is_ajax)

# Endpoint para cambiar el estado de un producto
@admin_lista_product_bp.route('/api/products/<string:product_id>/status', methods=['POST'])
@admin_jwt_required
def update_product_status(admin_user, product_id):
    """
    API para cambiar el estado (activo/inactivo) de un producto.

    Recibe una solicitud POST con el nuevo estado y lo aplica al producto
    correspondiente. Registra la acción en los logs para auditoría.

    Args:
        admin_user: El objeto del administrador autenticado.
        product_id (str): El ID del producto a modificar.

    Returns:
        JSON: Un objeto con el resultado de la operación.
    """
    try:
        product = Productos.query.get(product_id)
        if not product:
            current_app.logger.warning(
                f"Intento de cambiar estado de producto inexistente: {product_id} por admin {admin_user.id}")
            return jsonify({
                'success': False,
                'message': 'Producto no encontrado',
                'error_code': 'PRODUCT_NOT_FOUND'
            }), 404

        data = request.get_json()
        if not data or 'estado' not in data:
            current_app.logger.warning(
                f"Solicitud incompleta para cambiar estado de producto {product_id}")
            return jsonify({
                'success': False,
                'message': 'Datos incompletos',
                'error_code': 'INVALID_DATA'
            }), 400

        new_status = data.get('estado')
        if new_status not in ['activo', 'inactivo']:
            current_app.logger.warning(
                f"Estado inválido '{new_status}' para producto {product_id}")
            return jsonify({
                'success': False,
                'message': 'Estado no válido',
                'error_code': 'INVALID_STATUS'
            }), 400

        if product.estado == new_status:
            return jsonify({
                'success': True,
                'message': f'El producto ya estaba {"activado" if new_status == "activo" else "desactivado"}',
                'status_unchanged': True,
                'current_status': new_status
            }), 200

        old_status = product.estado

        product.estado = new_status

        db.session.commit()

        # Registrar la acción para auditoría.
        current_app.logger.info(
            f"Producto {product_id} ('{product.nombre}') cambiado de estado de {old_status} a {new_status} "
            f"por administrador {admin_user.id} ('{admin_user.nombre}')"
        )

        # Respuesta exitosa
        return jsonify({
            'success': True,
            'message': f'El producto ha sido {"activado" if new_status == "activo" else "desactivado"} correctamente',
            'product_id': product_id,
            'product_name': product.nombre,
            'old_status': old_status,
            'new_status': new_status,
            'timestamp': datetime.utcnow().isoformat()
        })

    except Exception as e:
        db.session.rollback()

        current_app.logger.error(
            f"Error al cambiar estado del producto {product_id}: {str(e)}",
            exc_info=True
        )

        return jsonify({
            'success': False,
            'message': 'Error al cambiar el estado del producto',
            'error_code': 'INTERNAL_ERROR',
            'error_details': str(e) if current_app.debug else None
        }), 500

@admin_lista_product_bp.route('/api/products/filter', methods=['GET'])
@admin_jwt_required
def filter_products_api(admin_user):
    """
    API para filtrar, ordenar y paginar la lista de productos en tiempo real.

    Este endpoint es consumido por el frontend (JavaScript) para actualizar la
    tabla de productos dinámicamente cuando el usuario interactúa con los filtros.
    La lógica es idéntica a `get_all_products`, pero devuelve los datos en formato JSON.

    Args:
        admin_user: El objeto del administrador autenticado.
    """
    try:
        # --- 1. Obtención de parámetros de filtro y paginación ---
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        nombre = request.args.get('nombre', '')
        estado = request.args.get('estado', '')
        categoria_id = request.args.get('categoria_id', '')
        subcategoria_id = request.args.get('subcategoria_id', '')
        seudocategoria_id = request.args.get('seudocategoria_id', '')
        marca = request.args.get('marca', '')
        min_price = request.args.get('min_price', type=float)
        max_price = request.args.get('max_price', type=float)
        agotados = request.args.get('agotados', 'false') == 'true'
        nuevos = request.args.get('nuevos', 'false') == 'true'
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')

        # --- 2. Construcción y filtrado de la consulta ---
        query = Productos.query

        # La lógica de filtrado es idéntica a la de la vista principal.
        if nombre:
            query = query.filter(Productos.nombre.ilike(f'%{nombre}%'))

        if estado:
            query = query.filter(Productos.estado == estado)

        # Filtros de categoría jerárquicos
        if seudocategoria_id:
            query = query.filter(
                Productos.seudocategoria_id == seudocategoria_id)
        elif subcategoria_id:
            query = query.join(Seudocategorias).filter(
                Seudocategorias.subcategoria_id == subcategoria_id)
        elif categoria_id:
            query = query.join(Seudocategorias).join(Subcategorias).filter(
                Subcategorias.categoria_principal_id == categoria_id)

        if marca:
            query = query.filter(Productos.marca.ilike(f'%{marca}%'))

        if min_price is not None:
            query = query.filter(Productos.precio >= min_price)

        if max_price is not None:
            query = query.filter(Productos.precio <= max_price)

        if agotados:
            #  La lógica correcta para "agotados" es comparar la existencia con el stock mínimo.
            query = query.filter(Productos._existencia <
                                 Productos.stock_minimo)

        if nuevos:
            cinco_dias_atras = datetime.utcnow() - timedelta(days=5) # Productos de los últimos 5 días.
            query = query.filter(Productos.created_at >= cinco_dias_atras)

        # Aplicar ordenamiento
        if sort_by == 'nombre':
            order_field = Productos.nombre
        elif sort_by == 'precio':
            order_field = Productos.precio
        elif sort_by == 'existencia':
            order_field = Productos._existencia
        else:
            order_field = Productos.created_at

        if sort_order == 'asc':
            query = query.order_by(order_field.asc())
        else:
            query = query.order_by(order_field.desc())

        # --- 3. Paginación y Serialización ---
        # Contar el total general de productos antes de aplicar filtros de paginación.
        total_general = db.session.query(Productos.id).count()

        productos_paginados = query.paginate(
            page=page, per_page=per_page, error_out=False)

        products_data = [producto_list_to_dict(
            product) for product in productos_paginados.items]

        # --- 4. Preparación de la respuesta JSON ---
        # Se incluyen los datos de los productos y la información de paginación.
        response_data = {
            'products': products_data,
            'pagination': {
                'page': productos_paginados.page,
                'pages': productos_paginados.pages,
                'per_page': productos_paginados.per_page,
                'total': productos_paginados.total,  # Total de productos filtrados
                'total_general': total_general,      # Total de productos sin filtrar
                'has_next': productos_paginados.has_next,
                'has_prev': productos_paginados.has_prev,
                'next_num': productos_paginados.next_num,
                'prev_num': productos_paginados.prev_num
            },
            'success': True
        }

        return jsonify(response_data)

    except Exception as e:
        current_app.logger.error(f"Error en filtro AJAX de productos: {e}")
        return jsonify({
            'success': False,
            'message': 'Error al filtrar productos',
            'error': str(e) if current_app.debug else None
        }), 500

from sqlalchemy.orm import joinedload


@admin_lista_product_bp.route('/api/products/category-dependencies', methods=['GET'])
@admin_jwt_required
def get_category_dependencies(admin_user):
    """
    API para obtener las dependencias jerárquicas de las categorías.

    Dado un nivel ('main', 'sub', 'pseudo') y un ID, devuelve los IDs de las
    categorías padre y/o hijas, y las marcas asociadas. Esto permite que el
    frontend actualice todos los filtros de categoría de forma dependiente y
    eficiente con una sola llamada.
    """
    level = request.args.get('level')
    category_id = request.args.get('id', type=str)

    if not level or not category_id:
        # Si no se especifica un nivel o ID, devuelve todas las marcas de todos los productos.
        marcas_query = db.session.query(Productos.marca).filter(
            Productos.marca.isnot(None), Productos.marca != ''
        ).distinct().order_by(Productos.marca).all()
        marcas = [marca[0] for marca in marcas_query]
        return jsonify({
            'success': True,
            'main_category_id': None,      # ID de la categoría principal padre
            'sub_category_id': None,       # ID de la subcategoría padre
            'sub_category_ids': [],        # IDs de las subcategorías hijas
            'pseudo_category_ids': [],     # IDs de las seudocategorías hijas
            'brands': marcas
        })

    main_category_id = None
    sub_category_id = None
    sub_category_ids_hijas = []
    pseudo_category_ids_hijas = []

    products_query = db.session.query(Productos.id)

    if level == 'categoria_id': # El usuario seleccionó una Categoría Principal
        main_category_id = category_id
        # Obtener todas las subcategorías hijas
        sub_query = db.session.query(Subcategorias.id).filter(
            Subcategorias.categoria_principal_id == category_id)
        sub_category_ids_hijas = [row[0] for row in sub_query.all()]

        # Obtener todas las seudocategorías nietas
        if sub_category_ids_hijas:
            pseudo_query = db.session.query(Seudocategorias.id).filter(
                Seudocategorias.subcategoria_id.in_(sub_category_ids_hijas))
            pseudo_category_ids_hijas = [row[0] for row in pseudo_query.all()]

        # Filtrar productos que pertenecen a esta jerarquía
        products_query = products_query.join(Seudocategorias).join(Subcategorias).filter(
            Subcategorias.categoria_principal_id == category_id)

    elif level == 'subcategoria_id':  # El usuario seleccionó una Subcategoría
        sub_category_id = category_id
        # Usamos joinedload para cargar el padre eficientemente
        sub = Subcategorias.query.options(
            joinedload(Subcategorias.categoria_principal)
        ).get(category_id)
        if sub:
            main_category_id = sub.categoria_principal_id

        # Obtener todas las seudocategorías hijas
        pseudo_query = db.session.query(Seudocategorias.id).filter(
            Seudocategorias.subcategoria_id == category_id)
        pseudo_category_ids_hijas = [row[0] for row in pseudo_query.all()]

        # Filtrar productos que pertenecen a esta jerarquía
        products_query = products_query.join(Seudocategorias).filter(
            Seudocategorias.subcategoria_id == category_id)

    elif level == 'seudocategoria_id':  # El usuario seleccionó una Seudocategoría
        # Usamos joinedload para cargar toda la jerarquía hacia arriba de forma eficiente
        pseudo = Seudocategorias.query.options(
            joinedload(Seudocategorias.subcategoria)
            .joinedload(Subcategorias.categoria_principal)
        ).get(category_id)

        if pseudo:
            sub_category_id = pseudo.subcategoria_id
            if pseudo.subcategoria:
                main_category_id = pseudo.subcategoria.categoria_principal_id

        # Filtrar productos que pertenecen a esta seudocategoría
        products_query = products_query.filter(Productos.seudocategoria_id == category_id)

    elif level == 'marca': # El usuario seleccionó una Marca
        brand_name = category_id
        # 1. Encontrar todos los productos de esa marca.
        products_with_brand = db.session.query(Productos.seudocategoria_id).filter(Productos.marca == brand_name).distinct()
        
        # 2. Obtener las seudocategorías únicas de esos productos.
        pseudo_ids_from_brand = [p[0] for p in products_with_brand.all()]
        
        if pseudo_ids_from_brand:
            # 3. A partir de las seudocategorías, encontrar las subcategorías y categorías principales únicas.
            sub_ids_query = db.session.query(Seudocategorias.subcategoria_id).filter(Seudocategorias.id.in_(pseudo_ids_from_brand)).distinct()
            sub_ids_from_brand = [s[0] for s in sub_ids_query.all()]
            
            if sub_ids_from_brand:
                main_ids_query = db.session.query(Subcategorias.categoria_principal_id).filter(Subcategorias.id.in_(sub_ids_from_brand)).distinct()
                main_ids_from_brand = [m[0] for m in main_ids_query.all()]

                # Asignar los IDs encontrados para la respuesta JSON.
                pseudo_category_ids_hijas = pseudo_ids_from_brand
                sub_category_ids_hijas = sub_ids_from_brand
                main_category_id = main_ids_from_brand # Reutilizamos esta variable para enviar la lista de IDs.

    else:
        return jsonify({'success': False, 'message': 'Nivel de categoría no válido'}), 400

    # Obtener marcas basadas en los productos filtrados
    marcas_query = db.session.query(Productos.marca).filter(
        Productos.id.in_(products_query.subquery()),
        Productos.marca.isnot(None),
        Productos.marca != ''
    ).distinct().order_by(Productos.marca).all()
    marcas = [marca[0] for marca in marcas_query]

    return jsonify({
        'success': True,
        # MEJORA: Ahora puede ser un ID único o una lista de IDs si el nivel es 'marca'.
        'main_category_id': main_category_id if level != 'marca' else None,
        'main_category_ids': main_category_id if level == 'marca' else [],
        'sub_category_id': sub_category_id,
        'sub_category_ids': sub_category_ids_hijas,
        'pseudo_category_ids': pseudo_category_ids_hijas,
        'brands': marcas
    })

@admin_lista_product_bp.route('/api/brands', methods=['GET'])
@admin_jwt_required
def get_brands_for_category(admin_user):
    """
    API auxiliar para obtener las marcas de productos disponibles dentro de una jerarquía de categorías.

    Filtra las marcas basándose en la categoría, subcategoría o seudocategoría
    seleccionada, asegurando que solo se muestren marcas relevantes en el filtro.

    Args:
        admin_user: El objeto del administrador autenticado.
    """
    try:
        categoria_id = request.args.get('categoria_id', '')
        subcategoria_id = request.args.get('subcategoria_id', '')
        seudocategoria_id = request.args.get('seudocategoria_id', '')

        # Inicia una consulta para obtener marcas distintas y no nulas.
        query = db.session.query(Productos.marca).filter(
            Productos.marca.isnot(None),
            Productos.marca != ''
        ).distinct()

        # Apply category filters hierarchically
        if seudocategoria_id:
            query = query.filter(
                Productos.seudocategoria_id == seudocategoria_id)
        elif subcategoria_id:
            query = query.join(Seudocategorias).filter(
                Seudocategorias.subcategoria_id == subcategoria_id)
        elif categoria_id:
            query = query.join(Seudocategorias).join(Subcategorias).filter(
                Subcategorias.categoria_principal_id == categoria_id)

        marcas = [marca[0]
                  for marca in query.order_by(Productos.marca).all() if marca[0]]

        # Crea una lista de diccionarios para la respuesta, como lo espera la función JS.
        marcas_data = [{'id': marca, 'nombre': marca} for marca in marcas]

        return jsonify({'success': True, 'marcas': marcas_data})

    except Exception as e:
        current_app.logger.error(f"Error al obtener marcas por categoría: {e}")
        return jsonify({
            'success': False,
            'message': 'Error al obtener marcas'
        }), 500
