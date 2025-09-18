# app/__init__.py
from flask import Flask, render_template, session, request
from config import Config
from .extensions import db, bcrypt, migrate, login_manager, jwt
from .models.domains.user_models import Usuarios, Admins
from .models.domains.order_models import Pedido, PedidoProducto
from .models.enums import EstadoPedido, EstadoEnum
from app.models.serializers import categoria_principal_to_dict, format_currency_cop
from app.blueprints.cliente.auth import perfil
from app.utils.jwt_utils import jwt_required
from app.utils.admin_jwt_utils import decode_admin_jwt_token
from datetime import datetime
import pytz
from sqlalchemy import func, not_, and_

def create_app(config_class=Config):
    app = Flask(__name__)
    app.jinja_env.add_extension('jinja2.ext.do')
    app.config.from_object(config_class)

    # --- LOGGING PROFESIONAL ---
    import logging
    formatter = logging.Formatter('[%(asctime)s] %(levelname)s in %(module)s: %(message)s')
    # Solo log a consola en producción/serverless (Vercel no permite escribir archivos)
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.DEBUG)
    app.logger.addHandler(console_handler)
    app.logger.setLevel(logging.DEBUG)
    app.logger.info('Logging profesional inicializado (solo consola)')

    # Configuración adicional para SQLAlchemy
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,
        'pool_recycle': 3600,
        'pool_timeout': 30,
        'max_overflow': 10,
        'connect_args': {
            'sslmode': 'require'
        }
    }

    # Inicializar extensiones
    db.init_app(app)
    bcrypt.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    jwt.init_app(app)

    # Configuración de login_manager después de asociar la app
    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Por favor inicia sesión para acceder a esta página.'
    login_manager.login_message_category = 'info'

    @login_manager.user_loader
    def load_user(id):
        return Usuarios.query.get(id)

    # Context processor to make admin_user available in all templates
    @app.context_processor
    def inject_admin_user():
        admin_user = None
        token = request.cookies.get('admin_jwt')
        if token:
            payload = decode_admin_jwt_token(token)
            if payload and 'user_id' in payload:
                admin_user = Admins.query.get(payload['user_id'])
        return dict(admin_user=admin_user)

    # Registrar blueprints cliente
    from app.blueprints.cliente.auth import auth_bp
    from app.blueprints.cliente.products import products_bp
    from app.blueprints.cliente.cart import cart_bp
    from app.blueprints.cliente.favorites import favorites_bp
    from app.blueprints.cliente.reviews import reviews_bp
    from app.blueprints.cliente.order import order_bp
    
    # Registrar blueprints admin
    from app.blueprints.admin.auth import admin_auth_bp
    from app.blueprints.admin.dashboard import admin_dashboard_bp
    from app.blueprints.admin.product.lista_product import admin_lista_product_bp
    from app.blueprints.admin.product.detalle_product import admin_detalle_product_bp
    from app.blueprints.admin.product.crear_product import admin_crear_product_bp
    from app.blueprints.admin.product.editar_product import admin_editar_product_bp
    from app.blueprints.admin.categoria.lista_categorias import admin_lista_categorias_bp
    from app.blueprints.admin.pedido.lista_pedidos import admin_lista_pedidos_bp
    from app.blueprints.admin.pedido.api import admin_api_bp
    from app.blueprints.admin.venta.lista_venta import admin_ventas_bp

    #cliente
    app.register_blueprint(cart_bp)
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(products_bp)
    app.register_blueprint(favorites_bp)
    app.register_blueprint(reviews_bp)
    app.register_blueprint(order_bp)
    
    # admin
    app.register_blueprint(admin_auth_bp)
    app.register_blueprint(admin_dashboard_bp)
    app.register_blueprint(admin_lista_product_bp)
    app.register_blueprint(admin_detalle_product_bp)
    app.register_blueprint(admin_crear_product_bp)
    app.register_blueprint(admin_editar_product_bp)
    app.register_blueprint(admin_lista_categorias_bp)
    app.register_blueprint(admin_lista_pedidos_bp, url_prefix='/admin')
    app.register_blueprint(admin_ventas_bp, url_prefix='/admin')
    app.register_blueprint(admin_api_bp)


    # Register the /perfil route directly with the app
    @app.route('/perfil')
    @jwt_required
    def root_perfil(usuario):
        # Contar todos los pedidos excepto aquellos 'en proceso' que están 'inactivos'.
        # Esto incluye:
        # - Pedidos 'en proceso' y 'activos'.
        # - Todos los pedidos 'completados' (activos e inactivos).
        # - Todos los pedidos 'cancelados' (activos e inactivos).
        pedidos_realizados = Pedido.query.filter(
            Pedido.usuario_id == usuario.id,
            not_(
                and_(
                    Pedido.estado_pedido == EstadoPedido.EN_PROCESO.value,
                    Pedido.estado == 'inactivo'
                )
            )
        ).count()

        # El total de compras debe sumar todos los pedidos 'completados', sin importar si están activos o inactivos.
        total_compras_valor = db.session.query(func.sum(Pedido.total)).filter(
            Pedido.usuario_id == usuario.id,
            Pedido.estado_pedido == EstadoPedido.COMPLETADO.value
        ).scalar() or 0

        total_compras_formateado = format_currency_cop(total_compras_valor)
        
        return perfil(usuario, pedidos_realizados=pedidos_realizados, total_compras=total_compras_formateado)

    # Verificar conexión a la base de datos al iniciar
    with app.app_context():
        try:
            db.engine.connect()
            print("✅ Conexión a la base de datos establecida correctamente")
        except Exception as e:
            print(f"❌ Error al conectar a la base de datos: {e}")

    # Context processor para el carrito y categorías
    @app.context_processor
    def inject_global_data():
        from app.blueprints.cliente.cart import get_or_create_cart, get_cart_items
        from app.models.domains.product_models import CategoriasPrincipales, Subcategorias, Seudocategorias
        from sqlalchemy.orm import joinedload
        
        # Datos del carrito
        cart_info = get_or_create_cart()
        items = get_cart_items(cart_info)
        total_items = sum(item['quantity'] for item in items)
        total_price = sum(item['subtotal'] for item in items)
        
        # Obtener las 7 categorías más antiguas y activas
        categorias_obj = CategoriasPrincipales.query\
            .filter(CategoriasPrincipales.estado == 'activo')\
            .order_by(CategoriasPrincipales.created_at.asc())\
            .limit(7)\
            .options(\
                joinedload(CategoriasPrincipales.subcategorias.and_(Subcategorias.estado == 'activo'))\
                .joinedload(Subcategorias.seudocategorias.and_(Seudocategorias.estado == 'activo'))\
            )\
            .all()
        
        # Convertir objetos SQLAlchemy a diccionarios para una serialización JSON consistente
        categorias_data = [categoria_principal_to_dict(c) for c in categorias_obj]

        # Exponer favoritos y autenticación global
        from flask import session
        from app.models.domains.review_models import Likes
        usuario_autenticado = 'user_id' in session
        total_favoritos = 0
        if usuario_autenticado:
            total_favoritos = Likes.query.join(Productos).filter(
                Likes.usuario_id == session['user_id'],
                Likes.estado == 'activo',
                Productos.estado == 'activo'
            ).count()
        return {
            'cart_items': items,
            'total_price': total_price,
            'categorias': categorias_data,
            'categorias_principales': categorias_obj,
            'total_favoritos': total_favoritos,
            'usuario_autenticado': usuario_autenticado,
            'now': datetime.utcnow()
        }

    # Custom Jinja2 filters
    def slugify_filter(s):
        return s.lower().replace(" ", "-").replace("_", "-")
    app.jinja_env.filters['slugify'] = slugify_filter

    def format_date_filter(value):
        if value is None:
            return ""
        if isinstance(value, str):
            # Try to parse ISO format string
            if value.endswith('Z'):
                value = value[:-1] + '+00:00'
            try:
                value = datetime.fromisoformat(value)
            except ValueError:
                return value # Return original string if parsing fails
        if isinstance(value, datetime):
            return value.strftime('%d/%m/%Y')
        return value

    app.jinja_env.filters['format_date'] = format_date_filter

    # Dictionary for Spanish month names
    SPANISH_MONTHS = {
        1: "enero", 2: "febrero", 3: "marzo", 4: "abril",
        5: "mayo", 6: "junio", 7: "julio", 8: "agosto",
        9: "septiembre", 10: "octubre", 11: "noviembre", 12: "diciembre"
    }

    def datetimeformat_filter(value, format='%Y-%m-%d %H:%M:%S'):
        if value is None:
            return ""

        # If value is a string, attempt to parse it into a datetime object
        if isinstance(value, str):
            try:
                # Handle ISO format with or without 'Z' for UTC
                if value.endswith('Z'):
                    value = value[:-1] + '+00:00'
                value = datetime.fromisoformat(value)
            except ValueError:
                # If parsing fails, return the original string or an empty string
                return value # Or ""
        
        # Ensure the datetime object is timezone-aware (assuming UTC if naive)
        if value.tzinfo is None:
            value = pytz.utc.localize(value)
        
        # Convert to Colombian time (America/Bogota)
        colombia_tz = pytz.timezone('America/Bogota')
        colombian_time = value.astimezone(colombia_tz)

        # Get the month name in Spanish
        spanish_month_name = SPANISH_MONTHS[colombian_time.month]

        # Replace the %B directive with the Spanish month name
        temp_format = format.replace('%B', '___SPANISH_MONTH___')
        formatted_string_with_placeholder = colombian_time.strftime(temp_format)
        final_formatted_string = formatted_string_with_placeholder.replace('___SPANISH_MONTH___', spanish_month_name)
        return final_formatted_string
    app.jinja_env.filters['datetimeformat'] = datetimeformat_filter

    # Manejador de errores 404
    @app.errorhandler(404)
    def page_not_found(e):
        return render_template('cliente/componentes/404.html'), 404

    return app
