"""
Módulo de Gestión de Categorías (Admin).

Este blueprint centraliza toda la lógica para la administración de la jerarquía
de categorías de productos (Principales, Subcategorías y Seudocategorías).
Proporciona una interfaz completa para listar, crear, editar y gestionar el
estado de cada nivel de categoría.

Funcionalidades Clave:
- **Vistas de Listado**: Ofrece una vista jerárquica ('Todas') y vistas de tabla
  individuales para cada nivel de categoría, con paginación, búsqueda y filtros.
- **API de Filtrado en Tiempo Real**: Endpoints que permiten al frontend filtrar
  y ordenar las listas de categorías dinámicamente sin recargar la página.
- **Gestión de Estado**: Endpoints para activar o desactivar categorías, lo que
  afecta su visibilidad en toda la aplicación.
- **Creación y Edición**: APIs para crear nuevas categorías y actualizar los
  detalles (nombre, descripción) de las existentes.
- **Optimización de Consultas**: Utiliza técnicas de carga anticipada (eager loading)
  como `subqueryload` para prevenir el problema N+1 y asegurar un rendimiento eficiente.
"""
from flask import Blueprint, jsonify, request, render_template, current_app
from app.utils.admin_jwt_utils import admin_jwt_required
from app.models.domains.product_models import CategoriasPrincipales, Subcategorias, Seudocategorias
from app.models.serializers import categoria_principal_to_dict, subcategoria_to_dict, seudocategoria_to_dict
from app.models.enums import EstadoEnum
from app.extensions import db
from sqlalchemy import or_, and_, func
from sqlalchemy.orm import joinedload, subqueryload
from datetime import datetime
from flask_wtf.csrf import generate_csrf
from slugify import slugify

admin_lista_categorias_bp = Blueprint('admin_categorias', __name__, url_prefix='/admin')

