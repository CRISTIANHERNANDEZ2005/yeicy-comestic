import os
from app import create_app
from config import config_by_name
from app.extensions import db
from app.models.domains.product_models import Productos
from slugify import slugify

# Configurar el entorno de Flask
flask_env = os.getenv('FLASK_ENV', 'development')
app = create_app(config_by_name[flask_env])

with app.app_context():
    print("Iniciando script para poblar slugs...")
    productos = Productos.query.all()
    for producto in productos:
        if not producto.slug:
            original_name = producto.nombre
            generated_slug = slugify(original_name)
            producto.slug = generated_slug
            print(f"Generado slug para '{original_name}': '{generated_slug}'")
        else:
            print(f"Producto '{producto.nombre}' ya tiene slug: '{producto.slug}'")
    
    try:
        db.session.commit()
        print("Slugs actualizados y cambios guardados en la base de datos.")
    except Exception as e:
        db.session.rollback()
        print(f"Error al guardar slugs: {e}")

print("Script de poblamiento de slugs finalizado.")
