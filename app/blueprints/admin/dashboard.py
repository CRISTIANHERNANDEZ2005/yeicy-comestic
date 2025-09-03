from flask import Blueprint, render_template
from app.utils.admin_jwt_utils import admin_jwt_required
from app.models.domains.product_models import Productos
from app.extensions import db
from sqlalchemy import func, or_

admin_dashboard_bp = Blueprint('admin_dashboard_bp', __name__)

@admin_dashboard_bp.route('/admin/dashboard')
@admin_jwt_required
def dashboard(admin_user): # admin_user will be passed by the decorator
    # Realizar consultas para obtener estadísticas de productos
    total_productos = Productos.query.count()
    total_unidades_en_stock = db.session.query(func.sum(Productos._existencia)).scalar() or 0
    sin_stock = Productos.query.filter(Productos._existencia == 0).count()
    stock_bajo = Productos.query.filter(Productos._existencia > 0, Productos._existencia < Productos.stock_minimo).count()

    # Crear un diccionario con las estadísticas
    stats = {
        'total_productos': total_productos,
        'en_stock': total_unidades_en_stock,
        'sin_stock': sin_stock,
        'stock_bajo': stock_bajo
    }

    # --- Lógica para Tareas Pendientes ---
    productos_para_revisar = Productos.query.filter(
        or_(
            Productos._existencia == 0,
            Productos._existencia < Productos.stock_minimo
        )
    ).order_by(Productos._existencia.asc()).all()

    tasks = []
    for producto in productos_para_revisar:
        reason = "Agotado" if producto.existencia == 0 else "Bajo Stock"
        tasks.append({
            'id': producto.id,
            'nombre': producto.nombre,
            'existencia': producto.existencia,
            'stock_minimo': producto.stock_minimo,
            'reason': reason
        })
    # ------------------------------------

    return render_template('admin/componentes/dashboard.html', admin_user=admin_user, stats=stats, tasks=tasks)