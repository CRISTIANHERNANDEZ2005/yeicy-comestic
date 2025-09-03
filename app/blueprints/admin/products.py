from flask import Blueprint, jsonify, request, render_template, current_app
from app.utils.admin_jwt_utils import admin_jwt_required
from app.models.domains.product_models import Productos, Seudocategorias, Subcategorias, CategoriasPrincipales
from app.models.serializers import producto_list_to_dict, seudocategoria_to_dict, subcategoria_to_dict, categoria_principal_to_dict
from app.extensions import db
from sqlalchemy import or_, and_
from datetime import datetime, timedelta
from flask_wtf.csrf import generate_csrf

admin_products_bp = Blueprint('admin_products', __name__, url_prefix='/admin')

@admin_products_bp.route('/lista-productos', methods=['GET'])
@admin_jwt_required
def get_all_products(admin_user):
    error_message = None
    products_data = []
    productos_paginados = None
    categorias_data = []
    subcategorias_data = []
    seudocategorias_data = []
    marcas_data = []

    try:
        # Obtener parámetros de filtro
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

        # Construir consulta base
        query = Productos.query

        # Aplicar filtros
        if nombre:
            query = query.filter(Productos.nombre.ilike(f'%{nombre}%'))
        
        if estado:
            query = query.filter(Productos.estado == estado)
        
        if categoria_id:
            query = query.join(Seudocategorias).join(Subcategorias).filter(
                Subcategorias.categoria_principal_id == categoria_id
            )
        
        if subcategoria_id:
            query = query.join(Seudocategorias).filter(
                Seudocategorias.subcategoria_id == subcategoria_id
            )
        
        if seudocategoria_id:
            query = query.filter(Productos.seudocategoria_id == seudocategoria_id)
        
        if marca:
            query = query.filter(Productos.marca.ilike(f'%{marca}%'))
        
        if min_price is not None:
            query = query.filter(Productos.precio >= min_price)
        
        if max_price is not None:
            query = query.filter(Productos.precio <= max_price)
        
        if agotados:
            query = query.filter(Productos.existencia < Productos.stock_minimo)
        
        if nuevos:
            cinco_dias_atras = datetime.utcnow() - timedelta(days=5)
            query = query.filter(Productos.created_at >= cinco_dias_atras)

        # Aplicar ordenamiento
        if sort_by == 'nombre':
            order_field = Productos.nombre
        elif sort_by == 'precio':
            order_field = Productos.precio
        elif sort_by == 'existencia':
            order_field = Productos.existencia
        else:
            order_field = Productos.created_at

        if sort_order == 'asc':
            query = query.order_by(order_field.asc())
        else:
            query = query.order_by(order_field.desc())

        # Paginación
        productos_paginados = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Obtener datos para filtros
        categorias = CategoriasPrincipales.query.filter_by(estado='activo').all()
        subcategorias = Subcategorias.query.filter_by(estado='activo').all()
        seudocategorias = Seudocategorias.query.filter_by(estado='activo').all()
        marcas = db.session.query(Productos.marca).filter(
            Productos.marca.isnot(None),
            Productos.marca != ''
        ).distinct().all()
        
        # Serializar datos
        products_data = [producto_list_to_dict(product) for product in productos_paginados.items]
        categorias_data = [categoria_principal_to_dict(cat) for cat in categorias]
        subcategorias_data = [subcategoria_to_dict(sub) for sub in subcategorias]
        seudocategorias_data = [seudocategoria_to_dict(seudo) for seudo in seudocategorias]
        marcas_data = [marca[0] for marca in marcas if marca[0]]

    except Exception as e:
        current_app.logger.error(f"Error al cargar productos en el panel de administración: {e}")
        error_message = "Ocurrió un error al cargar los productos. Por favor, inténtalo de nuevo."

        if productos_paginados is None:
            from flask_sqlalchemy import Pagination
            productos_paginados = Pagination(None, 1, 20, 0, []) 

    return render_template('admin/componentes/lista_productos.html', 
                         products=products_data,
                         pagination=productos_paginados,
                         categorias=categorias_data,
                         subcategorias=subcategorias_data,
                         seudocategorias=seudocategorias_data,
                         marcas=marcas_data,
                         filter_params=request.args,
                         error_message=error_message,
                         csrf_token=generate_csrf())

# Endpoint mejorado para cambiar el estado de un producto
@admin_products_bp.route('/api/products/<string:product_id>/status', methods=['POST'])
@admin_jwt_required
def update_product_status(admin_user, product_id):
    try:
        # Validar que el producto exista
        product = Productos.query.get(product_id)
        if not product:
            current_app.logger.warning(f"Intento de cambiar estado de producto inexistente: {product_id} por admin {admin_user.id}")
            return jsonify({
                'success': False, 
                'message': 'Producto no encontrado',
                'error_code': 'PRODUCT_NOT_FOUND'
            }), 404
        
        # Validar datos de entrada
        data = request.get_json()
        if not data or 'estado' not in data:
            current_app.logger.warning(f"Solicitud incompleta para cambiar estado de producto {product_id}")
            return jsonify({
                'success': False, 
                'message': 'Datos incompletos',
                'error_code': 'INVALID_DATA'
            }), 400
        
        new_status = data.get('estado')
        if new_status not in ['activo', 'inactivo']:
            current_app.logger.warning(f"Estado inválido '{new_status}' para producto {product_id}")
            return jsonify({
                'success': False, 
                'message': 'Estado no válido',
                'error_code': 'INVALID_STATUS'
            }), 400
        
        # Verificar si el estado ya es el mismo
        if product.estado == new_status:
            return jsonify({
                'success': True, 
                'message': f'El producto ya estaba {"activado" if new_status == "activo" else "desactivado"}',
                'status_unchanged': True,
                'current_status': new_status
            }), 200
        
        # Guardar estado anterior para logging
        old_status = product.estado
        
        # Actualizar el estado del producto
        product.estado = new_status
        
        
        
        # Guardar cambios en la base de datos
        db.session.commit()
        
        # Registrar la acción en el log
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
        # Revertir cambios en caso de error
        db.session.rollback()
        
        # Registrar el error
        current_app.logger.error(
            f"Error al cambiar estado del producto {product_id}: {str(e)}",
            exc_info=True
        )
        
        # Respuesta de error
        return jsonify({
            'success': False, 
            'message': 'Error al cambiar el estado del producto',
            'error_code': 'INTERNAL_ERROR',
            'error_details': str(e) if current_app.debug else None
        }), 500