@admin_lista_categorias_bp.route('/lista-categorias', methods=['GET'])
@admin_lista_categorias_bp.route('/lista-categorias/<string:view_type>', methods=['GET'])
@admin_jwt_required
def get_all_categories(admin_user, view_type=None):
    """
    Renderiza la página de gestión de categorías y maneja las diferentes vistas.

    Esta función es el controlador principal para la sección de categorías. Determina
    la vista solicitada (jerárquica, tabla de principales, etc.), aplica los
    filtros y la paginación correspondientes, y renderiza la plantilla principal
    con los datos necesarios.

    Args:
        admin_user: El objeto del administrador autenticado (inyectado por el decorador).
        view_type (str, optional): El tipo de vista a mostrar ('principales',
                                   'subcategorias', 'seudocategorias').
                                   Por defecto es None, lo que lleva a la vista 'all'.

    Returns:
        Response: La plantilla `lista_categorias.html` renderizada con los datos.
    """
    error_message = None
    categorias_data = []
    subcategorias_data = []
    seudocategorias_data = []
    pagination_data = None
    
    if view_type == 'principales':
        current_view = 'main'
    elif view_type == 'subcategorias':
        current_view = 'sub'
    elif view_type == 'seudocategorias':
        current_view = 'pseudo'
    else:
        current_view = 'all'

    current_view = request.args.get('view', current_view)
    
    try:
        # Obtener parámetros de filtro y paginación desde la URL.
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        nombre = request.args.get('nombre', '')
        estado = request.args.get('estado', '')
        categoria_id = request.args.get('categoria_id', '')
        subcategoria_id = request.args.get('subcategoria_id', '')
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')
        
        # Cargar datos según la vista actual.
        if current_view == 'main':
            # Vista de categorías principales
            # MEJORA PROFESIONAL: Carga anticipada de toda la jerarquía para evitar N+1 en el serializador.
            query = CategoriasPrincipales.query.options(
                subqueryload(CategoriasPrincipales.subcategorias)
                .subqueryload(Subcategorias.seudocategorias)
                .subqueryload(Seudocategorias.productos))
            
            if nombre:
                query = query.filter(CategoriasPrincipales.nombre.ilike(f'%{nombre}%'))
                
            if estado:
                query = query.filter(CategoriasPrincipales.estado == estado)
            
            # Aplicar ordenamiento
            if sort_by == 'nombre':
                order_expression = func.lower(CategoriasPrincipales.nombre)
            elif sort_by == 'created_at':
                order_expression = CategoriasPrincipales.created_at
            else:
                order_expression = func.lower(CategoriasPrincipales.nombre)
                
            if sort_order == 'asc':
                query = query.order_by(order_expression.asc())
            else:
                query = query.order_by(order_expression.desc())
            
            # Paginación
            pagination = query.paginate(
                page=page, per_page=per_page, error_out=False)
            
            # Add total_general for initial load
            pagination.total_general = db.session.query(CategoriasPrincipales.id).count()
            
            # Serializar datos
            categorias_data = [categoria_principal_to_dict(
                cat) for cat in pagination.items]
                
        elif current_view == 'sub':
            # Vista de subcategorías
            # MEJORA PROFESIONAL: Carga anticipada completa para el serializador.
            query = Subcategorias.query.options(
                joinedload(Subcategorias.categoria_principal), 
                subqueryload(Subcategorias.seudocategorias).subqueryload(Seudocategorias.productos)
            )
            
            if nombre:
                query = query.filter(Subcategorias.nombre.ilike(f'%{nombre}%'))
                
            if estado:
                query = query.filter(Subcategorias.estado == estado)
                
            if categoria_id:
                query = query.filter(Subcategorias.categoria_principal_id == categoria_id)
            
            # Aplicar ordenamiento
            if sort_by == 'nombre':
                order_expression = func.lower(Subcategorias.nombre)
            elif sort_by == 'created_at':
                order_expression = Subcategorias.created_at
            else:
                order_expression = func.lower(Subcategorias.nombre)
                
            if sort_order == 'asc':
                query = query.order_by(order_expression.asc())
            else:
                query = query.order_by(order_expression.desc())
            
            # Paginación
            pagination = query.paginate(
                page=page, per_page=per_page, error_out=False)
            
            # Add total_general for initial load
            pagination.total_general = db.session.query(Subcategorias.id).count()
                
            # Serializar datos
            subcategorias_data = [subcategoria_to_dict(
                sub) for sub in pagination.items]
            
            # Obtener categorías principales para el filtro
            categorias_data = [categoria_principal_to_dict(
                cat) for cat in CategoriasPrincipales.query.filter_by(estado=EstadoEnum.ACTIVO).all()]
            
        elif current_view == 'pseudo':
            # Vista de seudocategorías
            # MEJORA PROFESIONAL: Carga anticipada completa para el serializador.
            query = Seudocategorias.query.options(
                joinedload(Seudocategorias.subcategoria).joinedload(Subcategorias.categoria_principal), 
                subqueryload(Seudocategorias.productos)
            )
            
            if nombre:
                query = query.filter(Seudocategorias.nombre.ilike(f'%{nombre}%'))
                
            if estado:
                query = query.filter(Seudocategorias.estado == estado)
                
            if subcategoria_id:
                query = query.filter(Seudocategorias.subcategoria_id == subcategoria_id)
            
            # Aplicar ordenamiento
            if sort_by == 'nombre':
                order_expression = func.lower(Seudocategorias.nombre)
            elif sort_by == 'created_at':
                order_expression = Seudocategorias.created_at
            else:
                order_expression = func.lower(Seudocategorias.nombre)
                
            if sort_order == 'asc':
                query = query.order_by(order_expression.asc())
            else:
                query = query.order_by(order_expression.desc())
            
            # Paginación
            pagination = query.paginate(
                page=page, per_page=per_page, error_out=False)
            
            pagination.total_general = db.session.query(Seudocategorias.id).count()
                
            # Serializar datos
            seudocategorias_data = [seudocategoria_to_dict(
                seudo) for seudo in pagination.items]
            
            # Obtener subcategorías para el filtro
            subcategorias_data = [subcategoria_to_dict(
                sub) for sub in Subcategorias.query.filter_by(estado=EstadoEnum.ACTIVO).all()]
            
            # Obtener categorías principales para el filtro
            categorias_data = [categoria_principal_to_dict(
                cat) for cat in CategoriasPrincipales.query.filter_by(estado=EstadoEnum.ACTIVO).all()]
                
        else:  # Vista 'all' - jerárquica
            # Obtener todas las categorías principales con sus relaciones
            # Se utiliza subqueryload para resolver el problema N+1.
            # Esto carga todas las subcategorías, seudocategorías y sus productos
            # en consultas separadas y eficientes. La clave es cargar la jerarquía completa.
            query = CategoriasPrincipales.query.options(
                subqueryload(CategoriasPrincipales.subcategorias)
                .subqueryload(Subcategorias.seudocategorias)
                .subqueryload(Seudocategorias.productos)
            )

            # Apply sorting (if needed for 'all' view, using 'nombre' as default)
            query = query.order_by(CategoriasPrincipales.created_at.desc())

            # Paginación
            pagination = query.paginate(
                page=page, per_page=per_page, error_out=False)
            
            # Add total_general for initial load (total count of main categories)
            pagination.total_general = db.session.query(CategoriasPrincipales.id).count()

            categorias_data = [categoria_principal_to_dict(
                cat) for cat in pagination.items]

        if pagination:
            # Convert pagination object to a JSON-serializable dictionary for JavaScript
            pagination_info = {
                'page': pagination.page,
                'pages': pagination.pages,
                'per_page': pagination.per_page,
                'total': pagination.total,
                'total_general': getattr(pagination, 'total_general', pagination.total),
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev,
                'next_num': pagination.next_num,
                'prev_num': pagination.prev_num
            }
    
    except Exception as e:
        current_app.logger.error(
            f"Error al cargar categorías en el panel de administración: {e}")
        error_message = "Ocurrió un error al cargar las categorías. Por favor, inténtalo de nuevo."

    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

    return render_template('admin/componentes/categoria/lista_categorias.html',
                           categorias=categorias_data,
                           subcategorias=subcategorias_data,
                           seudocategorias=seudocategorias_data,
                           pagination=pagination,
                           pagination_info=pagination_info,
                           current_view=current_view,
                           filter_params=request.args,
                           error_message=error_message,
                           csrf_token=generate_csrf(),
                           is_ajax=is_ajax)

