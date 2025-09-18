from flask import Blueprint, render_template, request, abort, current_app, jsonify, redirect, url_for, flash
from flask_wtf.csrf import generate_csrf
from app.utils.admin_jwt_utils import admin_jwt_required
from app.models.domains.product_models import Productos, Seudocategorias, Subcategorias, CategoriasPrincipales
from app.models.serializers import producto_to_dict
import cloudinary.uploader
import cloudinary.api
from app.extensions import db
import json
from slugify import slugify

admin_editar_product_bp = Blueprint(
    'admin_editar', __name__, url_prefix='/admin')

@admin_editar_product_bp.route('/producto/editar/<string:product_slug>', methods=['GET'])
@admin_jwt_required
def edit_product_page(admin_user, product_slug):
    """
    Maneja la solicitud para mostrar el formulario de edición de un producto.
    GET: Muestra el formulario de edición prellenado con los datos del producto.
    """
    product = Productos.query.filter_by(slug=product_slug).first()
    if not product:
        abort(404, description="Producto no encontrado")

    if product.estado == 'inactivo':
        flash('No se puede editar un producto que está inactivo.', 'warning')
        return redirect(url_for('admin_products.get_all_products'))

    product_data = producto_to_dict(product)

    # Extract category IDs for pre-selection in JavaScript
    selected_seudocategoria_id = product.seudocategoria.id if product.seudocategoria else None
    selected_subcategoria_id = product.seudocategoria.subcategoria.id if product.seudocategoria and product.seudocategoria.subcategoria else None
    selected_categoria_principal_id = product.seudocategoria.subcategoria.categoria_principal.id if product.seudocategoria and product.seudocategoria.subcategoria and product.seudocategoria.subcategoria.categoria_principal else None

    return render_template(
        'admin/componentes/producto/editar_product.html',
        product=product_data,
        csrf_token=generate_csrf(),
        selected_seudocategoria_id=selected_seudocategoria_id,
        selected_subcategoria_id=selected_subcategoria_id,
        selected_categoria_principal_id=selected_categoria_principal_id
    )

