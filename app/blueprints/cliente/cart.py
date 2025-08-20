# app/blueprints/cart.py
from flask import Blueprint, request, jsonify, session, render_template, current_app
from app.models.domains.product_models import Productos
from app.models.domains.cart_models import CartItem
from app.models.serializers import producto_to_dict, cart_item_to_dict
from app.extensions import db
from datetime import datetime, timedelta
import uuid
import json
from app.utils.jwt_utils import jwt_required

cart_bp = Blueprint('cart', __name__)


def get_or_create_cart():
    """Obtiene o crea un carrito basado en la sesión del usuario"""
    if 'user_id' in session:
        # Usuario autenticado - retorna user_id
        return {'user_id': session['user_id']}
    else:
        # Usuario no autenticado - generar session_id temporal
        if 'cart_id' not in session:
            session['cart_id'] = str(uuid.uuid4())
        return {'session_id': session['cart_id']}

def get_cart_items(cart_info):
    """Obtiene los items del carrito con datos completos de productos"""
    if 'user_id' in cart_info:
        # Usuario autenticado - obtener de BD
        items = CartItem.query.filter_by(user_id=cart_info['user_id']).all()
    else:
        # Usuario no autenticado - obtener de BD por session_id
        items = CartItem.query.filter_by(session_id=cart_info['session_id']).all()
    return [item.to_dict() for item in items]


@cart_bp.route('/carrito')
def view_cart():
    cart_info = get_or_create_cart()
    items = get_cart_items(cart_info)

    # Calcular totales
    total_items = sum(item['quantity'] for item in items)
    total_price = sum(item['subtotal'] for item in items)

    if request.args.get('ajax'):
        return jsonify({
            'items': items,
            'total_items': total_items,
            'total_price': total_price
        })

    return render_template('cliente/ui/carrito.html',
                           cart_items=items,
                           total_items=total_items,
                           total_price=total_price)


@cart_bp.route('/api/cart_count')
def get_cart_count():
    cart_info = get_or_create_cart()
    items = get_cart_items(cart_info)
    total_items = sum(item['quantity'] for item in items)

    return jsonify({'total_items': total_items})


