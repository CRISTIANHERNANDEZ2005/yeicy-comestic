from flask import Blueprint, render_template
from app.utils.admin_jwt_utils import admin_jwt_required
from app.models.domains.product_models import Productos
from app.extensions import db
from sqlalchemy import func

admin_dashboard_bp = Blueprint('admin_dashboard_bp', __name__)

@admin_dashboard_bp.route('/admin/dashboard')
@admin_jwt_required
def dashboard(admin_user): # admin_user will be passed by the decorator
    # Realizar consultas para obtener estadísticas de productos
    total_productos = Productos.query.count()
    total_unidades_en_stock = db.session.query(func.sum(Productos.existencia)).scalar() or 0
    sin_stock = Productos.query.filter(Productos.existencia == 0).count()
    stock_bajo = Productos.query.filter(Productos.existencia > 0, Productos.existencia <= Productos.stock_minimo).count()

    # Crear un diccionario con las estadísticas
    stats = {
        'total_productos': total_productos,
        'en_stock': total_unidades_en_stock,
        'sin_stock': sin_stock,
        'stock_bajo': stock_bajo
    }
    return render_template('admin/componentes/dashboard.html', admin_user=admin_user, stats=stats)