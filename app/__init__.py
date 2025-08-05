# app/__init__.py
from flask import Flask, render_template
from config import Config


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

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
    from app.extensions import db, bcrypt, migrate
    db.init_app(app)
    bcrypt.init_app(app)
    migrate.init_app(app, db)

    # Registrar blueprints
    from app.blueprints.auth import auth_bp
    from app.blueprints.products import products_bp
    from app.blueprints.cart import cart_bp
    app.register_blueprint(cart_bp)
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(products_bp)

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
        from app.blueprints.cart import get_or_create_cart, get_cart_items
        from app.models.models import CategoriaPrincipal, Subcategoria, Seudocategoria
        from sqlalchemy.orm import joinedload
        
        # Datos del carrito
        cart_info, cart_session = get_or_create_cart()
        items = get_cart_items(cart_info)
        total_items = sum(item['quantity'] for item in items)
        total_price = sum(item['subtotal'] for item in items)
        
        # Obtener categorías activas
        categorias = CategoriaPrincipal.query\
            .filter_by(estado='activo')\
            .options(
                joinedload(CategoriaPrincipal.subcategorias)
                .joinedload(Subcategoria.seudocategorias)
            )\
            .all()

        # Filtrar subcategorías y seudocategorías activas
        for categoria in categorias:
            categoria.subcategorias = [
                sub for sub in categoria.subcategorias if sub.estado == 'activo']
            for subcategoria in categoria.subcategorias:
                subcategoria.seudocategorias = [
                    seudo for seudo in subcategoria.seudocategorias if seudo.estado == 'activo']
        
        return {
            'cart_items': items,
            'total_price': total_price,
            'categorias': categorias
        }

    # Manejador de errores 404
    @app.errorhandler(404)
    def page_not_found(e):
        return render_template('cliente/page/404.html'), 404

    return app