# Endpoint para cambiar el estado de una categoría principal
@admin_lista_categorias_bp.route('/api/categorias-principales/<string:categoria_id>/status', methods=['POST'])
@admin_jwt_required
def update_main_category_status(admin_user, categoria_id):
    """
    API para cambiar el estado (activo/inactivo) de una categoría principal.

    Recibe una solicitud POST con el nuevo estado y lo aplica a la categoría
    correspondiente. Registra la acción en los logs para auditoría.

    Args:
        admin_user: El objeto del administrador autenticado.
        categoria_id (str): El ID de la categoría principal a modificar.

    Returns:
        JSON: Un objeto con el resultado de la operación.
    """
    try:
        # Validar que la categoría exista
        categoria = CategoriasPrincipales.query.get(categoria_id)
        if not categoria:
            return jsonify({
                'success': False,
                'message': 'Categoría no encontrada',
                'error_code': 'CATEGORY_NOT_FOUND'
            }), 404

        # Validar datos de entrada
        data = request.get_json()
        if not data or 'estado' not in data:
            return jsonify({
                'success': False,
                'message': 'Datos incompletos',
                'error_code': 'INVALID_DATA'
            }), 400

        new_status = data.get('estado')
        if new_status not in ['activo', 'inactivo']:
            return jsonify({
                'success': False,
                'message': 'Estado no válido',
                'error_code': 'INVALID_STATUS'
            }), 400

        # Verificar si el estado ya es el mismo
        if categoria.estado == new_status:
            return jsonify({
                'success': True,
                'message': f'La categoría ya estaba {"activada" if new_status == "activo" else "desactivada"}',
                'status_unchanged': True,
                'current_status': new_status
            }), 200

        # Guardar estado anterior para logging
        old_status = categoria.estado

        # Actualizar el estado de la categoría
        categoria.estado = new_status

        # Guardar cambios en la base de datos
        db.session.commit()

        # Registrar la acción en el log
        current_app.logger.info(
            f"Categoría principal {categoria_id} ('{categoria.nombre}') cambiada de estado de {old_status} a {new_status} "
            f"por administrador {admin_user.id} ('{admin_user.nombre}')"
        )

        # Respuesta exitosa
        return jsonify({
            'success': True,
            'message': f'La categoría ha sido {"activada" if new_status == "activo" else "desactivada"} correctamente',
            'category_id': categoria_id,
            'category_name': categoria.nombre,
            'old_status': old_status,
            'new_status': new_status,
            'timestamp': datetime.utcnow().isoformat()
        })

    except Exception as e:
        # Revertir cambios en caso de error
        db.session.rollback()

        # Registrar el error
        current_app.logger.error(
            f"Error al cambiar estado de la categoría principal {categoria_id}: {str(e)}",
            exc_info=True
        )

        # Respuesta de error
        return jsonify({
            'success': False,
            'message': 'Error al cambiar el estado de la categoría',
            'error_code': 'INTERNAL_ERROR',
            'error_details': str(e) if current_app.debug else None
        }), 500

# Endpoint para cambiar el estado de una subcategoría
@admin_lista_categorias_bp.route('/api/subcategorias/<string:subcategoria_id>/status', methods=['POST'])
@admin_jwt_required
def update_subcategory_status(admin_user, subcategoria_id):
    """
    API para cambiar el estado (activo/inactivo) de una subcategoría.

    Recibe una solicitud POST con el nuevo estado. Al cambiar el estado,
    esta función también podría desencadenar una actualización en el estado de
    su categoría principal padre si es necesario.

    Args:
        admin_user: El objeto del administrador autenticado.
        subcategoria_id (str): El ID de la subcategoría a modificar.

    Returns:
        JSON: Un objeto con el resultado de la operación.
    """
    try:
        # Validar que la subcategoría exista
        subcategoria = Subcategorias.query.get(subcategoria_id)
        if not subcategoria:
            return jsonify({
                'success': False,
                'message': 'Subcategoría no encontrada',
                'error_code': 'SUBCATEGORY_NOT_FOUND'
            }), 404

        # Validar datos de entrada
        data = request.get_json()
        if not data or 'estado' not in data:
            return jsonify({
                'success': False,
                'message': 'Datos incompletos',
                'error_code': 'INVALID_DATA'
            }), 400

        new_status = data.get('estado')
        if new_status not in ['activo', 'inactivo']:
            return jsonify({
                'success': False,
                'message': 'Estado no válido',
                'error_code': 'INVALID_STATUS'
            }), 400

        # Verificar si el estado ya es el mismo
        if subcategoria.estado == new_status:
            return jsonify({
                'success': True,
                'message': f'La subcategoría ya estaba {"activada" if new_status == "activo" else "desactivada"}',
                'status_unchanged': True,
                'current_status': new_status
            }), 200

        # Guardar estado anterior para logging
        old_status = subcategoria.estado

        # Actualizar el estado de la subcategoría
        subcategoria.estado = new_status

        

        # Guardar cambios en la base de datos
        db.session.commit()

        # Registrar la acción en el log
        current_app.logger.info(
            f"Subcategoría {subcategoria_id} ('{subcategoria.nombre}') cambiada de estado de {old_status} a {new_status} "
            f"por administrador {admin_user.id} ('{admin_user.nombre}')"
        )

        # Respuesta exitosa (simplificada)
        return jsonify({
            'success': True,
            'message': f'Estado de subcategoría actualizado correctamente a {new_status}',
            'subcategory_id': subcategoria_id,
            'new_status': new_status
        })

    except Exception as e:
        # Revertir cambios en caso de error
        db.session.rollback()

        # Registrar el error con traceback completo
        current_app.logger.exception(
            f"Error al cambiar estado de la subcategoría {subcategoria_id}: {str(e)}"
        )

        # Respuesta de error
        return jsonify({
            'success': False,
            'message': 'Error al cambiar el estado de la subcategoría',
            'error_code': 'INTERNAL_ERROR',
            'error_details': str(e) if current_app.debug else None
        }), 500

