# app/blueprints/products.py
from flask import Blueprint, render_template, request, jsonify
from app.models.models import Producto, CategoriaPrincipal, Subcategoria, Seudocategoria, BusquedaTermino
from app.extensions import db
from sqlalchemy import func
from sqlalchemy.orm import joinedload
from app.blueprints.cart import get_cart_items, get_or_create_cart
from datetime import datetime, timedelta

products_bp = Blueprint('products', __name__)


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

# Añadir estas mejoras al endpoint /buscar


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
