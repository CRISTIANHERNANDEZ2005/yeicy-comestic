"""
Módulo de Fábrica de la Aplicación Flask (Application Factory).

Este archivo es el corazón de la aplicación. Contiene la función `create_app`,
que sigue el patrón de diseño "Application Factory". Este patrón es una buena
práctica en Flask para crear instancias de la aplicación con diferentes
configuraciones, lo que facilita las pruebas y la escalabilidad.

Responsabilidades principales:
- Crear y configurar la instancia principal de la aplicación Flask.
- Inicializar todas las extensiones de Flask (SQLAlchemy, Bcrypt, Migrate, LoginManager, JWT).
- Configurar servicios de terceros como Cloudinary.
- Establecer un sistema de logging profesional.
- Registrar todos los Blueprints que organizan la lógica de la aplicación (cliente y admin).
- Definir procesadores de contexto (`context_processor`) para inyectar datos globales
  en las plantillas Jinja2 (ej. datos del carrito, categorías, estado de autenticación).
- Configurar manejadores de peticiones (`before_request`) para tareas que se ejecutan
  antes de cada solicitud, como la restauración de sesiones.
- Definir manejadores de errores personalizados (ej. para errores 404).
- Registrar filtros personalizados de Jinja2 para formateo de datos en las plantillas.
"""
from flask import Flask, render_template, session, request
import cloudinary
from config import Config
from .extensions import db, bcrypt, migrate, login_manager, jwt
from .models.domains.user_models import Usuarios, Admins
from .models.domains.order_models import Pedido, PedidoProducto
from .models.enums import EstadoPedido, EstadoEnum
from app.blueprints.cliente.auth import perfil
from app.utils.jwt_utils import jwt_required, decode_jwt_token
from app.utils.admin_jwt_utils import decode_admin_jwt_token
from datetime import datetime
import pytz
from sqlalchemy import func, not_, and_
from app.models.serializers import format_currency_cop

