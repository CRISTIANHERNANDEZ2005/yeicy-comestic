# app/blueprints/cart.py
from flask import Blueprint, request, jsonify, session, render_template, current_app, make_response, url_for
from app.models.domains.product_models import Productos, Seudocategorias, Subcategorias, CategoriasPrincipales
from app.models.domains.cart_models import CartItem
from app.models.domains.order_models import Pedido, PedidoProducto
from app.models.enums import EstadoPedido
from app.extensions import db
from datetime import datetime, timedelta
import uuid
from app.utils.jwt_utils import jwt_required
from io import BytesIO
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
        items = CartItem.query.filter_by(user_id=cart_info['user_id'])\
            .join(CartItem.product)\
            .filter(Productos.estado == 'activo')\
            .join(Productos.seudocategoria)\
            .filter(Seudocategorias.estado == 'activo')\
            .join(Seudocategorias.subcategoria)\
            .filter(Subcategorias.estado == 'activo')\
            .join(Subcategorias.categoria_principal)\
            .filter(CategoriasPrincipales.estado == 'activo')\
            .all()
    else:
        # Usuario no autenticado - obtener de BD por session_id
        items = CartItem.query.filter_by(session_id=cart_info['session_id'])\
            .join(CartItem.product)\
            .filter(Productos.estado == 'activo')\
            .join(Productos.seudocategoria)\
            .filter(Seudocategorias.estado == 'activo')\
            .join(Seudocategorias.subcategoria)\
            .filter(Subcategorias.estado == 'activo')\
            .join(Subcategorias.categoria_principal)\
            .filter(CategoriasPrincipales.estado == 'activo')\
            .all()
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

    if quantity > product._existencia :
        return jsonify({'success': False, 'message': f'Stock insuficiente para {product.nombre}. Solo hay {product._existencia } unidades disponibles.', 'type': 'stock_error'})

    cart_info = get_or_create_cart()

    try:
        response_message = 'Producto agregado exitosamente'
        response_type = 'success'
        warnings = []

        # Ajustar la cantidad a la existencia disponible
        original_quantity = quantity
        quantity = min(original_quantity, product._existencia)

        if 'user_id' in cart_info:
            # Usuario autenticado - guardar en BD
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

        if original_quantity > product._existencia:
            warnings.append(f'La cantidad de {product.nombre} se ajustó a {product._existencia} debido a la disponibilidad.')
            response_type = 'warning' # Change type if there's a warning

        return jsonify({
            'success': True,
            'message': response_message,
            'type': response_type,
            'warnings': warnings,
            'total_items': sum(item['quantity'] for item in get_cart_items(cart_info)),
            'items': get_cart_items(cart_info)
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
        warnings = [] # Initialize warnings list
        if not request.is_json or request.json is None:
            return jsonify({'success': False, 'message': 'Solicitud inválida: se requiere JSON'}), 400

        cart_data_from_frontend = request.json.get('cart_items', [])
        merge = request.json.get('merge', False)
        user_id = usuario.id

        existing_db_cart_items = CartItem.query.filter_by(user_id=user_id).all()
        existing_db_cart_map_by_id = {item.id: item for item in existing_db_cart_items}
        existing_db_cart_map_by_product_id = {item.product_id: item for item in existing_db_cart_items}

        items_to_keep_in_db = set() # Track items that are in frontend cart and should remain in DB

        for item_data in cart_data_from_frontend:
            frontend_item_id = item_data.get('id')
            product_id = item_data.get('product_id')
            quantity = item_data.get('quantity')

            if not product_id or not isinstance(quantity, int) or quantity <= 0:
                current_app.logger.warning(f"Invalid cart item data received: {item_data}")
                continue

            product = Productos.query.get(str(product_id))
            if not product or product.estado != 'activo':
                current_app.logger.warning(f"Product {product_id} not found or inactive during sync.")
                continue

            original_quantity = quantity # Store original quantity for comparison
            quantity = min(original_quantity, product._existencia )
            if original_quantity > product._existencia :
                warnings.append(f'La cantidad de {product.nombre} se ajustó a {product._existencia } debido a la disponibilidad.')


            db_item = None
            if frontend_item_id and not frontend_item_id.startswith('temp_'):
                # Try to find by real ID if available
                db_item = existing_db_cart_map_by_id.get(frontend_item_id)
            
            if not db_item:
                # If not found by real ID, or if it's a temp ID, try to find by product_id
                db_item = existing_db_cart_map_by_product_id.get(product_id)

            if db_item:
                # Re-fetch the item to ensure it's not stale and still exists
                # This is a defensive check against race conditions
                current_db_item = db.session.query(CartItem).filter_by(id=db_item.id, user_id=user_id).first()
                
                if current_db_item:
                    # Item still exists, proceed with update
                    if merge:
                        current_db_item.quantity += quantity
                    else:
                        current_db_item.quantity = quantity
                    
                    # Check if quantity was adjusted due to stock during merge/update
                    if current_db_item.quantity > product._existencia :
                        current_db_item.quantity = product._existencia 
                        warnings.append(f'La cantidad de {product.nombre} se ajustó a {product._existencia } debido a la disponibilidad.')

                    current_db_item.updated_at = datetime.utcnow()
                    items_to_keep_in_db.add(current_db_item.id) # Mark as kept
                else:
                    # Item was found in initial map but deleted concurrently.
                    # If frontend still has it, add it as a new item.
                    cart_item = CartItem(
                        user_id=user_id,
                        product_id=product_id,
                        quantity=quantity
                    )
                    db.session.add(cart_item)
                    db.session.flush() # Get the ID for the newly added item
                    items_to_keep_in_db.add(cart_item.id) # Mark as kept
            else:
                # Item not found by ID or product_id, add as new
                cart_item = CartItem(
                    user_id=user_id,
                    product_id=product_id,
                    quantity=quantity
                )
                db.session.add(cart_item)
                db.session.flush() # Get the ID for the newly added item
                items_to_keep_in_db.add(cart_item.id) # Mark as kept

        # Delete items from DB that are not in the frontend cart (only if not merging)
        if not merge:
            for db_item in existing_db_cart_items:
                if db_item.id not in items_to_keep_in_db:
                    db.session.delete(db_item)

        db.session.commit()

        # Return the updated cart from the database
        items = CartItem.query.filter_by(user_id=user_id).all()
        cart_items_response = [item.to_dict() for item in items]

        total_items = sum(item['quantity'] for item in cart_items_response)
        total_price = sum(item['subtotal'] for item in cart_items_response)

        return jsonify({
            'success': True,
            'items': cart_items_response,
            'total_items': total_items,
            'total_price': total_price,
            'warnings': warnings # Include warnings in the response
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
        items = CartItem.query.filter_by(user_id=user_id)\
            .join(CartItem.product)\
            .filter(Productos.estado == 'activo')\
            .join(Productos.seudocategoria)\
            .filter(Seudocategorias.estado == 'activo')\
            .join(Seudocategorias.subcategoria)\
            .filter(Subcategorias.estado == 'activo')\
            .join(Subcategorias.categoria_principal)\
            .filter(CategoriasPrincipales.estado == 'activo')\
            .all()
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
        'existencia': product._existencia ,
        'estado': product.estado
    })
    
@cart_bp.route('/print_invoice/<uuid:order_id>')
@jwt_required
def print_invoice(usuario, order_id):
    """
    Renderiza la factura de un pedido específico en formato HTML para impresión directa.
    """
    pedido = Pedido.query.filter_by(id=str(order_id), usuario_id=usuario.id).first()

    if not pedido:
        return jsonify({'success': False, 'message': 'Pedido no encontrado o no autorizado'}), 404

    productos_del_pedido = PedidoProducto.query.filter_by(pedido_id=pedido.id).all()

    items_para_imprimir = []
    for pp in productos_del_pedido:
        if pp.producto:
            imagen_url = pp.producto.imagen_url
            if imagen_url and not imagen_url.startswith(('http://', 'https://')):
                imagen_url = url_for('static', filename=imagen_url.lstrip('/'), _external=True)
            
            items_para_imprimir.append({
                'producto_nombre': pp.producto.nombre,
                'producto_precio': float(pp.producto.precio),
                'producto_imagen_url': imagen_url,
                'producto_marca': pp.producto.marca,
                'quantity': pp.cantidad,
                'precio_unitario': float(pp.precio_unitario),
                'precio_unitario_formatted': f"{pp.precio_unitario:,.0f}",
                'subtotal': float(pp.cantidad * pp.precio_unitario),
                'subtotal_formatted': f"{(pp.cantidad * pp.precio_unitario):,.0f}"
            })

    # Renderizar el template HTML
    rendered_html = render_template(
        'cliente/ui/pedido_template.html',
        cart_items=items_para_imprimir,
        total_price=float(pedido.total),
        total_price_formatted=f"{pedido.total:,.0f}", # Formateado
        user=usuario,
        date=pedido.created_at.strftime("%d/%m/%Y"),
        pedido_id=pedido.id
    )

    # Devolver el HTML directamente para que el navegador lo imprima
    response = make_response(rendered_html)
    response.headers['Content-Type'] = 'text/html'
    return response

@cart_bp.route('/api/get_whatsapp_link/<uuid:order_id>')
@jwt_required
def get_whatsapp_link(usuario, order_id):
    """Genera un enlace de WhatsApp para compartir la factura PDF."""
    # Asegúrate de que el pedido exista y pertenezca al usuario
    pedido = Pedido.query.filter_by(id=str(order_id), usuario_id=usuario.id).first()
    if not pedido:
        return jsonify({'success': False, 'message': 'Pedido no encontrado o no autorizado'}), 404

    # Número de WhatsApp del administrador (reemplazar con el número real)
    admin_whatsapp_number = current_app.config.get('ADMIN_WHATSAPP_NUMBER', '573044931438')

    # Mensaje personalizado
    message = f"Hola, me gustaría confirmar mi pedido y adjunto la factura. Pedido ID: {order_id}."
    whatsapp_link = f"https://wa.me/{admin_whatsapp_number}?text={message}"

    return jsonify({'success': True, 'whatsapp_link': whatsapp_link})

@cart_bp.route('/api/create_order', methods=['POST'])
@jwt_required
def create_order(usuario):
    """Crea un nuevo pedido a partir del carrito del usuario autenticado."""
    try:
        user_id = usuario.id
        cart_items = CartItem.query.filter_by(user_id=user_id).all()

        if not cart_items:
            return jsonify({'success': False, 'message': 'El carrito está vacío.'}), 400

        total_pedido = 0
        productos_pedido = []

        for item in cart_items:
            product = Productos.query.get(item.product_id)
            if not product or product.estado != 'activo':
                db.session.rollback()
                return jsonify({'success': False, 'message': f'Producto {item.product_id} no disponible.'}), 400
            
            if product._existencia < item.quantity:
                db.session.rollback()
                return jsonify({'success': False, 'message': f'Stock insuficiente para {product.nombre}. Disponible: {product._existencia}, solicitado: {item.quantity}'}), 400

            subtotal = product.precio * item.quantity
            total_pedido += subtotal
            productos_pedido.append({
                'producto_obj': product,
                'cantidad': item.quantity,
                'precio_unitario': product.precio
            })

        # Crear el pedido
        nuevo_pedido = Pedido(
            usuario_id=user_id,
            total=total_pedido,
            estado_pedido=EstadoPedido.EN_PROCESO.value,
            estado='inactivo'
        )
        db.session.add(nuevo_pedido)
        db.session.flush()

        # Añadir productos al pedido y actualizar stock
        for item_data in productos_pedido:
            pedido_producto = PedidoProducto(
                pedido_id=nuevo_pedido.id,
                producto_id=item_data['producto_obj'].id,
                cantidad=item_data['cantidad'],
                precio_unitario=item_data['precio_unitario']
            )
            db.session.add(pedido_producto)

            # Disminuir stock
            item_data['producto_obj'].existencia -= item_data['cantidad']

        db.session.commit()

        current_app.logger.info(f"Nuevo pedido {nuevo_pedido.id} creado para el usuario {usuario.nombre}")

        return jsonify({
            'success': True,
            'message': 'Pedido creado exitosamente',
            'pedido_id': nuevo_pedido.id
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al crear pedido para usuario {usuario.id}: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno al crear el pedido'}), 500

@cart_bp.route('/api/clear_cart', methods=['POST'])
@jwt_required
def clear_cart(usuario):
    """Elimina todos los items del carrito de un usuario."""
    try:
        user_id = usuario.id
        CartItem.query.filter_by(user_id=user_id).delete()
        db.session.commit()
        return jsonify({'success': True, 'message': 'Carrito vaciado exitosamente'})
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al vaciar el carrito para el usuario {usuario.id}: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno al vaciar el carrito'}), 500