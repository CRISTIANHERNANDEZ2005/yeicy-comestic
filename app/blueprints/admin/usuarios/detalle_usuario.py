# user_routes.py
from flask import Blueprint, jsonify, request, render_template, current_app
from app.utils.admin_jwt_utils import admin_jwt_required
from app.models.domains.user_models import Admins, Usuarios
from app.models.domains.product_models import Productos, Seudocategorias, Subcategorias
from app.models.domains.order_models import Pedido, PedidoProducto
from app.models.domains.review_models import Reseñas
from app.models.serializers import (
    pedido_detalle_to_dict,
    producto_to_dict,
    resena_to_dict,
    format_currency_cop,
    pedido_detalle_to_dict,
    subcategoria_to_dict,
)
from app.models.enums import EstadoPedido
from app.extensions import db
from sqlalchemy import or_, and_, func, desc
from datetime import datetime, timedelta
import calendar

# Crear el blueprint
detalle_cliente = Blueprint('detalle_cliente', __name__)

@detalle_cliente.route('/admin/cliente/<string:user_id>/detalle', methods=['GET'])
@admin_jwt_required
def detalle_usuario(admin_user, user_id):
    """
    Renderiza la página de detalles de un usuario específico.

    Esta función obtiene toda la información relevante de un usuario,
    incluyendo sus estadísticas, pedidos, productos comprados y reseñas.

    Args:
        admin_user: El objeto del administrador autenticado.
        user_id (str): El ID del usuario a consultar.

    Returns:
        Renderiza la plantilla de detalles del usuario con todos los datos.
    """
    try:
        # Obtener el usuario
        usuario = Usuarios.query.get_or_404(user_id)
        
        # Calcular estadísticas del usuario
        total_invertido = db.session.query(func.sum(Pedido.total)).filter(
            Pedido.usuario_id == user_id, 
            Pedido.estado_pedido == EstadoPedido.COMPLETADO
        ).scalar() or 0
        
        # MEJORA PROFESIONAL: Se consolidan múltiples consultas de conteo en una sola.
        # En lugar de hacer 4 llamadas a la base de datos para contar pedidos por estado,
        # se realiza una única consulta que agrupa por estado y cuenta todos a la vez.
        # Esto reduce la sobrecarga de la red y la base de datos, mejorando el rendimiento.
        counts_by_status = db.session.query(
            Pedido.estado_pedido, func.count(Pedido.id)
        ).filter(
            Pedido.usuario_id == user_id
        ).group_by(
            Pedido.estado_pedido
        ).all()
        
        pedidos_completados_count = sum(count for estado, count in counts_by_status if estado == EstadoPedido.COMPLETADO)
        pedidos_en_proceso_count = sum(count for estado, count in counts_by_status if estado == EstadoPedido.EN_PROCESO)
        pedidos_cancelados_count = sum(count for estado, count in counts_by_status if estado == EstadoPedido.CANCELADO)
        pedidos_count = pedidos_completados_count + pedidos_en_proceso_count + pedidos_cancelados_count
        
        # Calcular tiempo como cliente
        tiempo_como_cliente = ""
        if usuario.created_at:
            now = datetime.utcnow()
            diff = now - usuario.created_at
            
            years = diff.days // 365
            months = (diff.days % 365) // 30
            
            if years > 0:
                tiempo_como_cliente = f"{years} año{'s' if years > 1 else ''}"
                if months > 0:
                    tiempo_como_cliente += f" y {months} mes{'es' if months > 1 else ''}"
            elif months > 0:
                tiempo_como_cliente = f"{months} mes{'es' if months > 1 else ''}"
            else:
                tiempo_como_cliente = f"{diff.days} día{'s' if diff.days > 1 else ''}"
        
        # Calcular días desde última compra
        dias_ultima_compra = 0
        ultimo_pedido = Pedido.query.filter_by(usuario_id=user_id).order_by(desc(Pedido.created_at)).first()
        if ultimo_pedido:
            dias_ultima_compra = (datetime.utcnow() - ultimo_pedido.created_at).days
        
        # Calcular tasa de finalización
        tasa_finalizacion = 0
        if pedidos_count > 0:
            tasa_finalizacion = int((pedidos_completados_count / pedidos_count) * 100)
        
        # Obtener categorías preferidas
        categorias_preferidas = []
        try:
            # Consulta para obtener las categorías más compradas por el usuario
            # MEJORA PROFESIONAL: La consulta ahora agrupa directamente por el nombre de la subcategoría
            # y realiza todos los joins necesarios para obtener los datos en una sola llamada,
            # evitando el problema N+1 y corrigiendo el error del nombre "Otras".
            query = db.session.query(
                Subcategorias.nombre.label('nombre_categoria'),
                func.count(PedidoProducto.producto_id).label('total_compras')
            ).join(
                Pedido, Pedido.id == PedidoProducto.pedido_id
            ).join(
                Productos, Productos.id == PedidoProducto.producto_id
            ).join(
                Seudocategorias, Seudocategorias.id == Productos.seudocategoria_id
            ).join(
                Subcategorias, Subcategorias.id == Seudocategorias.subcategoria_id
            ).filter(
                Pedido.usuario_id == user_id,
                Pedido.estado_pedido == EstadoPedido.COMPLETADO
            ).group_by(
                Subcategorias.nombre
            ).order_by(
                desc('total_compras') # Usar el alias de la columna para ordenar
            ).limit(5).all()
            
            total_compras_general = sum(item.total_compras for item in query)
            colores = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
            
            for i, item in enumerate(query):
                porcentaje = 0
                if total_compras_general > 0:
                    porcentaje = int((item.total_compras / total_compras_general) * 100)

                categorias_preferidas.append({
                    'nombre': item.nombre_categoria, # El nombre correcto ahora viene de la consulta.
                    'porcentaje': porcentaje,
                    'color': colores[i % len(colores)]
                })
        except Exception as e:
            current_app.logger.error(f"Error al obtener categorías preferidas: {str(e)}")
        
        return render_template(
            'admin/componentes/usuario/detalle_cliente.html',
            admin_user=admin_user,
            usuario=usuario, # Pasar el objeto de usuario completo
            total_invertido=total_invertido,
            pedidos_count=pedidos_count,
            tiempo_como_cliente=tiempo_como_cliente,
            dias_ultima_compra=dias_ultima_compra,
            tasa_finalizacion=tasa_finalizacion,
            categorias_preferidas=categorias_preferidas,
            pedidos_completados_count=pedidos_completados_count,
            pedidos_en_proceso_count=pedidos_en_proceso_count,
            pedidos_cancelados_count=pedidos_cancelados_count
        )
    
    except Exception as e:
        current_app.logger.error(f"Error al cargar detalle de usuario {user_id}: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al cargar los detalles del usuario'}), 500

# API para obtener pedidos de un usuario
@detalle_cliente.route('/api/usuarios/<string:user_id>/pedidos', methods=['GET'])
@admin_jwt_required
def get_usuario_pedidos(admin_user, user_id):
    """
    API: Obtiene los pedidos de un usuario con paginación y filtros.

    Args:
        admin_user: El objeto del administrador autenticado.
        user_id (str): El ID del usuario.

    Query Params:
        page, per_page, search, estado, fecha_inicio, fecha_fin, estado_filter.

    Returns:
        JSON: Un objeto con la lista de pedidos y metadatos de paginación.
    """
    try:
        # Obtener parámetros de consulta
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '')
        estado = request.args.get('estado', '')
        fecha_inicio = request.args.get('fecha_inicio', '')
        fecha_fin = request.args.get('fecha_fin', '')        
        
        # Construir consulta base
        query = Pedido.query.filter_by(usuario_id=user_id)

        # LOGGING: Registrar los parámetros recibidos para depuración.
        current_app.logger.info(f"API get_usuario_pedidos: page={page}, estado='{estado}', search='{search}'")
        
        # Aplicar filtro de búsqueda si existe
        if search:
            search_filter = or_(
                Pedido.id.ilike(f'%{search}%'),
                # MEJORA: Unir con PedidoProducto y Productos para buscar por nombre de producto.
                Pedido.productos.any(PedidoProducto.producto.has(Productos.nombre.ilike(f'%{search}%')))
            )
            query = query.filter(search_filter)
        
        # Aplicar filtro de estado (unificado)
        if estado and estado != 'todos':
            try:
                # CORRECCIÓN FINAL: Reemplazar espacios con guiones bajos y luego poner en mayúsculas
                # para que coincida con el nombre del miembro del Enum (ej. 'en proceso' -> 'EN_PROCESO').
                estado_upper = estado.upper().replace(' ', '_')
                estado_enum = EstadoPedido(estado_upper)
                current_app.logger.info(f"Filtrando por estado: {estado_enum}")
                query = query.filter(Pedido.estado_pedido == estado_enum)
            except ValueError:
                # CORRECCIÓN: Si la conversión directa falla, buscar por el valor del Enum.
                # Esto hace el código más robusto.
                current_app.logger.warning(f"Valor de estado '{estado}' no es un miembro de Enum, intentando por valor.")
                query = query.filter(Pedido.estado_pedido == estado)

        # Aplicar filtro de fechas si existen
        if fecha_inicio:
            try:
                fecha_inicio_dt = datetime.strptime(fecha_inicio, '%Y-%m-%d')
                query = query.filter(Pedido.created_at >= fecha_inicio_dt)
            except ValueError:
                pass
        
        if fecha_fin:
            try:
                fecha_fin_dt = datetime.strptime(fecha_fin, '%Y-%m-%d')
                # Agregar un día para incluir toda la fecha final
                fecha_fin_dt = fecha_fin_dt + timedelta(days=1)
                query = query.filter(Pedido.created_at < fecha_fin_dt)
            except ValueError:
                pass
        
        # Ordenar por fecha de creación descendente
        query = query.order_by(desc(Pedido.created_at))
        
        # Ejecutar consulta con paginación
        pedidos = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Preparar respuesta
        pedidos_list = []
        for pedido in pedidos.items:
            # Obtener nombres de productos para mostrar
            productos_nombres = []
            for pp in pedido.productos:
                if pp.producto:
                    productos_nombres.append(pp.producto.nombre)
            
            productos_nombre = ", ".join(productos_nombres) if productos_nombres else "Varios productos"
            
            # LOGGING PROFESIONAL: Añadimos un log para ver el valor exacto que se va a enviar.
            estado_serializado = pedido.estado_pedido.value.lower() if pedido.estado_pedido else None
            current_app.logger.debug(f"Serializando pedido {pedido.id}: estado_original='{pedido.estado_pedido.value if pedido.estado_pedido else 'None'}', estado_serializado='{estado_serializado}'")
            
            pedidos_list.append({
                'id': pedido.id,
                'created_at': pedido.created_at.isoformat() if pedido.created_at else None,
                #  Convertir el valor del Enum a minúsculas.
                # El frontend (JS) espera 'en_proceso', 'completado', etc., en minúsculas y con guion bajo.
                # El valor del Enum es 'EN_PROCESO', que al pasarlo a minúsculas se convierte en 'en_proceso'.
                'estado_pedido': estado_serializado,
                'productos_count': len(pedido.productos),
                'total': pedido.total,
                'productos_nombre': productos_nombre
            })
        
        return jsonify({
            'success': True,
            'pedidos': pedidos_list,
            'pagination': {
                'page': pedidos.page,
                'pages': pedidos.pages,
                'per_page': pedidos.per_page,
                'total': pedidos.total,
                'has_next': pedidos.has_next,
                'has_prev': pedidos.has_prev
            }
        })
    
    except Exception as e:
        current_app.logger.error(f"Error al obtener pedidos del usuario {user_id}: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al obtener los pedidos del usuario'}), 500

# --- MEJORA PROFESIONAL: Endpoint para obtener detalles de un pedido específico ---
@detalle_cliente.route('/api/pedidos/<string:pedido_id>/detalle', methods=['GET'])
@admin_jwt_required
def get_pedido_detalle(admin_user, pedido_id):
    """
    API: Obtiene los detalles completos de un pedido específico.

    Esta función es crucial para poblar la modal de detalles del pedido.
    Utiliza `joinedload` para cargar de forma eficiente el pedido, su usuario
    y todos los productos asociados en una sola consulta, evitando el problema N+1.

    Args:
        admin_user: El objeto del administrador autenticado.
        pedido_id (str): El ID del pedido a consultar.

    Returns:
        JSON: Un objeto con los detalles completos del pedido o un error si no se encuentra.
    """
    try:
        pedido = Pedido.query.options(
            db.joinedload(Pedido.usuario),
            db.joinedload(Pedido.productos).joinedload(PedidoProducto.producto)
        ).get(pedido_id)

        if not pedido:
            return jsonify({'success': False, 'message': 'Pedido no encontrado'}), 404

        return jsonify({'success': True, 'pedido': pedido_detalle_to_dict(pedido)})
    except Exception as e:
        current_app.logger.error(f"Error al obtener detalle del pedido {pedido_id}: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al obtener los detalles del pedido'}), 500

# API para obtener productos comprados por un usuario
@detalle_cliente.route('/api/usuarios/<string:user_id>/productos-comprados', methods=['GET'])
@admin_jwt_required
def get_usuario_productos_comprados(admin_user, user_id):
    """
    API: Obtiene los productos comprados por un usuario con paginación y filtros.

    Args:
        admin_user: El objeto del administrador autenticado.
        user_id (str): El ID del usuario.

    Query Params:
        page, per_page, search, categoria, orden.

    Returns:
        JSON: Un objeto con la lista de productos y metadatos de paginación.
    """
    try:
        # Obtener parámetros de consulta
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '')
        categoria = request.args.get('categoria', '')
        orden = request.args.get('orden', 'veces_comprado')
        
        # Subconsulta para obtener productos comprados por el usuario
        subquery = db.session.query(
            PedidoProducto.producto_id,
            func.count(PedidoProducto.producto_id).label('veces_comprado'),
            # MEJORA PROFESIONAL: Añadir la suma de la cantidad total de unidades compradas.
            func.sum(PedidoProducto.cantidad).label('unidades_totales'),
            func.sum(PedidoProducto.cantidad * PedidoProducto.precio_unitario).label('total_gastado'),
            func.max(Pedido.created_at).label('ultima_compra')
        ).join(
            Pedido, Pedido.id == PedidoProducto.pedido_id
        ).filter(
            Pedido.usuario_id == user_id,
            Pedido.estado_pedido == EstadoPedido.COMPLETADO
        ).group_by(
            PedidoProducto.producto_id
        ).subquery()
        
        # Construir consulta principal
        query = db.session.query(
            Productos,
            subquery.c.veces_comprado,
            subquery.c.unidades_totales,
            subquery.c.total_gastado,
            subquery.c.ultima_compra
        ).join(
            subquery, Productos.id == subquery.c.producto_id
        )
        
        # Aplicar filtro de búsqueda si existe
        if search:
            query = query.filter(
                or_(
                    Productos.nombre.ilike(f'%{search}%'),
                    Productos.descripcion.ilike(f'%{search}%'),
                    Productos.marca.ilike(f'%{search}%')
                )
            )
        
        # Aplicar filtro de categoría si existe
        if categoria:
            query = query.filter(
                Productos.seudocategoria.has(
                    Productos.seudocategoria.subcategoria.has(
                        Productos.seudocategoria.subcategoria.categoria_principal.has(
                            Productos.seudocategoria.subcategoria.categoria_principal.nombre.ilike(f'%{categoria}%')
                        )
                    )
                )
            )
        
        # Aplicar ordenamiento
        if orden == 'veces_comprado':
            query = query.order_by(desc(subquery.c.veces_comprado))
        elif orden == 'total_gastado':
            query = query.order_by(desc(subquery.c.total_gastado))
        elif orden == 'ultima_compra':
            query = query.order_by(desc(subquery.c.ultima_compra))
        else:
            query = query.order_by(desc(subquery.c.veces_comprado))
        
        # Ejecutar consulta con paginación
        productos = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Preparar respuesta
        productos_list = []
        for producto, veces_comprado, unidades_totales, total_gastado, ultima_compra in productos.items:
            # Obtener nombre de la categoría
            categoria_nombre = "Otras"
            if producto.seudocategoria and producto.seudocategoria.subcategoria:
                categoria_nombre = producto.seudocategoria.subcategoria.nombre
            
            productos_list.append({
                'id': producto.id,
                'nombre': producto.nombre,
                'descripcion': producto.descripcion,
                'imagen_url': producto.imagen_url,
                'marca': producto.marca, # CORRECCIÓN: Añadir la marca del producto a la respuesta.
                'categoria': categoria_nombre,
                'veces_comprado': veces_comprado,
                # MEJORA PROFESIONAL: Devolver el nuevo campo de unidades totales.
                'unidades_totales': int(unidades_totales) if unidades_totales else 0,
                'total_gastado': total_gastado,
                'ultima_compra': ultima_compra.isoformat() if ultima_compra else None,
                'precio': producto.precio
            })
        
        return jsonify({
            'success': True,
            'productos': productos_list,
            'pagination': {
                'page': productos.page,
                'pages': productos.pages,
                'per_page': productos.per_page,
                'total': productos.total,
                'has_next': productos.has_next,
                'has_prev': productos.has_prev
            }
        })
    
    except Exception as e:
        current_app.logger.error(f"Error al obtener productos comprados del usuario {user_id}: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al obtener los productos comprados del usuario'}), 500

# API para obtener productos más comprados por un usuario
@detalle_cliente.route('/api/usuarios/<string:user_id>/productos-frecuentes', methods=['GET'])
@admin_jwt_required
def get_usuario_productos_frecuentes(admin_user, user_id):
    """
    API: Obtiene los productos más comprados por un usuario con paginación y filtros.

    Args:
        admin_user: El objeto del administrador autenticado.
        user_id (str): El ID del usuario.

    Query Params:
        page, per_page, search, categoria, orden.

    Returns:
        JSON: Un objeto con la lista de productos y metadatos de paginación.
    """
    try:
        # Obtener parámetros de consulta
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '')
        categoria = request.args.get('categoria', '')
        orden = request.args.get('orden', 'veces_comprado')
        
        # Subconsulta para obtener productos comprados por el usuario
        subquery = db.session.query(
            PedidoProducto.producto_id,
            func.count(PedidoProducto.producto_id).label('veces_comprado'),
            func.max(Pedido.created_at).label('ultima_compra')
        ).join(
            Pedido, Pedido.id == PedidoProducto.pedido_id
        ).filter(
            Pedido.usuario_id == user_id,
            Pedido.estado_pedido == EstadoPedido.COMPLETADO
        ).group_by(
            PedidoProducto.producto_id
        ).having(
            func.count(PedidoProducto.producto_id) > 2
        ).subquery()
        
        # Construir consulta principal
        query = db.session.query(
            Productos,
            subquery.c.veces_comprado,
            subquery.c.ultima_compra,
            func.coalesce(Productos.calificacion_promedio_almacenada, 0).label('calificacion_promedio')
        ).join(
            subquery, Productos.id == subquery.c.producto_id
        )
        
        # Aplicar filtro de búsqueda si existe
        if search:
            query = query.filter(
                or_(
                    Productos.nombre.ilike(f'%{search}%'),
                    Productos.descripcion.ilike(f'%{search}%'),
                    Productos.marca.ilike(f'%{search}%')
                )
            )
        
        # Aplicar filtro de categoría si existe
        if categoria:
            query = query.filter(
                Productos.seudocategoria.has(
                    Productos.seudocategoria.subcategoria.has(
                        Productos.seudocategoria.subcategoria.categoria_principal.has(
                            Productos.seudocategoria.subcategoria.categoria_principal.nombre.ilike(f'%{categoria}%')
                        )
                    )
                )
            )
        
        # Aplicar ordenamiento
        if orden == 'veces_comprado':
            query = query.order_by(desc(subquery.c.veces_comprado))
        elif orden == 'calificacion':
            query = query.order_by(desc('calificacion_promedio'))
        elif orden == 'ultima_compra':
            query = query.order_by(desc(subquery.c.ultima_compra))
        else:
            query = query.order_by(desc(subquery.c.veces_comprado))
        
        # Ejecutar consulta con paginación
        productos = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Preparar respuesta
        productos_list = []
        for producto, veces_comprado, ultima_compra, calificacion_promedio in productos.items:
            # Obtener nombre de la categoría
            categoria_nombre = "Otras"
            if producto.seudocategoria and producto.seudocategoria.subcategoria:
                categoria_nombre = producto.seudocategoria.subcategoria.nombre
            
            productos_list.append({
                'id': producto.id,
                'nombre': producto.nombre,
                'descripcion': producto.descripcion,
                'imagen_url': producto.imagen_url,
                'marca': producto.marca, # CORRECCIÓN: Añadir la marca del producto a la respuesta.
                'categoria': categoria_nombre,
                'veces_comprado': veces_comprado,
                'ultima_compra': ultima_compra.isoformat() if ultima_compra else None,
                'calificacion_promedio': calificacion_promedio,
                'precio': producto.precio
            })
        
        return jsonify({
            'success': True,
            'productos': productos_list,
            'pagination': {
                'page': productos.page,
                'pages': productos.pages,
                'per_page': productos.per_page,
                'total': productos.total,
                'has_next': productos.has_next,
                'has_prev': productos.has_prev
            }
        })
    
    except Exception as e:
        current_app.logger.error(f"Error al obtener productos frecuentes del usuario {user_id}: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al obtener los productos frecuentes del usuario'}), 500

# API para obtener reseñas de un usuario
@detalle_cliente.route('/api/usuarios/<string:user_id>/reviews', methods=['GET'])
@admin_jwt_required
def get_usuario_reseñas(admin_user, user_id):
    """
    API: Obtiene las reseñas de un usuario con paginación y filtros.

    Args:
        admin_user: El objeto del administrador autenticado.
        user_id (str): El ID del usuario.

    Query Params:
        page, per_page, search, calificacion, orden.

    Returns:
        JSON: Un objeto con la lista de reseñas y metadatos de paginación.
    """
    try:
        # Obtener parámetros de consulta
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '')
        calificacion = request.args.get('calificacion', '')
        orden = request.args.get('orden', 'fecha')
        
        # Construir consulta base
        query = Reseñas.query.filter_by(usuario_id=user_id)
        
        # Aplicar filtro de búsqueda si existe
        if search:
            query = query.filter(
                or_(
                    Reseñas.texto.ilike(f'%{search}%'),
                    Reseñas.titulo.ilike(f'%{search}%'),
                    Reseñas.producto.has(Productos.nombre.ilike(f'%{search}%'))
                )
            )
        
        # Aplicar filtro de calificación si existe
        if calificacion:
            try:
                calificacion_int = int(calificacion)
                query = query.filter(Reseñas.calificacion == calificacion_int)
            except ValueError:
                pass
        
        # Aplicar ordenamiento
        if orden == 'fecha':
            query = query.order_by(desc(Reseñas.created_at))
        elif orden == 'calificacion':
            query = query.order_by(desc(Reseñas.calificacion))
        elif orden == 'votos':
            query = query.order_by(desc(Reseñas.votos_utiles_count))
        else:
            query = query.order_by(desc(Reseñas.created_at))
        
        # Ejecutar consulta con paginación
        reseñas = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Preparar respuesta
        reseñas_list = []
        for reseña in reseñas.items:
            reseñas_list.append(resena_to_dict(reseña))
        
        return jsonify({
            'success': True,
            'reseñas': reseñas_list,
            'pagination': {
                'page': reseñas.page,
                'pages': reseñas.pages,
                'per_page': reseñas.per_page,
                'total': reseñas.total,
                'has_next': reseñas.has_next,
                'has_prev': reseñas.has_prev
            }
        })
    
    except Exception as e:
        current_app.logger.error(f"Error al obtener reseñas del usuario {user_id}: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al obtener las reseñas del usuario'}), 500

# API para obtener categorías preferidas de un usuario
@detalle_cliente.route('/api/usuarios/<string:user_id>/categorias-preferidas', methods=['GET'])
@admin_jwt_required
def get_usuario_categorias_preferidas(admin_user, user_id):
    """
    API: Obtiene las categorías preferidas de un usuario.

    Args:
        admin_user: El objeto del administrador autenticado.
        user_id (str): El ID del usuario.

    Returns:
        JSON: Un objeto con la lista de categorías preferidas.
    """
    try:
        # MEJORA PROFESIONAL: La consulta ahora agrupa directamente por el nombre de la subcategoría
        # y realiza todos los joins necesarios para obtener los datos en una sola llamada,
        # evitando el problema N+1 que ocurría al buscar el nombre de la categoría en un bucle.
        query = db.session.query(
            Subcategorias.nombre.label('nombre_categoria'),
            func.count(PedidoProducto.producto_id).label('total_compras')
        ).join(
            Pedido, Pedido.id == PedidoProducto.pedido_id
        ).join(
            Productos, Productos.id == PedidoProducto.producto_id
        ).join(
            Seudocategorias, Seudocategorias.id == Productos.seudocategoria_id
        ).join(
            Subcategorias, Subcategorias.id == Seudocategorias.subcategoria_id
        ).filter(
            Pedido.usuario_id == user_id,
            Pedido.estado_pedido == EstadoPedido.COMPLETADO
        ).group_by(
            Subcategorias.nombre
        ).order_by(
            desc('total_compras') # Usar el alias de la columna para ordenar
        ).limit(5).all()
        
        total_compras_general = sum(item.total_compras for item in query)
        colores = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
        categorias = []
        for i, item in enumerate(query):
            porcentaje = 0
            if total_compras_general > 0:
                porcentaje = int((item.total_compras / total_compras_general) * 100)
            
            categorias.append({
                'nombre': item.nombre_categoria, # El nombre correcto ahora viene de la consulta.
                'porcentaje': porcentaje,
                'color': colores[i % len(colores)]
            })
        
        return jsonify({
            'success': True,
            'categorias': categorias
        })
    
    except Exception as e:
        current_app.logger.error(f"Error al obtener categorías preferidas del usuario {user_id}: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al obtener las categorías preferidas del usuario'}), 500

# API para obtener tendencia de compras de un usuario
@detalle_cliente.route('/api/usuarios/<string:user_id>/tendencia-compras', methods=['GET'])
@admin_jwt_required
def get_usuario_tendencia_compras(admin_user, user_id):
    """
    API: Obtiene la tendencia de compras de un usuario.

    Args:
        admin_user: El objeto del administrador autenticado.
        user_id (str): El ID del usuario.

    Query Params:
        periodo (6M, 1A, todo).

    Returns:
        JSON: Un objeto con las etiquetas y valores para el gráfico de tendencia.
    """
    try:
        periodo = request.args.get('periodo', '6M')
        
        # Determinar el rango de fechas según el período
        now = datetime.utcnow()
        
        if periodo == '6M':
            start_date = now - timedelta(days=180)
        elif periodo == '1A':
            start_date = now - timedelta(days=365)
        else:  # todo
            # Obtener la fecha del primer pedido del usuario
            primer_pedido = Pedido.query.filter_by(usuario_id=user_id).order_by(Pedido.created_at).first()
            if primer_pedido:
                start_date = primer_pedido.created_at
            else:
                start_date = now - timedelta(days=30)  # Valor por defecto
        
        # Consulta para obtener las compras por mes
        query = db.session.query(
            func.extract('year', Pedido.created_at).label('year'),
            func.extract('month', Pedido.created_at).label('month'),
            func.sum(Pedido.total).label('total')
        ).filter(
            Pedido.usuario_id == user_id,
            Pedido.estado_pedido == EstadoPedido.COMPLETADO,
            Pedido.created_at >= start_date
        ).group_by(
            func.extract('year', Pedido.created_at),
            func.extract('month', Pedido.created_at)
        ).order_by(
            'year', 'month'
        ).all()
        
        # Preparar datos para el gráfico
        labels = []
        valores = []
        
        # Generar etiquetas y valores para cada mes en el rango
        current_date = start_date.replace(day=1)
        while current_date <= now:
            month_name = calendar.month_abbr[current_date.month]
            year = current_date.year
            
            # Buscar el total para este mes
            total_mes = 0
            for year_db, month_db, total in query:
                if int(year_db) == year and int(month_db) == current_date.month:
                    total_mes = float(total)
                    break
            
            labels.append(f"{month_name} {year}")
            valores.append(total_mes)
            
            # Avanzar al siguiente mes
            if current_date.month == 12:
                current_date = current_date.replace(year=current_date.year + 1, month=1)
            else:
                current_date = current_date.replace(month=current_date.month + 1)
        
        return jsonify({
            'success': True,
            'labels': labels,
            'valores': valores
        })
    
    except Exception as e:
        current_app.logger.error(f"Error al obtener tendencia de compras del usuario {user_id}: {str(e)}")
        return jsonify({'success': False, 'message': 'Error al obtener la tendencia de compras del usuario'}), 500

# --- MEJORA PROFESIONAL: Endpoint para la modal de detalles de producto ---
@detalle_cliente.route('/api/productos/<string:producto_id>/detalle-cliente/<string:user_id>', methods=['GET'])
@admin_jwt_required
def get_producto_detalle_para_cliente(admin_user, producto_id, user_id):
    """
    API: Obtiene los detalles de un producto y las estadísticas de compra
    específicas para un cliente.

    Esta función es el backend para la modal de detalles de producto en la
    página de detalles del cliente. Combina información general del producto
    con datos de interacción específicos del cliente.

    Args:
        admin_user: El objeto del administrador autenticado.
        producto_id (str): El ID del producto a consultar.
        user_id (str): El ID del cliente para el cual se calculan las estadísticas.

    Returns:
        JSON: Un objeto con los detalles completos del producto y las estadísticas
              del cliente, o un error si no se encuentra.
    """
    try:
        # 1. Obtener los detalles generales del producto
        # MEJORA: Carga anticipada (eager loading) de las relaciones para evitar el problema N+1.
        # Se cargan las reseñas y la jerarquía de categorías en una sola consulta.
        producto = Productos.query.options(
            db.joinedload(Productos.reseñas),
            db.joinedload(Productos.seudocategoria).joinedload(Seudocategorias.subcategoria)
        ).get(producto_id)
        if not producto:
            return jsonify({'success': False, 'message': 'Producto no encontrado'}), 404
 
        # 2. Calcular estadísticas específicas del cliente para este producto
        stats_cliente = db.session.query(
            func.count(Pedido.id).label('veces_comprado'),
            func.sum(PedidoProducto.cantidad * PedidoProducto.precio_unitario).label('total_gastado'),
            func.max(Pedido.created_at).label('ultima_compra')
        ).join(
            PedidoProducto, Pedido.id == PedidoProducto.pedido_id
        ).filter(
            Pedido.usuario_id == user_id,
            PedidoProducto.producto_id == producto_id,
            Pedido.estado_pedido == EstadoPedido.COMPLETADO
        ).first()
 
        # 3. MEJORA PROFESIONAL: Obtener el historial detallado de compras para este producto.
        # Esta consulta recupera cada pedido individual donde el cliente compró el producto,
        # junto con la cantidad específica en esa orden.
        historial_compras = db.session.query(
            Pedido.created_at,
            PedidoProducto.cantidad
        ).join(
            PedidoProducto, Pedido.id == PedidoProducto.pedido_id
        ).filter(
            Pedido.usuario_id == user_id,
            PedidoProducto.producto_id == producto_id,
            Pedido.estado_pedido == EstadoPedido.COMPLETADO
        ).order_by(
            desc(Pedido.created_at)
        ).all()

        # 3. Preparar la respuesta JSON
        producto_data = {
            'id': producto.id,
            'nombre': producto.nombre,
            'descripcion': producto.descripcion,
            'precio': producto.precio,
            'costo': producto.costo,
            'existencia': producto.existencia,
            'imagen_url': producto.imagen_url,
            'marca': producto.marca,
            'slug': producto.slug,
            'categoria': producto.seudocategoria.subcategoria.nombre if producto.seudocategoria and producto.seudocategoria.subcategoria else 'N/A',
            'calificacion_promedio': float(producto.calificacion_promedio_almacenada or 0),
            # CORRECCIÓN: Usar len() en la lista de reseñas ya cargada en lugar de .count()
            'reviews_count': len(producto.reseñas),
            'stats_cliente': {
                'veces_comprado': stats_cliente.veces_comprado or 0,
                'total_gastado': float(stats_cliente.total_gastado or 0),
                'ultima_compra': stats_cliente.ultima_compra.isoformat() if stats_cliente.ultima_compra else None
            },
            'historial_compras': [
                {'fecha': item.created_at.isoformat(), 'cantidad': item.cantidad}
                for item in historial_compras
            ]
        }

        return jsonify({'success': True, 'producto': producto_data}) 

    except Exception as e:
        current_app.logger.error(f"Error al obtener detalle de producto {producto_id} para cliente {user_id}: {str(e)}")
        return jsonify({'success': False, 'message': 'Error interno al obtener los detalles del producto'}), 500