def create_app(config_class=Config):
    """
    Crea y configura una instancia de la aplicación Flask.

    Este es el punto de entrada principal que sigue el patrón de fábrica de aplicaciones.
    Permite crear la aplicación con una configuración específica, lo que es ideal para
    diferentes entornos (desarrollo, producción, pruebas).

    Args:
        config_class (object): La clase de configuración a utilizar. Por defecto,
                               utiliza la clase `Config` del módulo `config`.

    Returns:
        Flask: La instancia de la aplicación Flask configurada y lista para ejecutarse.
    """
    app = Flask(__name__)
    app.jinja_env.add_extension('jinja2.ext.do')
    app.config.from_object(config_class)

    # --- CONFIGURACIÓN DE CLOUDINARY ---
    # La librería de Cloudinary leerá automáticamente la variable de entorno CLOUDINARY_URL.
    cloudinary.config(secure=True)
    app.logger.info('Cloudinary configurado profesionalmente.')

    # --- LOGGING PROFESIONAL ---
    import logging
    formatter = logging.Formatter('[%(asctime)s] %(levelname)s in %(module)s: %(message)s')
    # Solo se registra en la consola en producción/serverless (Vercel no permite escribir archivos).
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.DEBUG)
    app.logger.addHandler(console_handler)
    app.logger.setLevel(logging.DEBUG)
    app.logger.info('Logging profesional inicializado (solo consola)')
    # --- CONFIGURACIÓN DE BASE DE DATOS ---
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

    # --- INICIALIZACIÓN DE EXTENSIONES ---
    db.init_app(app)
    bcrypt.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)

    # Inicializa Flask-JWT-Extended para la gestión de tokens JWT.
    jwt.init_app(app)

    # Configuración de login_manager después de asociar la app
    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Por favor inicia sesión para acceder a esta página.'
    login_manager.login_message_category = 'info'

    @login_manager.user_loader
    def load_user(id):
        """
        Función de callback requerida por Flask-Login para cargar un usuario desde la sesión.
        Dado un ID de usuario, devuelve el objeto de usuario correspondiente.
        """
        return Usuarios.query.get(id)

    # --- PROCESADORES DE CONTEXTO Y MANEJADORES DE PETICIONES ---
    @app.context_processor
    def inject_admin_user():
        """
        Procesador de contexto para inyectar el objeto `admin_user` en todas las plantillas.

        Intenta decodificar el token JWT de administrador desde las cookies. Si es válido,
        recupera el administrador de la base de datos y lo hace disponible globalmente
        en el contexto de las plantillas Jinja2. Esto es útil para la barra de navegación
        del panel de administración y otros elementos comunes de la UI.
        """
        admin_user = None
        token = request.cookies.get('admin_jwt')
        if token:
            payload = decode_admin_jwt_token(token)
            if payload and 'user_id' in payload:
                admin_user = Admins.query.get(payload['user_id'])
        return dict(admin_user=admin_user)

    @app.before_request
    def before_request_tasks(): # pragma: no cover
        """
        Middleware que se ejecuta antes de cada petición para realizar tareas globales.

        1. **Restauración de Sesión de Cliente**: Llama a `restore_session_from_jwt` para
           intentar restaurar la sesión del cliente desde un token JWT en las cookies.
        2. **Asignación a `g`**: Asigna el usuario cliente (`g.user`) y el administrador
           (`g.admin_user`) al objeto global `g` de Flask si se encuentran tokens válidos.
           El objeto `g` persiste durante el ciclo de vida de una única petición.
        3. **Actualización de `last_seen` del Admin**: Actualiza el timestamp `last_seen` del
           administrador en cada petición para mantener un seguimiento preciso de su actividad.
        """
        from flask import g
        from datetime import datetime, timezone
        from .blueprints.cliente.auth import restore_session_from_jwt
        
        # 1. Restaurar sesión de cliente y asignar a g.user si existe
        # La actualización de last_seen se maneja ahora en el login y en la restauración de sesión.
        restore_session_from_jwt()
        
        # 2. Asignar admin a g.admin_user si está autenticado
        # La actualización de last_seen se maneja en el login del admin.
        client_token = request.cookies.get('token')
        if client_token:
            payload = decode_jwt_token(client_token)
            if payload and 'user_id' in payload:
                user = Usuarios.query.get(payload['user_id'])
                if user:
                    g.user = user
        
        admin_token = request.cookies.get('admin_jwt')
        if admin_token:
            payload = decode_admin_jwt_token(admin_token)
            if payload and 'user_id' in payload:
                admin = Admins.query.get(payload['user_id'])
                if admin:
                    g.admin_user = admin
                    # Actualizar last_seen en cada petición del admin.
                    # Esto asegura que el estado "En línea" sea preciso y en tiempo real.
                    admin.last_seen = datetime.now(timezone.utc)
                    db.session.commit()

    # --- REGISTRO DE BLUEPRINTS ---
    from app.blueprints.cliente.auth import auth_bp
    from app.blueprints.cliente.products import products_bp
    from app.blueprints.cliente.cart import cart_bp
    from app.blueprints.cliente.favorites import favorites_bp
    from app.blueprints.cliente.reviews import reviews_bp
    from app.blueprints.cliente.order import order_bp
    from app.blueprints.cliente.events import events_bp

    # Registrar blueprints admin
    from app.blueprints.admin.auth_admin import admin_auth_bp
    from app.blueprints.admin.dashboard import admin_dashboard_bp
    from app.blueprints.admin.product.lista_product import admin_lista_product_bp
    from app.blueprints.admin.product.detalle_product import admin_detalle_product_bp
    from app.blueprints.admin.product.crear_product import admin_crear_product_bp
    from app.blueprints.admin.product.editar_product import admin_editar_product_bp
    from app.blueprints.admin.categoria.lista_categorias import admin_lista_categorias_bp
    from app.blueprints.admin.categoria.categoria_detalle import admin_categoria_detalle_bp
    from app.blueprints.admin.pedido.lista_pedidos import admin_lista_pedidos_bp
    from app.blueprints.admin.pedido.api import admin_api_bp
    from app.blueprints.admin.venta.lista_venta import admin_ventas_bp
    from app.blueprints.admin.usuarios.user_routes import user_bp
    from app.blueprints.admin.usuarios.detalle_usuario import detalle_cliente
    
    # Blueprints del cliente
    app.register_blueprint(cart_bp)
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(products_bp)
    app.register_blueprint(favorites_bp)
    app.register_blueprint(reviews_bp)
    app.register_blueprint(order_bp)
    app.register_blueprint(events_bp)

    # Blueprints del administrador
    app.register_blueprint(admin_auth_bp)
    app.register_blueprint(admin_dashboard_bp)
    app.register_blueprint(admin_lista_product_bp)
    app.register_blueprint(admin_detalle_product_bp)
    app.register_blueprint(admin_crear_product_bp)
    app.register_blueprint(admin_editar_product_bp)
    app.register_blueprint(admin_lista_categorias_bp)
    app.register_blueprint(admin_categoria_detalle_bp)
    app.register_blueprint(admin_lista_pedidos_bp, url_prefix='/admin')
    app.register_blueprint(admin_ventas_bp, url_prefix='/admin')
    app.register_blueprint(admin_api_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(detalle_cliente)


    # --- RUTAS PRINCIPALES DE LA APLICACIÓN ---
    @app.route('/perfil')
    @jwt_required
    def root_perfil(usuario):
        """
        Renderiza la página de perfil del usuario autenticado.

        Esta ruta, definida en el nivel principal de la aplicación, calcula estadísticas
        clave del usuario, como el número de pedidos realizados y el total gastado en
        compras completadas. Luego, delega la renderización de la plantilla a la
        función `perfil` del blueprint de autenticación.

        Args:
            usuario (Usuarios): El objeto de usuario inyectado por el decorador `@jwt_required`.
        """
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

    # --- VERIFICACIÓN DE CONEXIÓN Y PROCESADORES DE CONTEXTO ADICIONALES ---
    with app.app_context():
        try:
            db.engine.connect()
            print("✅ Conexión a la base de datos establecida correctamente")
        except Exception as e:
            print(f"❌ Error al conectar a la base de datos: {e}")

    # Context processor para el carrito y categorías
    @app.context_processor
    def inject_global_data():
        """
        Procesador de contexto para inyectar datos globales en todas las plantillas del cliente.

        Esta función se ejecuta antes de renderizar cualquier plantilla y hace que los
        siguientes datos estén disponibles globalmente:
        - `cart_items`, `total_price`: Para mostrar el estado del carrito en tiempo real.
        - `categorias`, `categorias_principales`: Para construir menús de navegación dinámicos.
        - `total_favoritos`: Para el contador de la lista de deseos.
        - `usuario_autenticado`: Un booleano para cambiar la UI según el estado de sesión.
        - `now`: La fecha y hora actual para comparaciones en las plantillas.
        """
        from app.models.serializers import categoria_principal_to_dict
        from app.blueprints.cliente.cart import get_or_create_cart, get_cart_items
        from app.models.domains.product_models import Productos, CategoriasPrincipales, Subcategorias, Seudocategorias
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
        #  La verificación ahora es más robusta.
        # Comprueba si el diccionario 'user' existe en la sesión y si tiene una clave 'id'.
        # Esto se alinea con cómo se establece la sesión en auth.py.
        usuario_autenticado = 'user' in session and 'id' in session['user']
        total_favoritos = 0
        if usuario_autenticado:
            total_favoritos = Likes.query.join(Productos).filter(
                Likes.usuario_id == session['user']['id'],
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

    # --- FILTROS PERSONALIZADOS DE JINJA2 ---
    def slugify_filter(s):
        """
        Filtro Jinja2 para convertir una cadena en un 'slug' amigable para URLs.
        Ejemplo: "Mi Producto" -> "mi-producto".
        """
        return s.lower().replace(" ", "-").replace("_", "-")
    app.jinja_env.filters['slugify'] = slugify_filter

    def format_date_filter(value):
        """
        Filtro Jinja2 para formatear una fecha (objeto datetime o cadena ISO)
        en el formato 'dd/mm/YYYY'.
        """
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

    # Diccionario para los nombres de los meses en español.
    SPANISH_MONTHS = {
        1: "enero", 2: "febrero", 3: "marzo", 4: "abril",
        5: "mayo", 6: "junio", 7: "julio", 8: "agosto",
        9: "septiembre", 10: "octubre", 11: "noviembre", 12: "diciembre"
    }

    def datetimeformat_filter(value, format='%Y-%m-%d %H:%M:%S'):
        """
        Filtro Jinja2 avanzado para formatear fechas y horas.

        - Convierte cadenas ISO a objetos datetime.
        - Convierte la fecha/hora a la zona horaria de Colombia (America/Bogota).
        - Reemplaza los especificadores de formato de mes (como %B) por el nombre
          del mes en español.
        """
        if value is None:
            return ""

        # Si el valor es una cadena, intenta convertirlo en un objeto datetime.
        if isinstance(value, str):
            try:
                # Maneja el formato ISO con o sin 'Z' para UTC.
                if value.endswith('Z'):
                    value = value[:-1] + '+00:00'
                value = datetime.fromisoformat(value)
            except ValueError:
                # Si la conversión falla, devuelve la cadena original.
                return value
        
        # Asegura que el objeto datetime sea consciente de la zona horaria (asumiendo UTC si es 'naive').
        if value.tzinfo is None:
            value = pytz.utc.localize(value)

        # Convierte a la hora de Colombia (America/Bogota).
        colombia_tz = pytz.timezone('America/Bogota')
        colombian_time = value.astimezone(colombia_tz)

        # Obtiene el nombre del mes en español.
        spanish_month_name = SPANISH_MONTHS[colombian_time.month]

        # Reemplaza la directiva %B con el nombre del mes en español.
        temp_format = format.replace('%B', '___SPANISH_MONTH___')
        formatted_string_with_placeholder = colombian_time.strftime(temp_format)
        final_formatted_string = formatted_string_with_placeholder.replace('___SPANISH_MONTH___', spanish_month_name)
        return final_formatted_string
    app.jinja_env.filters['datetimeformat'] = datetimeformat_filter
    
    app.jinja_env.filters['format_currency_cop'] = format_currency_cop

    # --- MANEJADOR DE ERRORES ---
    @app.errorhandler(404)
    def page_not_found(e):
        """
        Manejador de errores global para el código de estado 404 (Página no encontrada).
        Renderiza una plantilla personalizada en lugar de la página de error por defecto.
        """
        return render_template('cliente/componentes/404.html'), 404

    return app
