from flask import Blueprint, render_template
from app.utils.admin_jwt_utils import admin_jwt_required

admin_dashboard_bp = Blueprint('admin_dashboard_bp', __name__)

@admin_dashboard_bp.route('/admin/dashboard')
@admin_jwt_required
def dashboard(admin_user): # admin_user will be passed by the decorator
    return render_template('admin/componentes/dashboard.html', admin_user=admin_user)