from flask import Blueprint, jsonify, request, render_template, current_app
from app.utils.admin_jwt_utils import admin_jwt_required
from app.models.domains.order_models import Pedido, PedidoProducto
from app.models.domains.user_models import Usuarios
from app.models.domains.product_models import Productos
from app.models.enums import EstadoPedido
from app.models.serializers import pedido_to_dict, pedido_detalle_to_dict
from app.extensions import db
from sqlalchemy import or_, and_, func, desc
from sqlalchemy.orm import joinedload
from datetime import datetime, timedelta
from flask_wtf.csrf import generate_csrf

admin_ventas_bp = Blueprint('admin_ventas', __name__)

@admin_ventas_bp.route('/lista-ventas', methods=['GET'])
@admin_jwt_required
def get_ventas(admin_user):
    error_message = None
    ventas_data = []
    pagination = None
    pagination_info = {}
    
    try:
        # Obtener parámetros de filtro
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        venta_id = request.args.get('venta_id', '')
        cliente = request.args.get('cliente', '')
        fecha_inicio = request.args.get('fecha_inicio', '')
        fecha_fin = request.args.get('fecha_fin', '')
        monto_min = request.args.get('monto_min', '')
        monto_max = request.args.get('monto_max', '')
        sort_by = request.args.get('sort_by', 'created_at')
        estado = request.args.get('estado', 'todos')
        
        # Construir consulta base - Solo pedidos completados
        query = Pedido.query.options(joinedload(Pedido.usuario)).filter(
            Pedido.estado_pedido == EstadoPedido.COMPLETADO
        )
        
        # Aplicar filtro de estado (activo/inactivo)
        if estado in ['activo', 'inactivo']:
            query = query.filter(Pedido.estado == estado)

        # Aplicar filtros
        if venta_id:
            # Usamos ilike para permitir búsquedas parciales del ID
            query = query.filter(Pedido.id.ilike(f'%{venta_id}%'))

        if cliente:
            query = query.join(Usuarios).filter(
                or_(
                    Usuarios.nombre.ilike(f'%{cliente}%'),
                    Usuarios.apellido.ilike(f'%{cliente}%'),
                    Usuarios.numero.ilike(f'%{cliente}%')
                )
            )
            
        if fecha_inicio:
            try:
                fecha_inicio_dt = datetime.strptime(fecha_inicio, '%Y-%m-%d')
                query = query.filter(Pedido.created_at >= fecha_inicio_dt)
            except ValueError:
                pass
                
        if fecha_fin:
            try:
                fecha_fin_dt = datetime.strptime(fecha_fin, '%Y-%m-%d') + timedelta(days=1)
                query = query.filter(Pedido.created_at < fecha_fin_dt)
            except ValueError:
                pass
        
        # Aplicar filtro por rango de montos - Manejo seguro de conversión
        try:
            if monto_min and monto_min.strip():
                monto_min_float = float(monto_min)
                query = query.filter(Pedido.total >= monto_min_float)
        except (ValueError, TypeError):
            pass
            
        try:
            if monto_max and monto_max.strip():
                monto_max_float = float(monto_max)
                query = query.filter(Pedido.total <= monto_max_float)
        except (ValueError, TypeError):
            pass
        
        # Aplicar ordenamiento
        if sort_by == 'created_at':
            query = query.order_by(Pedido.created_at.desc())
        elif sort_by == 'created_at_asc':
            query = query.order_by(Pedido.created_at.asc())
        elif sort_by == 'total':
            query = query.order_by(Pedido.total.desc())
        elif sort_by == 'total_asc':
            query = query.order_by(Pedido.total.asc())
        elif sort_by == 'cliente':
            query = query.join(Usuarios).order_by(Usuarios.nombre.asc(), Usuarios.apellido.asc())
        elif sort_by == 'cliente_desc':
            query = query.join(Usuarios).order_by(Usuarios.nombre.desc(), Usuarios.apellido.desc())
        else:  # Por defecto ordenar por fecha descendente
            query = query.order_by(Pedido.created_at.desc())
        
        # Paginación
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Serializar datos
        ventas_data = [pedido_to_dict(venta) for venta in pagination.items]

        # Preparar información de paginación para JSON
        pagination_info = {
            'page': pagination.page,
            'pages': pagination.pages,
            'per_page': pagination.per_page,
            'total': pagination.total,
            'has_next': pagination.has_next,
            'has_prev': pagination.has_prev,
            'next_num': pagination.next_num,
            'prev_num': pagination.prev_num
        }
        
    except Exception as e:
        current_app.logger.error(f"Error al cargar ventas en el panel de administración: {e}")
        error_message = "Ocurrió un error al cargar las ventas. Por favor, inténtalo de nuevo."

    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

    return render_template('admin/componentes/ventas/lista_ventas.html',
                           ventas=ventas_data,
                           pagination=pagination,
                           pagination_info=pagination_info,
                           filter_params=request.args,
                           error_message=error_message,
                           csrf_token=generate_csrf(),
                           is_ajax=is_ajax)

