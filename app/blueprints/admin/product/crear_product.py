"""
Módulo de Creación de Productos (Admin).

Este blueprint gestiona la lógica para la creación de nuevos productos en el
panel de administración. Proporciona tanto la interfaz de usuario (formulario)
como los endpoints de API necesarios para una experiencia de creación dinámica.

Funcionalidades Clave:
- **Renderizado de Formulario**: Muestra la página con el formulario para crear un nuevo producto.
- **Procesamiento de Datos**: Valida exhaustivamente los datos del formulario, incluyendo campos obligatorios, formatos numéricos y reglas de negocio (ej. precio > costo).
- **Gestión de Imágenes**: Sube la imagen del producto al servicio de Cloudinary de forma segura.
- **APIs Auxiliares**: Ofrece endpoints para poblar dinámicamente los selectores de categorías, subcategorías y seudocategorías, mejorando la usabilidad del formulario.
"""
from app.utils.cloudinary_utils import upload_image_and_get_url
from flask import Blueprint, render_template, request, abort, current_app, jsonify, redirect, url_for, flash
from flask_wtf.csrf import generate_csrf
from app.utils.admin_jwt_utils import admin_jwt_required
from app.models.domains.product_models import Productos, Seudocategorias, Subcategorias, CategoriasPrincipales
import cloudinary.uploader
from app.models.enums import EstadoEnum
from app.extensions import db
import json

admin_crear_product_bp = Blueprint(
    'admin_crear', __name__, url_prefix='/admin')

@admin_crear_product_bp.route('/producto/crear', methods=['GET', 'POST'])
@admin_jwt_required
def create_product(admin_user):
    """
    Gestiona la creación de un nuevo producto.

    - **GET**: Renderiza la página con el formulario de creación de productos.
    - **POST**: Procesa los datos enviados desde el formulario. Realiza una serie
      de validaciones críticas, sube la imagen a Cloudinary, verifica la unicidad
      del nombre y el slug, y finalmente crea el nuevo producto en la base de datos.

    Args:
        admin_user: El objeto del administrador autenticado (inyectado por el decorador).

    Returns:
        Response (GET): La plantilla HTML del formulario de creación.
        JSON (POST): Una respuesta JSON indicando el éxito o fracaso de la operación,
                     con mensajes de error detallados si es necesario.
    """
    if request.method == 'GET':
        # Para una solicitud GET, simplemente se muestra el formulario vacío.
        return render_template(
            'admin/componentes/producto/nuevo_product.html',
            csrf_token=generate_csrf()
        )
    
    elif request.method == 'POST':
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

            # --- 3. Verificación de Unicidad del Nombre y Slug ---
            from slugify import slugify
            # Verificar unicidad del nombre
            if Productos.query.filter_by(nombre=nombre).first():
                return jsonify({'success': False, 'message': f'Ya existe un producto con el nombre "{nombre}".'}), 409

            # Verificar unicidad del slug
            slug = slugify(nombre)
            if Productos.query.filter_by(slug=slug).first():
                return jsonify({'success': False, 'message': f'Ya existe un producto con el nombre ("{slug}").'}), 409

            # --- 4. Subida de la Imagen a Cloudinary ---
            imagen_url = None
            try:
                # Lógica de subida profesional con deduplicación centralizada.
                imagen_url = upload_image_and_get_url(imagen_file)
                if not imagen_url:
                    raise Exception("La subida a Cloudinary no devolvió una URL.")
            except Exception as e:
                current_app.logger.error(f"Error al subir imagen a Cloudinary: {e}", exc_info=True)
                return jsonify({'success': False, 'message': 'Error al subir la imagen del producto.'}), 500

            # --- 5. Verificación de la existencia de la categoría seleccionada ---
            seudocategoria = Seudocategorias.query.get(seudocategoria_id)
            if not seudocategoria:
                return jsonify({
                    'success': False,
                    'message': 'La seudocategoría seleccionada ya no existe. Por favor, recarga la página.'
                }), 400

            # --- 6. Creación de la instancia del modelo Producto ---
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

            # --- 7. Persistencia en la Base de Datos ---
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
            # Captura errores de validación de los Value Objects en el modelo.
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
    API para obtener las subcategorías activas de una categoría principal.

    Utilizado por el formulario de creación/edición de productos para poblar
    dinámicamente el selector de subcategorías cuando se elige una categoría principal.

    Args:
        admin_user: El objeto del administrador autenticado.
        categoria_id (str): El ID de la categoría principal padre.
    """
    try:
        subcategorias = Subcategorias.query.filter_by(
            categoria_principal_id=categoria_id,
            estado=EstadoEnum.ACTIVO
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
    API para obtener las seudocategorías activas de una subcategoría.

    Utilizado por el formulario de creación/edición de productos para poblar
    dinámicamente el selector de seudocategorías cuando se elige una subcategoría.

    Args:
        admin_user: El objeto del administrador autenticado.
        subcategoria_id (str): El ID de la subcategoría padre.
    """
    try:
        seudocategorias = Seudocategorias.query.filter_by(
            subcategoria_id=subcategoria_id,
            estado=EstadoEnum.ACTIVO
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
    API para obtener todas las categorías principales activas.

    Utilizado para poblar el selector inicial de categorías en el formulario
    de creación/edición de productos.

    Args:
        admin_user: El objeto del administrador autenticado.
    """
    try:
        categorias = CategoriasPrincipales.query.filter_by(estado=EstadoEnum.ACTIVO).all()
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