@cart_bp.route('/api/add_to_cart', methods=['POST'])
def add_to_cart():
    product_id = request.form.get('product_id')
    quantity = int(request.form.get('quantity', 1))

    if not product_id:
        return jsonify({'success': False, 'message': 'Producto no especificado'})

    product = Productos.query.get(str(product_id))
    if not product or product.estado != 'activo':
        return jsonify({'success': False, 'message': 'Producto no disponible'})

    cart_info = get_or_create_cart()

    try:
        if 'user_id' in cart_info:
            # Usuario autenticado
            cart_item = CartItem.query.filter_by(
                user_id=cart_info['user_id'],
                product_id=product_id
            ).first()

            if cart_item:
                cart_item.quantity += quantity
                cart_item.updated_at = datetime.utcnow()
            else:
                cart_item = CartItem(
                    user_id=cart_info['user_id'],
                    product_id=product_id,
                    quantity=quantity
                )
                db.session.add(cart_item)
        else:
            # Usuario no autenticado
            # Redirigir a la página de inicio de sesión o mostrar un mensaje
            return jsonify({'success': False, 'message': 'Debes iniciar sesión para agregar productos al carrito'})

        db.session.commit()
        return jsonify({
            'success': True,
            'total_items': sum(item['quantity'] for item in get_cart_items(cart_info)),
            'items': get_cart_items(cart_info),
            'message': 'Producto agregado exitosamente'
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error adding to cart: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al agregar al carrito'})

@cart_bp.route('/api/get_cart_data', methods=['GET'])
def get_cart_data():
    """Endpoint optimizado para obtener datos del carrito"""
    cart_info = get_or_create_cart()
    items = get_cart_items(cart_info)
    total_items = sum(item['quantity'] for item in items)
    total_price = sum(item['subtotal'] for item in items)

    return jsonify({
        'success': True,
        'items': items,
        'total_items': total_items,
        'total_price': total_price
    })





@cart_bp.route('/api/add_to_cart', methods=['POST'])
def add_to_cart_optimized():
    """Endpoint optimizado para agregar productos al carrito"""
    product_id = request.form.get('product_id')
    quantity = int(request.form.get('quantity', 1))

    if not product_id:
        return jsonify({'success': False, 'message': 'Producto no especificado'})

    product = Productos.query.get(str(product_id))
    if not product or product.estado != 'activo':
        return jsonify({'success': False, 'message': 'Producto no disponible'})

    if quantity > product.stock:
        return jsonify({'success': False, 'message': 'Stock insuficiente'})

    cart_info = get_or_create_cart()

    try:
        if 'user_id' in cart_info:
            # Usuario autenticado - guardar en BD
            cart_item = CartItem.query.filter_by(
                user_id=cart_info['user_id'],
                product_id=product_id
            ).first()

            # Para usuarios autenticados, el frontend debe manejar el localStorage
            # y luego llamar a /api/sync_cart para sincronizar con la BD.
            # Este endpoint solo confirma la disponibilidad del producto.
            pass
        # No se hace nada para usuarios no autenticados en el backend,
        # el frontend maneja el localStorage.

        return jsonify({
            'success': True,
            'message': 'Producto agregado exitosamente',
            'stock_warning': quantity >= product.stock
        })

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error adding to cart: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al agregar al carrito'})

@cart_bp.route('/api/sync_cart', methods=['POST'])
@jwt_required
def sync_cart(usuario):
    """Sincroniza el carrito del localStorage con la BD para usuarios autenticados"""
    try:
        if not request.is_json or request.json is None:
            return jsonify({'success': False, 'message': 'Solicitud inválida: se requiere JSON'}), 400

        cart_data_from_frontend = request.json.get('cart_items', [])
        merge = request.json.get('merge', False)
        user_id = usuario.id

        existing_db_cart_items = CartItem.query.filter_by(user_id=user_id).all()
        existing_db_cart_map = {item.product_id: item for item in existing_db_cart_items}

        for item_data in cart_data_from_frontend:
            product_id = item_data.get('product_id')
            quantity = item_data.get('quantity')

            if not product_id or not isinstance(quantity, int) or quantity <= 0:
                current_app.logger.warning(f"Invalid cart item data received: {item_data}")
                continue

            product = Productos.query.get(str(product_id))
            if not product or product.estado != 'activo':
                current_app.logger.warning(f"Product {product_id} not found or inactive during sync.")
                continue

            quantity = min(quantity, product.stock)

            if product_id in existing_db_cart_map:
                db_item = existing_db_cart_map[product_id]
                if merge:
                    db_item.quantity += quantity
                else:
                    db_item.quantity = quantity
                db_item.quantity = min(db_item.quantity, product.stock)
                db_item.updated_at = datetime.utcnow()
                del existing_db_cart_map[product_id]
            else:
                cart_item = CartItem(
                    user_id=user_id,
                    product_id=product_id,
                    quantity=quantity
                )
                db.session.add(cart_item)

        if not merge:
            for product_id_to_delete in existing_db_cart_map:
                db.session.delete(existing_db_cart_map[product_id_to_delete])

        db.session.commit()

        items = CartItem.query.filter_by(user_id=user_id).all()
        cart_items_response = [item.to_dict() for item in items]

        total_items = sum(item['quantity'] for item in cart_items_response)
        total_price = sum(item['subtotal'] for item in cart_items_response)

        return jsonify({
            'success': True,
            'items': cart_items_response,
            'total_items': total_items,
            'total_price': total_price
        })

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error syncing cart: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al sincronizar carrito'}), 500

@cart_bp.route('/api/load_cart', methods=['GET'])
@jwt_required
def load_cart(usuario):
    """Carga el carrito del usuario desde la BD para hidratar el frontend"""
    try:
        user_id = usuario.id
        items = CartItem.query.filter_by(user_id=user_id).all()
        cart_items_response = [item.to_dict() for item in items]

        total_items = sum(item['quantity'] for item in cart_items_response)
        total_price = sum(item['subtotal'] for item in cart_items_response)

        return jsonify({
            'success': True,
            'items': cart_items_response,
            'total_items': total_items,
            'total_price': total_price
        })
    except Exception as e:
        current_app.logger.error(f"Error loading cart for user {usuario.id}: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al cargar el carrito'}), 500


@cart_bp.route('/api/product/<product_id>')
def get_product_details(product_id):
    """Obtiene los detalles de un producto específico"""
    product = Productos.query.get(product_id)

    if not product or product.estado != 'activo':
        return jsonify({'error': 'Producto no encontrado'}), 404

    return jsonify({
        'id': product.id,
        'nombre': product.nombre,
        'precio': float(product.precio),
        'imagen_url': product.imagen_url,
        'marca': product.marca or '',
        'stock': product.stock,
        'estado': product.estado
    })