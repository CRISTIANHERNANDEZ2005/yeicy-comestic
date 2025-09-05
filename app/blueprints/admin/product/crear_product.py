from flask import Blueprint, render_template, request, abort, current_app, jsonify, redirect, url_for, flash
from flask_wtf.csrf import generate_csrf
from app.utils.admin_jwt_utils import admin_jwt_required
from app.models.domains.product_models import Productos, Seudocategorias, Subcategorias, CategoriasPrincipales
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
            'admin/componentes/nuevo_product.html',
            csrf_token=generate_csrf()
        )
    
    elif request.method == 'POST':
        try:
            # Obtener datos del formulario
            nombre = request.form.get('nombre')
            marca = request.form.get('marca')
            descripcion = request.form.get('descripcion')
            imagen_url = request.form.get('imagen_url')
            precio = float(request.form.get('precio', 0))
            costo = float(request.form.get('costo', 0))
            existencia = int(request.form.get('existencia', 0))
            stock_minimo = int(request.form.get('stock_minimo', 10))
            stock_maximo = int(request.form.get('stock_maximo', 100))
            seudocategoria_id = request.form.get('seudocategoria_id')
            especificaciones_json = request.form.get('especificaciones', '{}')
            
            current_app.logger.info(f"DEBUG: seudocategoria_id from form: {seudocategoria_id}")
            current_app.logger.info(f"DEBUG: marca from form: {marca}")
            
            # Validaciones básicas
            if not nombre or not descripcion or not imagen_url or precio <= 0 or costo <= 0 or existencia < 0:
                return jsonify({
                    'success': False,
                    'message': 'Todos los campos obligatorios deben ser completados correctamente'
                }), 400
            
            if precio <= costo:
                return jsonify({
                    'success': False,
                    'message': 'El precio de venta debe ser mayor que el costo'
                }), 400

            if not seudocategoria_id: # Add this check
                return jsonify({
                    'success': False,
                    'message': 'Debe seleccionar una seudocategoría'
                }), 400
            
            if not marca: # Add this check for marca
                return jsonify({
                    'success': False,
                    'message': 'Debe ingresar una marca para el producto'
                }), 400
            
            # Verificar que la seudocategoría exista
            seudocategoria = Seudocategorias.query.get(seudocategoria_id)
            if not seudocategoria:
                return jsonify({
                    'success': False,
                    'message': 'La seudocategoría seleccionada no existe'
                }), 400
            
            # Parsear especificaciones JSON
            try:
                especificaciones = json.loads(especificaciones_json)
                if not isinstance(especificaciones, dict):
                    especificaciones = {}
            except json.JSONDecodeError:
                especificaciones = {}
            
            # Crear el nuevo producto
            nuevo_producto = Productos(
                nombre=nombre,
                marca=marca,
                descripcion=descripcion,
                imagen_url=imagen_url,
                precio=precio,
                costo=costo,
                existencia=existencia,
                stock_minimo=stock_minimo,
                stock_maximo=stock_maximo,
                seudocategoria_id=seudocategoria_id,
                especificaciones=especificaciones
            )
            
            # Guardar en la base de datos
            db.session.add(nuevo_producto)
            db.session.commit()
            
            # Actualizar el estado de la seudocategoría y categorías superiores
            seudocategoria.check_and_update_status()
            
            # Devolver respuesta exitosa
            return jsonify({
                'success': True,
                'message': 'Producto creado exitosamente',
                'product_id': nuevo_producto.id,
                'product_slug': nuevo_producto.slug
            }), 201
            
        except ValueError as e:
            return jsonify({
                'success': False,
                'message': f'Error en los datos proporcionados: {str(e)}'
            }), 400
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