@admin_editar_product_bp.route('/api/producto/editar/<string:product_slug>', methods=['PUT'])
@admin_jwt_required
def update_product_api(admin_user, product_slug):
    """
    Maneja la solicitud API para actualizar un producto existente.
    PUT: Procesa los datos del formulario y actualiza el producto.
    """
    product = Productos.query.filter_by(slug=product_slug).first()
    if not product:
        return jsonify({'success': False, 'message': 'Producto no encontrado'}), 404

    if product.estado == 'inactivo':
        return jsonify({'success': False, 'message': 'No se puede editar un producto que está inactivo.'}), 403

    try:
        # --- 1. Obtención de datos ---
        data = request.form
        nombre = data.get('nombre')
        marca = data.get('marca')
        descripcion = data.get('descripcion')
        imagen_file = request.files.get('imagen_file')
        precio_str = data.get('precio')
        costo_str = data.get('costo')
        existencia_str = data.get('existencia')
        stock_minimo_str = data.get('stock_minimo', '10')
        stock_maximo_str = data.get('stock_maximo', '100')
        seudocategoria_id = data.get('seudocategoria_id')
        especificaciones_json = data.get('especificaciones', '{}')

        # --- 2. Validaciones Profesionales ---
        errors = []
        if not nombre:
            errors.append('El nombre del producto es obligatorio.')
        if not marca:
            errors.append('La marca del producto es obligatoria.')
        if not descripcion:
            errors.append('La descripción del producto es obligatoria.')
        if not imagen_file and not product.imagen_url:
            errors.append('La imagen del producto es obligatoria.')
        if not seudocategoria_id:
            errors.append('Debe seleccionar una seudocategoría.')

        # Conversión y validación de números
        try:
            precio = float(precio_str)
            if precio <= 0:
                errors.append('El precio debe ser un número positivo.')
        except (ValueError, TypeError):
            errors.append('El formato del precio no es válido.')
            precio = 0

        try:
            costo = float(costo_str)
            if costo <= 0:
                errors.append('El costo debe ser un número positivo.')
        except (ValueError, TypeError):
            errors.append('El formato del costo no es válido.')
            costo = 0

        if 'El formato del precio no es válido.' not in errors and 'El formato del costo no es válido.' not in errors:
            if precio <= costo:
                errors.append('El precio de venta debe ser mayor que el costo.')
        
        try:
            existencia = int(existencia_str)
            if existencia < 0:
                errors.append('La existencia no puede ser negativa.')
        except (ValueError, TypeError):
            errors.append('El formato de la existencia no es válido.')

        # Si hay errores de validación, devolverlos todos juntos
        if errors:
            return jsonify({'success': False, 'message': ' '.join(errors)}), 400

        # --- 3. Verificación de Unicidad (Slug) ---
        # Solo verificar unicidad si el nombre ha cambiado
        new_slug = slugify(nombre)
        if new_slug != product.slug and Productos.query.filter_by(slug=new_slug).first():
            return jsonify({
                'success': False,
                'message': f'Ya existe un producto con el nombre "{nombre}". Por favor, elige otro.'
            }), 409

        # --- 4. Verificación de Entidades Relacionadas ---
        seudocategoria = Seudocategorias.query.get(seudocategoria_id)
        if not seudocategoria:
            return jsonify({
                'success': False,
                'message': 'La seudocategoría seleccionada ya no existe. Por favor, recarga la página.'
            }), 400

        # --- 5. Actualización del Objeto ---
        try:
            especificaciones = json.loads(especificaciones_json)
            if not isinstance(especificaciones, dict):
                especificaciones = {}
        except json.JSONDecodeError:
            especificaciones = {}

        # --- Manejo de la imagen ---
        imagen_url_final = product.imagen_url  # Mantener la URL antigua por defecto

        if imagen_file:
            # A. Subir nueva imagen
            try:
                upload_result = cloudinary.uploader.upload(imagen_file, folder="yeicy-cosmetic/products")
                imagen_url_final = upload_result.get('secure_url')
                if not imagen_url_final:
                    raise Exception("La subida a Cloudinary no devolvió una URL.")
            except Exception as e:
                current_app.logger.error(f"Error al subir nueva imagen a Cloudinary para producto {product.slug}: {e}", exc_info=True)
                return jsonify({'success': False, 'message': 'Error al subir la nueva imagen.'}), 500

            # B. Eliminar imagen antigua de Cloudinary (práctica profesional para no dejar basura)
            if product.imagen_url:
                try:
                    # Extraer el public_id de la URL antigua.
                    # El public_id incluye el nombre de la carpeta.
                    start_index = product.imagen_url.find('yeicy-cosmetic/products/')
                    if start_index != -1:
                        end_index = product.imagen_url.rfind('.')
                        public_id = product.imagen_url[start_index:end_index]
                        cloudinary.api.delete_resources([public_id])
                        current_app.logger.info(f"Imagen antigua '{public_id}' eliminada de Cloudinary para producto {product.slug}.")
                except Exception as e:
                    # No es un error crítico si no se puede borrar la imagen vieja, solo loguearlo
                    current_app.logger.error(f"No se pudo eliminar la imagen antigua '{product.imagen_url}' de Cloudinary: {e}", exc_info=True)

        product.nombre = nombre
        product.marca = marca
        product.descripcion = descripcion
        product.imagen_url = imagen_url_final
        product.precio = precio
        product.costo = costo
        product.existencia = int(existencia_str)
        product.stock_minimo = int(stock_minimo_str)
        product.stock_maximo = int(stock_maximo_str)
        product.seudocategoria_id = seudocategoria_id
        product.especificaciones = especificaciones
        product.slug = new_slug # Actualizar el slug si el nombre cambió

        # --- 6. Persistencia en Base de Datos ---
        db.session.commit()
        
        # Opcional: Actualizar el estado de la seudocategoría si es necesario
        seudocategoria.check_and_update_status()
        
        return jsonify({
            'success': True,
            'message': 'Producto actualizado exitosamente.',
            'product_id': product.id,
            'product_slug': product.slug
        }), 200
        
    except ValueError as e:
        return jsonify({'success': False, 'message': f'Error en los datos proporcionados: {str(e)}'}), 400
    except Exception as e:
        current_app.logger.error(
            f"Error al actualizar el producto {product_slug}: {e}", exc_info=True)
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': 'Ocurrió un error interno al actualizar el producto'
        }), 500