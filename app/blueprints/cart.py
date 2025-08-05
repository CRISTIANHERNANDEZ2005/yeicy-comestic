# app/blueprints/cart.py
from flask import Blueprint, request, jsonify, session, render_template, current_app
from app.models.models import Producto, CartItem, CartSession
from app.extensions import db
from datetime import datetime, timedelta
import uuid
import json

cart_bp = Blueprint('cart', __name__)


def get_or_create_cart():
    """Obtiene o crea un carrito basado en la sesión del usuario"""
    if 'user_id' in session:
        # Usuario autenticado - retorna user_id
        return {'user_id': session['user_id']}, None
    else:
        # Usuario no autenticado - generar session_id temporal
        if 'cart_id' not in session:
            session['cart_id'] = str(uuid.uuid4())
        return {'session_id': session['cart_id']}, None


def get_cart_items(cart_info):
    """Obtiene los items del carrito con datos completos de productos"""
    if 'user_id' in cart_info:
        # Usuario autenticado - obtener de BD
        items = CartItem.query.filter_by(user_id=cart_info['user_id']).all()
        return [item.to_dict() for item in items]
    else:
        # Usuario no autenticado - retornar lista vacía (se maneja desde JS)
        return []


@cart_bp.route('/carrito')
def view_cart():
    cart_info, _ = get_or_create_cart()
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
    cart_info, _ = get_or_create_cart()
    items = get_cart_items(cart_info)
    total_items = sum(item['quantity'] for item in items)

    return jsonify({'total_items': total_items})


@cart_bp.route('/api/add_to_cart', methods=['POST'])
def add_to_cart():
    product_id = request.form.get('product_id')
    quantity = int(request.form.get('quantity', 1))

    if not product_id:
        return jsonify({'success': False, 'message': 'Producto no especificado'})

    product = Producto.query.get(product_id)
    if not product or product.estado != 'activo':
        return jsonify({'success': False, 'message': 'Producto no disponible'})

    cart_info, cart_session = get_or_create_cart()

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
            items_data = []
            if cart_session and cart_session.items:
                items_data = json.loads(cart_session.items)

            item_found = False
            for item in items_data:
                if item['product_id'] == product_id:
                    item['quantity'] += quantity
                    item_found = True
                    break

            if not item_found:
                items_data.append({
                    'product_id': product_id,
                    'quantity': quantity
                })

            cart_session.items = json.dumps(items_data)
            cart_session.updated_at = datetime.utcnow()

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