@admin_ventas_bp.route('/api/ventas', methods=['GET'])
@admin_jwt_required
def get_ventas_api(admin_user):
    try:
        # Obtener parámetros de filtro
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        venta_id = request.args.get('venta_id', '')
        cliente = request.args.get('cliente', '')
        fecha_inicio = request.args.get('fecha_inicio', '')
        fecha_fin = request.args.get('fecha_fin', '')
        monto_min = request.args.get('monto_min', '')
        monto_max = request.args.get('monto_max', '')
        sort_by = request.args.get('sort_by', 'created_at')
        estado = request.args.get('estado', 'todos')

        # Construir consulta base - Solo pedidos completados
        query = Pedido.query.options(joinedload(Pedido.usuario)).filter(
            Pedido.estado_pedido == EstadoPedido.COMPLETADO
        )
        
        # Aplicar filtro de estado (activo/inactivo)
        if estado in ['activo', 'inactivo']:
            query = query.filter(Pedido.estado == estado)

        # Aplicar filtros
        if venta_id:
            # Usamos ilike para permitir búsquedas parciales del ID
            query = query.filter(Pedido.id.ilike(f'%{venta_id}%'))

        if cliente:
            query = query.join(Usuarios).filter(
                or_(
                    Usuarios.nombre.ilike(f'%{cliente}%'),
                    Usuarios.apellido.ilike(f'%{cliente}%'),
                    Usuarios.numero.ilike(f'%{cliente}%')
                )
            )
            
        if fecha_inicio:
            try:
                fecha_inicio_dt = datetime.strptime(fecha_inicio, '%Y-%m-%d')
                query = query.filter(Pedido.created_at >= fecha_inicio_dt)
            except ValueError:
                pass
                
        if fecha_fin:
            try:
                fecha_fin_dt = datetime.strptime(fecha_fin, '%Y-%m-%d') + timedelta(days=1)
                query = query.filter(Pedido.created_at < fecha_fin_dt)
            except ValueError:
                pass
        
        # Aplicar filtro por rango de montos - Manejo seguro de conversión
        try:
            if monto_min and monto_min.strip():
                monto_min_float = float(monto_min)
                query = query.filter(Pedido.total >= monto_min_float)
        except (ValueError, TypeError):
            pass
            
        try:
            if monto_max and monto_max.strip():
                monto_max_float = float(monto_max)
                query = query.filter(Pedido.total <= monto_max_float)
        except (ValueError, TypeError):
            pass
        
        # Aplicar ordenamiento
        if sort_by == 'created_at':
            query = query.order_by(Pedido.created_at.desc())
        elif sort_by == 'created_at_asc':
            query = query.order_by(Pedido.created_at.asc())
        elif sort_by == 'total':
            query = query.order_by(Pedido.total.desc())
        elif sort_by == 'total_asc':
            query = query.order_by(Pedido.total.asc())
        elif sort_by == 'cliente':
            query = query.join(Usuarios).order_by(Usuarios.nombre.asc(), Usuarios.apellido.asc())
        elif sort_by == 'cliente_desc':
            query = query.join(Usuarios).order_by(Usuarios.nombre.desc(), Usuarios.apellido.desc())
        else:  # Por defecto ordenar por fecha descendente
            query = query.order_by(Pedido.created_at.desc())

        # Paginación
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Serializar datos
        ventas_data = [pedido_to_dict(venta) for venta in pagination.items]

        # Preparar respuesta
        response_data = {
            'ventas': ventas_data,
            'pagination': {
                'page': pagination.page,
                'pages': pagination.pages,
                'per_page': pagination.per_page,
                'total': pagination.total,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev,
                'next_num': pagination.next_num,
                'prev_num': pagination.prev_num
            },
            'success': True
        }

        return jsonify(response_data)

    except Exception as e:
        current_app.logger.error(f"Error en filtro AJAX de ventas: {e}")
        return jsonify({
            'success': False,
            'message': 'Error al filtrar ventas'
        }), 500