# Endpoint para cambiar el estado de una seudocategoría
@admin_lista_categorias_bp.route('/api/seudocategorias/<string:seudocategoria_id>/status', methods=['POST'])
@admin_jwt_required
def update_pseudocategory_status(admin_user, seudocategoria_id):
    """
    API para cambiar el estado (activo/inactivo) de una seudocategoría.

    Recibe una solicitud POST con el nuevo estado. Cambiar el estado de una
    seudocategoría puede afectar el estado de su subcategoría y categoría
    principal padre.

    Args:
        admin_user: El objeto del administrador autenticado.
        seudocategoria_id (str): El ID de la seudocategoría a modificar.

    Returns:
        JSON: Un objeto con el resultado de la operación.
    """
    try:
        # Validar que la seudocategoría exista
        seudocategoria = Seudocategorias.query.get(seudocategoria_id)
        if not seudocategoria:
            return jsonify({
                'success': False,
                'message': 'Seudocategoría no encontrada',
                'error_code': 'PSEUDOCATEGORY_NOT_FOUND'
            }), 404

        # Validar datos de entrada
        data = request.get_json()
        if not data or 'estado' not in data:
            return jsonify({
                'success': False,
                'message': 'Datos incompletos',
                'error_code': 'INVALID_DATA'
            }), 400

        new_status = data.get('estado')
        if new_status not in ['activo', 'inactivo']:
            return jsonify({
                'success': False,
                'message': 'Estado no válido',
                'error_code': 'INVALID_STATUS'
            }), 400

        # Verificar si el estado ya es el mismo
        if seudocategoria.estado == new_status:
            return jsonify({
                'success': True,
                'message': f'La seudocategoría ya estaba {"activada" if new_status == "activo" else "desactivada"}',
                'status_unchanged': True,
                'current_status': new_status
            }), 200

        # Guardar estado anterior para logging
        old_status = seudocategoria.estado

        # Actualizar el estado de la seudocategoría
        seudocategoria.estado = new_status

        

        # Guardar cambios en la base de datos
        db.session.commit()

        # Registrar la acción en el log
        current_app.logger.info(
            f"Seudocategoría {seudocategoria_id} ('{seudocategoria.nombre}') cambiada de estado de {old_status} a {new_status} "
            f"por administrador {admin_user.id} ('{admin_user.nombre}')"
        )

        # Respuesta exitosa (simplificada)
        return jsonify({
            'success': True,
            'message': f'Estado de seudocategoría actualizado correctamente a {new_status}',
            'pseudocategory_id': seudocategoria_id,
            'new_status': new_status
        })

    except Exception as e:
        # Revertir cambios en caso de error
        db.session.rollback()

        # Registrar el error
        current_app.logger.error(
            f"Error al cambiar estado de la seudocategoría {seudocategoria_id}: {str(e)}",
            exc_info=True
        )

        # Respuesta de error
        return jsonify({
            'success': False,
            'message': 'Error al cambiar el estado de la seudocategoría',
            'error_code': 'INTERNAL_ERROR',
            'error_details': str(e) if current_app.debug else None
        }), 500

