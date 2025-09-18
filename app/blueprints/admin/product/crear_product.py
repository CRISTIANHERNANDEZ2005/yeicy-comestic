from flask import Blueprint, render_template, request, abort, current_app, jsonify, redirect, url_for, flash
from flask_wtf.csrf import generate_csrf
from app.utils.admin_jwt_utils import admin_jwt_required
from app.models.domains.product_models import Productos, Seudocategorias, Subcategorias, CategoriasPrincipales
import cloudinary.uploader
from app.extensions import db
import json

admin_crear_product_bp = Blueprint(
    'admin_crear', __name__, url_prefix='/admin')

@admin_crear_product_bp.route('/producto/crear', methods=['GET', 'POST'])
@admin_jwt_required
def create_product(admin_user):
    """
    Maneja la solicitud para crear un nuevo producto en el panel de administración.
    GET: Muestra el formulario de creación.
    POST: Procesa los datos del formulario y crea el producto.
    """
    if request.method == 'GET':
        # Renderizar el formulario de creación
        return render_template(
            'admin/componentes/producto/nuevo_product.html',
            csrf_token=generate_csrf()
        )
    
    elif request.method == 'POST':
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
            if not descripcion: # La descripción es opcional en algunos casos, pero la mantenemos obligatoria por ahora.
                errors.append('La descripción del producto es obligatoria.')
            if not imagen_file:
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

            # --- 3. Subida de Imagen a Cloudinary ---
            imagen_url = None
            try:
                # El folder ayuda a organizar las imágenes en Cloudinary
                upload_result = cloudinary.uploader.upload(imagen_file, folder="yeicy-cosmetic/products")
                imagen_url = upload_result.get('secure_url')
                if not imagen_url:
                    raise Exception("La subida a Cloudinary no devolvió una URL.")
            except Exception as e:
                current_app.logger.error(f"Error al subir imagen a Cloudinary: {e}", exc_info=True)
                return jsonify({'success': False, 'message': 'Error al subir la imagen del producto.'}), 500

            # --- 4. Verificación de Unicidad (Slug) ---
            from slugify import slugify
            slug = slugify(nombre)
            if Productos.query.filter_by(slug=slug).first():
                return jsonify({
                    'success': False,
                    'message': f'Ya existe un producto con el nombre "{nombre}". Por favor, elige otro.'
                }), 409  # 409 Conflict es más apropiado aquí

            # --- 5. Verificación de Entidades Relacionadas ---
            seudocategoria = Seudocategorias.query.get(seudocategoria_id)
            if not seudocategoria:
                return jsonify({
                    'success': False,
                    'message': 'La seudocategoría seleccionada ya no existe. Por favor, recarga la página.'
                }), 400

            # --- 6. Procesamiento y Creación del Objeto ---
            try:
                especificaciones = json.loads(especificaciones_json)
                if not isinstance(especificaciones, dict):
                    especificaciones = {}
            except json.JSONDecodeError:
                especificaciones = {}

            nuevo_producto = Productos(
                nombre=nombre,
                marca=marca,
                descripcion=descripcion,
                imagen_url=imagen_url,
                precio=precio,
                costo=costo,
                existencia=int(existencia_str),
                stock_minimo=int(stock_minimo_str),
                stock_maximo=int(stock_maximo_str),
                seudocategoria_id=seudocategoria_id,
                especificaciones=especificaciones
            )

            # --- 7. Persistencia en Base de Datos ---
            db.session.add(nuevo_producto)
            db.session.commit()
            
            seudocategoria.check_and_update_status()
            
            return jsonify({
                'success': True,
                'message': 'Producto creado exitosamente.',
                'product_id': nuevo_producto.id,
                'product_slug': nuevo_producto.slug
            }), 201
            
        except ValueError as e:
            # Este error ahora es menos probable gracias a las validaciones de arriba
            return jsonify({'success': False, 'message': f'Error en los datos proporcionados: {str(e)}'}), 400
        except Exception as e:
            # Loguear el error para depuración
            current_app.logger.error(
                f"Error al crear el producto: {e}", exc_info=True)
            # Revertir cambios en la base de datos
            db.session.rollback()
            return jsonify({
                'success': False,
                'message': 'Ocurrió un error interno al crear el producto'
            }), 500


@admin_crear_product_bp.route('/api/categorias/<string:categoria_id>/subcategorias', methods=['GET'])
@admin_jwt_required
def get_subcategorias(admin_user, categoria_id):
    """
    Obtiene las subcategorías asociadas a una categoría principal.
    """
    try:
        subcategorias = Subcategorias.query.filter_by(
            categoria_principal_id=categoria_id,
            estado='activo'
        ).all()
        
        return jsonify({
            'success': True,
            'subcategorias': [
                {'id': sub.id, 'nombre': sub.nombre} 
                for sub in subcategorias
            ]
        })
    except Exception as e:
        current_app.logger.error(f"Error al obtener subcategorías: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Error al obtener subcategorías'
        }), 500

@admin_crear_product_bp.route('/api/subcategorias/<string:subcategoria_id>/seudocategorias', methods=['GET'])
@admin_jwt_required
def get_seudocategorias(admin_user, subcategoria_id):
    """
    Obtiene las seudocategorías asociadas a una subcategoría.
    """
    try:
        seudocategorias = Seudocategorias.query.filter_by(
            subcategoria_id=subcategoria_id,
            estado='activo'
        ).all()
        
        return jsonify({
            'success': True,
            'seudocategorias': [
                {'id': seudo.id, 'nombre': seudo.nombre} 
                for seudo in seudocategorias
            ]
        })
    except Exception as e:
        current_app.logger.error(f"Error al obtener seudocategorías: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Error al obtener seudocategorías'
        }), 500

@admin_crear_product_bp.route('/api/categorias_principales', methods=['GET'])
@admin_jwt_required
def get_categorias_principales(admin_user):
    """
    Obtiene todas las categorías principales activas.
    """
    try:
        categorias = CategoriasPrincipales.query.filter_by(estado='activo').all()
        return jsonify({
            'success': True,
            'categorias': [
                {'id': cat.id, 'nombre': cat.nombre} 
                for cat in categorias
            ]
        })
    except Exception as e:
        current_app.logger.error(f"Error al obtener categorías principales: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Error al obtener categorías principales'
        }), 500