@admin_ventas_bp.route('/api/ventas/<string:venta_id>', methods=['GET'])
@admin_jwt_required
def get_venta_detalle(admin_user, venta_id):
    try:
        venta = Pedido.query.options(
            joinedload(Pedido.usuario),
            joinedload(Pedido.productos).joinedload(PedidoProducto.producto)
        ).get(venta_id)
        
        if not venta or venta.estado_pedido != EstadoPedido.COMPLETADO:
            return jsonify({
                'success': False,
                'message': 'Venta no encontrada'
            }), 404
        
        venta_data = pedido_detalle_to_dict(venta)
        
        return jsonify({
            'success': True,
            'venta': venta_data
        })
        
    except Exception as e:
        current_app.logger.error(f"Error al obtener detalle de la venta {venta_id}: {e}")
        return jsonify({
            'success': False,
            'message': 'Error al obtener detalle de la venta'
        }), 500

@admin_ventas_bp.route('/api/ventas/<string:venta_id>/estado', methods=['POST'])
@admin_jwt_required
def update_venta_estado(admin_user, venta_id):
    try:
        venta = Pedido.query.get(venta_id)
        if not venta or venta.estado_pedido != EstadoPedido.COMPLETADO:
            return jsonify({
                'success': False,
                'message': 'Venta no encontrada'
            }), 404

        data = request.get_json()
        if not data or 'estado' not in data:
            return jsonify({
                'success': False,
                'message': 'Datos incompletos'
            }), 400

        nuevo_estado = data.get('estado')
        if nuevo_estado not in ['activo', 'inactivo']:
            return jsonify({
                'success': False,
                'message': 'Estado no válido'
            }), 400

        if venta.estado == nuevo_estado:
            return jsonify({
                'success': True,
                'message': f'La venta ya estaba {nuevo_estado}',
                'status_unchanged': True,
                'current_status': nuevo_estado
            }), 200

        old_status = venta.estado
        venta.estado = nuevo_estado
        venta.updated_at = datetime.utcnow()
        db.session.commit()

        current_app.logger.info(
            f"Venta {venta_id} cambiada de estado de {old_status} a {nuevo_estado} "
            f"por administrador {admin_user.id} ('{admin_user.nombre}')"
        )

        return jsonify({
            'success': True,
            'message': f'La venta ha sido marcada como {nuevo_estado} correctamente',
            'venta_id': venta_id,
            'new_status': nuevo_estado
        })

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al cambiar estado de la venta {venta_id}: {e}")
        return jsonify({
            'success': False,
            'message': 'Error al cambiar el estado de la venta'
        }), 500

