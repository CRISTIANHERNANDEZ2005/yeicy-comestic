"""
Módulo de Edición de Productos (Admin).

Este blueprint gestiona la lógica para la edición de productos existentes en el
panel de administración. Proporciona la interfaz de usuario (formulario prellenado)
y el endpoint de API para procesar las actualizaciones.

Funcionalidades Clave:
- **Renderizado de Formulario de Edición**: Muestra la página con el formulario de edición, cargando y prellenando todos los datos del producto seleccionado.
- **Procesamiento de Actualizaciones**: Valida los datos modificados, gestiona la actualización de la imagen (subiendo la nueva y eliminando la antigua de Cloudinary), verifica la unicidad del nombre/slug si ha cambiado, y persiste todos los cambios en la base de datos.
- **Protección de Lógica de Negocio**: Impide la edición de productos que se encuentren en estado 'inactivo'.
"""
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
    Renderiza la página de edición para un producto específico.

    - **GET**: Busca un producto por su `slug`. Si se encuentra y está activo,
      serializa sus datos y los de su jerarquía de categorías para prellenar
      el formulario de edición. Si el producto está inactivo, redirige al
      listado con una advertencia.

    Args:
        admin_user: El objeto del administrador autenticado (inyectado por el decorador).
        product_slug (str): El slug del producto a editar.

    Returns:
        Response: La plantilla `editar_product.html` renderizada con los datos del producto,
                  o una redirección si el producto no es editable.
    """
    product = Productos.query.filter_by(slug=product_slug).first()
    if not product:
        abort(404, description="Producto no encontrado")

    # Regla de negocio: no se pueden editar productos inactivos.
    if product.estado == 'inactivo':
        flash('No se puede editar un producto que está inactivo.', 'warning')
        return redirect(url_for('admin_products.get_all_products'))

    product_data = producto_to_dict(product)

    # Extrae los IDs de la jerarquía de categorías para la preselección en los <select> del frontend.
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
    API para procesar la actualización de un producto existente.

    - **PUT**: Recibe los datos del formulario (multipart/form-data).
      1.  Realiza validaciones exhaustivas de los datos.
      2.  Si el nombre cambia, verifica la unicidad del nuevo nombre y slug.
      3.  Si se sube una nueva imagen, la procesa con Cloudinary y elimina la imagen
          antigua para evitar archivos huérfanos.
      4.  Actualiza todos los campos del producto en la base de datos.

    Args:
        admin_user: El objeto del administrador autenticado.
        product_slug (str): El slug del producto a actualizar.

    Returns:
        JSON: Una respuesta JSON indicando el éxito o fracaso de la operación.
    """
    product = Productos.query.filter_by(slug=product_slug).first()
    if not product:
        return jsonify({'success': False, 'message': 'Producto no encontrado'}), 404

    if product.estado == 'inactivo':
        return jsonify({'success': False, 'message': 'No se puede editar un producto que está inactivo.'}), 403

    try:
        # --- 1. Obtención de datos del formulario (multipart/form-data) ---
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

        # --- 2. Validaciones de negocio y de formato ---
        errors = []
        if not nombre:
            errors.append('El nombre del producto es obligatorio.')
        if not marca:
            errors.append('La marca del producto es obligatoria.')
        if not descripcion:
            errors.append('La descripción del producto es obligatoria.')
        # Si no se sube un nuevo archivo, se asume que se conserva la imagen existente.
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

        # --- 3. Verificación de Unicidad si el nombre ha cambiado ---
        if nombre != product.nombre:
            # Verificar unicidad del nombre
            if Productos.query.filter(Productos.nombre == nombre, Productos.id != product.id).first():
                return jsonify({'success': False, 'message': f'Ya existe un producto con el nombre "{nombre}".'}), 409

            # Verificar unicidad del slug
            new_slug = slugify(nombre)
            if Productos.query.filter(Productos.slug == new_slug, Productos.id != product.id).first():
                return jsonify({'success': False, 'message': f'Ya existe un producto con el nombre ("{new_slug}").'}), 409
            product.slug = new_slug

        # --- 4. Verificación de la existencia de la categoría seleccionada ---
        seudocategoria = Seudocategorias.query.get(seudocategoria_id)
        if not seudocategoria:
            return jsonify({
                'success': False,
                'message': 'La seudocategoría seleccionada ya no existe. Por favor, recarga la página.'
            }), 400

        # --- 5. Procesamiento de especificaciones y manejo de imagen ---
        try:
            especificaciones = json.loads(especificaciones_json)
            if not isinstance(especificaciones, dict):
                especificaciones = {}
        except json.JSONDecodeError:
            especificaciones = {}

        # Por defecto, se mantiene la URL de la imagen existente.
        imagen_url_final = product.imagen_url  # Mantener la URL antigua por defecto

        if imagen_file:
            # A. Si se sube un archivo nuevo, se procesa.
            try:
                # MEJORA PROFESIONAL AVANZADA: Usar "Eager Transformations" para crear versiones optimizadas al instante.
                # Se genera un public_id único para la nueva imagen.
                import uuid
                public_id = f"{product.slug}-{str(uuid.uuid4())[:8]}"

                upload_options = {
                    'folder': "yeicy-cosmetic/products",
                    'public_id': public_id,
                    'eager': [ # Crear esta versión optimizada inmediatamente
                        {'width': 800, 'height': 800, 'crop': 'limit'}, # Redimensiona sin cortar para encajar en 800x800
                        {'quality': 'auto:good'}, # Calidad automática optimizada
                        {'fetch_format': 'auto'}  # Formato de archivo automático (WebP, AVIF, etc.)
                    ]
                }
                upload_result = cloudinary.uploader.upload(imagen_file, **upload_options)
                # Usar la URL de la versión optimizada "eager"
                imagen_url_final = upload_result['eager'][0].get('secure_url')
                if not imagen_url_final:
                    raise Exception("La subida a Cloudinary no devolvió una URL.")
            except Exception as e:
                current_app.logger.error(f"Error al subir nueva imagen a Cloudinary para producto {product.slug}: {e}", exc_info=True)
                return jsonify({'success': False, 'message': 'Error al subir la nueva imagen.'}), 500

            # B. PRÁCTICA PROFESIONAL: Eliminar la imagen antigua de Cloudinary solo si no está en uso por otros productos.
            old_image_url = product.imagen_url
            if old_image_url:
                # Contar cuántos productos usan la imagen antigua.
                # Si el conteo es 1, significa que solo este producto la usa y es seguro borrarla.
                image_usage_count = Productos.query.filter_by(imagen_url=old_image_url).count()

                if image_usage_count <= 1:
                    try:
                        # Extraer el public_id de la URL antigua.
                        # El public_id incluye el nombre de la carpeta.
                        start_index = old_image_url.find('yeicy-cosmetic/products/')
                        if start_index != -1:
                            end_index = old_image_url.rfind('.')
                            public_id = old_image_url[start_index:end_index]
                            cloudinary.api.delete_resources([public_id])
                            current_app.logger.info(f"Imagen antigua '{public_id}' eliminada de Cloudinary para producto {product.slug} (no estaba en uso por otros productos).")
                    except Exception as e:
                        # No es un error crítico si no se puede borrar la imagen vieja, solo se registra.
                        current_app.logger.error(f"No se pudo eliminar la imagen antigua '{old_image_url}' de Cloudinary: {e}", exc_info=True)
                else:
                    current_app.logger.info(
                        f"La imagen antigua '{old_image_url}' no se eliminará de Cloudinary porque está siendo utilizada por {image_usage_count} productos."
                    )

        # --- 6. Actualización de los campos del producto ---
        product.nombre = nombre
        # El slug se actualiza antes si el nombre cambia
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

        # --- 7. Persistencia en la Base de Datos ---
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