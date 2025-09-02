# script_registrar_admin.py
from app import create_app, db

app = create_app()

with app.app_context():
    admin = Admin(
        cedula="12345678",
        nombre="Admin",
        apellido="Principal",
        numero_telefono="9876543210",
        contraseña="admin123456"
    )
    db.session.add(admin)
    db.session.commit()
    print("Admin creado con éxito")