@cart_bp.route('/api/update_cart', methods=['POST'])
def update_cart():
    item_id = request.form.get('item_id')
    new_quantity = int(request.form.get('quantity', 1))

    if not item_id or new_quantity < 1:
        return jsonify({'success': False, 'message': 'Datos inválidos'})

    cart_info, cart_session = get_or_create_cart()

    try:
        if 'user_id' in cart_info:
            # Usuario autenticado
            cart_item = CartItem.query.filter_by(
                id=item_id,
                user_id=cart_info['user_id']
            ).first()

            if cart_item:
                cart_item.quantity = new_quantity
                cart_item.updated_at = datetime.utcnow()
        else:
            # Usuario no autenticado
            if cart_session and cart_session.items:
                items_data = json.loads(cart_session.items)
                for item in items_data:
                    if item.get('id') == item_id:
                        item['quantity'] = new_quantity
                        break
                cart_session.items = json.dumps(items_data)
                cart_session.updated_at = datetime.utcnow()

        db.session.commit()
        items = get_cart_items(cart_info)
        total_price = sum(item['subtotal'] for item in items)

        return jsonify({
            'success': True,
            'subtotal': next((item['subtotal'] for item in items if item['id'] == item_id), 0),
            'total_price': total_price,
            'items': get_cart_items(cart_info)
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating cart: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al actualizar el carrito'})


@cart_bp.route('/api/remove_from_cart', methods=['POST'])
def remove_from_cart():
    item_id = request.form.get('item_id')

    if not item_id:
        return jsonify({'success': False, 'message': 'Ítem no especificado'})

    cart_info, cart_session = get_or_create_cart()

    try:
        if 'user_id' in cart_info:
            # Usuario autenticado
            CartItem.query.filter_by(
                id=item_id,
                user_id=cart_info['user_id']
            ).delete()
        else:
            # Usuario no autenticado
            if cart_session and cart_session.items:
                items_data = json.loads(cart_session.items)
                items_data = [
                    item for item in items_data if item.get('id') != item_id]
                cart_session.items = json.dumps(items_data)
                cart_session.updated_at = datetime.utcnow()

        db.session.commit()
        items = get_cart_items(cart_info)
        total_price = sum(item['subtotal'] for item in items)

        return jsonify({
            'success': True,
            'total_items': len(items),
            'total_price': total_price,
            'items': get_cart_items(cart_info),
            'message': 'Producto eliminado exitosamente'
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error removing from cart: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al eliminar del carrito'})


@cart_bp.route('/api/get_cart_data', methods=['GET'])
def get_cart_data():
    """Endpoint optimizado para obtener datos del carrito"""
    cart_info, _ = get_or_create_cart()
    items = get_cart_items(cart_info)
    total_items = sum(item['quantity'] for item in items)
    total_price = sum(item['subtotal'] for item in items)

    return jsonify({
        'success': True,
        'items': items,
        'total_items': total_items,
        'total_price': total_price
    })


def merge_carts(user_id, session_id):
    """Fusión de carritos cuando un usuario inicia sesión"""
    try:
        # Obtener items de la sesión
        cart_session = CartSession.query.get(session_id)
        if cart_session and cart_session.items:
            session_items = json.loads(cart_session.items)

            # Transferir items al usuario
            for item in session_items:
                existing_item = CartItem.query.filter_by(
                    user_id=user_id,
                    product_id=item['product_id']
                ).first()

                if existing_item:
                    existing_item.quantity += item['quantity']
                else:
                    new_item = CartItem(
                        user_id=user_id,
                        product_id=item['product_id'],
                        quantity=item['quantity']
                    )
                    db.session.add(new_item)

            # Eliminar la sesión del carrito
            db.session.delete(cart_session)
            db.session.commit()

        return True
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error merging carts: {str(e)}")
        return False


@cart_bp.route('/api/add_to_cart', methods=['POST'])
def add_to_cart_optimized():
    """Endpoint optimizado para agregar productos al carrito"""
    product_id = request.form.get('product_id')
    quantity = int(request.form.get('quantity', 1))

    if not product_id:
        return jsonify({'success': False, 'message': 'Producto no especificado'})

    product = Producto.query.get(product_id)
    if not product or product.estado != 'activo':
        return jsonify({'success': False, 'message': 'Producto no disponible'})

    if quantity > product.stock:
        return jsonify({'success': False, 'message': 'Stock insuficiente'})

    cart_info, _ = get_or_create_cart()

    try:
        if 'user_id' in cart_info:
            # Usuario autenticado - guardar en BD
            cart_item = CartItem.query.filter_by(
                user_id=cart_info['user_id'],
                product_id=product_id
            ).first()

            if cart_item:
                new_quantity = min(cart_item.quantity +
                                   quantity, product.stock)
                cart_item.quantity = new_quantity
            else:
                cart_item = CartItem(
                    user_id=cart_info['user_id'],
                    product_id=product_id,
                    quantity=min(quantity, product.stock)
                )
                db.session.add(cart_item)
            db.session.commit()

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
def sync_cart():
    """Sincroniza el carrito del localStorage con la BD para usuarios autenticados"""
    try:
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Usuario no autenticado'})

        cart_data = request.json.get('cart_items', [])
        user_id = session['user_id']

        # Limpiar carrito actual del usuario
        CartItem.query.filter_by(user_id=user_id).delete()

        # Agregar nuevos items
        for item in cart_data:
            product = Producto.query.get(item['product_id'])
            if product and product.estado == 'activo':
                cart_item = CartItem(
                    user_id=user_id,
                    product_id=item['product_id'],
                    quantity=min(item['quantity'], product.stock)
                )
                db.session.add(cart_item)

        db.session.commit()

        # Retornar carrito actualizado
        items = CartItem.query.filter_by(user_id=user_id).all()
        cart_items = [item.to_dict() for item in items]

        return jsonify({
            'success': True,
            'items': cart_items,
            'total_items': sum(item['quantity'] for item in items),
            'total_price': sum(item['subtotal'] for item in items)
        })

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error syncing cart: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al sincronizar carrito'})


@cart_bp.route('/api/product/<int:product_id>')
def get_product_details(product_id):
    """Obtiene los detalles de un producto específico"""
    product = Producto.query.get(product_id)

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
