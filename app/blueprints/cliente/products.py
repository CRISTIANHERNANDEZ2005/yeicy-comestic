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

products_bp = Blueprint('products', __name__)

@products_bp.route('/')
@products_bp.route('/products')
def index():
    """
    Endpoint principal que muestra productos de la categoría 'Maquillaje'
    o todos los productos si no existe la categoría
    """
    # Obtener categorías principales (sin cambios - ya está perfecto)
    categorias = CategoriasPrincipales.query\
        .filter_by(estado='activo')\
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

@products_bp.route('/producto/<producto_id>')
def producto_detalle(producto_id):
    """
    Muestra los detalles de un producto específico
    """
    producto = Productos.query.get_or_404(producto_id)
    
    # Verificar si el producto está activo
    if producto.estado != 'activo':
        from flask import abort
        abort(404)
    
    # Obtener productos relacionados (misma categoría principal)
    productos_relacionados = Productos.query.join(
        Seudocategorias, Productos.seudocategoria_id == Seudocategorias.id
    ).join(
        Subcategorias, Seudocategorias.subcategoria_id == Subcategorias.id
    ).filter(
        Productos.id != producto.id,
        Productos.estado == 'activo',
        Subcategorias.categoria_principal_id == producto.seudocategoria.subcategoria.categoria_principal_id
    ).limit(4).all()
    
    # Obtener reseñas del producto
    reseñas = Reseñas.query.filter_by(
        producto_id=producto.id,
        estado='activo'
    ).order_by(Reseñas.created_at.desc()).all()
    
    # Calcular calificación promedio
    calificacion_promedio = db.session.query(
        db.func.avg(Reseñas.calificacion)
    ).filter(
        Reseñas.producto_id == producto.id,
        Reseñas.estado == 'activo'
    ).scalar() or 0
    
    # Verificar si el usuario actual ha dado like al producto
    es_favorito = False
    if 'user' in session:
        like = Likes.query.filter_by(
            usuario_id=session['user'].get('id'),
            producto_id=producto.id,
            estado='activo'
        ).first()
        es_favorito = like is not None
    
    return render_template(
        'cliente/componentes/producto_detalle.html',
        producto=producto,
        productos_relacionados=productos_relacionados,
        reseñas=reseñas,
        calificacion_promedio=round(float(calificacion_promedio), 1),
        es_favorito=es_favorito,
        title=f"{producto.nombre} - YE & CY Cosméticos"
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
        productos = Productos.query.filter(
            db.or_(
                Productos.nombre.ilike(f'%{query}%'),
                Productos.marca.ilike(f'%{query}%'),
                Productos.descripcion.ilike(f'%{query}%')
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
