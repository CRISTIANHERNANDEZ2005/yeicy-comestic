"""
Módulo de Notificaciones y Eventos del Cliente.

Este blueprint se encarga de gestionar las notificaciones periódicas para el cliente.
Su principal función es verificar si existen actualizaciones en el estado de los pedidos
que aún no han sido vistas por el usuario, para luego mostrarlas como notificaciones
emergentes (toasts) en la interfaz.
"""

# --- Importaciones de Flask y Librerías Estándar ---
from flask import Blueprint, jsonify, current_app

# --- Importaciones de Extensiones y Terceros ---
from app.utils.jwt_utils import jwt_required
from sqlalchemy import desc
from sqlalchemy.orm.attributes import flag_modified

# --- Importaciones Locales de la Aplicación ---
from app.models.domains.order_models import Pedido
from app.extensions import db

events_bp = Blueprint('events', __name__, url_prefix='/events')

@events_bp.route('/api/check-notifications')
@jwt_required
def check_notifications(usuario):
    """
    Endpoint para verificar si hay notificaciones de pedidos no leídas.

    Este endpoint es consultado periódicamente por el frontend para simular notificaciones
    en tiempo real. Revisa el historial de seguimiento de los pedidos recientes del usuario
    en busca de entradas marcadas con `notified_to_client: false`.

    Si encuentra una notificación no leída:
    1. La marca como leída (`notified_to_client: true`) para evitar que se muestre de nuevo.
    2. Devuelve la notificación más reciente encontrada en formato JSON.

    Args:
        usuario (Usuarios): El objeto de usuario inyectado por el decorador `@jwt_required`.

    Returns:
        JSON: Un objeto con `success: true` y una lista `notifications` que contiene
              la notificación más reciente, o una lista vacía si no hay nuevas.
        JSON: Un objeto de error en caso de fallo en la base de datos.
    """
    try:
        # --- Optimización de Consulta ---
        # Se buscan solo los 10 pedidos más recientes para evitar escanear toda la
        # tabla de pedidos en cada verificación, mejorando significativamente el rendimiento.
        pedidos = Pedido.query.filter_by(usuario_id=usuario.id).order_by(desc(Pedido.updated_at)).limit(10).all()
        
        notifications = []
        
        for pedido in pedidos:
            if not pedido.seguimiento_historial:
                continue
            
            history_changed = False
            # Itera el historial en orden inverso para encontrar la notificación más
            # reciente primero y procesarla.
            for entry in reversed(pedido.seguimiento_historial):
                if entry.get('notified_to_client') is False:
                    # Encontramos una notificación no leída
                    notifications.append({
                        'title': f"Actualización de tu Pedido #{pedido.id[:8]}...",
                        'message': entry.get('notas', 'Tu pedido ha sido actualizado.'),
                        'status': entry.get('estado', 'recibido'),
                        'order_id': str(pedido.id)
                    })
                    # Marca la notificación como "leída" para que no se envíe de nuevo.
                    entry['notified_to_client'] = True
                    history_changed = True
                    # Se rompe el bucle para mostrar solo la notificación más reciente de este pedido.
                    # Las más antiguas (si las hubiera) se mostrarán en la siguiente llamada a la API.
                    break
            
            if history_changed:
                # --- Persistencia de Cambios en JSON ---
                # `flag_modified` es crucial para notificar a SQLAlchemy que el campo JSON
                # `seguimiento_historial` ha sido modificado internamente y debe ser actualizado en la BD.
                flag_modified(pedido, "seguimiento_historial")

        if notifications:
            # Guarda los cambios en la base de datos (marcar como leídas).
            db.session.commit()
            # Devuelve solo la notificación más reciente encontrada para no abrumar al usuario.
            return jsonify({'success': True, 'notifications': [notifications[0]]})
        else:
            # No se encontraron notificaciones nuevas.
            return jsonify({'success': True, 'notifications': []})

    except Exception as e:
        current_app.logger.error(f"Error al comprobar notificaciones para el usuario {usuario.id}: {e}", exc_info=True)
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Error al buscar notificaciones'}), 500