# Endpoint para obtener detalles de una categoría para edición
@admin_lista_categorias_bp.route('/api/categoria/<string:category_type>/<string:category_id>', methods=['GET'])
@admin_jwt_required
def get_category_details(admin_user, category_type, category_id):
    """
    API para obtener los detalles de una categoría específica para el modal de edición.

    Devuelve el nombre, descripción y la información de sus padres jerárquicos
    para mostrar en el formulario de edición.

    Args:
        admin_user: El objeto del administrador autenticado.
        category_type (str): El tipo de categoría ('main', 'sub', 'pseudo').
        category_id (str): El ID de la categoría a obtener.

    Returns:
        JSON: Un objeto con los detalles de la categoría.
    """
    try:
        category = None
        data = {}
        
        model_map = {
            'main': CategoriasPrincipales,
            'sub': Subcategorias,
            'pseudo': Seudocategorias
        }
        
        model = model_map.get(category_type)
        if not model:
            return jsonify({'success': False, 'message': 'Tipo de categoría no válido.'}), 400

        if category_type == 'main':
            category = model.query.get(category_id)
            if category:
                data = {
                    'id': category.id,
                    'nombre': category.nombre,
                    'descripcion': category.descripcion,
                    'nivel_display': 'Categoría Principal'
                }
        elif category_type == 'sub':
            category = model.query.options(joinedload(model.categoria_principal)).get(category_id)
            if category:
                data = {
                    'id': category.id,
                    'nombre': category.nombre,
                    'descripcion': category.descripcion,
                    'nivel_display': 'Subcategoría',
                    'categoria_principal_nombre': category.categoria_principal.nombre if category.categoria_principal else 'N/A'
                }
        elif category_type == 'pseudo':
            category = model.query.options(joinedload(model.subcategoria).joinedload(Subcategorias.categoria_principal)).get(category_id)
            if category:
                data = {
                    'id': category.id,
                    'nombre': category.nombre,
                    'descripcion': category.descripcion,
                    'nivel_display': 'Seudocategoría',
                    'subcategoria_nombre': category.subcategoria.nombre if category.subcategoria else 'N/A',
                    'categoria_principal_nombre': category.subcategoria.categoria_principal.nombre if category.subcategoria and category.subcategoria.categoria_principal else 'N/A'
                }
        
        if not category:
            return jsonify({'success': False, 'message': 'Categoría no encontrada'}), 404
            
        return jsonify({'success': True, 'categoria': data})

    except Exception as e:
        current_app.logger.error(f"Error al obtener detalles de la categoría {category_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno del servidor'}), 500

# Endpoint para actualizar detalles de una categoría
@admin_lista_categorias_bp.route('/api/categoria/<string:category_type>/<string:category_id>', methods=['PUT'])
@admin_jwt_required
def update_category_details(admin_user, category_type, category_id):
    """
    API para actualizar el nombre y la descripción de una categoría.

    Recibe una solicitud PUT con los nuevos datos. Antes de actualizar, realiza
    validaciones cruciales para asegurar la unicidad del nombre y del slug generado,
    previniendo conflictos de URL y datos duplicados.

    Args:
        admin_user: El objeto del administrador autenticado.
        category_type (str): El tipo de categoría a actualizar.
        category_id (str): El ID de la categoría a actualizar.

    Returns:
        JSON: Un mensaje de éxito o un error de validación/servidor.
    """
    try:
        data = request.get_json()
        nombre = data.get('nombre')
        descripcion = data.get('descripcion')

        if not nombre or not descripcion:
            return jsonify({'success': False, 'message': 'El nombre y la descripción son obligatorios.'}), 400

        model_map = {
            'main': CategoriasPrincipales,
            'sub': Subcategorias,
            'pseudo': Seudocategorias
        }

        model = model_map.get(category_type)
        if not model:
            return jsonify({'success': False, 'message': 'Tipo de categoría no válido.'}), 400

        category = model.query.get(category_id)
        if not category:
            return jsonify({'success': False, 'message': 'Categoría no encontrada.'}), 404

        # Check for name uniqueness if it has changed
        if category.nombre != nombre:
            # 1. Check for name uniqueness
            existing_name = model.query.filter(model.nombre == nombre, model.id != category.id).first()
            if existing_name:
                return jsonify({'success': False, 'message': f'Ya existe una categoría con el nombre "{nombre}".'}), 409

            # 2. Check for slug uniqueness
            new_slug = slugify(nombre)
            existing_slug = model.query.filter(model.slug == new_slug, model.id != category.id).first()
            if existing_slug:
                return jsonify({'success': False, 'message': f'Ya existe una categoría con un nombre similar que genera un slug duplicado ("{new_slug}").'}), 409
            
            # 3. If checks pass, update the slug
            category.slug = new_slug

        # Update fields
        category.nombre = nombre
        category.descripcion = descripcion

        db.session.commit()
        
        current_app.logger.info(
            f"Categoría ({category_type}) ID {category.id} actualizada por administrador {admin_user.id} ('{admin_user.nombre}')"
        )

        return jsonify({'success': True, 'message': 'Categoría actualizada correctamente.'})

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al actualizar la categoría {category_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno del servidor al actualizar.'}), 500

# Endpoint API para filtros en tiempo real - Categorías Principales
@admin_lista_categorias_bp.route('/api/categorias-principales/filter', methods=['GET'])
@admin_jwt_required
def filter_main_categories_api(admin_user):
    """
    API para filtrar y paginar las categorías principales en tiempo real.

    Este endpoint es consumido por el frontend para actualizar la vista de tabla
    de categorías principales cuando el usuario aplica filtros o cambia de página.

    Args:
        admin_user: El objeto del administrador autenticado.

    Returns:
        JSON: Un objeto que contiene la lista de categorías y metadatos de paginación.
    """
    try:
        # Obtener parámetros de filtro
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        nombre = request.args.get('nombre', '')
        estado = request.args.get('estado', '')
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')

        # Construir consulta base
        query = CategoriasPrincipales.query

        # Aplicar filtros
        if nombre:
            query = query.filter(CategoriasPrincipales.nombre.ilike(f'%{nombre}%'))

        if estado:
            query = query.filter(CategoriasPrincipales.estado == estado)

        # Aplicar ordenamiento
        if sort_by == 'nombre':
            order_expression = func.lower(CategoriasPrincipales.nombre)
        elif sort_by == 'created_at':
            order_expression = CategoriasPrincipales.created_at
        else:
            order_expression = func.lower(CategoriasPrincipales.nombre)

        if sort_order == 'asc':
            query = query.order_by(order_expression.asc())
        else:
            query = query.order_by(order_expression.desc())

        # Contar el total general de categorías en la base de datos
        total_general = db.session.query(CategoriasPrincipales.id).count()

        # Paginación sobre la consulta filtrada
        categorias_paginadas = query.paginate(
            page=page, per_page=per_page, error_out=False)

        # Serializar categorías
        categorias_data = [categoria_principal_to_dict(
            categoria) for categoria in categorias_paginadas.items]

        # Preparar respuesta JSON
        response_data = {
            'categorias': categorias_data,
            'pagination': {
                'page': categorias_paginadas.page,
                'pages': categorias_paginadas.pages,
                'per_page': categorias_paginadas.per_page,
                'total': categorias_paginadas.total,  # Total de categorías filtradas
                'total_general': total_general,      # Total de categorías sin filtrar
                'has_next': categorias_paginadas.has_next,
                'has_prev': categorias_paginadas.has_prev,
                'next_num': categorias_paginadas.next_num,
                'prev_num': categorias_paginadas.prev_num
            },
            'success': True
        }

        return jsonify(response_data)

    except Exception as e:
        current_app.logger.error(f"Error en filtro AJAX de categorías principales: {e}")
        return jsonify({
            'success': False,
            'message': 'Error al filtrar categorías principales',
            'error': str(e) if current_app.debug else None
        }), 500

# Endpoint API para filtros en tiempo real - Subcategorías
@admin_lista_categorias_bp.route('/api/subcategorias/filter', methods=['GET'])
@admin_jwt_required
def filter_subcategories_api(admin_user):
    """
    API para filtrar y paginar las subcategorías en tiempo real.

    Similar a `filter_main_categories_api`, pero para el nivel de subcategorías.
    Permite filtrar por categoría principal padre.

    Args:
        admin_user: El objeto del administrador autenticado.

    Returns:
        JSON: Un objeto que contiene la lista de subcategorías y metadatos de paginación.
    """
    try:
        # Obtener parámetros de filtro
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        nombre = request.args.get('nombre', '')
        estado = request.args.get('estado', '')
        categoria_id = request.args.get('categoria_id', '')
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')

        # Construir consulta base
        query = Subcategorias.query

        # Aplicar filtros
        if nombre:
            query = query.filter(Subcategorias.nombre.ilike(f'%{nombre}%'))

        if estado:
            query = query.filter(Subcategorias.estado == estado)
            
        if categoria_id:
            query = query.filter(Subcategorias.categoria_principal_id == categoria_id)

        # Aplicar ordenamiento
        if sort_by == 'nombre':
            order_expression = func.lower(Subcategorias.nombre)
        elif sort_by == 'created_at':
            order_expression = Subcategorias.created_at
        else:
            order_expression = func.lower(Subcategorias.nombre)

        if sort_order == 'asc':
            query = query.order_by(order_expression.asc())
        else:
            query = query.order_by(order_expression.desc())

        # Contar el total general de subcategorías en la base de datos
        total_general = db.session.query(Subcategorias.id).count()

        # Paginación sobre la consulta filtrada
        subcategorias_paginadas = query.paginate(
            page=page, per_page=per_page, error_out=False)

        # Serializar subcategorías
        subcategorias_data = [subcategoria_to_dict(
            subcategoria) for subcategoria in subcategorias_paginadas.items]

        # Preparar respuesta JSON
        response_data = {
            'subcategorias': subcategorias_data,
            'pagination': {
                'page': subcategorias_paginadas.page,
                'pages': subcategorias_paginadas.pages,
                'per_page': subcategorias_paginadas.per_page,
                'total': subcategorias_paginadas.total,  # Total de subcategorías filtradas
                'total_general': total_general,      # Total de subcategorías sin filtrar
                'has_next': subcategorias_paginadas.has_next,
                'has_prev': subcategorias_paginadas.has_prev,
                'next_num': subcategorias_paginadas.next_num,
                'prev_num': subcategorias_paginadas.prev_num
            },
            'success': True
        }

        return jsonify(response_data)

    except Exception as e:
        current_app.logger.error(f"Error en filtro AJAX de subcategorías: {e}")
        return jsonify({
            'success': False,
            'message': 'Error al filtrar subcategorías',
            'error': str(e) if current_app.debug else None
        }), 500

# Endpoint API para filtros en tiempo real - Seudocategorías
@admin_lista_categorias_bp.route('/api/seudocategorias/filter', methods=['GET'])
@admin_jwt_required
def filter_pseudocategories_api(admin_user):
    """
    API para filtrar y paginar las seudocategorías en tiempo real.

    Endpoint para la vista de tabla de seudocategorías, permitiendo filtrar
    por subcategoría padre.

    Args:
        admin_user: El objeto del administrador autenticado.

    Returns:
        JSON: Un objeto que contiene la lista de seudocategorías y metadatos de paginación.
    """
    try:
        # Obtener parámetros de filtro
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        nombre = request.args.get('nombre', '')
        estado = request.args.get('estado', '')
        subcategoria_id = request.args.get('subcategoria_id', '')
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')

        # Construir consulta base
        query = Seudocategorias.query

        # Aplicar filtros
        if nombre:
            query = query.filter(Seudocategorias.nombre.ilike(f'%{nombre}%'))

        if estado:
            query = query.filter(Seudocategorias.estado == estado)
            
        if subcategoria_id:
            query = query.filter(Seudocategorias.subcategoria_id == subcategoria_id)

        # Aplicar ordenamiento
        if sort_by == 'nombre':
            order_expression = func.lower(Seudocategorias.nombre)
        elif sort_by == 'created_at':
            order_expression = Seudocategorias.created_at
        else:
            order_expression = func.lower(Seudocategorias.nombre)

        if sort_order == 'asc':
            query = query.order_by(order_expression.asc())
        else:
            query = query.order_by(order_expression.desc())

        # Contar el total general de seudocategorías en la base de datos
        total_general = db.session.query(Seudocategorias.id).count()

        # Paginación sobre la consulta filtrada
        seudocategorias_paginadas = query.paginate(
            page=page, per_page=per_page, error_out=False)

        # Serializar seudocategorías
        seudocategorias_data = [seudocategoria_to_dict(
            seudocategoria) for seudocategoria in seudocategorias_paginadas.items]

        # Preparar respuesta JSON
        response_data = {
            'seudocategorias': seudocategorias_data,
            'pagination': {
                'page': seudocategorias_paginadas.page,
                'pages': seudocategorias_paginadas.pages,
                'per_page': seudocategorias_paginadas.per_page,
                'total': seudocategorias_paginadas.total,  # Total de seudocategorías filtradas
                'total_general': total_general,      # Total de seudocategorías sin filtrar
                'has_next': seudocategorias_paginadas.has_next,
                'has_prev': seudocategorias_paginadas.has_prev,
                'next_num': seudocategorias_paginadas.next_num,
                'prev_num': seudocategorias_paginadas.prev_num
            },
            'success': True
        }

        return jsonify(response_data)

    except Exception as e:
        current_app.logger.error(f"Error en filtro AJAX de seudocategorías: {e}")
        return jsonify({
            'success': False,
            'message': 'Error al filtrar seudocategorías',
            'error': str(e) if current_app.debug else None
        }), 500

# Endpoint para obtener subcategorías de una categoría
@admin_lista_categorias_bp.route('/api/categorias-principales/<string:categoria_id>/subcategorias', methods=['GET'])
@admin_jwt_required
def get_subcategories_for_category(admin_user, categoria_id):
    """
    API auxiliar para obtener las subcategorías de una categoría principal específica.

    Utilizado para poblar dinámicamente los selectores de subcategorías en los
    formularios de creación y edición, basándose en la categoría principal seleccionada.

    Args:
        admin_user: El objeto del administrador autenticado.
        categoria_id (str): El ID de la categoría principal padre.

    Returns:
        JSON: Una lista de objetos de subcategoría (id, nombre).
    """
    try:
        estado_filtro = request.args.get('estado')
        query = Subcategorias.query.filter_by(categoria_principal_id=categoria_id)
        if estado_filtro:
            query = query.filter_by(estado=EstadoEnum(estado_filtro))

        subcategorias = query.all()

        subcategorias_data = [subcategoria_to_dict(sub) for sub in subcategorias]

        return jsonify({
            'success': True,
            'subcategorias': subcategorias_data
        })
    except Exception as e:
        current_app.logger.error(f"Error al obtener subcategorías: {e}")
        return jsonify({
            'success': False,
            'message': 'Error al obtener subcategorías'
        }), 500

# Endpoint para crear una nueva categoría principal
@admin_lista_categorias_bp.route('/api/categorias-principales', methods=['POST'])
@admin_jwt_required
def create_main_category(admin_user):
    """
    API para crear una nueva categoría principal.

    Recibe los datos (nombre, descripción) a través de una solicitud POST.
    Valida la unicidad del nombre y del slug antes de crear el registro.

    Args:
        admin_user: El objeto del administrador autenticado.

    Returns:
        JSON: Un mensaje de éxito con los datos de la nueva categoría, o un error.
    """
    try:
        data = request.get_json()
        nombre = data.get('nombre')
        descripcion = data.get('descripcion')
        estado = data.get('estado', 'activo')  # Default to 'activo'

        if not nombre or not descripcion:
            return jsonify({'success': False, 'message': 'Nombre y descripción son obligatorios'}), 400

        # Basic validation for estado
        if estado not in ['activo', 'inactivo']:
            return jsonify({'success': False, 'message': 'Estado no válido'}), 400

        # Check if category with same name already exists
        if CategoriasPrincipales.query.filter_by(nombre=nombre).first():
            return jsonify({'success': False, 'message': f'Ya existe una categoría principal con el nombre "{nombre}".'}), 409

        # Check for slug uniqueness
        slug = slugify(nombre)
        if CategoriasPrincipales.query.filter_by(slug=slug).first():
            return jsonify({'success': False, 'message': f'Ya existe una categoría principal con el nombre ("{slug}").'}), 409


        new_category = CategoriasPrincipales(
            nombre=nombre,
            descripcion=descripcion,
            estado=estado
        )
        db.session.add(new_category)
        db.session.commit()

        current_app.logger.info(
            f"Categoría principal '{nombre}' creada por administrador {admin_user.id} ('{admin_user.nombre}')"
        )

        return jsonify({'success': True, 'message': 'Categoría principal creada correctamente', 'category': categoria_principal_to_dict(new_category)}), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al crear categoría principal: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno del servidor al crear categoría principal'}), 500

# Endpoint para crear una nueva subcategoría
@admin_lista_categorias_bp.route('/api/subcategorias', methods=['POST'])
@admin_jwt_required
def create_subcategory(admin_user):
    """
    API para crear una nueva subcategoría.

    Recibe nombre, descripción y el ID de la categoría principal padre.
    Valida la unicidad del nombre y del slug.

    Args:
        admin_user: El objeto del administrador autenticado.

    Returns:
        JSON: Un mensaje de éxito con los datos de la nueva subcategoría, o un error.
    """
    try:
        data = request.get_json()
        nombre = data.get('nombre')
        descripcion = data.get('descripcion')
        categoria_principal_id = data.get('categoria_principal_id')
        estado = data.get('estado', 'activo')

        if not nombre or not descripcion or not categoria_principal_id:
            return jsonify({'success': False, 'message': 'Nombre, descripción y categoría principal son obligatorios'}), 400
        
        if estado not in ['activo', 'inactivo']:
            return jsonify({'success': False, 'message': 'Estado no válido'}), 400

        main_category = CategoriasPrincipales.query.get(categoria_principal_id)
        if not main_category:
            return jsonify({'success': False, 'message': 'Categoría principal no encontrada'}), 404
        
        # Verificar unicidad global del nombre
        if Subcategorias.query.filter_by(nombre=nombre).first():
            return jsonify({'success': False, 'message': f'Ya existe una subcategoría con el nombre "{nombre}".'}), 409

        # Check for slug uniqueness
        slug = slugify(nombre)
        if Subcategorias.query.filter_by(slug=slug).first():
            return jsonify({'success': False, 'message': f'Ya existe una subcategoría con el nombre ("{slug}").'}), 409

        new_subcategory = Subcategorias(
            nombre=nombre,
            descripcion=descripcion,
            categoria_principal_id=categoria_principal_id,
            estado=estado
        )
        db.session.add(new_subcategory)
        db.session.commit()

        current_app.logger.info(
            f"Subcategoría '{nombre}' creada en categoría principal '{main_category.nombre}' por administrador {admin_user.id} ('{admin_user.nombre}')"
        )

        return jsonify({'success': True, 'message': 'Subcategoría creada correctamente', 'subcategory': subcategoria_to_dict(new_subcategory)}), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al crear subcategoría: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno del servidor al crear subcategoría'}), 500

# Endpoint para crear una nueva seudocategoría
@admin_lista_categorias_bp.route('/api/seudocategorias', methods=['POST'])
@admin_jwt_required
def create_pseudocategory(admin_user):
    """
    API para crear una nueva seudocategoría.

    Recibe nombre, descripción y el ID de la subcategoría padre.
    Valida la unicidad del nombre y del slug.

    Args:
        admin_user: El objeto del administrador autenticado.

    Returns:
        JSON: Un mensaje de éxito con los datos de la nueva seudocategoría, o un error.
    """
    try:
        data = request.get_json()
        nombre = data.get('nombre')
        descripcion = data.get('descripcion')
        subcategoria_id = data.get('subcategoria_id')
        estado = data.get('estado', 'activo')

        if not nombre or not descripcion or not subcategoria_id:
            return jsonify({'success': False, 'message': 'Nombre, descripción y subcategoría son obligatorios'}), 400
        
        if estado not in ['activo', 'inactivo']:
            return jsonify({'success': False, 'message': 'Estado no válido'}), 400

        sub_category = Subcategorias.query.get(subcategoria_id)
        if not sub_category:
            return jsonify({'success': False, 'message': 'Subcategoría no encontrada'}), 404
        
        # Verificar unicidad global del nombre
        if Seudocategorias.query.filter_by(nombre=nombre).first():
            return jsonify({'success': False, 'message': f'Ya existe una seudocategoría con el nombre "{nombre}".'}), 409

        # Check for slug uniqueness
        slug = slugify(nombre)
        if Seudocategorias.query.filter_by(slug=slug).first():
            return jsonify({'success': False, 'message': f'Ya existe una seudocategoría con el nombre ("{slug}").'}), 409

        new_pseudocategory = Seudocategorias(
            nombre=nombre,
            descripcion=descripcion,
            subcategoria_id=subcategoria_id,
            estado=estado
        )
        db.session.add(new_pseudocategory)
        db.session.commit()

        current_app.logger.info(
            f"Seudocategoría '{nombre}' creada en subcategoría '{sub_category.nombre}' por administrador {admin_user.id} ('{admin_user.nombre}')"
        )

        return jsonify({'success': True, 'message': 'Seudocategoría creada correctamente', 'pseudocategory': seudocategoria_to_dict(new_pseudocategory)}), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al crear seudocategoría: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno del servidor al crear seudocategoría'}), 500