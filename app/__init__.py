# app/__init__.py
from flask import Flask, render_template, session, request
from config import Config
from .extensions import db, bcrypt, migrate, login_manager, jwt
from .models.domains.user_models import Usuarios, Admins
from app.models.serializers import categoria_principal_to_dict
from app.blueprints.cliente.auth import perfil
from app.utils.jwt_utils import jwt_required
from app.utils.admin_jwt_utils import decode_admin_jwt_token
from datetime import datetime
import pytz

def create_app(config_class=Config):
    app = Flask(__name__)
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

    # Registrar blueprints
    from app.blueprints.cliente.auth import auth_bp
    from app.blueprints.cliente.products import products_bp
    from app.blueprints.cliente.cart import cart_bp
    from app.blueprints.cliente.favorites import favorites_bp
    from app.blueprints.cliente.reviews import reviews_bp
    from app.blueprints.admin.auth import admin_auth_bp
    from app.blueprints.admin.dashboard import admin_dashboard_bp
    from app.blueprints.admin.product.lista_product import admin_lista_product_bp
    from app.blueprints.admin.product.detalle_product import admin_detalle_product_bp

    app.register_blueprint(cart_bp)
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(products_bp)
    app.register_blueprint(favorites_bp)
    app.register_blueprint(reviews_bp)
    app.register_blueprint(admin_auth_bp)
    app.register_blueprint(admin_dashboard_bp)
    app.register_blueprint(admin_lista_product_bp)
    app.register_blueprint(admin_detalle_product_bp)

    # Register the /perfil route directly with the app
    @app.route('/perfil')
    @jwt_required
    def root_perfil(usuario):
        return perfil(usuario)

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
        
        # Obtener categorías activas
        categorias_obj = CategoriasPrincipales.query\
            .filter_by(estado='activo')\
            .options(
                joinedload(CategoriasPrincipales.subcategorias)
                .joinedload(Subcategorias.seudocategorias)
            )\
            .all()

        # Filtrar subcategorías y seudocategorías activas
        for categoria in categorias_obj:
            categoria.subcategorias = [
                sub for sub in categoria.subcategorias if sub.estado == 'activo']
            for subcategoria in categoria.subcategorias:
                subcategoria.seudocategorias = [
                    seudo for seudo in subcategoria.seudocategorias if seudo.estado == 'activo']
        
        # Convertir objetos SQLAlchemy a diccionarios para una serialización JSON consistente
        categorias_data = [categoria_principal_to_dict(c) for c in categorias_obj]

        # Exponer favoritos y autenticación global
        from flask import session
        from app.models.domains.review_models import Likes
        usuario_autenticado = 'user_id' in session
        total_favoritos = 0
        if usuario_autenticado:
            total_favoritos = Likes.query.filter_by(usuario_id=session['user_id'], estado='activo').count()
        return {
            'cart_items': items,
            'total_price': total_price,
            'categorias': categorias_data,
            'categorias_principales': categorias_obj,
            'total_favoritos': total_favoritos,
            'usuario_autenticado': usuario_autenticado
        }

    # Custom Jinja2 filters
    def slugify_filter(s):
        return s.lower().replace(" ", "-").replace("_", "-")
    app.jinja_env.filters['slugify'] = slugify_filter

    def datetimeformat_filter(value, format='%Y-%m-%d %H:%M:%S'):
        if value is None:
            return ""
        # Ensure the datetime object is timezone-aware (assuming UTC if naive)
        if value.tzinfo is None:
            value = pytz.utc.localize(value)
        
        # Convert to Colombian time (America/Bogota)
        colombia_tz = pytz.timezone('America/Bogota')
        colombian_time = value.astimezone(colombia_tz)
        
        return colombian_time.strftime(format)
    app.jinja_env.filters['datetimeformat'] = datetimeformat_filter

    # Manejador de errores 404
    @app.errorhandler(404)
    def page_not_found(e):
        return render_template('cliente/componentes/404.html'), 404

    return app
