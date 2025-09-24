from flask import Blueprint, jsonify, request, render_template, current_app
from app.utils.admin_jwt_utils import admin_jwt_required
from app.models.domains.order_models import Pedido, PedidoProducto
from app.models.domains.user_models import Usuarios
from app.models.domains.product_models import Productos
from app.models.enums import EstadoPedido, EstadoEnum, EstadoSeguimiento
from app.models.serializers import pedido_to_dict, pedido_detalle_to_dict
from app.extensions import db
from sqlalchemy import or_, and_, func, desc
from sqlalchemy.orm import joinedload
from datetime import datetime, timedelta, date
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

@admin_ventas_bp.route('/api/ventas', methods=['POST'])
@admin_jwt_required
def create_venta(admin_user):
    """
    Crea una nueva venta (Pedido con estado COMPLETADO).
    Reutiliza la lógica del modal de creación de pedidos.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No se recibieron datos'}), 400

        usuario_id = data.get('usuario_id')
        productos_payload = data.get('productos')

        if not usuario_id or not productos_payload:
            return jsonify({'success': False, 'message': 'Faltan datos: se requiere usuario_id y productos'}), 400

        usuario = Usuarios.query.get(usuario_id)
        if not usuario:
            return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404

        total_venta = 0
        productos_a_procesar = []

        for item in productos_payload:
            producto_id = item.get('id')
            cantidad = item.get('cantidad')

            if not producto_id or not isinstance(cantidad, int) or cantidad <= 0:
                return jsonify({'success': False, 'message': f'Datos de producto inválidos: {item}'}), 400

            producto = Productos.query.get(producto_id)
            if not producto:
                return jsonify({'success': False, 'message': f'Producto con ID {producto_id} no encontrado'}), 404
            
            if producto.existencia < cantidad:
                return jsonify({
                    'success': False, 
                    'message': f'Stock insuficiente para {producto.nombre}. Disponible: {producto.existencia}, solicitado: {cantidad}'
                }), 400

            subtotal = producto.precio * cantidad
            total_venta += subtotal
            
            productos_a_procesar.append({
                'producto_obj': producto,
                'cantidad': cantidad,
                'precio_unitario': producto.precio
            })

        # MEJORA PROFESIONAL: Añadir historial de seguimiento para notificar al cliente.
        # Al crear una venta directa, se genera una notificación de "Entregado".
        nota_seguimiento = "Tu pedido esta completado con exito."
        historial_inicial = [{
            'estado': EstadoSeguimiento.ENTREGADO.value,
            'notas': nota_seguimiento,
            'timestamp': datetime.utcnow().isoformat() + "Z",
            'notified_to_client': False  # Clave para que se muestre la notificación al cliente.
        }]

        nueva_venta = Pedido(
            usuario_id=usuario_id,
            total=total_venta,
            estado_pedido=EstadoPedido.COMPLETADO, # La diferencia clave: se crea como COMPLETADO
            estado=EstadoEnum.ACTIVO.value,
            seguimiento_estado=EstadoSeguimiento.ENTREGADO,
            notas_seguimiento=nota_seguimiento,
            seguimiento_historial=historial_inicial
        )
        db.session.add(nueva_venta)
        db.session.flush()

        for item in productos_a_procesar:
            pedido_producto = PedidoProducto(
                pedido_id=nueva_venta.id,
                producto_id=item['producto_obj'].id,
                cantidad=item['cantidad'],
                precio_unitario=item['precio_unitario']
            )
            db.session.add(pedido_producto)
            item['producto_obj'].existencia -= item['cantidad']

        db.session.commit()
        current_app.logger.info(f"Nueva venta (pedido completado) {nueva_venta.id} creada por administrador {admin_user.id}")
        return jsonify({'success': True, 'message': 'Venta creada exitosamente', 'pedido_id': nueva_venta.id}), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al crear venta: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error interno al crear la venta'}), 500

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
        periodo = request.args.get('periodo', '30d') # Nuevo: 7d, 30d, 1y
        
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

        # Lógica mejorada para el gráfico
        hoy = datetime.utcnow().date()
        if periodo == '7d':
            start_date = hoy - timedelta(days=6)
            group_by_format = '%Y-%m-%d'
            label_format = '%d/%m'
            date_trunc = func.date(Pedido.created_at)
        elif periodo == '1y':
            start_date = hoy - timedelta(days=365)
            group_by_format = 'YYYY-MM' # Formato para PostgreSQL
            label_format = '%b %Y'
            date_trunc = func.to_char(Pedido.created_at, group_by_format)
        else: # 30d por defecto
            start_date = hoy - timedelta(days=29)
            group_by_format = '%Y-%m-%d'
            label_format = '%d/%m'
            date_trunc = func.date(Pedido.created_at)

        # Consulta para el gráfico
        grafico_query = db.session.query(
            date_trunc.label('fecha'),
            func.count(Pedido.id).label('cantidad'),
            func.sum(Pedido.total).label('total')
        ).filter(
            Pedido.estado_pedido == EstadoPedido.COMPLETADO,
            Pedido.created_at >= start_date
        ).group_by('fecha').order_by('fecha')

        # Aplicar filtros adicionales al gráfico si se proporcionan
        if fecha_inicio:
            grafico_query = grafico_query.filter(Pedido.created_at >= datetime.strptime(fecha_inicio, '%Y-%m-%d'))
        if fecha_fin:
            grafico_query = grafico_query.filter(Pedido.created_at < (datetime.strptime(fecha_fin, '%Y-%m-%d') + timedelta(days=1)))

        ventas_agrupadas = grafico_query.all()
        
        # Crear un diccionario para un acceso rápido
        # MEJORA: La clave 'fecha' ahora puede ser una cadena directamente desde la BD (para '1y')
        # o un objeto de fecha (para '7d'/'30d'). Lo manejamos de forma robusta.
        ventas_dict = {}
        for r in ventas_agrupadas:
            clave = r.fecha.strftime('%Y-%m-%d') if isinstance(r.fecha, (datetime, date)) else str(r.fecha)
            ventas_dict[clave] = {'cantidad': r.cantidad, 'total': float(r.total)}

        # Generar etiquetas y datos para el rango de fechas completo
        fechas = []
        cantidades = []
        totales = []
        num_dias = 365 if periodo == '1y' else (7 if periodo == '7d' else 30)

        if periodo == '1y':
            for i in range(12):
                mes_actual = (hoy.month - i - 1) % 12 + 1
                ano_actual = hoy.year if mes_actual <= hoy.month else hoy.year - 1
                fecha = datetime(ano_actual, mes_actual, 1)
                clave = fecha.strftime('%Y-%m') # Usamos el formato Python para generar la clave
                fechas.insert(0, fecha.strftime(label_format))
                venta_mes = ventas_dict.get(clave, {'cantidad': 0, 'total': 0})
                cantidades.insert(0, venta_mes['cantidad'])
                totales.insert(0, venta_mes['total'])
        else:
            for i in range(num_dias):
                fecha = hoy - timedelta(days=i)
                clave = fecha.strftime('%Y-%m-%d') # Usamos el formato Python para generar la clave
                fechas.insert(0, fecha.strftime(label_format))
                venta_dia = ventas_dict.get(clave, {'cantidad': 0, 'total': 0})
                cantidades.insert(0, venta_dia['cantidad'])
                totales.insert(0, venta_dia['total'])
        
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