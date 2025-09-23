from flask import Blueprint, jsonify, current_app
from app.utils.jwt_utils import jwt_required
from app.models.domains.order_models import Pedido
from app.extensions import db
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import desc

events_bp = Blueprint('events', __name__, url_prefix='/events')

@events_bp.route('/api/check-notifications')
@jwt_required
def check_notifications(usuario):
    """
    Comprueba si hay notificaciones de pedidos no leídas para el usuario.
    Si las encuentra, devuelve la más reciente y la marca como leída.
    """
    try:
        # Buscar los 10 pedidos más recientes del usuario para optimizar la búsqueda
        pedidos = Pedido.query.filter_by(usuario_id=usuario.id).order_by(desc(Pedido.updated_at)).limit(10).all()
        
        notifications = []
        
        for pedido in pedidos:
            if not pedido.seguimiento_historial:
                continue
            
            history_changed = False
            # Iterar en reversa para encontrar la notificación más reciente primero
            for entry in reversed(pedido.seguimiento_historial):
                if entry.get('notified_to_client') is False:
                    # Encontramos una notificación no leída
                    notifications.append({
                        'title': f"Actualización de tu Pedido #{pedido.id[:8]}...",
                        'message': entry.get('notas', 'Tu pedido ha sido actualizado.'),
                        'status': entry.get('estado', 'recibido'),
                        'order_id': str(pedido.id)
                    })
                    # Marcar como leída
                    entry['notified_to_client'] = True
                    history_changed = True
                    # MEJORA: Romper el bucle para mostrar solo la notificación más reciente de este pedido.
                    # Las más antiguas se mostrarán en la siguiente recarga de página.
                    break
            
            if history_changed:
                flag_modified(pedido, "seguimiento_historial")

        if notifications:
            db.session.commit()
            # Devolver solo la notificación más reciente para no abrumar al usuario
            return jsonify({'success': True, 'notifications': [notifications[0]]})
        else:
            return jsonify({'success': True, 'notifications': []})

    except Exception as e:
        current_app.logger.error(f"Error al comprobar notificaciones para el usuario {usuario.id}: {e}", exc_info=True)
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Error al buscar notificaciones'}), 500