@admin_ventas_bp.route('/api/ventas/estadisticas', methods=['GET'])
@admin_jwt_required
def get_ventas_estadisticas(admin_user):
    try:
        # Obtener parámetros de fechas
        fecha_inicio = request.args.get('fecha_inicio', '')
        fecha_fin = request.args.get('fecha_fin', '')
        monto_min = request.args.get('monto_min', '')
        monto_max = request.args.get('monto_max', '')
        
        # Construir consulta base - Solo pedidos completados
        query = Pedido.query.filter(
            Pedido.estado_pedido == EstadoPedido.COMPLETADO
        )
        
        # Aplicar filtros de fecha
        if fecha_inicio:
            try:
                fecha_inicio_dt = datetime.strptime(fecha_inicio, '%Y-%m-%d')
                query = query.filter(Pedido.created_at >= fecha_inicio_dt)
            except ValueError:
                pass
                
        if fecha_fin:
            try:
                fecha_fin_dt = datetime.strptime(fecha_fin, '%Y-%m-%d') + timedelta(days=1)
                query = query.filter(Pedido.created_at < fecha_fin_dt)
            except ValueError:
                pass
        
        # Aplicar filtro por rango de montos - Manejo seguro de conversión
        try:
            if monto_min and monto_min.strip():
                monto_min_float = float(monto_min)
                query = query.filter(Pedido.total >= monto_min_float)
        except (ValueError, TypeError):
            pass
            
        try:
            if monto_max and monto_max.strip():
                monto_max_float = float(monto_max)
                query = query.filter(Pedido.total <= monto_max_float)
        except (ValueError, TypeError):
            pass
        
        # Calcular estadísticas
        total_ventas = query.count()
        total_ingresos = db.session.query(func.sum(Pedido.total)).filter(
            Pedido.estado_pedido == EstadoPedido.COMPLETADO
        )
        
        # Aplicar los mismos filtros a la consulta de ingresos
        if fecha_inicio:
            try:
                fecha_inicio_dt = datetime.strptime(fecha_inicio, '%Y-%m-%d')
                total_ingresos = total_ingresos.filter(Pedido.created_at >= fecha_inicio_dt)
            except ValueError:
                pass
                
        if fecha_fin:
            try:
                fecha_fin_dt = datetime.strptime(fecha_fin, '%Y-%m-%d') + timedelta(days=1)
                total_ingresos = total_ingresos.filter(Pedido.created_at < fecha_fin_dt)
            except ValueError:
                pass
        
        # Aplicar filtro por rango de montos a la consulta de ingresos
        try:
            if monto_min and monto_min.strip():
                monto_min_float = float(monto_min)
                total_ingresos = total_ingresos.filter(Pedido.total >= monto_min_float)
        except (ValueError, TypeError):
            pass
            
        try:
            if monto_max and monto_max.strip():
                monto_max_float = float(monto_max)
                total_ingresos = total_ingresos.filter(Pedido.total <= monto_max_float)
        except (ValueError, TypeError):
            pass
        
        total_ingresos = total_ingresos.scalar() or 0
        
        # Calcular ticket promedio
        ticket_promedio = total_ingresos / total_ventas if total_ventas > 0 else 0
        
        # Obtener ventas por día (últimos 30 días)
        hoy = datetime.now().date()
        hace_30_dias = hoy - timedelta(days=30)
        
        # Aplicar filtros de fecha a la consulta de gráfico
        grafico_query = Pedido.query.filter(
            Pedido.estado_pedido == EstadoPedido.COMPLETADO,
            func.date(Pedido.created_at) >= hace_30_dias
        )
        
        if fecha_inicio:
            try:
                fecha_inicio_dt = datetime.strptime(fecha_inicio, '%Y-%m-%d')
                grafico_query = grafico_query.filter(Pedido.created_at >= fecha_inicio_dt)
            except ValueError:
                pass
                
        if fecha_fin:
            try:
                fecha_fin_dt = datetime.strptime(fecha_fin, '%Y-%m-%d') + timedelta(days=1)
                grafico_query = grafico_query.filter(Pedido.created_at < fecha_fin_dt)
            except ValueError:
                pass
        
        # Aplicar filtro por rango de montos a la consulta de gráfico
        try:
            if monto_min and monto_min.strip():
                monto_min_float = float(monto_min)
                grafico_query = grafico_query.filter(Pedido.total >= monto_min_float)
        except (ValueError, TypeError):
            pass
            
        try:
            if monto_max and monto_max.strip():
                monto_max_float = float(monto_max)
                grafico_query = grafico_query.filter(Pedido.total <= monto_max_float)
        except (ValueError, TypeError):
            pass
        
        ventas_por_dia = db.session.query(
            func.date(Pedido.created_at).label('fecha'),
            func.count(Pedido.id).label('cantidad'),
            func.sum(Pedido.total).label('total')
        ).filter(
            Pedido.estado_pedido == EstadoPedido.COMPLETADO,
            func.date(Pedido.created_at) >= hace_30_dias
        ).group_by(func.date(Pedido.created_at)).all()
        
        # Formatear datos para el gráfico
        fechas = []
        cantidades = []
        totales = []
        
        for i in range(30):
            fecha = hoy - timedelta(days=i)
            fecha_str = fecha.strftime('%Y-%m-%d')
            fechas.append(fecha.strftime('%d/%m'))
            
            # Buscar si hay ventas para esta fecha
            venta_dia = next((v for v in ventas_por_dia if v.fecha.strftime('%Y-%m-%d') == fecha_str), None)
            
            if venta_dia:
                cantidades.append(venta_dia.cantidad)
                totales.append(float(venta_dia.total))
            else:
                cantidades.append(0)
                totales.append(0)
        
        # Invertir para mostrar en orden cronológico
        fechas.reverse()
        cantidades.reverse()
        totales.reverse()
        
        return jsonify({
            'success': True,
            'estadisticas': {
                'total_ventas': total_ventas,
                'total_ingresos': float(total_ingresos),
                'ticket_promedio': float(ticket_promedio),
                'grafico': {
                    'fechas': fechas,
                    'cantidades': cantidades,
                    'totales': totales
                }
            }
        })

    except Exception as e:
        current_app.logger.error(f"Error al obtener estadísticas de ventas: {e}")
        return jsonify({
            'success': False,
            'message': 'Error al obtener estadísticas de ventas'
        }), 500
        

