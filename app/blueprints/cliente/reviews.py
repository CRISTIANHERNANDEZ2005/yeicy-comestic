"""
Módulo para manejar las operaciones relacionadas con las reseñas de productos.
"""
from flask import Blueprint, request, jsonify, current_app
from app.models.models import Producto, Reseña, Usuario
from app.extensions import db
from app.utils.jwt_utils import jwt_required
from sqlalchemy.orm import joinedload

# Crear el blueprint para reseñas
reviews_bp = Blueprint('reviews', __name__)

@reviews_bp.route('/api/productos/<int:producto_id>/reseñas', methods=['GET'])
def listar_resenas(producto_id):
    """
    Obtiene la lista de reseñas de un producto específico.
    
    Args:
        producto_id (int): ID del producto del que se quieren obtener las reseñas
        
    Returns:
        JSON: Lista de reseñas del producto
    """
    current_app.logger.info(f"Listando reseñas para producto {producto_id}")
    
    # Verificar si el producto existe y está activo
    producto = Producto.query.get(producto_id)
    if not producto or producto.estado != 'activo':
        current_app.logger.warning(f"Producto {producto_id} no encontrado o inactivo al listar reseñas")
        return jsonify({'error': 'Producto no encontrado'}), 404
    
    # Obtener reseñas activas con información del usuario
    resenas = Reseña.query.filter_by(
        producto_id=producto_id, 
        estado='activo'
    ).options(
        joinedload(Reseña.usuario)
    ).order_by(
        Reseña.fecha.desc()
    ).all()
    
    # Formatear respuesta
    datos = [
        {
            'id': r.id,
            'usuario': {
                'id': r.usuario.id,
                'nombre': r.usuario.nombre,
                'apellido': r.usuario.apellido
            },
            'texto': r.texto,
            'calificacion': r.calificacion,
            'fecha': r.fecha.isoformat()
        }
        for r in resenas
    ]
    
    current_app.logger.info(f"Producto {producto_id} tiene {len(datos)} reseñas activas")
    return jsonify({
        'success': True,
        'reseñas': datos, 
        'total': len(datos)
    })

@reviews_bp.route('/api/productos/<int:producto_id>/reseñas', methods=['POST'])
@jwt_required
def crear_resena(usuario, producto_id):
    """
    Crea una nueva reseña para un producto.
    
    Args:
        usuario (Usuario): Usuario autenticado (proporcionado por el decorador @jwt_required)
        producto_id (int): ID del producto a reseñar
        
    Returns:
        JSON: Resultado de la operación
    """
    from datetime import datetime
    
    # Obtener datos de la solicitud
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400
    
    texto = data.get('texto', '').strip()
    calificacion = data.get('calificacion')
    
    # Validaciones
    if not texto:
        return jsonify({'success': False, 'error': 'El texto de la reseña es requerido'}), 400
    
    if not isinstance(calificacion, int) or calificacion < 1 or calificacion > 5:
        return jsonify({'success': False, 'error': 'La calificación debe ser un número entre 1 y 5'}), 400
    
    # Verificar si el producto existe y está activo
    producto = Producto.query.get(producto_id)
    if not producto or producto.estado != 'activo':
        return jsonify({'success': False, 'error': 'Producto no encontrado o inactivo'}), 404
    
    # Verificar si el usuario ya ha dejado una reseña para este producto
    existe_resena = Reseña.query.filter_by(
        usuario_id=usuario.id,
        producto_id=producto_id,
        estado='activo'
    ).first()
    
    if existe_resena:
        return jsonify({
            'success': False, 
            'error': 'Ya has dejado una reseña para este producto'
        }), 400
    
    try:
        # Crear nueva reseña
        nueva_resena = Reseña(
            usuario_id=usuario.id,
            producto_id=producto_id,
            texto=texto,
            calificacion=calificacion,
            fecha=datetime.utcnow(),
            estado='activo'
        )
        
        db.session.add(nueva_resena)
        db.session.commit()
        
        # Actualizar el promedio de calificaciones del producto
        producto.actualizar_promedio_calificaciones()
        
        return jsonify({
            'success': True,
            'mensaje': 'Reseña creada exitosamente',
            'reseña': {
                'id': nueva_resena.id,
                'texto': nueva_resena.texto,
                'calificacion': nueva_resena.calificacion,
                'fecha': nueva_resena.fecha.isoformat(),
                'usuario': {
                    'id': usuario.id,
                    'nombre': usuario.nombre,
                    'apellido': usuario.apellido
                }
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error al crear reseña: {str(e)}')
        return jsonify({
            'success': False,
            'error': 'Error al procesar la reseña',
            'details': str(e) if current_app.debug else None
        }), 500