@admin_ventas_bp.route('/api/ventas/<string:venta_id>/imprimir', methods=['GET'])
@admin_jwt_required
def imprimir_factura(admin_user, venta_id):
    try:
        # Obtener el pedido con todos los detalles necesarios
        venta = Pedido.query.options(
            joinedload(Pedido.usuario),
            joinedload(Pedido.productos).joinedload(PedidoProducto.producto)
        ).get(venta_id)
        
        if not venta or venta.estado_pedido != EstadoPedido.COMPLETADO:
            return jsonify({
                'success': False,
                'message': 'Venta no encontrada'
            }), 404
        
        # Preparar los datos para la plantilla
        # Formatear los productos para la plantilla
        cart_items = []
        for producto in venta.productos:
            cart_items.append({
                'producto_nombre': producto.producto.nombre,
                'producto_marca': producto.producto.marca if hasattr(producto.producto, 'marca') else 'N/A',
                'producto_imagen_url': producto.producto.imagen_url if hasattr(producto.producto, 'imagen_url') else None,
                'quantity': producto.cantidad,
                'precio_unitario': producto.precio_unitario,
                'precio_unitario_formatted': "${:,.0f}".format(producto.precio_unitario),
                'subtotal': producto.cantidad * producto.precio_unitario,
                'subtotal_formatted': "${:,.0f}".format(producto.cantidad * producto.precio_unitario)
            })
        
        # Calcular el total formateado
        total_price_formatted = "${:,.0f}".format(venta.total)
        
        # Obtener la fecha actual formateada
        from datetime import datetime
        date = datetime.now().strftime('%Y-%m-%d')
        
        # Renderizar la plantilla
        return render_template(
            'cliente/ui/pedido_template.html',
            pedido_id=venta.id,
            date=date,
            user=venta.usuario,
            cart_items=cart_items,
            total_price_formatted=total_price_formatted
        )
        
    except Exception as e:
        current_app.logger.error(f"Error al generar factura para la venta {venta_id}: {e}")
        return jsonify({
            'success': False,
            'message': 'Error al generar la factura'
        }), 500